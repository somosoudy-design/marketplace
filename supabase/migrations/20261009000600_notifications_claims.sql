-- =====================================================================
-- Notifications (in-app center + push queue) and claims (reclamos).
-- =====================================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in (
    'order_placed', 'payment_received', 'payment_confirmed', 'payment_rejected', 'fulfillment_update',
    'order_dispatched', 'order_delivered', 'installment_due', 'claim_update', 'back_in_stock',
    'seller_new_order', 'product_moderation', 'system')),
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  push_status text not null default 'pending' check (push_status in ('pending', 'sent', 'skipped', 'failed')),
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);
comment on column public.notifications.is_test is 'Seeded development notifications. Never generated for real operations.';
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_push_idx on public.notifications (push_status, created_at) where push_status = 'pending';

create table public.push_tokens (
  token text primary key check (char_length(token) between 10 and 300),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_prefs jsonb;
  v_push boolean;
begin
  select preferences into v_prefs from public.profiles where id = p_user;
  v_push := coalesce((v_prefs -> 'notifications' ->> p_kind)::boolean, (v_prefs -> 'notifications' ->> 'push')::boolean, true);
  insert into public.notifications (user_id, kind, title, body, data, push_status)
  values (p_user, p_kind, p_title, p_body, coalesce(p_data, '{}'::jsonb),
          case when v_push and exists (select 1 from public.push_tokens where user_id = p_user) then 'pending' else 'skipped' end)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.notify(uuid, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.notify_store(p_store uuid, p_kind text, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select user_id from public.store_members where store_id = p_store loop
    perform public.notify(r.user_id, p_kind, p_title, p_body, p_data);
  end loop;
end $$;
revoke execute on function public.notify_store(uuid, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.register_push_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid := public.require_user();
begin
  insert into public.push_tokens (token, user_id, platform) values (p_token, v_user, p_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, last_seen_at = now();
end $$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null) returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update public.notifications set read_at = now()
   where user_id = public.require_user() and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ---------- claims ----------
create type public.claim_status as enum ('open', 'seller_responded', 'escalated', 'resolved', 'rejected');
create sequence public.claim_number_seq start 9100;

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  order_id uuid not null references public.orders (id),
  fulfillment_id uuid not null references public.fulfillments (id),
  store_id uuid not null references public.stores (id),
  buyer_id uuid not null references auth.users (id),
  reason text not null check (reason in ('not_received', 'damaged', 'wrong_item', 'not_as_described', 'missing_parts', 'other')),
  description text not null check (char_length(description) between 10 and 2000),
  status public.claim_status not null default 'open',
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index claims_one_open_per_fulfillment on public.claims (fulfillment_id) where status in ('open', 'seller_responded', 'escalated');
create trigger claims_touch before update on public.claims for each row execute function public.touch_updated_at();
create trigger claims_audit after update of status on public.claims for each row execute function public.audit_trigger();

create table public.claim_messages (
  id bigint generated always as identity primary key,
  claim_id uuid not null references public.claims (id) on delete cascade,
  author_id uuid not null references auth.users (id),
  author_role text not null check (author_role in ('buyer', 'seller', 'admin')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index claim_messages_idx on public.claim_messages (claim_id, created_at);

alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.claims enable row level security;
alter table public.claim_messages enable row level security;

create policy notifications_own on public.notifications for select using (user_id = auth.uid());
create policy push_tokens_own on public.push_tokens for select using (user_id = auth.uid());
create policy push_tokens_delete_own on public.push_tokens for delete using (user_id = auth.uid());
create policy claims_read on public.claims for select using (
  buyer_id = auth.uid() or public.is_store_member(store_id) or public.is_admin()
);
create policy claim_messages_read on public.claim_messages for select using (
  exists (select 1 from public.claims c where c.id = claim_id and (c.buyer_id = auth.uid() or public.is_store_member(c.store_id) or public.is_admin()))
);
revoke all on public.notifications, public.push_tokens, public.claims, public.claim_messages from anon;
revoke insert, update, delete on public.notifications, public.claims, public.claim_messages from authenticated;
revoke insert, update on public.push_tokens from authenticated;

create or replace function public.open_claim(p_fulfillment_id uuid, p_reason text, p_description text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_user uuid := public.require_user(); v_f record; v_id uuid; v_number text;
begin
  perform public.check_rate_limit('open_claim', 5, 3600);
  select f.*, o.buyer_id, o.number as order_number into v_f
    from public.fulfillments f join public.orders o on o.id = f.order_id where f.id = p_fulfillment_id;
  if not found or v_f.buyer_id <> v_user then raise exception 'not found' using errcode = 'P0002'; end if;
  v_number := 'R-' || nextval('public.claim_number_seq');
  insert into public.claims (number, order_id, fulfillment_id, store_id, buyer_id, reason, description)
  values (v_number, v_f.order_id, p_fulfillment_id, v_f.store_id, v_user, p_reason, p_description) returning id into v_id;
  insert into public.claim_messages (claim_id, author_id, author_role, body) values (v_id, v_user, 'buyer', p_description);
  perform public.notify_store(v_f.store_id, 'claim_update', 'Nuevo reclamo ' || v_number,
    'Pedido ' || v_f.order_number || '. Responde dentro del plazo indicado en las normas.', jsonb_build_object('claim_id', v_id));
  return v_id;
end $$;

create or replace function public.post_claim_message(p_claim_id uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid := public.require_user(); v_c public.claims; v_role text;
begin
  perform public.check_rate_limit('claim_message', 30, 3600);
  select * into v_c from public.claims where id = p_claim_id for update;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  v_role := case when v_c.buyer_id = v_user then 'buyer'
                 when public.is_store_member(v_c.store_id) then 'seller'
                 when public.is_admin() then 'admin' end;
  if v_role is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if v_c.status in ('resolved', 'rejected') then raise exception 'claim closed' using errcode = 'P0001', hint = 'claim_closed'; end if;
  insert into public.claim_messages (claim_id, author_id, author_role, body) values (p_claim_id, v_user, v_role, p_body);
  if v_role = 'seller' and v_c.status = 'open' then
    update public.claims set status = 'seller_responded' where id = p_claim_id;
  end if;
  if v_role <> 'buyer' then
    perform public.notify(v_c.buyer_id, 'claim_update', 'Reclamo ' || v_c.number, 'Tienes una nueva respuesta.', jsonb_build_object('claim_id', p_claim_id));
  else
    perform public.notify_store(v_c.store_id, 'claim_update', 'Reclamo ' || v_c.number, 'El comprador respondió.', jsonb_build_object('claim_id', p_claim_id));
  end if;
end $$;

create or replace function public.escalate_claim(p_claim_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid := public.require_user(); v_c public.claims;
begin
  select * into v_c from public.claims where id = p_claim_id for update;
  if not found or v_c.buyer_id <> v_user then raise exception 'not found' using errcode = 'P0002'; end if;
  if v_c.status not in ('open', 'seller_responded') then raise exception 'cannot escalate' using errcode = 'P0001', hint = 'invalid_state'; end if;
  -- buyers may escalate after the seller answered, or after the configured response window
  if v_c.status = 'open' and v_c.created_at > now() - make_interval(hours => (public.setting('claims.seller_response_hours', '48'))::int) then
    raise exception 'seller response window still open' using errcode = 'P0001', hint = 'too_early';
  end if;
  update public.claims set status = 'escalated' where id = p_claim_id;
end $$;

create or replace function public.resolve_claim(p_claim_id uuid, p_status public.claim_status, p_resolution text) returns void
language plpgsql security definer set search_path = public as $$
declare v_c public.claims;
begin
  perform public.require_admin();
  if p_status not in ('resolved', 'rejected') then raise exception 'invalid status' using errcode = '22023'; end if;
  update public.claims set status = p_status, resolution = p_resolution where id = p_claim_id returning * into v_c;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  perform public.notify(v_c.buyer_id, 'claim_update', 'Reclamo ' || v_c.number || (case when p_status = 'resolved' then ' resuelto' else ' cerrado' end),
                        coalesce(p_resolution, ''), jsonb_build_object('claim_id', p_claim_id));
end $$;
