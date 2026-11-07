-- Proposed application migration; no production execution in this batch.
-- All cleanup orchestration is server-only. Auth identity changes use Auth Admin API;
-- physical objects use Storage API. Unclassified records keep the request pending.
do $$ begin
 if md5((select prosrc from pg_proc where oid='public.process_account_deletion(uuid,boolean,text)'::regprocedure))<>'a6be40bcca9a00f70005d89a08190c5a'
 or md5((select prosrc from pg_proc where oid='public.require_user()'::regprocedure))<>'56adbdbd37b826bef6af16e891b1eddd' then
  raise exception 'Account closure baseline differs; review before applying';
 end if;
 if to_regnamespace('account_private') is not null then raise exception 'Account module already exists'; end if;
end $$;
-- PROPOSAL ONLY. Root integrates and applies to mayami_account_close_20261107 only.
-- Simple accounts, future closure only. No financial rows or Auth/vendor schema writes.
create schema account_private;
revoke all on schema account_private from public,anon,authenticated,service_role;
create table account_private.close_jobs(
 request_id uuid primary key,
 user_id uuid not null unique,
 state text not null default 'closing' check(state in('closing','closed')),
 phase text not null default 'queued' check(phase in('queued','processing','failed','retention_pending','completed')),
 lease_token uuid, lease_until timestamptz,
 attempts integer not null default 0,
 data_cleaned boolean not null default false,
 last_code text,
 created_at timestamptz not null default now(),finished_at timestamptz,
 check(state<>'closed' or phase='completed' and data_cleaned)
);
-- Deliberately NO FK to auth.users: stale signed subjects stay blocked after hard deletion too.
alter table account_private.close_jobs enable row level security;
revoke all on account_private.close_jobs from public,anon,authenticated,service_role;
alter table public.account_deletion_requests add column cleanup_state text
 check(cleanup_state is null or cleanup_state in('processing','failed','retention_pending','completed'));

create function account_private.session_open() returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select auth.uid() is not null
 and exists(select 1 from auth.users u where u.id=auth.uid() and u.deleted_at is null
   and (u.banned_until is null or u.banned_until<=now()))
 and not exists(select 1 from account_private.close_jobs j where j.user_id=auth.uid())
$$;
revoke all on function account_private.session_open() from public,anon,authenticated,service_role;
-- Exactly one self-scoped boolean for restrictive RLS; no private-table SELECT.
grant usage on schema account_private to authenticated;
grant execute on function account_private.session_open() to authenticated;

create function account_private.assert_open() returns void
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();
begin
 if coalesce(auth.role(),'')<>'authenticated' then return; end if;
 if u is null then raise exception 'authentication required' using errcode='28000',hint='auth_required'; end if;
 perform pg_advisory_xact_lock_shared(hashtextextended('account-close:'||u::text,0));
 if not account_private.session_open() then
   raise exception 'account is closing or closed' using errcode='42501',hint='account_closed';
 end if;
end $$;
revoke all on function account_private.assert_open() from public,anon,authenticated,service_role;
-- require_user is INVOKER; this grant is only a self-scoped gate, never table access.
grant execute on function account_private.assert_open() to authenticated;

create function account_private.current_open_uid() returns uuid
language plpgsql volatile security definer set search_path=pg_catalog as $$
begin perform account_private.assert_open(); return auth.uid(); end $$;
revoke all on function account_private.current_open_uid() from public,anon,authenticated,service_role;

create or replace function public.require_user() returns uuid
language plpgsql volatile set search_path=pg_catalog as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception 'authentication required' using errcode='28000',hint='auth_required'; end if;
 perform account_private.assert_open();
 return u;
end $$;
-- Existing ACL on require_user remains unchanged.

create function public.account_request_guard() returns void
language plpgsql volatile security definer set search_path=pg_catalog as $$
begin perform account_private.assert_open(); end $$;
revoke all on function public.account_request_guard() from public,anon,authenticated,service_role;
grant execute on function public.account_request_guard() to anon,authenticated,service_role;
-- Runner-only PGRST_DB_PRE_REQUEST=public.account_request_guard; NO ALTER ROLE or production config here.

create function account_private.guard_write() returns trigger
language plpgsql volatile security definer set search_path=pg_catalog as $$
begin perform account_private.assert_open(); return null; end $$;
revoke all on function account_private.guard_write() from public,anon,authenticated,service_role;

-- Restrictive predicates for ALL RLS app tables plus Storage objects.
-- Statement write guard also covers DEFINER writes that bypass RLS.
-- Trigger name sorts before cart locks: account-close shared -> checkout -> rows.
do $$
declare r record;
begin
 for r in select n.nspname,c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind in('r','p') and (
   n.nspname in('public','cart_private','checkout_private','authoring_private','favorites_private')
   or n.nspname='storage' and c.relname='objects')
 loop
  if r.relrowsecurity then
   execute format('create policy account_open_only on %I.%I as restrictive for all to authenticated using ((select account_private.session_open())) with check ((select account_private.session_open()))',r.nspname,r.relname);
  end if;
  execute format('create trigger account_00_open before insert or update or delete on %I.%I for each statement execute function account_private.guard_write()',r.nspname,r.relname);
 end loop;
end $$;

-- Existing authenticated DEFINERs with raw auth.uid get the same actor gate.
-- Keeps signatures, return types, ACL, owner and monetary expressions.
-- Anonymous optional readers retain NULL subject; active callers retain their own UUID.
do $$
declare r record; d text; s text;
begin
 for r in select p.oid,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prokind='f' and p.prosecdef
   and has_function_privilege('authenticated',p.oid,'EXECUTE')
   and position('auth.uid()' in p.prosrc)>0
 loop
  s:=replace(r.prosrc,'auth.uid()','(select account_private.current_open_uid())');
  d:=pg_get_functiondef(r.oid);
  d:=replace(d,r.prosrc,s);
  -- A gate takes a transaction advisory lock and needs a fresh snapshot after waiting.
  d:=replace(d,' STABLE',' VOLATILE');
  execute d;
 end loop;
end $$;

create function account_private.service_only() returns void
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if not public.is_service_role() then raise exception 'service role required' using errcode='42501',hint='service_required'; end if;
end $$;
revoke all on function account_private.service_only() from public,anon,authenticated,service_role;

create function account_private.blockers(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare b jsonb:='{}'; n bigint; r record;
begin
 -- Any business history/free text remains untouched pending classification.
 for r in select * from (values
  ('orders','buyer_id'),('payments','buyer_id'),('payments','verified_by'),('payment_quotes','buyer_id'),
  ('claims','buyer_id'),('claim_messages','author_id'),('reviews','user_id'),
  ('store_members','user_id'),('user_roles','user_id'),('user_roles','granted_by'),
  ('payouts','created_by'),('payouts','paid_by'),('refunds','created_by'),('buyer_refund_payouts','paid_by'),
  ('cargo_batches','created_by'),('exchange_rates','created_by'),('pricing_snapshots','taken_by'),
  ('product_costs','updated_by'),('variant_costs','updated_by'),('rate_policies','updated_by'),
  ('app_settings','updated_by'),('account_deletion_requests','processed_by'),
  ('url_imports','created_by'),('ledger_entries','created_by'),
  ('fulfillment_events','actor_id'),('moderation_events','actor_id')
 ) v(t,c)
 loop
  execute format('select count(*) from public.%I where %I=$1',r.t,r.c) into n using p_user;
  if n>0 then b:=b||jsonb_build_object(r.t||'.'||r.c,n); end if;
 end loop;
 select count(*) into n from authoring_private.product_edit_intents where actor_id=p_user;
 if n>0 then b:=b||jsonb_build_object('authoring_intents',n); end if;
 -- Own/prefixed files only qualify as daily avatars if BOTH scope and owner are coherent.
 select count(*) into n from storage.objects o
 where ((to_jsonb(o)->>'owner')=p_user::text or (to_jsonb(o)->>'owner_id')=p_user::text
         or split_part(o.name,'/',1)=p_user::text)
 and not coalesce((
  o.bucket_id='avatars' and split_part(o.name,'/',1)=p_user::text
  and array_length(string_to_array(o.name,'/'),1)=2
  and split_part(o.name,'/',2) not in('','..','.')
  and position(chr(92) in o.name)=0
  and coalesce(nullif(to_jsonb(o)->>'owner_id',''),nullif(to_jsonb(o)->>'owner',''))=p_user::text
  and (nullif(to_jsonb(o)->>'owner','') is null or (to_jsonb(o)->>'owner')=p_user::text)
  and (nullif(to_jsonb(o)->>'owner_id','') is null or (to_jsonb(o)->>'owner_id')=p_user::text)
 ),false);
 if n>0 then b:=b||jsonb_build_object('unclassified_storage',n); end if;
 select count(*) into n from public.audit_log where (actor_id=p_user or entity='user' and entity_id=p_user::text)
  and data is not null and data<>'{}'::jsonb;
 if n>0 then b:=b||jsonb_build_object('unclassified_audit_data',n); end if;
 return b;
end $$;
revoke all on function account_private.blockers(uuid) from public,anon,authenticated,service_role;

create function account_private.lease(p_request_id uuid,p_token uuid) returns account_private.close_jobs
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare j account_private.close_jobs;
begin
 perform account_private.service_only();
 select * into j from account_private.close_jobs where request_id=p_request_id for update;
 if not found or j.state<>'closing' or j.phase<>'processing' or j.lease_token is distinct from p_token or j.lease_until<=clock_timestamp() then
  raise exception 'lease is not current' using errcode='42501',hint='closure_lease_invalid';
 end if;
 return j;
end $$;
revoke all on function account_private.lease(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.process_account_deletion(p_request_id uuid,p_approve boolean,p_notes text default null)
returns void language plpgsql volatile security definer set search_path=pg_catalog as $$
declare r public.account_deletion_requests; j account_private.close_jobs; b jsonb; target uuid;
begin
 perform public.require_admin();
 -- Take the actor gate before request/checkout rows, matching authenticated writes.
 select user_id into target from public.account_deletion_requests where id=p_request_id;
 if not found then raise exception 'request not found' using errcode='P0002'; end if;
 perform pg_advisory_xact_lock(hashtextextended('account-close:'||target::text,0));
 select * into r from public.account_deletion_requests where id=p_request_id for update;
 if not found then raise exception 'request not found' using errcode='P0002'; end if;
 if r.user_id is distinct from target then raise exception 'request changed; retry' using errcode='40001'; end if;
 select * into j from account_private.close_jobs where request_id=r.id;
 if found then
  if p_approve is true then return; end if;
  raise exception 'Approved closure cannot be rejected or reopened' using hint='closure_in_progress';
 end if; -- Stable approval replay, never undo a committed closure.
 if p_approve is null then raise exception 'Approval required' using errcode='22023'; end if;
 if r.status not in('requested','in_review') then raise exception 'already processed' using hint='already_processed'; end if;
 if not p_approve then
  if coalesce(trim(p_notes),'')='' then raise exception 'note required' using errcode='22023',hint='note_required'; end if;
  update public.account_deletion_requests set status='rejected',notes=left(p_notes,500),processed_by=auth.uid(),processed_at=now() where id=r.id;
  return;
 end if;
 -- Never wait for target locks while retaining a row lock needed by target operations.
 -- Order is account-close exclusive -> checkout; target writes take shared account-close first.
 perform pg_advisory_xact_lock(hashtextextended('checkout:'||r.user_id::text,0));
 -- Preserve the existing hard rejection BEFORE creating an irreversible closing marker.
 if exists(select 1 from public.orders where buyer_id=r.user_id and status in('placed','in_progress')) then
  raise exception 'The account has open orders' using errcode='P0001',hint='open_orders';
 end if;
 if exists(select 1 from public.user_roles where user_id=r.user_id)
 or exists(select 1 from public.store_members where user_id=r.user_id) then
  raise exception 'Remove staff access first' using errcode='P0001',hint='has_roles';
 end if;
 b:=account_private.blockers(r.user_id);
 insert into account_private.close_jobs(request_id,user_id,phase,last_code)
 values(r.id,r.user_id,case when b='{}'::jsonb then 'queued' else 'retention_pending' end,
   case when b='{}'::jsonb then null else 'retention_pending' end);
 update public.account_deletion_requests set status='in_review',
  cleanup_state=case when b='{}'::jsonb then 'processing' else 'retention_pending' end,
  processed_by=auth.uid(),processed_at=null where id=r.id;
end $$;

create function public.account_closure_capabilities() returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
begin perform public.require_admin(); return true; end $$;
revoke all on function public.account_closure_capabilities() from public,anon,authenticated,service_role;
grant execute on function public.account_closure_capabilities() to authenticated;

create function public.account_close_claim(p_request_id uuid) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare j account_private.close_jobs; b jsonb; t uuid;
begin
 perform account_private.service_only();
 select * into j from account_private.close_jobs where request_id=p_request_id for update;
 if not found then raise exception 'closure not approved' using errcode='P0002'; end if;
 if j.state='closed' then return jsonb_build_object('state','completed','user_id',j.user_id); end if;
 b:=account_private.blockers(j.user_id);
 if b<>'{}'::jsonb then
  update account_private.close_jobs set phase='retention_pending',last_code='retention_pending',lease_token=null,lease_until=null where request_id=p_request_id;
  update public.account_deletion_requests set cleanup_state='retention_pending' where id=p_request_id;
  return jsonb_build_object('state','retention_pending','user_id',j.user_id,'blockers',b);
 end if;
 if j.phase='processing' and j.lease_until>clock_timestamp() then return jsonb_build_object('state','busy','user_id',j.user_id); end if;
 t:=gen_random_uuid();
 update account_private.close_jobs set phase='processing',lease_token=t,lease_until=clock_timestamp()+interval '120 seconds',attempts=attempts+1,last_code=null where request_id=p_request_id;
 update public.account_deletion_requests set cleanup_state='processing' where id=p_request_id;
 return jsonb_build_object('state','processing','user_id',j.user_id,'lease_token',t);
end $$;

create function public.account_close_targets(p_request_id uuid,p_lease_token uuid) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare j account_private.close_jobs; b jsonb; out jsonb;
begin
 j:=account_private.lease(p_request_id,p_lease_token);
 b:=account_private.blockers(j.user_id);
 if b<>'{}'::jsonb then raise exception 'retention classification required' using errcode='P0001',hint='retention_pending'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('bucket_id',bucket_id,'name',name) order by name),'[]'::jsonb) into out
 from (select o.bucket_id,o.name from storage.objects o where o.bucket_id='avatars' and split_part(o.name,'/',1)=j.user_id::text
   and coalesce(nullif(to_jsonb(o)->>'owner_id',''),nullif(to_jsonb(o)->>'owner',''))=j.user_id::text order by o.name limit 100) x;
 return out;
end $$;

create function public.account_close_clean_data(p_request_id uuid,p_lease_token uuid) returns void
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare j account_private.close_jobs;
begin
 j:=account_private.lease(p_request_id,p_lease_token);
 if account_private.blockers(j.user_id)<>'{}'::jsonb then raise exception 'retention classification required' using errcode='P0001',hint='retention_pending'; end if;
 delete from public.addresses where user_id=j.user_id;
 delete from public.favorites where user_id=j.user_id;
 delete from public.cart_items where user_id=j.user_id;
 delete from public.stock_alerts where user_id=j.user_id;
 delete from public.user_events where user_id=j.user_id;
 delete from public.rec_events where user_id=j.user_id;
 delete from public.push_tokens where user_id=j.user_id;
 delete from public.notifications where user_id=j.user_id;
 delete from checkout_private.cart_intent_journal where buyer_id=j.user_id;
 delete from favorites_private.merge_journal where buyer_id=j.user_id;
 update public.profiles set full_name=null,phone=null,avatar_path=null,preferences='{}',personalization_enabled=false,marketing_opt_in=false where id=j.user_id;
 update public.account_deletion_requests set reason=null,notes=null where user_id=j.user_id;
 update account_private.close_jobs set data_cleaned=true where request_id=p_request_id;
end $$;

create function public.account_close_finish(p_request_id uuid,p_lease_token uuid) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare j account_private.close_jobs; u jsonb; n bigint;
begin
 perform account_private.service_only();
 select * into j from account_private.close_jobs where request_id=p_request_id for update;
 if found and j.state='closed' then return jsonb_build_object('state','completed'); end if;
 j:=account_private.lease(p_request_id,p_lease_token);
 if account_private.blockers(j.user_id)<>'{}'::jsonb then raise exception 'retention classification required' using errcode='P0001',hint='retention_pending'; end if;
 select to_jsonb(a) into u from auth.users a where id=j.user_id;
 if u is not null and (u->>'deleted_at' is null or coalesce(u->>'encrypted_password','')<>'' or
   coalesce(u->'raw_user_meta_data','{}'::jsonb)<>'{}'::jsonb or coalesce(u->'raw_app_meta_data','{}'::jsonb)<>'{}'::jsonb) then
  raise exception 'Auth cleanup incomplete' using hint='auth_cleanup_incomplete';
 end if;
 if u is not null and (coalesce(u->>'confirmation_token','')<>'' or coalesce(u->>'recovery_token','')<>''
  or coalesce(u->>'email_change_token_current','')<>'' or coalesce(u->>'email_change_token_new','')<>''
  or coalesce(u->>'phone_change_token','')<>'') then
  raise exception 'Auth one-time credentials remain' using hint='auth_cleanup_incomplete';
 end if;
 if exists(select 1 from auth.identities where user_id=j.user_id and identity_data<>'{}'::jsonb)
  or exists(select 1 from auth.sessions where user_id=j.user_id)
  or exists(select 1 from auth.refresh_tokens where user_id=j.user_id::text)
  or exists(select 1 from auth.mfa_factors where user_id=j.user_id)
  or exists(select 1 from auth.one_time_tokens where user_id=j.user_id)
  or exists(select 1 from auth.oauth_authorizations where user_id=j.user_id)
  or exists(select 1 from auth.oauth_consents where user_id=j.user_id) then
  raise exception 'Auth credentials remain' using hint='auth_cleanup_incomplete';
 end if;
 if exists(select 1 from storage.objects o where (to_jsonb(o)->>'owner')=j.user_id::text
   or (to_jsonb(o)->>'owner_id')=j.user_id::text or split_part(o.name,'/',1)=j.user_id::text) then
  raise exception 'Storage cleanup incomplete' using hint='storage_cleanup_incomplete';
 end if;
 if not j.data_cleaned or exists(select 1 from public.profiles where id=j.user_id and
  (full_name is not null or phone is not null or avatar_path is not null or preferences<>'{}'::jsonb or personalization_enabled or marketing_opt_in))
  or exists(select 1 from public.addresses where user_id=j.user_id)
  or exists(select 1 from public.favorites where user_id=j.user_id)
  or exists(select 1 from public.cart_items where user_id=j.user_id)
  or exists(select 1 from public.stock_alerts where user_id=j.user_id)
  or exists(select 1 from public.user_events where user_id=j.user_id)
  or exists(select 1 from public.rec_events where user_id=j.user_id)
  or exists(select 1 from public.push_tokens where user_id=j.user_id)
  or exists(select 1 from public.notifications where user_id=j.user_id)
  or exists(select 1 from checkout_private.cart_intent_journal where buyer_id=j.user_id)
  or exists(select 1 from favorites_private.merge_journal where buyer_id=j.user_id) then
  raise exception 'Daily data cleanup incomplete' using hint='daily_cleanup_incomplete';
 end if;
 -- Auth's own audit may retain identity fields after its official deletion API.
 -- Do not erase vendor-managed audit rows or silently classify them as financial records.
 if exists(select 1 from auth.audit_log_entries a where
   (a.payload->'traits'->>'user_id'=j.user_id::text and
      (coalesce(a.payload->'traits'->>'user_email','')<>'' or coalesce(a.payload->'traits'->>'user_phone','')<>''))
   or (a.payload->>'actor_id'=j.user_id::text and coalesce(a.payload->>'actor_username','')<>'')) then
  raise exception 'Auth audit retention requires classification' using errcode='P0001',hint='auth_audit_retention_pending';
 end if;
 update account_private.close_jobs set state='closed',phase='completed',lease_token=null,lease_until=null,finished_at=clock_timestamp(),last_code=null where request_id=p_request_id;
 update public.account_deletion_requests set status='completed',cleanup_state='completed',processed_at=now(),reason=null,notes=null where id=p_request_id;
 return jsonb_build_object('state','completed');
end $$;

create function public.account_close_fail(p_request_id uuid,p_lease_token uuid,p_code text) returns void
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare j account_private.close_jobs; c text;
begin
 j:=account_private.lease(p_request_id,p_lease_token);
 c:=case when p_code='retention_pending' then 'retention_pending' else 'failed' end;
 update account_private.close_jobs set phase=c,last_code=left(regexp_replace(coalesce(p_code,'failed'),'[^a-zA-Z0-9_:-]','','g'),80),lease_token=null,lease_until=null where request_id=p_request_id;
 update public.account_deletion_requests set cleanup_state=c where id=p_request_id;
end $$;

revoke all on function public.account_close_claim(uuid),public.account_close_targets(uuid,uuid),public.account_close_clean_data(uuid,uuid),public.account_close_finish(uuid,uuid),public.account_close_fail(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.account_close_claim(uuid),public.account_close_targets(uuid,uuid),public.account_close_clean_data(uuid,uuid),public.account_close_finish(uuid,uuid),public.account_close_fail(uuid,uuid,text) to service_role;

-- Do not let direct administrative REST UPDATE mark completed without the job receipt.
create function account_private.guard_completion() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if TG_OP='DELETE' then
  if exists(select 1 from account_private.close_jobs where request_id=old.id) then
   raise exception 'Approved closure receipt cannot be removed' using hint='closure_in_progress';
  end if;
  return old;
 end if;
 if (new.status='completed' or new.cleanup_state='completed') and
    (TG_OP='INSERT' or old.status is distinct from new.status or old.cleanup_state is distinct from new.cleanup_state)
    and not exists(select 1 from account_private.close_jobs where request_id=new.id and user_id=new.user_id and state='closed' and phase='completed') then
  raise exception 'Closure completion requires verified cleanup' using hint='closure_not_verified';
 end if;
 if TG_OP='UPDATE' and exists(select 1 from account_private.close_jobs where request_id=old.id)
 and (new.user_id is distinct from old.user_id or new.id is distinct from old.id or new.status='rejected') then
  raise exception 'Approved closure identity is immutable' using hint='closure_in_progress';
 end if;
 return new;
end $$;
revoke all on function account_private.guard_completion() from public,anon,authenticated,service_role;
create trigger account_completion_receipt before insert or update or delete on public.account_deletion_requests for each row execute function account_private.guard_completion();

-- Idempotent Auth phase verification. A retry need not repeat a successful provider deletion.
create function public.account_close_auth_ready(p_request_id uuid,p_lease_token uuid) returns boolean
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare j account_private.close_jobs; u jsonb;
begin
 j:=account_private.lease(p_request_id,p_lease_token);
 select to_jsonb(a) into u from auth.users a where id=j.user_id;
 return u is not null and u->>'deleted_at' is not null
  and coalesce(u->>'encrypted_password','')=''
  and coalesce(u->'raw_user_meta_data','{}'::jsonb)='{}'::jsonb
  and coalesce(u->'raw_app_meta_data','{}'::jsonb)='{}'::jsonb
  and coalesce(u->>'confirmation_token','')=''
  and coalesce(u->>'recovery_token','')=''
  and coalesce(u->>'email_change_token_current','')=''
  and coalesce(u->>'email_change_token_new','')=''
  and coalesce(u->>'phone_change_token','')=''
  and not exists(select 1 from auth.identities where user_id=j.user_id and identity_data<>'{}'::jsonb)
  and not exists(select 1 from auth.sessions where user_id=j.user_id)
  and not exists(select 1 from auth.refresh_tokens where user_id=j.user_id::text)
  and not exists(select 1 from auth.mfa_factors where user_id=j.user_id)
  and not exists(select 1 from auth.one_time_tokens where user_id=j.user_id)
  and not exists(select 1 from auth.oauth_authorizations where user_id=j.user_id)
  and not exists(select 1 from auth.oauth_consents where user_id=j.user_id);
end $$;
revoke all on function public.account_close_auth_ready(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.account_close_auth_ready(uuid,uuid) to service_role;
