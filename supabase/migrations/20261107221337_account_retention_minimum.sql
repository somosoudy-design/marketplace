-- Local retention module, baseline34ecd9ae. No production application in this batch.
-- Application-owned functions/tables; scoped DML/INSERT trigger on the optional Auth audit copy.
-- No internal schema changes, global grants, migration-table DML or scheduler activation.
do $$
declare r record;
begin
 for r in select * from (values
  ('account_private.session_open()', 'b9323910eaa0edeefa3762beaf03533c'),
  ('public.process_account_deletion(uuid,boolean,text)', '379bf3640c4a4b9b913bd122c94ff1d6'),
  ('public.account_close_claim(uuid)', 'f9f746a5e3c51790d199a8f722c0a5af'),
  ('public.account_close_finish(uuid,uuid)', 'aeeed54dd2c47d1469b2d38d298cb4be'),
  ('account_private.guard_completion()', 'c24d2a0b5e52d11ce90f0c03155d2ff7')
 ) v(signature,body_md5)
 loop
  if md5((select prosrc from pg_proc where oid=to_regprocedure(r.signature))) is distinct from r.body_md5 then
   raise exception 'Account receipt baseline differs: %', r.signature;
  end if;
 end loop;
 if to_regclass('account_private.closed_subjects') is not null then
  raise exception 'Receipt expiry module already exists';
 end if;
end $$;

-- This is active subject revocation + terminal replay identity, NOT an event log.
-- Hashes remain pseudonymous identifiers. They are not anonymous or zero-PII.
-- No FK: hard-deleting Auth/request must not erase the revocation boundary.
create table account_private.closed_subjects (
 subject_hash bytea primary key check(octet_length(subject_hash)=32),
 request_hash bytea not null unique check(octet_length(request_hash)=32),
 closed_at timestamptz not null
);
alter table account_private.closed_subjects enable row level security;
revoke all on account_private.closed_subjects from public,anon,authenticated,service_role;

create function account_private.closed_receipt(p_request_id uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from account_private.closed_subjects
  where request_hash=sha256(convert_to('mayami:closed-request:v1:'||p_request_id::text,'UTF8')))
$$;
revoke all on function account_private.closed_receipt(uuid) from public,anon,authenticated,service_role;

create or replace function account_private.session_open() returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select auth.uid() is not null
 and exists(select 1 from auth.users u where u.id=auth.uid() and u.deleted_at is null
   and (u.banned_until is null or u.banned_until<=now()))
 and not exists(select 1 from account_private.close_jobs j where j.user_id=auth.uid())
 and not exists(select 1 from account_private.closed_subjects s where
   s.subject_hash=sha256(convert_to('mayami:closed-subject:v1:'||auth.uid()::text,'UTF8')))
$$;
-- CREATE OR REPLACE preserves the original self-only authenticated EXECUTE grant.

-- Preserve all existing process/lease/finish verification, ACL and signatures.
-- Baseline MD5 above pins every exact source replacement. No generic RPC rewriting.
do $$
declare s text; old_fragment text; new_fragment text;
begin
 s:=pg_get_functiondef('public.process_account_deletion(uuid,boolean,text)'::regprocedure);
 s:=replace(s, E' perform public.require_admin();\n', E' perform public.require_admin();\n if account_private.closed_receipt(p_request_id) then\n  if p_approve is true then return; end if;\n  raise exception ''Verified closure cannot be reopened'' using hint=''closure_in_progress'';\n end if;\n');
 -- Both missing-row branches recheck after a concurrent GC commit; no false retry failure.
 old_fragment:='if not found then raise exception ''request not found'' using errcode=''P0002''; end if;';
 new_fragment:='if not found then
  if account_private.closed_receipt(p_request_id) then
   if p_approve is true then return; end if;
   raise exception ''Verified closure cannot be reopened'' using hint=''closure_in_progress'';
  end if;
  raise exception ''request not found'' using errcode=''P0002'';
 end if;';
 s:=replace(s,old_fragment,new_fragment);
 execute s;

 s:=pg_get_functiondef('public.account_close_claim(uuid)'::regprocedure);
 s:=replace(s,'if not found then raise exception ''closure not approved'' using errcode=''P0002''; end if;',
 'if not found then
  if account_private.closed_receipt(p_request_id) then return jsonb_build_object(''state'',''completed''); end if;
  raise exception ''closure not approved'' using errcode=''P0002'';
 end if;');
 execute s;

 s:=pg_get_functiondef('public.account_close_finish(uuid,uuid)'::regprocedure);
 s:=replace(s,'if found and j.state=''closed'' then return jsonb_build_object(''state'',''completed''); end if;',
 'if (found and j.state=''closed'') or account_private.closed_receipt(p_request_id) then return jsonb_build_object(''state'',''completed''); end if;');
 execute s;

 s:=pg_get_functiondef('account_private.guard_completion()'::regprocedure);
 s:=replace(s,E'begin\n if TG_OP=''DELETE'' then',E'begin\n if TG_OP in(''INSERT'',''UPDATE'') then\n  if exists(select 1 from account_private.closed_subjects where\n   request_hash=sha256(convert_to(''mayami:closed-request:v1:''||new.id::text,''UTF8''))\n   or subject_hash=sha256(convert_to(''mayami:closed-subject:v1:''||new.user_id::text,''UTF8''))) then\n   raise exception ''Expired closure receipt cannot be recreated'' using errcode=''42501'',hint=''closure_receipt_expired'';\n  end if;\n end if;\n if TG_OP=''DELETE'' then');
 -- Existing DELETE guard intentionally unchanged. Only this owner-only purge can
 -- remove a job; public request deletion then sees no job in the same transaction.
 execute s;
end $$;

-- A private injected clock makes exact before/after tests possible. No API role
-- may call this helper or choose a future timestamp. No global clock/GUC changes.
create function account_private.expire_receipts(p_now timestamptz,p_limit integer)
returns integer language plpgsql volatile security definer set search_path=pg_catalog as $$
declare j account_private.close_jobs; deleted_count integer:=0; changed integer;
begin
 if p_now is null or not isfinite(p_now) or p_limit is null or p_limit<1 or p_limit>1000 then
  raise exception 'Invalid receipt-expiry arguments' using errcode='22023';
 end if;
 for j in
  select x.* from account_private.close_jobs x
  join public.account_deletion_requests r on r.id=x.request_id and r.user_id=x.user_id
  where x.state='closed' and x.phase='completed' and x.data_cleaned
   and x.finished_at is not null and x.finished_at+interval '2160 hours'<=p_now
   and x.lease_token is null and x.lease_until is null
   and r.status='completed' and r.cleanup_state='completed'
   and not account_private.receipt_held(x.user_id,p_now)
   and account_private.blockers(x.user_id)='{}'::jsonb
   and account_private.audit_ready(x.user_id,p_now)
  order by x.finished_at,x.request_id
  limit p_limit for update of x skip locked
 loop
  -- An age is never authority to discard an unresolved retention hold.
  if account_private.blockers(j.user_id)<>'{}'::jsonb then continue; end if;
  if account_private.receipt_held(j.user_id,p_now) or not account_private.audit_ready(j.user_id,p_now) then continue; end if;

  -- No ON CONFLICT: a conflicting identity is an invariant failure, not success.
  insert into account_private.closed_subjects(subject_hash,request_hash,closed_at)
  values(sha256(convert_to('mayami:closed-subject:v1:'||j.user_id::text,'UTF8')),
         sha256(convert_to('mayami:closed-request:v1:'||j.request_id::text,'UTF8')),j.finished_at);
  delete from account_private.close_jobs where request_id=j.request_id;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'Receipt expiry lost its job'; end if;
  delete from public.account_deletion_requests where id=j.request_id and user_id=j.user_id
   and status='completed' and cleanup_state='completed';
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'Receipt expiry lost its request'; end if;
  deleted_count:=deleted_count+1;
 end loop;
 return deleted_count;
end $$;
revoke all on function account_private.expire_receipts(timestamptz,integer) from public,anon,authenticated,service_role;

-- Holds are specific, finite, service-managed case references, never inferred from
-- a table name. No free-text/PII, automatic legal hold, ten-year blanket or API grants.
create table account_private.retention_holds(
 id uuid primary key default gen_random_uuid(),
 subject_hash bytea not null check(octet_length(subject_hash)=32),
 scope text not null check(scope in('auth_audit','receipt')),
 audit_id uuid,
 reason_code text not null check(reason_code in('security_incident','legal_preservation')),
 case_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),
 until_at timestamptz not null check(isfinite(until_at) and until_at>created_at),
 check((scope='auth_audit' and audit_id is not null) or (scope='receipt' and audit_id is null))
);
alter table account_private.retention_holds enable row level security;
revoke all on account_private.retention_holds from public,anon,authenticated,service_role;

create table account_private.managed_auth_audit(
 audit_id uuid primary key,
 subject_hash bytea not null check(octet_length(subject_hash)=32),
 expires_at timestamptz not null,
 fingerprint bytea not null,
 disposition text not null check(disposition in('minimized','held'))
);
alter table account_private.managed_auth_audit enable row level security;
revoke all on account_private.managed_auth_audit from public,anon,authenticated,service_role;
create index managed_auth_audit_expiry on account_private.managed_auth_audit(expires_at);
create index close_receipt_expiry on account_private.close_jobs(finished_at) where state='closed';

create function account_private.subject_key(p_user uuid) returns bytea
language sql immutable set search_path=pg_catalog as $$
 select sha256(convert_to('mayami:closed-subject:v1:'||p_user::text,'UTF8'))
$$;
create function account_private.receipt_held(p_user uuid,p_now timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from account_private.retention_holds where subject_hash=account_private.subject_key(p_user)
 and scope='receipt' and created_at<=p_now and until_at>p_now)
$$;
create function account_private.audit_held(p_subject bytea,p_id uuid,p_now timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from account_private.retention_holds where subject_hash=p_subject
 and scope='auth_audit' and audit_id=p_id and created_at<=p_now and until_at>p_now)
$$;

-- Only the documented, single-subject shape is managed. Unknown fields/actions,
-- ambiguous subjects and dates keep classification pending, without erasing evidence.
create function account_private.audit_subject(p jsonb) returns uuid
language plpgsql immutable set search_path=pg_catalog as $$
declare actor text; subject text; traits jsonb;
begin
 if p is null or jsonb_typeof(p)<>'object' or
  p-array['action','actor_id','actor_name','actor_username','actor_via_sso','log_type','traits']<>'{}'::jsonb then return null; end if;
 if not coalesce(p->>'action'=any(array[
  'login','logout','invite_accepted','user_signedup','user_invited','user_deleted','user_modified',
  'user_recovery_requested','user_reauthenticate_requested','user_confirmation_requested','user_repeated_signup',
  'user_updated_password','token_revoked','token_refreshed','generate_recovery_codes','factor_in_progress',
  'factor_unenrolled','challenge_created','verification_attempted','factor_deleted','recovery_codes_deleted',
  'factor_updated','mfa_code_login','identity_unlinked']),false)
  or jsonb_typeof(p->'log_type')<>'string'
  or not coalesce(p->>'log_type'~'^[a-z_]{1,32}$',false) then return null; end if;
 if exists(select 1 from jsonb_each(p) where key in('actor_name','actor_username') and jsonb_typeof(value) not in('string','null')) then return null; end if;
 if p ? 'actor_via_sso' and jsonb_typeof(p->'actor_via_sso')<>'boolean' then return null; end if;
 traits:=coalesce(p->'traits','{}'::jsonb);
 if jsonb_typeof(traits)<>'object' or traits-array['provider','user_id','user_email','user_phone']<>'{}'::jsonb then return null; end if;
 if exists(select 1 from jsonb_each(traits) where key in('user_email','user_phone') and jsonb_typeof(value) not in('string','null')) then return null; end if;
 if traits ? 'provider' and not coalesce(traits->>'provider'=any(array['email','phone','google','apple','anonymous','sso','saml']),false) then return null; end if;
 actor:=nullif(p->>'actor_id',''); subject:=nullif(traits->>'user_id','');
 if actor='00000000-0000-0000-0000-000000000000' then actor:=null; end if;
 if (actor is not null and actor!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$')
 or (subject is not null and subject!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$') then return null; end if;
 if actor is not null and subject is not null and actor::uuid<>subject::uuid then return null; end if;
 return coalesce(subject,actor)::uuid;
end $$;

create function account_private.audit_links(p jsonb,p_user uuid) returns boolean
language sql immutable set search_path=pg_catalog as $$
 select coalesce(p->'traits'->>'user_id'=p_user::text or p->>'actor_id'=p_user::text,false)
$$;
create function account_private.audit_minimal(p jsonb,p_user uuid) returns jsonb
language sql immutable set search_path=pg_catalog as $$
 select jsonb_strip_nulls(jsonb_build_object('action',p->'action','log_type',p->'log_type',
 'actor_id',p->'actor_id','actor_via_sso',p->'actor_via_sso',
 'traits',jsonb_strip_nulls(jsonb_build_object('user_id',p_user::text,'provider',p->'traits'->'provider'))))
$$;
create function account_private.audit_fingerprint(p jsonb,p_created timestamptz,p_ip text) returns bytea
language sql immutable set search_path=pg_catalog as $$
 select sha256(convert_to(jsonb_build_object('payload',p,'created_epoch',extract(epoch from p_created),'ip',p_ip)::text,'UTF8'))
$$;

create function account_private.minimize_audit_row(p_id uuid,p_user uuid,p_now timestamptz) returns boolean
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare a auth.audit_log_entries; body jsonb; held boolean;
begin
 select * into a from auth.audit_log_entries where id=p_id for update;
 if not found or a.created_at is null or not isfinite(a.created_at)
 or account_private.audit_subject(a.payload::jsonb) is distinct from p_user then return false; end if;
 if exists(select 1 from account_private.managed_auth_audit where audit_id=a.id
   and (subject_hash<>account_private.subject_key(p_user)
    or fingerprint is distinct from account_private.audit_fingerprint(a.payload::jsonb,a.created_at,a.ip_address))) then return false; end if;
 held:=account_private.audit_held(account_private.subject_key(p_user),a.id,p_now);
 if not held then
  body:=account_private.audit_minimal(a.payload::jsonb,p_user);
  update auth.audit_log_entries set payload=body::json,ip_address='' where id=a.id;
  a.payload:=body::json; a.ip_address:='';
 end if;
 insert into account_private.managed_auth_audit(audit_id,subject_hash,expires_at,fingerprint,disposition)
 values(a.id,account_private.subject_key(p_user),a.created_at+interval '2160 hours',
   account_private.audit_fingerprint(a.payload::jsonb,a.created_at,a.ip_address),case when held then 'held' else 'minimized' end)
 on conflict(audit_id) do update set expires_at=excluded.expires_at,fingerprint=excluded.fingerprint,disposition=excluded.disposition;
 return true;
end $$;

create function account_private.audit_row_ready(p_id uuid,p_user uuid,p_now timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from auth.audit_log_entries a join account_private.managed_auth_audit m on m.audit_id=a.id
  where a.id=p_id and m.subject_hash=account_private.subject_key(p_user)
   and account_private.audit_subject(a.payload::jsonb)=p_user
   and m.fingerprint=account_private.audit_fingerprint(a.payload::jsonb,a.created_at,a.ip_address)
   and ((m.disposition='minimized' and a.payload::jsonb=account_private.audit_minimal(a.payload::jsonb,p_user) and a.ip_address='')
    or (m.disposition='held' and account_private.audit_held(m.subject_hash,a.id,p_now))))
$$;
create function account_private.audit_ready(p_user uuid,p_now timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select not exists(select 1 from auth.audit_log_entries a where account_private.audit_links(a.payload::jsonb,p_user)
  and not account_private.audit_row_ready(a.id,p_user,p_now))
 -- A rewritten subject must not make a registered fingerprint disappear from this check.
 and not exists(select 1 from account_private.managed_auth_audit m where m.subject_hash=account_private.subject_key(p_user)
  and not account_private.audit_row_ready(m.audit_id,p_user,p_now))
$$;

create function public.account_close_minimize_audit(p_request_id uuid,p_lease_token uuid) returns void
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare j account_private.close_jobs; a record;
begin
 j:=account_private.lease(p_request_id,p_lease_token);
 if not j.data_cleaned or not public.account_close_auth_ready(p_request_id,p_lease_token) then
  raise exception 'Cleanup must precede audit minimization' using hint='cleanup_not_ready';
 end if;
 if account_private.blockers(j.user_id)<>'{}'::jsonb then raise exception 'Classification required' using hint='retention_pending'; end if;
 for a in select x.id from auth.audit_log_entries x where account_private.audit_subject(x.payload::jsonb)=j.user_id
  and not account_private.audit_row_ready(x.id,j.user_id,clock_timestamp())
  and not exists(select 1 from account_private.managed_auth_audit m where m.audit_id=x.id
    and (m.subject_hash<>account_private.subject_key(j.user_id)
      or m.fingerprint is distinct from account_private.audit_fingerprint(x.payload::jsonb,x.created_at,x.ip_address)))
  order by x.created_at,x.id limit 500 for update of x skip locked
 loop perform account_private.minimize_audit_row(a.id,j.user_id,clock_timestamp()); end loop;
 -- Unknown/busy/extra rows are detected by audit_ready at finish, not silently discarded.
end $$;
revoke all on function public.account_close_minimize_audit(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.account_close_minimize_audit(uuid,uuid) to service_role;

-- GoTrue can write without HTTP JWT claims. Scope and ownership checks are internal;
-- this trigger must not require a service-role JWT or add grants to Auth/API roles.
create function account_private.guard_auth_audit_insert() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid; held boolean;
begin
 u:=account_private.audit_subject(new.payload::jsonb);
 if u is null or new.created_at is null or not isfinite(new.created_at) then return new; end if;
 if not exists(select 1 from account_private.close_jobs where user_id=u and data_cleaned
   and exists(select 1 from auth.users where id=u and deleted_at is not null))
 and not exists(select 1 from account_private.closed_subjects where subject_hash=account_private.subject_key(u)) then return new; end if;
 held:=account_private.audit_held(account_private.subject_key(u),new.id,clock_timestamp());
 if not held then new.payload:=account_private.audit_minimal(new.payload::jsonb,u)::json;new.ip_address:='';end if;
 insert into account_private.managed_auth_audit(audit_id,subject_hash,expires_at,fingerprint,disposition)
 values(new.id,account_private.subject_key(u),new.created_at+interval '2160 hours',
  account_private.audit_fingerprint(new.payload::jsonb,new.created_at,new.ip_address),case when held then 'held' else 'minimized' end);
 return new;
end $$;
create trigger mayami_minimize_closed_audit before insert on auth.audit_log_entries for each row execute function account_private.guard_auth_audit_insert();

create function account_private.expire_auth_audit(p_now timestamptz,p_limit integer) returns integer
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare m account_private.managed_auth_audit; a auth.audit_log_entries; n integer:=0;
begin
 if p_now is null or not isfinite(p_now) or p_limit is null or p_limit<1 or p_limit>1000 then raise exception 'Invalid audit expiry arguments' using errcode='22023';end if;
 for m in select x.* from account_private.managed_auth_audit x where expires_at<=p_now
  and not account_private.audit_held(x.subject_hash,x.audit_id,p_now)
  and not exists(select 1 from auth.audit_log_entries y where y.id=x.audit_id and
    (account_private.audit_subject(y.payload::jsonb) is null
     or account_private.subject_key(account_private.audit_subject(y.payload::jsonb)) is distinct from x.subject_hash
     or account_private.audit_fingerprint(y.payload::jsonb,y.created_at,y.ip_address) is distinct from x.fingerprint))
  order by expires_at,audit_id limit p_limit for update of x skip locked
 loop
  if account_private.audit_held(m.subject_hash,m.audit_id,p_now) then continue;end if;
  select * into a from auth.audit_log_entries where id=m.audit_id for update;
  if found then
   if account_private.audit_subject(a.payload::jsonb) is null
   or account_private.subject_key(account_private.audit_subject(a.payload::jsonb))<>m.subject_hash
   or account_private.audit_fingerprint(a.payload::jsonb,a.created_at,a.ip_address)<>m.fingerprint then continue;end if;
   delete from auth.audit_log_entries where id=m.audit_id; n:=n+1;
  end if;
  delete from account_private.managed_auth_audit where audit_id=m.audit_id;
 end loop;
 return n;
end $$;

-- Exact pinned old verification replaced by a scoped policy, not a zero-record rule.
do $$
declare s text; old_fragment text;
begin
 s:=pg_get_functiondef('public.account_close_finish(uuid,uuid)'::regprocedure);
 old_fragment:=$old$if exists(select 1 from auth.audit_log_entries a where
   (a.payload->'traits'->>'user_id'=j.user_id::text and
      (coalesce(a.payload->'traits'->>'user_email','')<>'' or coalesce(a.payload->'traits'->>'user_phone','')<>''))
   or (a.payload->>'actor_id'=j.user_id::text and coalesce(a.payload->>'actor_username','')<>'')) then$old$;
 if position(old_fragment in s)=0 then raise exception 'Audit finalizer baseline differs';end if;
 s:=replace(s,old_fragment,'if not account_private.audit_ready(j.user_id,clock_timestamp()) then');
 execute s;
end $$;

-- Clock injection is private/owner-only. The public executor always uses real time.
create function account_private.retention_sweep(p_now timestamptz,p_limit integer) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare a integer; r integer;
begin
 a:=account_private.expire_auth_audit(p_now,p_limit);
 r:=account_private.expire_receipts(p_now,p_limit);
 -- Expired case metadata contains no operational reason to remain after its hold ends.
 delete from account_private.retention_holds h where until_at<=p_now
  and (exists(select 1 from account_private.closed_subjects s where s.subject_hash=h.subject_hash)
    or exists(select 1 from account_private.close_jobs j where j.state='closed' and account_private.subject_key(j.user_id)=h.subject_hash));
 return jsonb_build_object('audit_rows',a,'receipts',r);
end $$;
create function public.account_retention_run(p_limit integer default 100) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
begin perform account_private.service_only();return account_private.retention_sweep(clock_timestamp(),p_limit);end $$;
revoke all on function public.account_retention_run(integer) from public,anon,authenticated,service_role;
grant execute on function public.account_retention_run(integer) to service_role;

revoke all on function account_private.subject_key(uuid),account_private.receipt_held(uuid,timestamptz),
 account_private.audit_held(bytea,uuid,timestamptz),account_private.audit_subject(jsonb),account_private.audit_links(jsonb,uuid),
 account_private.audit_minimal(jsonb,uuid),account_private.audit_fingerprint(jsonb,timestamptz,text),
 account_private.minimize_audit_row(uuid,uuid,timestamptz),account_private.audit_row_ready(uuid,uuid,timestamptz),account_private.audit_ready(uuid,timestamptz),
 account_private.guard_auth_audit_insert(),account_private.expire_auth_audit(timestamptz,integer),
 account_private.retention_sweep(timestamptz,integer) from public,anon,authenticated,service_role;
-- Deliberately no Cron job. Scheduling/hosted privilege verification is a separate activation.
