-- Plumbing for the edge functions in supabase/functions (payments-start, provider webhooks, push-dispatch,
-- rates-sync) and the scheduled jobs. Everything here is service-role only.

-- ---------- provider payments ----------
-- Where the buyer finishes paying (PayPal approval page / Binance Pay checkout). Kept so a retried
-- "Pagar" returns the same checkout instead of opening a second provider order.
alter table public.payments add column if not exists provider_checkout_url text;

drop function if exists public.attach_provider_payment(uuid, text);
create or replace function public.attach_provider_payment(p_payment_id uuid, p_provider_payment_id text, p_checkout_url text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.payments
     set provider_payment_id = p_provider_payment_id, provider_checkout_url = coalesce(p_checkout_url, provider_checkout_url)
   where id = p_payment_id and status = 'processing';
end $$;

-- The provider refused to create the order (bad credentials, limits, outage). The payment never reached the
-- provider, so it fails cleanly and the buyer can quote again; nothing is credited.
create or replace function public.fail_provider_start(p_payment_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.payments set status = 'failed', rejection_reason = left(coalesce(p_reason, 'provider error'), 300)
   where id = p_payment_id and status = 'processing' and provider_payment_id is null;
end $$;

-- An event with an invalid signature is stored for the audit trail under a synthetic id, so a forged event
-- can never occupy the id of the genuine one (the unique key would otherwise turn the real event into a
-- "duplicate"). The edge functions reject unsigned events before reaching this point; this is the second line.
create or replace function public.record_provider_event(
  p_provider text, p_event_id text, p_event_type text, p_provider_payment_id text, p_outcome text,
  p_amount numeric, p_currency text, p_signature_valid boolean, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_event_id bigint; v_p public.payments;
begin
  if not public.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not p_signature_valid then
    insert into public.payment_events (provider, provider_event_id, event_type, signature_valid, payload, processed, error)
    values (p_provider, 'unsigned:' || coalesce(p_event_id, '') || ':' || gen_random_uuid(), coalesce(p_event_type, ''), false,
            coalesce(p_payload, '{}'::jsonb), true, 'invalid signature');
    return jsonb_build_object('status', 'rejected_signature');
  end if;
  insert into public.payment_events (provider, provider_event_id, event_type, signature_valid, payload)
  values (p_provider, p_event_id, p_event_type, true, p_payload)
  on conflict (provider, provider_event_id) do nothing
  returning id into v_event_id;
  if v_event_id is null then return jsonb_build_object('status', 'duplicate'); end if;
  select * into v_p from public.payments where provider = p_provider and provider_payment_id = p_provider_payment_id for update;
  if not found then
    update public.payment_events set error = 'unknown payment' where id = v_event_id;
    return jsonb_build_object('status', 'unknown_payment');
  end if;
  update public.payment_events set payment_id = v_p.id where id = v_event_id;
  if p_outcome = 'succeeded' then
    if v_p.status = 'failed' then
      -- money arrived after the attempt was cancelled or timed out: never lost, never auto-credited twice
      update public.payments set status = 'pending_verification', amount_received = p_amount,
             rejection_reason = 'Pago confirmado por el proveedor después de cancelar o vencer el intento: revisar.'
       where id = v_p.id;
      update public.payment_events set processed = true, error = 'late success: manual review' where id = v_event_id;
      return jsonb_build_object('status', 'needs_review');
    end if;
    if v_p.status <> 'processing' then
      update public.payment_events set processed = true, error = 'payment not processing' where id = v_event_id;
      return jsonb_build_object('status', 'ignored');
    end if;
    if p_currency is distinct from v_p.currency or p_amount is null or p_amount < v_p.amount then
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

-- The buyer gives up on an online attempt (closed the provider page, wants another method). If the provider
-- still confirms it later, record_provider_event sends it to manual review instead of losing it.
create or replace function public.cancel_provider_payment(p_payment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := public.require_user();
begin
  update public.payments set status = 'failed', rejection_reason = 'Intento en línea cancelado por el comprador'
   where id = p_payment_id and buyer_id = v_user and status = 'processing' and provider is not null;
  if not found then raise exception 'payment not cancellable' using errcode = 'P0001', hint = 'invalid_state'; end if;
end $$;

insert into public.app_settings (key, value, description, is_public) values
  ('payments.provider_expiry_minutes', '180', 'Minutos que un pago en línea (Binance Pay, PayPal) espera la confirmación del proveedor antes de liberar el pedido', false)
on conflict (key) do nothing;

-- Online attempts nobody confirmed (buyer abandoned the provider page) stop blocking the order after
-- payments.provider_expiry_minutes; unpaid orders then expire as before.
create or replace function public.expire_unpaid_orders() returns int
language plpgsql security definer set search_path = public as $$
declare v_o record; v_n int := 0; v_hours int := (public.setting('orders.unpaid_expiry_hours', '48'))::int;
        v_provider_minutes int := (public.setting('payments.provider_expiry_minutes', '180'))::int;
begin
  if not public.is_service_role() and not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.payments set status = 'failed', rejection_reason = 'Sin confirmación del proveedor a tiempo'
   where status = 'processing' and provider is not null and created_at < now() - make_interval(mins => v_provider_minutes);
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

-- ---------- push notifications ----------
-- 'sending' marks a batch claimed by one dispatcher, so two runs never push the same notification twice.
alter table public.notifications drop constraint if exists notifications_push_status_check;
alter table public.notifications add constraint notifications_push_status_check
  check (push_status in ('pending', 'sending', 'sent', 'skipped', 'failed'));
alter table public.notifications
  add column if not exists push_attempts int not null default 0,
  add column if not exists push_claimed_at timestamptz,
  add column if not exists push_error text;

-- Returns up to p_limit notifications with their device tokens and marks them 'sending'. Test notifications
-- are never pushed, and a notification older than a day is skipped: a late "tu pedido salió" is misleading.
create or replace function public.claim_push_batch(p_limit int default 100, p_ids uuid[] default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_out jsonb;
begin
  if not public.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.notifications set push_status = 'skipped', push_error = 'test notification'
   where push_status = 'pending' and is_test and (p_ids is null or id = any (p_ids));
  update public.notifications set push_status = 'skipped', push_error = 'expired before delivery'
   where push_status in ('pending', 'sending') and created_at < now() - interval '24 hours' and (p_ids is null or id = any (p_ids));
  with c as (
    select id from public.notifications
     where not is_test and push_attempts < 3
       and (push_status = 'pending' or (push_status = 'sending' and push_claimed_at < now() - interval '10 minutes'))
       and (p_ids is null or id = any (p_ids))
     order by created_at
     limit least(greatest(coalesce(p_limit, 100), 1), 500)
     for update skip locked
  ), u as (
    update public.notifications n
       set push_status = 'sending', push_claimed_at = now(), push_attempts = n.push_attempts + 1
      from c where n.id = c.id
    returning n.id, n.user_id, n.kind, n.title, n.body, n.data
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', u.id, 'kind', u.kind, 'title', u.title, 'body', u.body, 'data', u.data,
           'tokens', (select coalesce(jsonb_agg(t.token), '[]'::jsonb) from public.push_tokens t where t.user_id = u.user_id))), '[]'::jsonb)
    into v_out from u;
  return v_out;
end $$;

-- p_results: [{ "id": uuid, "status": "sent" | "skipped" | "failed" | "retry", "error": text }]. Tokens Expo reports as
-- no longer registered are removed so they are not tried again.
create or replace function public.complete_push(p_results jsonb, p_dead_tokens text[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.notifications n
     set push_status = case r.status when 'sent' then 'sent'
                                     when 'skipped' then 'skipped'
                                     when 'retry' then case when n.push_attempts < 3 then 'pending' else 'failed' end
                                     else 'failed' end,
         push_error = left(r.error, 300)
    from jsonb_to_recordset(coalesce(p_results, '[]'::jsonb)) as r(id uuid, status text, error text)
   where n.id = r.id and n.push_status = 'sending';
  delete from public.push_tokens where token = any (coalesce(p_dead_tokens, '{}'));
end $$;

-- ---------- scheduled jobs ----------
-- Calls an edge function with the service role key kept in Supabase Vault. Missing secrets make it a
-- no-op with a notice (a fresh project keeps working until an operator stores them).
create or replace function public.invoke_edge_function(p_name text, p_body jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_url text; v_key text;
begin
  if not public.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_name !~ '^[a-z0-9-]{1,40}$' then raise exception 'invalid function name' using errcode = '22023'; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'kora_project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'kora_service_role_key';
  if v_url is null or v_key is null then
    raise notice 'edge function % not called: vault secrets kora_project_url / kora_service_role_key are missing', p_name;
    return null;
  end if;
  return net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/' || p_name,
    headers := jsonb_build_object('content-type', 'application/json', 'authorization', 'Bearer ' || v_key),
    body := coalesce(p_body, '{}'::jsonb),
    timeout_milliseconds := 30000);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'expire_unpaid_orders()', 'attach_provider_payment(uuid, text, text)', 'fail_provider_start(uuid, text)',
    'record_provider_event(text, text, text, text, text, numeric, text, boolean, jsonb)',
    'claim_push_batch(int, uuid[])', 'complete_push(jsonb, text[])', 'invoke_edge_function(text, jsonb)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- pg_cron + pg_net exist on hosted Supabase (enable them in Database > Extensions if this notice appears).
-- Local Postgres without them skips scheduling; the jobs can still be run by hand.
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron')
     or not exists (select 1 from pg_available_extensions where name = 'pg_net') then
    raise notice 'pg_cron/pg_net not available: scheduled jobs not created';
    return;
  end if;
  create extension if not exists pg_cron;
  create extension if not exists pg_net with schema extensions;
  perform cron.schedule('kora-expire-unpaid-orders', '*/10 * * * *', 'select public.expire_unpaid_orders()');
  perform cron.schedule('kora-refresh-popularity', '17 * * * *', 'select public.refresh_popularity()');
  perform cron.schedule('kora-rates-sync', '*/30 * * * *', $job$select public.invoke_edge_function('rates-sync')$job$);
  perform cron.schedule('kora-push-dispatch', '* * * * *', $job$select public.invoke_edge_function('push-dispatch')$job$);
end $$;
