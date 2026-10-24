-- =====================================================================
-- Push delivery receipts (second phase of Expo push).
-- A ticket from Expo only means the message was accepted; whether Apple or Google delivered it is reported later
-- by a receipt (ready after about 15 minutes, kept by Expo for 24 hours). The dispatcher stores every ticket, asks
-- for its receipt once it is due, drops devices that no longer exist and marks a notification failed when no
-- device received it. Operators see the health of the channel on the admin dashboard.
-- =====================================================================

create table public.push_tickets (
  ticket_id text primary key check (char_length(ticket_id) between 1 and 100),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  -- cleared when the device is removed (dead device, sign-out, account deletion), so no token outlives its owner
  token text references public.push_tokens (token) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'ok', 'error', 'expired')),
  error text,
  created_at timestamptz not null default now(),
  checked_at timestamptz
);
create index push_tickets_due_idx on public.push_tickets (created_at) where status = 'pending';
create index push_tickets_notification_idx on public.push_tickets (notification_id);
create index push_tickets_token_idx on public.push_tickets (token);

alter table public.push_tickets enable row level security;
revoke all on public.push_tickets from public, anon, authenticated;

-- p_tickets: [{ "ticket_id": text, "notification_id": uuid, "token": text }] for every ticket Expo accepted.
drop function if exists public.complete_push(jsonb, text[]);
create or replace function public.complete_push(p_results jsonb, p_dead_tokens text[] default '{}', p_tickets jsonb default '[]')
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
  insert into public.push_tickets (ticket_id, notification_id, token)
  select t.ticket_id, t.notification_id, (select pt.token from public.push_tokens pt where pt.token = t.token)
    from jsonb_to_recordset(coalesce(p_tickets, '[]'::jsonb)) as t(ticket_id text, notification_id uuid, token text)
   where t.ticket_id is not null and exists (select 1 from public.notifications n where n.id = t.notification_id)
  on conflict (ticket_id) do nothing;
  delete from public.push_tokens where token = any (coalesce(p_dead_tokens, '{}'));
end $$;

-- Returns up to p_limit ticket ids whose receipt is due: at least 15 minutes old, not asked about in the last
-- 10 minutes (Expo answers nothing until the receipt is ready). Tickets past Expo's 24 hours are closed as
-- 'expired' and finished tickets are kept for a week.
create or replace function public.claim_push_receipts(p_limit int default 1000, p_ids uuid[] default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_out jsonb;
begin
  if not public.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.push_tickets set status = 'expired', checked_at = now()
   where status = 'pending' and created_at < now() - interval '24 hours';
  delete from public.push_tickets where status <> 'pending' and created_at < now() - interval '7 days';
  with c as (
    select ticket_id from public.push_tickets
     where status = 'pending' and created_at <= now() - interval '15 minutes'
       and (checked_at is null or checked_at < now() - interval '10 minutes')
       and (p_ids is null or notification_id = any (p_ids))
     order by created_at
     limit least(greatest(coalesce(p_limit, 1000), 1), 1000)
     for update skip locked
  ), u as (
    update public.push_tickets t set checked_at = now() from c where t.ticket_id = c.ticket_id returning t.ticket_id
  )
  select coalesce(jsonb_agg(u.ticket_id), '[]'::jsonb) into v_out from u;
  return v_out;
end $$;

-- p_receipts: [{ "ticket_id": text, "status": "ok" | "error", "error": text }]. A device Apple or Google no longer
-- knows is removed; a notification whose every ticket failed is marked failed with the reason.
create or replace function public.complete_push_receipts(p_receipts jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ids text[]; v_ok int; v_err int; v_dead int; v_failed int;
begin
  if not public.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  with u as (
    update public.push_tickets t set status = r.status, error = left(r.error, 300), checked_at = now()
      from jsonb_to_recordset(coalesce(p_receipts, '[]'::jsonb)) as r(ticket_id text, status text, error text)
     where t.ticket_id = r.ticket_id and t.status = 'pending' and r.status in ('ok', 'error')
    returning t.ticket_id, t.status
  ) select coalesce(array_agg(ticket_id), '{}'), count(*) filter (where status = 'ok'), count(*) filter (where status = 'error')
      into v_ids, v_ok, v_err from u;

  with marked as (
    update public.notifications n
       set push_status = 'failed',
           push_error = left('Sin entregar: ' || (select string_agg(distinct coalesce(t.error, 'error'), ', ') from public.push_tickets t where t.notification_id = n.id), 300)
     where n.push_status = 'sent'
       and n.id in (select t.notification_id from public.push_tickets t where t.ticket_id = any (v_ids) and t.status = 'error')
       and not exists (select 1 from public.push_tickets t where t.notification_id = n.id and t.status <> 'error')
    returning 1
  ) select count(*) into v_failed from marked;

  with gone as (
    delete from public.push_tokens pt
     where pt.token in (select t.token from public.push_tickets t where t.ticket_id = any (v_ids) and t.error = 'DeviceNotRegistered')
    returning 1
  ) select count(*) into v_dead from gone;

  return jsonb_build_object('ok', v_ok, 'error', v_err, 'notifications_failed', v_failed, 'devices_removed', v_dead);
end $$;

do $$
declare f text;
begin
  foreach f in array array['complete_push(jsonb, text[], jsonb)', 'claim_push_receipts(int, uuid[])', 'complete_push_receipts(jsonb)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- ---------- admin dashboard: health of the push channel ----------
create or replace function public.push_health() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'devices', (select count(*) from public.push_tokens),
    'sent_24h', (select count(*) from public.notifications where push_status = 'sent' and created_at > now() - interval '24 hours'),
    'failed_24h', (select count(*) from public.notifications where push_status = 'failed' and created_at > now() - interval '24 hours'),
    'confirmed_24h', (select count(*) from public.push_tickets where status = 'ok' and created_at > now() - interval '24 hours'),
    'rejected_24h', (select count(*) from public.push_tickets where status = 'error' and created_at > now() - interval '24 hours'),
    -- waiting longer than the dispatcher's one-minute schedule allows: the job or its Vault secrets are missing
    'stuck', (select count(*) from public.notifications
               where push_status in ('pending', 'sending') and not is_test and created_at < now() - interval '10 minutes'
                 and created_at > now() - interval '24 hours'),
    -- Expo, Apple or Google refusing our credentials: no device receives anything until an operator fixes it
    'credentials_error', (
      select max(at) from (
        select checked_at as at from public.push_tickets
         where status = 'error' and error in ('InvalidCredentials', 'MismatchSenderId') and checked_at > now() - interval '24 hours'
        union all
        select created_at from public.notifications
         where push_error ~ '(InvalidCredentials|MismatchSenderId)' and created_at > now() - interval '24 hours'
      ) x)
  );
end $$;
revoke execute on function public.push_health() from public, anon;
grant execute on function public.push_health() to authenticated;
