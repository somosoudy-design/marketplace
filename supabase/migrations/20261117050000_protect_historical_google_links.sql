-- Run after enabling email confirmations, before enabling Google. See docs/GOOGLE_CUENTAS_HISTORICAS.md.
-- One transaction is required so the original census and its guard are visible together.
begin;
set local lock_timeout = '5s';
lock table auth.users, auth.identities in share row exclusive mode;

create schema mayami_auth_private;
revoke all on schema mayami_auth_private from public, anon, authenticated, service_role;

create table mayami_auth_private.google_recovery (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_otp_transaction xid8,
  email_otp_session uuid,
  allow_after timestamptz
);
revoke all on mayami_auth_private.google_recovery from public, anon, authenticated, service_role;

insert into mayami_auth_private.google_recovery (user_id)
select u.id from auth.users u
where u.email is not null and u.email_confirmed_at is not null
  and nullif(u.encrypted_password, '') is not null
  and exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email')
  and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google');

-- Session deletion holds a lock on the session. Keep its timestamp separate from
-- the cohort row, which password recovery locks before revoking sessions.
create table mayami_auth_private.google_session_closures (
  user_id uuid primary key references mayami_auth_private.google_recovery(user_id) on delete cascade,
  closed_at timestamptz
);
revoke all on mayami_auth_private.google_session_closures from public, anon, authenticated, service_role;
insert into mayami_auth_private.google_session_closures(user_id)
select user_id from mayami_auth_private.google_recovery;

-- One hour is Mayami's configured maximum access-token lifetime. The extra minute covers clock skew.
-- Refresh tokens are revoked when Auth deletes their sessions, but other services accept unexpired JWTs.
create function mayami_auth_private.jwt_drain() returns interval
language sql immutable set search_path = '' as $$ select interval '61 minutes' $$;

create function mayami_auth_private.record_email_proof() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update mayami_auth_private.google_recovery
    set email_otp_transaction = null, email_otp_session = null, allow_after = null
    where user_id = new.id;
  elsif nullif(old.recovery_token, '') is not null and nullif(new.recovery_token, '') is null
      and new.recovery_sent_at is not null and new.recovery_sent_at = old.recovery_sent_at
      and new.encrypted_password is not distinct from old.encrypted_password then
    -- GoTrue consumes the email recovery/magic OTP and issues its session in the same transaction.
    -- Merely requesting a code or issuing a phone OTP cannot produce this pair.
    update mayami_auth_private.google_recovery set email_otp_transaction = pg_current_xact_id()
    where user_id = new.id;
  end if;
  return null;
end;
$$;
create trigger mayami_google_record_email_proof after update of email, recovery_token on auth.users
for each row execute function mayami_auth_private.record_email_proof();

create function mayami_auth_private.record_otp_session() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update mayami_auth_private.google_recovery g
  set email_otp_session = new.session_id, email_otp_transaction = null
  from auth.sessions s
  where s.id = new.session_id and s.user_id = g.user_id
    and g.email_otp_transaction = pg_current_xact_id();
  return null;
end;
$$;
create trigger mayami_google_otp_session after insert on auth.mfa_amr_claims
for each row when (new.authentication_method = 'otp')
execute function mayami_auth_private.record_otp_session();

create function mayami_auth_private.check_password_rotation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- At commit Auth has deleted the other sessions. A password-authenticated caller keeps
  -- its own session, so it cannot certify a change by waiting for somebody else's OTP.
  -- Clearing recovery_sent_at distinguishes a real password replacement from a hash re-encryption.
  update mayami_auth_private.google_recovery g
  set allow_after = case when old.recovery_sent_at is not null and new.recovery_sent_at is null
    and exists (select 1 from auth.sessions s where s.user_id = g.user_id and s.id = g.email_otp_session)
    and not exists (select 1 from auth.sessions s where s.user_id = g.user_id and s.id <> g.email_otp_session)
    then clock_timestamp() + mayami_auth_private.jwt_drain() end,
    email_otp_transaction = null
  where g.user_id = new.id;
  return null;
end;
$$;
create constraint trigger mayami_google_password_rotated after update of encrypted_password on auth.users
deferrable initially deferred for each row when (old.encrypted_password is distinct from new.encrypted_password)
execute function mayami_auth_private.check_password_rotation();

create function mayami_auth_private.track_new_session() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from mayami_auth_private.google_recovery where user_id = new.user_id) then
    -- GoTrue updates last_sign_in_at after inserting a session. Match recovery's lock order.
    perform 1 from auth.users where id = new.user_id for no key update;
    perform 1 from mayami_auth_private.google_recovery where user_id = new.user_id for update;
  end if;
  return new;
end;
$$;
create trigger mayami_google_new_session before insert on auth.sessions
for each row execute function mayami_auth_private.track_new_session();

create function mayami_auth_private.track_closed_sessions() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid;
begin
  -- Wait until the DELETE has acquired *all* of its session rows. Otherwise two
  -- overlapping logouts could acquire a session row and the timestamp row in opposite orders.
  for account_id in
    select distinct g.user_id from removed_sessions r
    join mayami_auth_private.google_recovery g on g.user_id = r.user_id
    where g.email_otp_session is distinct from r.id order by g.user_id
  loop
    update mayami_auth_private.google_session_closures set closed_at = clock_timestamp() where user_id = account_id;
  end loop;
  return null;
end;
$$;
create trigger mayami_google_closed_sessions after delete on auth.sessions
referencing old table as removed_sessions for each statement
execute function mayami_auth_private.track_closed_sessions();

create function mayami_auth_private.guard_google_link() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  account mayami_auth_private.google_recovery%rowtype;
  has_passkey boolean := false;
begin
  if not exists (select 1 from mayami_auth_private.google_recovery where user_id = new.user_id) then return new; end if;
  perform 1 from auth.users where id = new.user_id for no key update;
  select * into account from mayami_auth_private.google_recovery where user_id = new.user_id for update;
  if not found then return new; end if;
  -- Passkeys are standalone sign-in credentials in GoTrue versions that support them.
  if to_regclass('auth.webauthn_credentials') is not null then
    execute 'select exists (select 1 from auth.webauthn_credentials where user_id = $1)'
      into has_passkey using new.user_id;
  end if;

  if has_passkey or account.allow_after is null or account.allow_after > clock_timestamp()
     or exists (select 1 from mayami_auth_private.google_session_closures c where c.user_id = new.user_id
       and c.closed_at + mayami_auth_private.jwt_drain() > clock_timestamp())
     or new.identity_data ->> 'email_verified' is distinct from 'true'
     or not exists (select 1 from auth.users u where u.id = new.user_id
       and lower(u.email) = lower(new.identity_data ->> 'email') and nullif(u.phone, '') is null)
     or exists (select 1 from auth.sessions s where s.user_id = new.user_id
       and s.id is distinct from account.email_otp_session)
     or exists (select 1 from auth.identities i where i.user_id = new.user_id and i.provider <> 'email') then
    raise exception using errcode = 'P0001', message = 'Mayami requires verified account recovery before linking Google';
  end if;
  delete from mayami_auth_private.google_recovery where user_id = new.user_id;
  return new;
end;
$$;
create trigger mayami_google_first_identity before insert on auth.identities
for each row when (new.provider = 'google') execute function mayami_auth_private.guard_google_link();

-- No identifiers as input. Only the active, verified mailbox session can read its post-reset timing.
create function public.my_google_link_recovery_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('allow_after', greatest(g.allow_after, c.closed_at + mayami_auth_private.jwt_drain()), 'other_sessions_open', exists (
    select 1 from auth.sessions other where other.user_id = g.user_id and other.id <> current_session.id
  ))
  from mayami_auth_private.google_recovery g join mayami_auth_private.google_session_closures c using (user_id)
  join auth.sessions current_session
    on current_session.id = g.email_otp_session and current_session.user_id = g.user_id
  where g.user_id = auth.uid() and g.allow_after is not null
    and current_session.id::text = auth.jwt() ->> 'session_id'
$$;
revoke all on function public.my_google_link_recovery_status() from public, anon, authenticated, service_role;
grant execute on function public.my_google_link_recovery_status() to authenticated;

revoke all on all functions in schema mayami_auth_private from public, anon, authenticated, service_role;
commit;
