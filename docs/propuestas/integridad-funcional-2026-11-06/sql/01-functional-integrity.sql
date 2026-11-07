-- LOCAL REVIEW CANDIDATE ONLY. No remote execution or privilege grants.
-- Existing RPC signatures and financial calculations remain unchanged.
create or replace function public.track_event(
  p_kind public.user_event_kind, p_product_id uuid default null, p_category_id uuid default null,
  p_store_id uuid default null, p_query text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if p_kind = 'purchase' then
    raise exception 'purchase events are written by checkout only' using errcode='42501', hint='forbidden';
  end if;
  if v_user is null then return; end if;
  if not coalesce((select personalization_enabled from public.profiles where id = v_user), true) then return; end if;
  perform public.check_rate_limit('track', 300, 60);
  insert into public.user_events (user_id, kind, product_id, category_id, store_id, query)
  values (v_user, p_kind, p_product_id, p_category_id, p_store_id, left(nullif(trim(p_query), ''), 120));
end $$;

-- Keep ownership and personalise preferences enforced even for direct REST INSERTs.
-- Trusted checkout runs under its existing definer; it is the only purchase writer.
alter policy user_events_insert_own on public.user_events
  with check (user_id=auth.uid() and kind<>'purchase'
    and coalesce((select personalization_enabled from public.profiles where id=auth.uid()),true));

create or replace function public.place_order(
  p_address_id uuid, p_shipping jsonb, p_plan_code text, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := public.require_user();
  v_existing public.orders;
  v_preview jsonb;
  v_line record;
  v_order_id uuid;
  v_number text;
  v_group jsonb;
  v_f_id uuid;
  v_first_step text;
  v_schedule jsonb;
  v_ob jsonb;
  v_ship_to jsonb;
  v_addr public.addresses;
  v_pct numeric;
  v_store record;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception 'idempotency key required' using errcode = '22023', hint = 'idempotency_required';
  end if;

  -- serialize checkouts per buyer (double tap, two devices)
  perform pg_advisory_xact_lock(hashtextextended('checkout:' || v_user::text, 0));

  select * into v_existing from public.orders where buyer_id = v_user and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('order_id', v_existing.id, 'number', v_existing.number, 'replayed', true);
  end if;

  perform public.check_rate_limit('place_order', 10, 600);

  -- lock every variant in the cart in a stable order to avoid deadlocks, then re-read under lock
  perform 1 from public.product_variants v
    where v.id in (select variant_id from public.cart_items where user_id = v_user)
    order by v.id for update;

  v_preview := public._build_checkout(v_user, p_address_id, coalesce(p_shipping, '{}'::jsonb), coalesce(p_plan_code, 'full'));

  if (v_preview ->> 'line_count')::int = 0 then
    raise exception 'cart is empty' using errcode = 'P0001', hint = 'cart_empty';
  end if;
  if (v_preview ->> 'issues')::int > 0 then
    raise exception 'some items are no longer available' using errcode = 'P0001', hint = 'cart_has_issues',
      detail = (select string_agg(l ->> 'variant_id' || ':' || (l ->> 'issue'), ',')
                  from jsonb_array_elements(v_preview -> 'groups') g, jsonb_array_elements(g -> 'lines') l
                 where l ->> 'issue' is not null);
  end if;
  if (v_preview ->> 'needs_address')::boolean then
    raise exception 'address required' using errcode = 'P0001', hint = 'address_required';
  end if;
  if (v_preview ->> 'needs_shipping')::boolean then
    raise exception 'no shipping available for this address' using errcode = 'P0001', hint = 'shipping_unavailable';
  end if;

  select * into v_addr from public.addresses where id = (v_preview -> 'address' ->> 'id')::uuid;
  v_ship_to := jsonb_build_object(
    'recipient', v_addr.recipient, 'phone', v_addr.phone, 'country_code', v_addr.country_code, 'region_code', v_addr.region_code,
    'region_name', (select name from public.regions where country_code = v_addr.country_code and code = v_addr.region_code),
    'city', v_addr.city, 'municipality', v_addr.municipality, 'line1', v_addr.line1, 'reference', v_addr.reference,
    'id_document', v_addr.id_document);

  v_number := coalesce(public.setting('orders.number_prefix') #>> '{}', 'P') || '-' || nextval('public.order_number_seq');
  insert into public.orders (number, buyer_id, items_usd, shipping_usd, financing_usd, total_usd, plan_code, ship_to, idempotency_key)
  values (v_number, v_user, (v_preview ->> 'items_usd')::numeric, (v_preview ->> 'shipping_usd')::numeric,
          (v_preview ->> 'financing_usd')::numeric, (v_preview ->> 'total_usd')::numeric,
          coalesce(p_plan_code, 'full'), v_ship_to, p_idempotency_key)
  returning id into v_order_id;

  for v_group in select * from jsonb_array_elements(v_preview -> 'groups') loop
    select code into v_first_step from public.fulfillment_steps where flow = (v_group ->> 'flow')::public.fulfillment_flow order by seq limit 1;
    insert into public.fulfillments (order_id, seq, store_id, flow, group_key, status, shipping_method_id, shipping_method_name, shipping_kind,
                                     shipping_usd, ready_min_days, ready_max_days, eta_min_date, eta_max_date, ship_to, carrier_name)
    values (v_order_id, (v_group ->> 'seq')::int, (v_group -> 'store' ->> 'id')::uuid, (v_group ->> 'flow')::public.fulfillment_flow,
            v_group ->> 'key', v_first_step, (v_group -> 'selected_shipping' ->> 'method_id')::uuid,
            v_group -> 'selected_shipping' ->> 'name', (v_group -> 'selected_shipping' ->> 'kind')::public.shipping_kind,
            (v_group -> 'selected_shipping' ->> 'cost_usd')::numeric,
            (v_group ->> 'ready_min_days')::int, (v_group ->> 'ready_max_days')::int,
            (v_group -> 'selected_shipping' ->> 'eta_min_date')::date, (v_group -> 'selected_shipping' ->> 'eta_max_date')::date,
            v_ship_to, v_group -> 'selected_shipping' ->> 'carrier')
    returning id into v_f_id;
    insert into public.fulfillment_events (fulfillment_id, step_code, note, source) values (v_f_id, v_first_step, null, 'system');

    for v_line in
      select (l ->> 'variant_id')::uuid as variant_id, (l ->> 'product_id')::uuid as product_id, l ->> 'title' as title,
             l ->> 'variant_title' as variant_title, l ->> 'image_path' as image_path, (l ->> 'availability')::public.availability as availability,
             (l ->> 'unit_price_usd')::numeric as price, (l ->> 'quantity')::int as qty
        from jsonb_array_elements(v_group -> 'lines') l
    loop
      v_pct := public.commission_pct((v_group -> 'store' ->> 'id')::uuid, (select category_id from public.products where id = v_line.product_id));
      insert into public.order_items (order_id, fulfillment_id, store_id, product_id, variant_id, title, variant_title, image_path,
                                      availability, unit_price_usd, quantity, line_total_usd, commission_pct, commission_usd)
      values (v_order_id, v_f_id, (v_group -> 'store' ->> 'id')::uuid, v_line.product_id, v_line.variant_id, v_line.title, v_line.variant_title,
              v_line.image_path, v_line.availability, v_line.price, v_line.qty, v_line.price * v_line.qty, v_pct,
              round(v_line.price * v_line.qty * v_pct / 100, 2));
      -- atomic stock decrement; the guard makes concurrent last-unit purchases fail cleanly
      update public.product_variants set stock = stock - v_line.qty
       where id = v_line.variant_id and stock is not null;
      if exists (select 1 from public.product_variants where id = v_line.variant_id and stock is not null and stock < 0) then
        raise exception 'insufficient stock' using errcode = 'P0001', hint = 'insufficient_stock', detail = v_line.variant_id::text;
      end if;
      if coalesce((select personalization_enabled from public.profiles where id=v_user),true) then
      insert into public.user_events (user_id, kind, product_id) values (v_user, 'purchase', v_line.product_id);
      end if;
    end loop;
  end loop;

  v_schedule := v_preview -> 'schedule';
  for v_ob in select * from jsonb_array_elements(v_schedule) loop
    insert into public.payment_obligations (order_id, seq, kind, amount_usd, due_date)
    values (v_order_id, (v_ob ->> 'seq')::int, (v_ob ->> 'kind')::public.obligation_kind, (v_ob ->> 'amount_usd')::numeric,
            current_date + (v_ob ->> 'due_in_days')::int);
  end loop;

  perform public.ledger_post('order_placed', jsonb_build_array(
    jsonb_build_object('account', 'buyer_receivable', 'amount', (v_preview ->> 'total_usd')::numeric),
    jsonb_build_object('account', 'deferred_revenue', 'amount', -(v_preview ->> 'total_usd')::numeric)
  ), v_order_id);

  delete from public.cart_items c
   where c.user_id = v_user
     and c.variant_id in (select variant_id from public.order_items where order_id = v_order_id);

  perform public.notify(v_user, 'order_placed', 'Pedido ' || v_number || ' recibido',
    'Te avisaremos cuando confirmemos tu pago.', jsonb_build_object('order_id', v_order_id));
  for v_store in select distinct store_id from public.fulfillments where order_id = v_order_id loop
    perform public.notify_store(v_store.store_id, 'seller_new_order', 'Nuevo pedido ' || v_number,
      'Se habilitará la preparación cuando el pago esté verificado.', jsonb_build_object('order_id', v_order_id));
  end loop;
  perform public.audit('place', 'order', v_order_id::text, jsonb_build_object('total', v_preview ->> 'total_usd', 'plan', p_plan_code));

  return jsonb_build_object('order_id', v_order_id, 'number', v_number, 'replayed', false);
end $$;

-- Additive request identity for new manual reports. Historical rows remain NULL; no backfill.
alter table public.payments add column intent_request_hash text;
alter table public.payments add constraint payments_intent_request_hash_format
  check(intent_request_hash is null or intent_request_hash ~ '^[0-9a-f]{64}$');
comment on column public.payments.intent_request_hash is
  'SHA256 of supported normalised manual report input. NULL means historical/unbound input; never rewrite payment history to infer an omitted timestamp.';

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
  v_request jsonb; v_request_hash text; v_requested_paid_at timestamptz;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception 'idempotency key required' using errcode = '22023', hint = 'idempotency_required';
  end if;
  -- Match the supported write contract: trimmed reference, exact proof path,
  -- truncated payer fields and the explicit paid_at instant (NULL means omitted/automatic).
  -- Unknown JSON properties do not alter the operation, and equivalent time zone spellings match.
  v_requested_paid_at := (p_payer ->> 'paid_at')::timestamptz;
  v_request := jsonb_build_object('quote_id',p_quote_id,'reference',v_ref,'proof_path',p_proof_path,
    'payer_name',left(p_payer->>'name',120),'payer_bank',left(p_payer->>'bank',80),
    'payer_phone',left(p_payer->>'phone',32),'paid_at_epoch',extract(epoch from v_requested_paid_at));
  v_request_hash := encode(extensions.digest(convert_to(v_request::text,'UTF8'),'sha256'),'hex');
  -- Serialize one buyer intent before lookup; response loss and concurrent retries recover the same report.
  perform pg_advisory_xact_lock(hashtextextended('submit_payment:' || v_user::text || ':' || p_idempotency_key,0));
  select * into v_existing from public.payments where buyer_id = v_user and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.intent_request_hash is not null then
      if v_existing.intent_request_hash <> v_request_hash then
        raise exception 'payment key reused for a different report' using errcode='22023',hint='idempotency_conflict';
      end if;
    elsif v_existing.quote_id is distinct from p_quote_id
       or v_existing.reference is distinct from v_ref
       or v_existing.proof_path is distinct from p_proof_path
       or v_existing.payer_name is distinct from left(p_payer->>'name',120)
       or v_existing.payer_bank is distinct from left(p_payer->>'bank',80)
       or v_existing.payer_phone is distinct from left(p_payer->>'phone',32)
       or (v_requested_paid_at is not null and v_existing.declared_paid_at is distinct from v_requested_paid_at) then
      -- Legacy rows cannot reveal whether their stored date came from the caller or now().
      -- Compare all recoverable supported fields; an omitted date keeps original retries working.
      -- Do not populate a guessed hash or modify this historical payment.
      raise exception 'payment key reused for a different report' using errcode='22023',hint='idempotency_conflict';
    end if;
    return to_jsonb(v_existing) || jsonb_build_object('replayed', true);
  end if;

  perform public.check_rate_limit('submit_payment', 10, 3600);

  select * into v_quote from public.payment_quotes where id = p_quote_id and buyer_id = v_user for update;
  if not found then raise exception 'quote not found' using errcode = 'P0002'; end if;
  if v_quote.status <> 'open' then raise exception 'quote no longer valid' using errcode = 'P0001', hint = 'quote_used'; end if;
  if v_quote.expires_at < now() then
    update public.payment_quotes set status = 'expired' where id = p_quote_id;
    -- the status change must persist even though we abort: report via return instead of raising
    return jsonb_build_object('error', 'quote_expired');
  end if;

  select * into v_method from public.payment_methods where code = v_quote.method_code for share;
  if not found or not v_method.enabled then
    raise exception 'payment method unavailable' using errcode='P0001', hint='method_unavailable';
  end if;
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
                               status, idempotency_key, intent_request_hash)
  values ('PG-' || nextval('public.payment_number_seq'), v_quote.order_id, v_user, v_quote.id, v_quote.method_code, v_quote.currency,
          v_quote.amount_due, v_quote.rate_applied, v_quote.base_usd, v_quote.fee_usd, v_ref, v_norm, p_proof_path,
          left(p_payer ->> 'name', 120), left(p_payer ->> 'bank', 80), left(p_payer ->> 'phone', 32),
          coalesce(v_requested_paid_at, now()), 'pending_verification', p_idempotency_key, v_request_hash)
  returning * into v_payment;

  update public.payment_quotes set status = 'used', used_at = now() where id = p_quote_id;
  perform public.notify(v_user, 'payment_received', 'Pago recibido',
    'Estamos verificando tu pago ' || v_payment.number || '. Te avisaremos al confirmarlo.',
    jsonb_build_object('order_id', v_quote.order_id, 'payment_id', v_payment.id));
  return to_jsonb(v_payment) || jsonb_build_object('replayed', false);
end $$;

create or replace function public.moderate_product(p_product_id uuid, p_status public.moderation_status, p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_product public.products; v_last_event bigint;
begin
  perform public.require_admin();
  if p_status in ('rejected','suspended') and coalesce(trim(p_note),'')='' then
    raise exception 'a note is required to reject or suspend' using errcode='22023',hint='note_required';
  end if;
  select * into v_product from public.products where id=p_product_id for update;
  if not found then raise exception 'product not found' using errcode='P0002';end if;
  if v_product.moderation_status is not distinct from p_status and v_product.moderation_note is not distinct from p_note then return;end if;
  select coalesce(max(id),0) into v_last_event from public.moderation_events where product_id=p_product_id;
  update public.products set moderation_status=p_status,moderation_note=p_note where id=p_product_id;
  if v_product.moderation_status is distinct from p_status then
    -- Only annotate the event this transition just created; never rewrite an earlier moderator.
    update public.moderation_events set note=coalesce(p_note,note) where product_id=p_product_id and id>v_last_event;
  else
    insert into public.moderation_events(product_id,from_status,to_status,note,actor_id,automatic)
      values(p_product_id,v_product.moderation_status,p_status,p_note,auth.uid(),false);
  end if;
  perform public.audit('moderate','product',p_product_id::text,jsonb_build_object('status',p_status,'note',p_note));
end $$;
