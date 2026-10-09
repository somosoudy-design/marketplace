-- =====================================================================
-- Foundation: identity, roles, settings, audit, helpers
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------- enums ----------
create type public.app_role as enum ('admin', 'superadmin');
create type public.store_member_role as enum ('owner', 'staff');

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  avatar_path text,
  preferences jsonb not null default '{}'::jsonb,
  personalization_enabled boolean not null default true,
  marketing_opt_in boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_len check (full_name is null or char_length(full_name) <= 120),
  constraint profiles_phone_len check (phone is null or char_length(phone) <= 32)
);
comment on table public.profiles is 'Public-facing user profile. Auth credentials live only in auth.users (managed by Supabase Auth).';

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id),
  primary key (user_id, role)
);
comment on table public.user_roles is 'Elevated roles. Buyer is implicit for every user; seller access comes from store_members.';

-- ---------- generic helpers ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.has_role(p_role public.app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and (role = p_role or role = 'superadmin')
  );
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'superadmin')
  );
$$;

create or replace function public.is_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'superadmin');
$$;

-- True only for the service role JWT (edge functions, server jobs) or a direct database session without
-- any JWT (migrations, seed, pg_cron). NOTE: never test current_user here: inside SECURITY DEFINER
-- functions current_user is the function owner, which would grant everyone service privileges.
create or replace function public.is_service_role() returns boolean
language sql stable as $$
  select case
    when nullif(current_setting('request.jwt.claims', true), '') is not null
      then (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    else session_user in ('postgres', 'supabase_admin')
  end;
$$;

create or replace function public.require_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.is_service_role()) then
    raise exception 'forbidden' using errcode = '42501', hint = 'admin_required';
  end if;
end $$;

create or replace function public.require_user() returns uuid
language plpgsql stable as $$
declare v uuid := auth.uid();
begin
  if v is null then
    raise exception 'authentication required' using errcode = '28000', hint = 'auth_required';
  end if;
  return v;
end $$;

-- new auth user -> profile row
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120), ''),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'phone', ''), 32), '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- settings (commercial configuration editable without code) ----------
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  is_public boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);
comment on table public.app_settings is 'Commercial rules editable from the admin panel. is_public=true keys are readable by clients.';

create or replace function public.setting(p_key text, p_default jsonb default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.app_settings where key = p_key), p_default);
$$;

-- ---------- audit log ----------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_role text,
  action text not null,
  entity text not null,
  entity_id text,
  data jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);
create index audit_log_created_idx on public.audit_log (created_at desc);
comment on table public.audit_log is 'Append-only. No UPDATE/DELETE grants for any API role.';

create or replace function public.audit(p_action text, p_entity text, p_entity_id text, p_data jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, data)
  values (
    auth.uid(),
    coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', current_user),
    p_action, p_entity, p_entity_id, p_data
  );
end $$;

create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_id text;
  v_data jsonb;
begin
  if tg_op = 'DELETE' then
    v_id := (to_jsonb(old) ->> 'id');
    v_data := jsonb_build_object('old', to_jsonb(old));
  elsif tg_op = 'UPDATE' then
    v_id := (to_jsonb(new) ->> coalesce(tg_argv[0], 'id'));
    select jsonb_object_agg(n.key, jsonb_build_object('from', o.value, 'to', n.value))
      into v_data
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o using (key)
     where n.value is distinct from o.value and n.key not in ('updated_at', 'search');
    if v_data is null then return new; end if;
  else
    v_id := (to_jsonb(new) ->> coalesce(tg_argv[0], 'id'));
    v_data := jsonb_build_object('new', to_jsonb(new));
  end if;
  perform public.audit(lower(tg_op), tg_table_name, v_id, v_data);
  return coalesce(new, old);
end $$;

create trigger app_settings_audit after insert or update or delete on public.app_settings
  for each row execute function public.audit_trigger('key');
create trigger user_roles_audit after insert or update or delete on public.user_roles
  for each row execute function public.audit_trigger('user_id');

-- ---------- rate limiting (per user, per action, fixed window) ----------
create table public.rate_limits (
  user_id uuid not null,
  action text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (user_id, action, window_start)
);

create or replace function public.check_rate_limit(p_action text, p_max int, p_window_seconds int)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_window timestamptz;
  v_hits int;
begin
  if v_user is null then return; end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limits as r (user_id, action, window_start, hits)
  values (v_user, p_action, v_window, 1)
  on conflict (user_id, action, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;
  if v_hits > p_max then
    raise exception 'rate limit exceeded for %', p_action using errcode = 'P0001', hint = 'rate_limited';
  end if;
end $$;

-- ---------- JWT custom claims (Supabase Auth hook) ----------
-- Adds app_roles to the access token so the admin web can route without extra queries.
-- Authorization decisions are still made in the database (is_admin()), never from the token alone.
create or replace function public.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_claims jsonb := event -> 'claims';
  v_roles jsonb;
  v_stores jsonb;
begin
  select coalesce(jsonb_agg(role), '[]'::jsonb) into v_roles
    from public.user_roles where user_id = (event ->> 'user_id')::uuid;
  select coalesce(jsonb_agg(store_id), '[]'::jsonb) into v_stores
    from public.store_members where user_id = (event ->> 'user_id')::uuid;
  v_claims := jsonb_set(v_claims, '{app_metadata}', coalesce(v_claims -> 'app_metadata', '{}'::jsonb));
  v_claims := jsonb_set(v_claims, '{app_metadata,roles}', v_roles);
  v_claims := jsonb_set(v_claims, '{app_metadata,stores}', v_stores);
  return jsonb_set(event, '{claims}', v_claims);
end $$;

-- ---------- account deletion requests ----------
create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text,
  status text not null default 'requested' check (status in ('requested', 'in_review', 'completed', 'rejected')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references auth.users (id),
  notes text
);
create unique index account_deletion_one_open on public.account_deletion_requests (user_id)
  where status in ('requested', 'in_review');

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.app_settings enable row level security;
alter table public.audit_log enable row level security;
alter table public.rate_limits enable row level security;
alter table public.account_deletion_requests enable row level security;

create policy profiles_self_read on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy user_roles_read on public.user_roles for select using (user_id = auth.uid() or public.is_admin());
create policy user_roles_superadmin on public.user_roles for all using (public.is_superadmin()) with check (public.is_superadmin());

create policy settings_public_read on public.app_settings for select using (is_public or public.is_admin());
create policy settings_admin_write on public.app_settings for all using (public.is_admin()) with check (public.is_admin());

create policy audit_admin_read on public.audit_log for select using (public.is_admin());

create policy deletion_self on public.account_deletion_requests for select using (user_id = auth.uid() or public.is_admin());
create policy deletion_admin_update on public.account_deletion_requests for update using (public.is_admin());

revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
revoke all on public.rate_limits from anon, authenticated;
revoke insert, delete on public.profiles from anon, authenticated;
revoke all on public.profiles from anon;
revoke all on public.account_deletion_requests from anon;
revoke insert, delete on public.account_deletion_requests from authenticated;
revoke all on public.user_roles from anon;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from anon, authenticated, public;
grant select on public.user_roles to supabase_auth_admin;

create or replace function public.request_account_deletion(p_reason text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_user uuid := public.require_user();
begin
  select id into v_id from public.account_deletion_requests
   where user_id = v_user and status in ('requested', 'in_review');
  if v_id is not null then return v_id; end if;
  insert into public.account_deletion_requests (user_id, reason) values (v_user, left(p_reason, 500)) returning id into v_id;
  perform public.audit('request', 'account_deletion', v_id::text, null);
  return v_id;
end $$;
