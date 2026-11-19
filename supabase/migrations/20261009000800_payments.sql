-- =====================================================================
-- Payment quotes, manual payment submission, admin verification,
-- automated provider events, allocation to obligations, refunds,
-- order cancellation and seller payouts.
-- =====================================================================

create or replace function public._outstanding(p_ob public.payment_obligations) returns numeric
language sql immutable as $$ select p_ob.amount_usd - p_ob.paid_usd - p_ob.waived_usd; $$;

-- recompute obligation statuses + order payment fields from the source of truth (obligations, refunds)
create or replace function public._recompute_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_paid numeric;
  v_refund_due numeric;
  v_total numeric;
  v_refunded numeric;
begin
  update public.payment_obligations
     set status = case
       when status = 'cancelled' then 'cancelled'
       when paid_usd + waived_usd >= amount_usd then 'paid'
       when paid_usd > 0 then 'partially_paid'
       else 'pending' end::public.obligation_status
   where order_id = p_order_id;

  select coalesce(sum(usd_recognized), 0) into v_paid from public.payments where order_id = p_order_id and status = 'confirmed';
  v_paid := v_paid - coalesce((select sum(amount_usd) from public.buyer_refund_payouts where order_id = p_order_id), 0);
  select -coalesce(sum(amount_usd), 0) into v_refund_due from public.ledger_entries
   where order_id = p_order_id and account = 'buyer_refund_payable';
  select total_usd, refunded_usd into v_total, v_refunded from public.orders where id = p_order_id;

  update public.orders set
    paid_usd = greatest(v_paid, 0),
    payment_status = case
      when v_refund_due > 0 then 'refund_due'
      when v_total = 0 and v_refunded > 0 then 'refunded'
      when v_paid >= v_total and v_total > 0 then 'paid'
      when v_paid > 0 then 'partially_paid'
      else 'unpaid' end::public.order_payment_status
   where id = p_order_id;
end $$;
revoke execute on function public._recompute_order(uuid) from public, anon, authenticated;

create or replace function public._order_payment_level(p_order_id uuid) returns text
language sql stable security definer set search_path = public as $$
  -- 'full' when everything owed is covered, 'down_payment' when the first obligation is covered, else 'none'
  select case
    when (select paid_usd >= total_usd from public.orders where id = p_order_id) then 'full'
    when exists (select 1 from public.payment_obligations where order_id = p_order_id and seq = 1 and status = 'paid') then 'down_payment'
    else 'none' end;
$$;

-- ---------- quotes ----------
create or replace function public.create_payment_quote(p_order_id uuid, p_method_code text, p_obligation_ids uuid[] default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := public.require_user();
  v_order public.orders;
  v_method public.payment_methods;
  v_obs uuid[];
  v_first_seq int;
  v_base numeric;
  v_fee numeric;
  v_rate record;
  v_quote public.payment_quotes;
begin
  perform public.check_rate_limit('quote', 30, 600);
  select * into v_order from public.orders where id = p_order_id and buyer_id = v_user;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if v_order.status = 'cancelled' then raise exception 'order cancelled' using errcode = 'P0001', hint = 'order_cancelled'; end if;

  select * into v_method from public.payment_methods where code = p_method_code and enabled;
  if not found then raise exception 'payment method unavailable' using errcode = 'P0001', hint = 'method_unavailable'; end if;
  if v_method.kind = 'automated' and v_method.integration_status not in ('live', 'sandbox') then
    raise exception 'payment method not configured' using errcode = 'P0001', hint = 'method_unavailable';
  end if;

  if exists (
    select 1 from public.payments p join public.payment_quotes q on q.id = p.quote_id
     where p.order_id = p_order_id and p.status in ('pending_verification', 'processing')
       and (p_obligation_ids is null or q.obligation_ids && p_obligation_ids)
  ) then
    raise exception 'a payment for this amount is being verified' using errcode = 'P0001', hint = 'payment_pending_verification';
  end if;

  select min(seq) into v_first_seq from public.payment_obligations o
   where o.order_id = p_order_id and o.status in ('pending', 'partially_paid');
  if v_first_seq is null then raise exception 'nothing to pay' using errcode = 'P0001', hint = 'nothing_due'; end if;

  if p_obligation_ids is null or cardinality(p_obligation_ids) = 0 then
    select array_agg(id) into v_obs from public.payment_obligations where order_id = p_order_id and seq = v_first_seq;
  else
    select array_agg(id order by seq) into v_obs from public.payment_obligations
     where order_id = p_order_id and id = any (p_obligation_ids) and status in ('pending', 'partially_paid');
    if v_obs is null or cardinality(v_obs) <> cardinality(p_obligation_ids) then
      raise exception 'invalid obligations' using errcode = 'P0001', hint = 'obligations_invalid';
    end if;
    -- installments are paid in order: the earliest outstanding one must be included
    if not exists (select 1 from public.payment_obligations where id = any (v_obs) and seq = v_first_seq) then
      raise exception 'pay the earliest installment first' using errcode = 'P0001', hint = 'obligations_order';
    end if;
  end if;

  select sum(public._outstanding(o)) into v_base from public.payment_obligations o where o.id = any (v_obs);
  if v_base < v_method.min_usd or (v_method.max_usd is not null and v_base > v_method.max_usd) then
    raise exception 'amount outside method limits' using errcode = 'P0001', hint = 'method_limits';
  end if;
  v_fee := round(v_base * v_method.fee_pct / 100 + v_method.fee_fixed_usd, 2);

  select * into v_rate from public.current_rate('USD/' || v_method.currency); -- raises rate_unavailable when stale

  update public.payment_quotes set status = 'cancelled' where order_id = p_order_id and buyer_id = v_user and status = 'open';

  insert into public.payment_quotes (buyer_id, order_id, method_code, obligation_ids, base_usd, fee_usd, currency, rate_pair,
                                     rate_base, rate_applied, rate_source, rate_observed_at, amount_due, expires_at)
  values (v_user, p_order_id, p_method_code, v_obs, v_base, v_fee, v_method.currency, 'USD/' || v_method.currency,
          v_rate.rate_base, v_rate.rate_applied, v_rate.source_code, v_rate.observed_at,
          round((v_base + v_fee) * v_rate.rate_applied, 2), now() + make_interval(mins => v_method.quote_ttl_minutes))
  returning * into v_quote;

  return to_jsonb(v_quote) || jsonb_build_object(
    'method', jsonb_build_object('code', v_method.code, 'name', v_method.name, 'kind', v_method.kind, 'rail', v_method.rail,
      'requires_reference', v_method.requires_reference, 'requires_proof', v_method.requires_proof,
      'instructions', v_method.instructions, 'integration_status', v_method.integration_status));
end $$;

-- ---------- manual payment submission ----------
create or replace function public.submit_payment(
  p_quote_id uuid, p_reference text, p_proof_path text, p_payer jsonb, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := public.require_user();
  v_existing public.payments;
  v_quote public.payment_quotes;
  v_method public.payment_methods;
  v_ref text := nullif(trim(p_reference), '');
  v_norm text;
  v_payment public.payments;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception 'idempotency key required' using errcode = '22023', hint = 'idempotency_required';
  end if;
  select * into v_existing from public.payments where buyer_id = v_user and idempotency_key = p_idempotency_key;
  if found then return to_jsonb(v_existing) || jsonb_build_object('replayed', true); end if;

  perform public.check_rate_limit('submit_payment', 10, 3600);

  select * into v_quote from public.payment_quotes where id = p_quote_id and buyer_id = v_user for update;
  if not found then raise exception 'quote not found' using errcode = 'P0002'; end if;
  if v_quote.status <> 'open' then raise exception 'quote no longer valid' using errcode = 'P0001', hint = 'quote_used'; end if;
  if v_quote.expires_at < now() then
    update public.payment_quotes set status = 'expired' where id = p_quote_id;
    -- the status change must persist even though we abort: report via return instead of raising
    return jsonb_build_object('error', 'quote_expired');
  end if;

  select * into v_method from public.payment_methods where code = v_quote.method_code;
  if v_method.kind <> 'manual' then raise exception 'use the provider flow for this method' using errcode = 'P0001', hint = 'method_automated'; end if;
  if v_method.requires_reference and (v_ref is null or char_length(v_ref) < 4) then
    raise exception 'reference required' using errcode = '22023', hint = 'reference_required';
  end if;
  if v_ref is not null and v_method.reference_pattern is not null
     and regexp_replace(v_ref, '[^A-Za-z0-9]', '', 'g') !~ v_method.reference_pattern then
    raise exception 'reference format invalid' using errcode = '22023', hint = 'reference_invalid';
  end if;
  if v_method.requires_proof and p_proof_path is null then
    raise exception 'proof required' using errcode = '22023', hint = 'proof_required';
  end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> v_user::text then
    raise exception 'invalid proof path' using errcode = '42501', hint = 'proof_invalid';
  end if;
  if exists (select 1 from public.payment_obligations where id = any (v_quote.obligation_ids) and status not in ('pending', 'partially_paid')) then
    update public.payment_quotes set status = 'cancelled' where id = p_quote_id;
    return jsonb_build_object('error', 'obligation_already_paid');
  end if;

  v_norm := case when v_ref is null then null else upper(regexp_replace(v_ref, '[^A-Za-z0-9]', '', 'g')) end;
  if v_norm is not null and exists (
    select 1 from public.payments where method_code = v_quote.method_code and reference_normalized = v_norm
       and status in ('pending_verification', 'processing', 'confirmed')
  ) then
    raise exception 'this reference was already submitted' using errcode = '23505', hint = 'duplicate_reference';
  end if;

  insert into public.payments (number, order_id, buyer_id, quote_id, method_code, currency, amount, rate_applied, base_usd, fee_usd,
                               reference, reference_normalized, proof_path, payer_name, payer_bank, payer_phone, declared_paid_at,
                               status, idempotency_key)
  values ('PG-' || nextval('public.payment_number_seq'), v_quote.order_id, v_user, v_quote.id, v_quote.method_code, v_quote.currency,
          v_quote.amount_due, v_quote.rate_applied, v_quote.base_usd, v_quote.fee_usd, v_ref, v_norm, p_proof_path,
          left(p_payer ->> 'name', 120), left(p_payer ->> 'bank', 80), left(p_payer ->> 'phone', 32),
          coalesce((p_payer ->> 'paid_at')::timestamptz, now()), 'pending_verification', p_idempotency_key)
  returning * into v_payment;

  update public.payment_quotes set status = 'used', used_at = now() where id = p_quote_id;
  perform public.notify(v_user, 'payment_received', 'Pago recibido',
    'Estamos verificando tu pago ' || v_payment.number || '. Te avisaremos al confirmarlo.',
    jsonb_build_object('order_id', v_quote.order_id, 'payment_id', v_payment.id));
  return to_jsonb(v_payment) || jsonb_build_object('replayed', false);
end $$;

-- ---------- allocation (shared by admin verification and provider webhooks) ----------
create or replace function public._apply_payment(p_payment_id uuid, p_usd numeric, p_fee numeric, p_actor_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_p public.payments;
  v_q public.payment_quotes;
  v_left numeric := p_usd;
  v_ob public.payment_obligations;
  v_take numeric;
  v_order public.orders;
  v_f record;
  v_level text;
begin
  select * into v_p from public.payments where id = p_payment_id for update;
  select * into v_q from public.payment_quotes where id = v_p.quote_id;
  select * into v_order from public.orders where id = v_p.order_id for update;

  -- quoted obligations first (in order), then any other outstanding obligations of the order
  for v_ob in
    select * from public.payment_obligations
     where order_id = v_p.order_id and status in ('pending', 'partially_paid')
     order by (id = any (v_q.obligation_ids)) desc, seq
     for update
  loop
    exit when v_left <= 0;
    v_take := least(v_left, public._outstanding(v_ob));
    if v_take > 0 then
      update public.payment_obligations set paid_usd = paid_usd + v_take where id = v_ob.id;
      insert into public.payment_allocations (payment_id, obligation_id, amount_usd) values (p_payment_id, v_ob.id, v_take);
      v_left := v_left - v_take;
    end if;
  end loop;

  update public.payments set status = 'confirmed', usd_recognized = p_usd, verified_at = now(), verified_by = auth.uid()
   where id = p_payment_id;

  perform public.ledger_post('payment_confirmed', jsonb_build_array(
    jsonb_build_object('account', 'cash_clearing', 'amount', p_usd + p_fee),
    jsonb_build_object('account', 'buyer_receivable', 'amount', -(p_usd - v_left)),
    jsonb_build_object('account', 'buyer_refund_payable', 'amount', -v_left),
    jsonb_build_object('account', 'fee_revenue', 'amount', -p_fee)
  ), v_p.order_id, p_payment_id, null, null,
     v_p.method_code || ' ' || v_p.currency || ' ' || coalesce(v_p.amount_received, v_p.amount) || ' @ ' || v_p.rate_applied || coalesce(' · ' || p_actor_note, ''));

  perform public._recompute_order(v_p.order_id);
  update public.orders set status = 'in_progress' where id = v_p.order_id and status = 'placed';

  -- "Anticipo verificado": automatically advance import fulfillments waiting on the deposit
  v_level := public._order_payment_level(v_p.order_id);
  for v_f in
    select f.id from public.fulfillments f
      join public.fulfillment_steps cur on cur.flow = f.flow and cur.code = f.status
      join public.fulfillment_steps nxt on nxt.flow = f.flow and nxt.seq = cur.seq + 1
     where f.order_id = v_p.order_id and f.flow = 'import_order' and nxt.code = 'deposit_verified'
       and (nxt.requires_payment is null or nxt.requires_payment = 'down_payment' and v_level in ('down_payment', 'full') or v_level = 'full')
  loop
    perform public._set_fulfillment_step(v_f.id, 'deposit_verified', null, 'system', null, null);
  end loop;

  select * into v_order from public.orders where id = v_p.order_id;
  perform public.notify(v_p.buyer_id, 'payment_confirmed', 'Pago confirmado',
    case when v_order.payment_status = 'paid' then 'Tu pedido ' || v_order.number || ' está pagado por completo.'
         else 'Saldo pendiente: ' || public._fmt_usd(v_order.total_usd - v_order.paid_usd) || '.' end,
    jsonb_build_object('order_id', v_p.order_id, 'payment_id', p_payment_id));
  if v_order.payment_status = 'paid' then
    for v_f in select distinct store_id from public.fulfillments where order_id = v_p.order_id and flow = 'seller_shipping' loop
      perform public.notify_store(v_f.store_id, 'seller_new_order', 'Pedido ' || v_order.number || ' pagado',
        'Ya puedes confirmarlo y prepararlo.', jsonb_build_object('order_id', v_p.order_id));
    end loop;
  end if;
end $$;
revoke execute on function public._apply_payment(uuid, numeric, numeric, text) from public, anon, authenticated;

create or replace function public.review_payment(p_payment_id uuid, p_approve boolean, p_amount_received numeric default null, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_p public.payments;
  v_received numeric;
  v_usd numeric;
  v_fee numeric;
begin
  perform public.require_admin();
  select * into v_p from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment not found' using errcode = 'P0002'; end if;
  if v_p.status not in ('pending_verification', 'processing') then
    raise exception 'payment already reviewed' using errcode = 'P0001', hint = 'already_reviewed';
  end if;

  if not p_approve then
    if coalesce(trim(p_reason), '') = '' then raise exception 'reason required' using errcode = '22023', hint = 'reason_required'; end if;
    update public.payments set status = 'rejected', rejection_reason = p_reason, verified_at = now(), verified_by = auth.uid()
     where id = p_payment_id;
    perform public.notify(v_p.buyer_id, 'payment_rejected', 'No pudimos confirmar tu pago',
      p_reason, jsonb_build_object('order_id', v_p.order_id, 'payment_id', p_payment_id));
    return jsonb_build_object('status', 'rejected');
  end if;

  v_received := coalesce(p_amount_received, v_p.amount);
  if v_received <= 0 then raise exception 'invalid amount' using errcode = '22023'; end if;
  if v_received > v_p.amount then
    raise exception 'received amount exceeds quoted amount; record the excess separately' using errcode = '22023', hint = 'amount_exceeds_quote';
  end if;
  if v_received < v_p.amount and coalesce(trim(p_reason), '') = '' then
    raise exception 'note required for partial amounts' using errcode = '22023', hint = 'reason_required';
  end if;
  -- proportional recognition for partial receipts; exact when the full amount arrived
  if v_received = v_p.amount then
    v_usd := v_p.base_usd; v_fee := v_p.fee_usd;
  else
    v_usd := trunc(v_p.base_usd * v_received / v_p.amount, 2);
    v_fee := trunc(v_p.fee_usd * v_received / v_p.amount, 2);
  end if;
  update public.payments set amount_received = v_received where id = p_payment_id;
  perform public._apply_payment(p_payment_id, v_usd, v_fee, p_reason);
  return jsonb_build_object('status', 'confirmed', 'usd_recognized', v_usd);
end $$;

-- ---------- automated providers (PayPal / Binance Pay ...) ----------
create or replace function public.start_provider_payment(p_quote_id uuid, p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_user uuid := public.require_user(); v_quote public.payment_quotes; v_method public.payment_methods; v_payment public.payments;
begin
  select * into v_payment from public.payments where buyer_id = v_user and idempotency_key = p_idempotency_key;
  if found then return to_jsonb(v_payment) || jsonb_build_object('replayed', true); end if;
  select * into v_quote from public.payment_quotes where id = p_quote_id and buyer_id = v_user for update;
  if not found then raise exception 'quote not found' using errcode = 'P0002'; end if;
  if v_quote.status <> 'open' or v_quote.expires_at < now() then raise exception 'quote no longer valid' using errcode = 'P0001', hint = 'quote_expired'; end if;
  select * into v_method from public.payment_methods where code = v_quote.method_code;
  if v_method.kind <> 'automated' or v_method.integration_status not in ('live', 'sandbox') then
    raise exception 'provider not available' using errcode = 'P0001', hint = 'method_unavailable';
  end if;
  insert into public.payments (number, order_id, buyer_id, quote_id, method_code, currency, amount, rate_applied, base_usd, fee_usd,
                               status, idempotency_key, provider)
  values ('PG-' || nextval('public.payment_number_seq'), v_quote.order_id, v_user, v_quote.id, v_quote.method_code, v_quote.currency,
          v_quote.amount_due, v_quote.rate_applied, v_quote.base_usd, v_quote.fee_usd, 'processing', p_idempotency_key, v_method.rail)
  returning * into v_payment;
  update public.payment_quotes set status = 'used', used_at = now() where id = p_quote_id;
  return to_jsonb(v_payment) || jsonb_build_object('replayed', false);
end $$;

create or replace function public.attach_provider_payment(p_payment_id uuid, p_provider_payment_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.payments set provider_payment_id = p_provider_payment_id where id = p_payment_id and status = 'processing';
end $$;

-- Webhook entry point (called by edge functions with the service role AFTER signature verification).
create or replace function public.record_provider_event(
  p_provider text, p_event_id text, p_event_type text, p_provider_payment_id text, p_outcome text,
  p_amount numeric, p_currency text, p_signature_valid boolean, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_event_id bigint; v_p public.payments;
begin
  if not public.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.payment_events (provider, provider_event_id, event_type, signature_valid, payload)
  values (p_provider, p_event_id, p_event_type, p_signature_valid, p_payload)
  on conflict (provider, provider_event_id) do nothing
  returning id into v_event_id;
  if v_event_id is null then return jsonb_build_object('status', 'duplicate'); end if;
  if not p_signature_valid then
    update public.payment_events set error = 'invalid signature' where id = v_event_id;
    return jsonb_build_object('status', 'rejected_signature');
  end if;
  select * into v_p from public.payments where provider = p_provider and provider_payment_id = p_provider_payment_id for update;
  if not found then
    update public.payment_events set error = 'unknown payment' where id = v_event_id;
    return jsonb_build_object('status', 'unknown_payment');
  end if;
  update public.payment_events set payment_id = v_p.id where id = v_event_id;
  if p_outcome = 'succeeded' then
    if v_p.status <> 'processing' then
      update public.payment_events set processed = true, error = 'payment not processing' where id = v_event_id;
      return jsonb_build_object('status', 'ignored');
    end if;
    if p_currency <> v_p.currency or p_amount < v_p.amount then
      update public.payments set status = 'pending_verification', amount_received = p_amount where id = v_p.id;
      update public.payment_events set processed = true, error = 'amount/currency mismatch: manual review' where id = v_event_id;
      return jsonb_build_object('status', 'needs_review');
    end if;
    update public.payments set amount_received = p_amount where id = v_p.id;
    perform public._apply_payment(v_p.id, v_p.base_usd, v_p.fee_usd, p_provider || ' event ' || p_event_id);
  elsif p_outcome in ('failed', 'cancelled', 'expired') then
    update public.payments set status = 'failed', rejection_reason = p_event_type where id = v_p.id and status = 'processing';
  end if;
  update public.payment_events set processed = true where id = v_event_id;
  return jsonb_build_object('status', 'processed');
end $$;

-- ---------- fulfillment progression ----------
create or replace function public._set_fulfillment_step(
  p_fulfillment_id uuid, p_step text, p_note text, p_source text, p_tracking text, p_carrier text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_f public.fulfillments;
  v_step public.fulfillment_steps;
  v_order public.orders;
  v_kind text;
begin
  select * into v_f from public.fulfillments where id = p_fulfillment_id for update;
  select * into v_step from public.fulfillment_steps where flow = v_f.flow and code = p_step;
  update public.fulfillments
     set status = p_step,
         tracking_number = coalesce(nullif(trim(p_tracking), ''), tracking_number),
         carrier_name = coalesce(nullif(trim(p_carrier), ''), carrier_name),
         delivered_at = case when p_step = 'delivered' then now() else delivered_at end
   where id = p_fulfillment_id;
  insert into public.fulfillment_events (fulfillment_id, step_code, note, source, actor_id)
  values (p_fulfillment_id, p_step, p_note, p_source, auth.uid());

  select * into v_order from public.orders where id = v_f.order_id;
  if v_step.notify_buyer then
    v_kind := case p_step when 'dispatched' then 'order_dispatched' when 'delivered' then 'order_delivered' else 'fulfillment_update' end;
    perform public.notify(v_order.buyer_id, v_kind, v_step.buyer_label,
      'Pedido ' || v_order.number || ' · Entrega ' || v_f.seq || coalesce('. ' || v_step.buyer_description, ''),
      jsonb_build_object('order_id', v_f.order_id, 'fulfillment_id', p_fulfillment_id));
  end if;
  if p_step = 'delivered' then perform public._settle_fulfillment(p_fulfillment_id); end if;

  -- order completes when every delivery is terminal
  if not exists (
    select 1 from public.fulfillments f join public.fulfillment_steps s on s.flow = f.flow and s.code = f.status
     where f.order_id = v_f.order_id and not s.is_terminal
  ) then
    update public.orders set status = case when exists (select 1 from public.fulfillments where order_id = v_f.order_id and status <> 'cancelled')
                                           then 'completed' else 'cancelled' end::public.order_status
     where id = v_f.order_id and status <> 'cancelled';
  elsif v_order.status = 'placed' and p_step <> 'cancelled' then
    update public.orders set status = 'in_progress' where id = v_f.order_id;
  end if;
end $$;
revoke execute on function public._set_fulfillment_step(uuid, text, text, text, text, text) from public, anon, authenticated;

create or replace function public.advance_fulfillment(p_fulfillment_id uuid, p_step text, p_note text default null,
  p_tracking text default null, p_carrier text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_f public.fulfillments;
  v_cur public.fulfillment_steps;
  v_next public.fulfillment_steps;
  v_admin boolean := public.is_admin() or public.is_service_role();
  v_level text;
begin
  select * into v_f from public.fulfillments where id = p_fulfillment_id for update;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  if not v_admin and not public.is_store_member(v_f.store_id) then raise exception 'not found' using errcode = 'P0002'; end if;
  select * into v_cur from public.fulfillment_steps where flow = v_f.flow and code = v_f.status;
  select * into v_next from public.fulfillment_steps where flow = v_f.flow and code = p_step;
  if not found then raise exception 'unknown step' using errcode = '22023', hint = 'invalid_step'; end if;
  if v_cur.is_terminal then raise exception 'delivery already closed' using errcode = 'P0001', hint = 'invalid_transition'; end if;
  if p_step = 'cancelled' and not v_admin then raise exception 'only admins can cancel deliveries' using errcode = '42501'; end if;
  if p_step <> 'cancelled' and v_next.seq <= v_cur.seq then
    raise exception 'logistic states only move forward' using errcode = 'P0001', hint = 'invalid_transition';
  end if;
  if not v_admin and not v_next.seller_can_set then
    raise exception 'this state is managed by the platform' using errcode = '42501', hint = 'step_not_allowed';
  end if;
  v_level := public._order_payment_level(v_f.order_id);
  if v_next.requires_payment = 'full' and v_level <> 'full'
     or v_next.requires_payment = 'down_payment' and v_level = 'none' then
    raise exception 'payment requirement not met for this state' using errcode = 'P0001', hint = 'payment_required';
  end if;
  if p_step = 'dispatched' and v_f.flow = 'seller_shipping' and v_f.shipping_kind = 'home_delivery'
     and coalesce(nullif(trim(p_tracking), ''), v_f.tracking_number) is null then
    raise exception 'tracking number required to dispatch' using errcode = '22023', hint = 'tracking_required';
  end if;
  if p_step = 'cancelled' then
    perform public._cancel_fulfillment(p_fulfillment_id, coalesce(p_note, 'cancelled'));
    return;
  end if;
  perform public._set_fulfillment_step(p_fulfillment_id, p_step, p_note,
    case when v_admin then 'admin' else 'seller' end, p_tracking, p_carrier);
end $$;

-- ---------- settlement (revenue recognition on delivery) ----------
create or replace function public._settle_fulfillment(p_fulfillment_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_f public.fulfillments;
  v_kind public.store_kind;
  v_net numeric;
  v_comm numeric;
begin
  select * into v_f from public.fulfillments where id = p_fulfillment_id for update;
  if v_f.settled then return; end if;
  select kind into v_kind from public.stores where id = v_f.store_id;
  select coalesce(sum(line_total_usd - refunded_usd), 0),
         coalesce(sum(round((line_total_usd - refunded_usd) * commission_pct / 100, 2)), 0)
    into v_net, v_comm
    from public.order_items where fulfillment_id = p_fulfillment_id;
  if v_kind = 'platform' then
    perform public.ledger_post('fulfillment_settled', jsonb_build_array(
      jsonb_build_object('account', 'deferred_revenue', 'amount', v_net + v_f.shipping_usd),
      jsonb_build_object('account', 'sales_revenue', 'amount', -(v_net + v_f.shipping_usd))
    ), v_f.order_id, null, p_fulfillment_id);
  else
    -- seller ships with own logistics: shipping charged to the buyer is owed to the seller
    perform public.ledger_post('fulfillment_settled', jsonb_build_array(
      jsonb_build_object('account', 'deferred_revenue', 'amount', v_net + v_f.shipping_usd),
      jsonb_build_object('account', 'seller_payable', 'amount', -(v_net - v_comm + v_f.shipping_usd), 'store_id', v_f.store_id),
      jsonb_build_object('account', 'commission_revenue', 'amount', -v_comm)
    ), v_f.order_id, null, p_fulfillment_id);
  end if;
  update public.fulfillments set settled = true where id = p_fulfillment_id;
end $$;
revoke execute on function public._settle_fulfillment(uuid) from public, anon, authenticated;

-- ---------- cargo batches ----------
create or replace function public.assign_to_batch(p_batch_id uuid, p_fulfillment_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  perform public.require_admin();
  update public.fulfillments set cargo_batch_id = p_batch_id
   where id = any (p_fulfillment_ids) and flow = 'import_order' and status not in ('delivered', 'cancelled');
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.update_cargo_batch(p_batch_id uuid, p_step text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_target public.fulfillment_steps;
  v_f record;
  v_updated int := 0;
  v_skipped jsonb := '[]'::jsonb;
  v_level text;
begin
  perform public.require_admin();
  select * into v_target from public.fulfillment_steps where flow = 'import_order' and code = p_step;
  if not found or v_target.is_terminal then raise exception 'invalid batch step' using errcode = '22023', hint = 'invalid_step'; end if;
  update public.cargo_batches set step_code = p_step where id = p_batch_id;
  if not found then raise exception 'batch not found' using errcode = 'P0002'; end if;
  for v_f in
    select f.id, f.order_id, s.seq from public.fulfillments f
      join public.fulfillment_steps s on s.flow = f.flow and s.code = f.status
     where f.cargo_batch_id = p_batch_id and not s.is_terminal
     order by f.created_at
  loop
    if v_f.seq >= v_target.seq then continue; end if;
    v_level := public._order_payment_level(v_f.order_id);
    if v_target.requires_payment = 'full' and v_level <> 'full' or v_target.requires_payment = 'down_payment' and v_level = 'none' then
      v_skipped := v_skipped || jsonb_build_object('fulfillment_id', v_f.id, 'reason', 'payment_required');
      continue;
    end if;
    perform public._set_fulfillment_step(v_f.id, p_step, p_note, 'batch', null, null);
    v_updated := v_updated + 1;
  end loop;
  perform public.audit('batch_step', 'cargo_batch', p_batch_id::text, jsonb_build_object('step', p_step, 'updated', v_updated, 'skipped', v_skipped));
  return jsonb_build_object('updated', v_updated, 'skipped', v_skipped);
end $$;

-- ---------- refunds ----------
-- Reduces what the buyer owes: first waives outstanding obligations (latest first),
-- anything already paid beyond the new total becomes a refund payable to the buyer.
create or replace function public._reduce_buyer_debt(p_order_id uuid, p_amount numeric, p_event text) returns numeric
language plpgsql security definer set search_path = public as $$
declare v_left numeric := p_amount; v_ob public.payment_obligations; v_take numeric;
begin
  for v_ob in select * from public.payment_obligations where order_id = p_order_id and status in ('pending', 'partially_paid')
              order by seq desc for update loop
    exit when v_left <= 0;
    v_take := least(v_left, public._outstanding(v_ob));
    update public.payment_obligations set waived_usd = waived_usd + v_take where id = v_ob.id;
    v_left := v_left - v_take;
  end loop;
  if v_left > 0 then
    perform public.ledger_post(p_event || '_refund_due', jsonb_build_array(
      jsonb_build_object('account', 'buyer_receivable', 'amount', v_left),
      jsonb_build_object('account', 'buyer_refund_payable', 'amount', -v_left)
    ), p_order_id);
  end if;
  return v_left;
end $$;
revoke execute on function public._reduce_buyer_debt(uuid, numeric, text) from public, anon, authenticated;

create or replace function public.refund_item(p_order_item_id uuid, p_quantity int, p_reason text, p_restock boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_item public.order_items;
  v_f public.fulfillments;
  v_kind public.store_kind;
  v_amount numeric;
  v_comm numeric;
  v_due numeric;
  v_order public.orders;
begin
  perform public.require_admin();
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason required' using errcode = '22023', hint = 'reason_required'; end if;
  select * into v_item from public.order_items where id = p_order_item_id for update;
  if not found then raise exception 'item not found' using errcode = 'P0002'; end if;
  select * into v_order from public.orders where id = v_item.order_id for update;
  if p_quantity <= 0 or p_quantity > v_item.quantity - v_item.refunded_qty then
    raise exception 'invalid quantity' using errcode = '22023', hint = 'invalid_quantity';
  end if;
  select * into v_f from public.fulfillments where id = v_item.fulfillment_id;
  select kind into v_kind from public.stores where id = v_item.store_id;
  v_amount := v_item.unit_price_usd * p_quantity;
  v_comm := round(v_amount * v_item.commission_pct / 100, 2);

  update public.order_items set refunded_qty = refunded_qty + p_quantity, refunded_usd = refunded_usd + v_amount where id = v_item.id;
  update public.orders set refunded_usd = refunded_usd + v_amount, total_usd = total_usd - v_amount where id = v_item.order_id;
  if p_restock then
    update public.product_variants set stock = stock + p_quantity where id = v_item.variant_id and stock is not null;
  end if;

  if v_f.settled then
    if v_kind = 'platform' then
      perform public.ledger_post('refund', jsonb_build_array(
        jsonb_build_object('account', 'sales_revenue', 'amount', v_amount),
        jsonb_build_object('account', 'buyer_receivable', 'amount', -v_amount)), v_item.order_id, null, v_f.id, null, p_reason);
    else
      perform public.ledger_post('refund', jsonb_build_array(
        jsonb_build_object('account', 'seller_payable', 'amount', v_amount - v_comm, 'store_id', v_item.store_id),
        jsonb_build_object('account', 'commission_revenue', 'amount', v_comm),
        jsonb_build_object('account', 'buyer_receivable', 'amount', -v_amount)), v_item.order_id, null, v_f.id, null, p_reason);
    end if;
  else
    perform public.ledger_post('refund', jsonb_build_array(
      jsonb_build_object('account', 'deferred_revenue', 'amount', v_amount),
      jsonb_build_object('account', 'buyer_receivable', 'amount', -v_amount)), v_item.order_id, null, v_f.id, null, p_reason);
  end if;

  v_due := public._reduce_buyer_debt(v_item.order_id, v_amount, 'refund');
  insert into public.refunds (order_id, order_item_id, quantity, amount_usd, reason, restock, created_by)
  values (v_item.order_id, v_item.id, p_quantity, v_amount, p_reason, p_restock, auth.uid());
  perform public._recompute_order(v_item.order_id);
  perform public.notify(v_order.buyer_id, 'system', 'Reembolso registrado',
    'Pedido ' || v_order.number || ': ' || public._fmt_usd(v_amount) || '.' ||
    case when v_due > 0 then ' Te devolveremos ' || public._fmt_usd(v_due) || '.' else ' Se descontó de tu saldo pendiente.' end,
    jsonb_build_object('order_id', v_item.order_id));
  return jsonb_build_object('refunded_usd', v_amount, 'refund_due_usd', v_due);
end $$;

create or replace function public.record_refund_payout(p_order_id uuid, p_amount numeric, p_method text, p_reference text)
returns void language plpgsql security definer set search_path = public as $$
declare v_due numeric;
begin
  perform public.require_admin();
  perform 1 from public.orders where id = p_order_id for update;
  select -coalesce(sum(amount_usd), 0) into v_due from public.ledger_entries where order_id = p_order_id and account = 'buyer_refund_payable';
  if p_amount <= 0 or p_amount > v_due then raise exception 'amount exceeds refund due (%)', v_due using errcode = '22023', hint = 'invalid_amount'; end if;
  if coalesce(trim(p_reference), '') = '' then raise exception 'reference required' using errcode = '22023', hint = 'reference_required'; end if;
  insert into public.buyer_refund_payouts (order_id, amount_usd, method, reference, paid_by) values (p_order_id, p_amount, p_method, p_reference, auth.uid());
  perform public.ledger_post('refund_paid', jsonb_build_array(
    jsonb_build_object('account', 'buyer_refund_payable', 'amount', p_amount),
    jsonb_build_object('account', 'cash_clearing', 'amount', -p_amount)), p_order_id, null, null, null, p_method || ' ' || p_reference);
  perform public._recompute_order(p_order_id);
end $$;

-- ---------- cancellation ----------
create or replace function public._cancel_fulfillment(p_fulfillment_id uuid, p_reason text) returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_f public.fulfillments;
  v_open numeric;
  v_item record;
begin
  select * into v_f from public.fulfillments where id = p_fulfillment_id for update;
  if v_f.status in ('delivered', 'cancelled') then return 0; end if;
  for v_item in select * from public.order_items where fulfillment_id = p_fulfillment_id and refunded_qty < quantity for update loop
    update public.product_variants set stock = stock + (v_item.quantity - v_item.refunded_qty)
     where id = v_item.variant_id and stock is not null;
  end loop;
  select coalesce(sum(line_total_usd - refunded_usd), 0) + v_f.shipping_usd into v_open
    from public.order_items where fulfillment_id = p_fulfillment_id;
  update public.order_items set refunded_usd = line_total_usd, refunded_qty = quantity where fulfillment_id = p_fulfillment_id;
  update public.orders set refunded_usd = refunded_usd + v_open, total_usd = total_usd - v_open where id = v_f.order_id;
  if v_open > 0 then
    perform public.ledger_post('fulfillment_cancelled', jsonb_build_array(
      jsonb_build_object('account', 'deferred_revenue', 'amount', v_open),
      jsonb_build_object('account', 'buyer_receivable', 'amount', -v_open)), v_f.order_id, null, p_fulfillment_id, null, p_reason);
    perform public._reduce_buyer_debt(v_f.order_id, v_open, 'cancel');
  end if;
  perform public._set_fulfillment_step(p_fulfillment_id, 'cancelled', p_reason, case when public.is_admin() then 'admin' else 'system' end, null, null);
  perform public._recompute_order(v_f.order_id);
  return v_open;
end $$;
revoke execute on function public._cancel_fulfillment(uuid, text) from public, anon, authenticated;

create or replace function public.cancel_order(p_order_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_order public.orders; v_f record; v_admin boolean := public.is_admin() or public.is_service_role();
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or (not v_admin and v_order.buyer_id <> auth.uid()) then raise exception 'not found' using errcode = 'P0002'; end if;
  if v_order.status in ('cancelled', 'completed') then raise exception 'order closed' using errcode = 'P0001', hint = 'invalid_transition'; end if;
  if not v_admin then
    if v_order.paid_usd > 0 or exists (select 1 from public.payments where order_id = p_order_id and status in ('pending_verification', 'processing')) then
      raise exception 'contact support to cancel a paid order' using errcode = 'P0001', hint = 'cancel_requires_support';
    end if;
  end if;
  update public.payment_quotes set status = 'cancelled' where order_id = p_order_id and status = 'open';
  for v_f in select id from public.fulfillments where order_id = p_order_id and status not in ('delivered', 'cancelled') loop
    perform public._cancel_fulfillment(v_f.id, coalesce(p_reason, 'cancelled'));
  end loop;
  update public.payment_obligations set status = 'cancelled' where order_id = p_order_id and status in ('pending', 'partially_paid') and paid_usd = 0;
  update public.orders set status = 'cancelled', cancel_reason = p_reason where id = p_order_id;
  perform public._recompute_order(p_order_id);
  perform public.audit('cancel', 'order', p_order_id::text, jsonb_build_object('reason', p_reason));
end $$;

-- Releases stock of orders never paid within the configured window (run on a schedule).
create or replace function public.expire_unpaid_orders() returns int
language plpgsql security definer set search_path = public as $$
declare v_o record; v_n int := 0; v_hours int := (public.setting('orders.unpaid_expiry_hours', '48'))::int;
begin
  if not public.is_service_role() and not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  for v_o in select o.id from public.orders o
              where o.status = 'placed' and o.payment_status = 'unpaid' and o.placed_at < now() - make_interval(hours => v_hours)
                and not exists (select 1 from public.payments p where p.order_id = o.id and p.status in ('pending_verification', 'processing'))
  loop
    perform public.cancel_order(v_o.id, 'Sin pago dentro de ' || v_hours || ' horas');
    v_n := v_n + 1;
  end loop;
  update public.payment_quotes set status = 'expired' where status = 'open' and expires_at < now();
  return v_n;
end $$;

-- ---------- seller balances & payouts ----------
create or replace function public.seller_balance(p_store_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_available numeric; v_pending numeric; v_paid numeric; v_comm numeric; v_draft numeric;
begin
  perform public.require_store_member(p_store_id);
  select -coalesce(sum(amount_usd), 0) into v_available from public.ledger_entries where account = 'seller_payable' and store_id = p_store_id;
  select coalesce(sum(i.line_total_usd - i.refunded_usd - round((i.line_total_usd - i.refunded_usd) * i.commission_pct / 100, 2)), 0)
    into v_pending
    from public.order_items i join public.fulfillments f on f.id = i.fulfillment_id
   where i.store_id = p_store_id and not f.settled and f.status <> 'cancelled';
  select coalesce(sum(amount_usd), 0) into v_paid from public.payouts where store_id = p_store_id and status = 'paid';
  select coalesce(sum(amount_usd), 0) into v_draft from public.payouts where store_id = p_store_id and status = 'draft';
  select coalesce(sum(round((i.line_total_usd - i.refunded_usd) * i.commission_pct / 100, 2)), 0) into v_comm
    from public.order_items i join public.fulfillments f on f.id = i.fulfillment_id where i.store_id = p_store_id and f.settled;
  return jsonb_build_object('available_usd', v_available, 'scheduled_usd', v_draft, 'pending_usd', v_pending,
                            'paid_out_usd', v_paid, 'commissions_usd', v_comm);
end $$;

create or replace function public.create_payout(p_store_id uuid, p_amount numeric, p_notes text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_bal jsonb;
begin
  perform public.require_admin();
  perform pg_advisory_xact_lock(hashtextextended('payout:' || p_store_id::text, 0));
  v_bal := public.seller_balance(p_store_id);
  if p_amount <= 0 or p_amount > (v_bal ->> 'available_usd')::numeric - (v_bal ->> 'scheduled_usd')::numeric then
    raise exception 'amount exceeds available balance' using errcode = 'P0001', hint = 'insufficient_balance';
  end if;
  insert into public.payouts (store_id, amount_usd, notes, created_by) values (p_store_id, p_amount, p_notes, auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.mark_payout_paid(p_payout_id uuid, p_method text, p_reference text) returns void
language plpgsql security definer set search_path = public as $$
declare v_p public.payouts;
begin
  perform public.require_admin();
  if coalesce(trim(p_reference), '') = '' then raise exception 'reference required' using errcode = '22023', hint = 'reference_required'; end if;
  select * into v_p from public.payouts where id = p_payout_id for update;
  if not found or v_p.status <> 'draft' then raise exception 'payout not payable' using errcode = 'P0001', hint = 'invalid_transition'; end if;
  update public.payouts set status = 'paid', method = p_method, reference = p_reference, paid_at = now(), paid_by = auth.uid() where id = p_payout_id;
  perform public.ledger_post('payout', jsonb_build_array(
    jsonb_build_object('account', 'seller_payable', 'amount', v_p.amount_usd, 'store_id', v_p.store_id),
    jsonb_build_object('account', 'cash_clearing', 'amount', -v_p.amount_usd)), null, null, null, p_payout_id, p_method || ' ' || p_reference);
end $$;

create or replace function public.cancel_payout(p_payout_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.payouts set status = 'cancelled' where id = p_payout_id and status = 'draft';
  if not found then raise exception 'payout not cancellable' using errcode = 'P0001', hint = 'invalid_transition'; end if;
end $$;

-- generic manual adjustment (two legs, admin, reasoned, audited)
create or replace function public.post_adjustment(p_store_id uuid, p_amount numeric, p_memo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_group uuid;
begin
  perform public.require_admin();
  if coalesce(trim(p_memo), '') = '' then raise exception 'memo required' using errcode = '22023', hint = 'reason_required'; end if;
  -- positive amount credits the seller (platform owes more), negative debits
  v_group := public.ledger_post('adjustment', jsonb_build_array(
    jsonb_build_object('account', 'seller_payable', 'amount', -p_amount, 'store_id', p_store_id),
    jsonb_build_object('account', 'adjustments', 'amount', p_amount)), null, null, null, null, p_memo);
  perform public.audit('adjustment', 'store', p_store_id::text, jsonb_build_object('amount', p_amount, 'memo', p_memo));
  return v_group;
end $$;
