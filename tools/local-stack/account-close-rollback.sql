\set ON_ERROR_STOP on
\if :{?buyer_uuid}
\else
\echo 'Supply buyer_uuid, admin_uuid and request_uuid from an active local API fixture.'
\quit 2
\endif
\if :{?admin_uuid}
\else
\quit 2
\endif
\if :{?request_uuid}
\else
\quit 2
\endif
BEGIN;
SET LOCAL statement_timeout = '8s';
SELECT set_config('account_test.buyer', :'buyer_uuid', true) AS fixture_buyer,
       set_config('account_test.admin', :'admin_uuid', true) AS fixture_admin,
       set_config('account_test.request', :'request_uuid', true) AS fixture_request \gset
DO $guard$
DECLARE b uuid:=current_setting('account_test.buyer')::uuid; a uuid:=current_setting('account_test.admin')::uuid; r uuid:=current_setting('account_test.request')::uuid;
BEGIN
 IF current_database()<>'mayami_account_close_20261107' OR host(inet_server_addr())<>'127.0.0.1' OR inet_server_port()<>55437 THEN RAISE EXCEPTION 'Wrong isolated clone'; END IF;
 IF b=a OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=b AND email LIKE '%@example.com' AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()))
 OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=a AND email LIKE '%@example.com' AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now())) THEN RAISE EXCEPTION 'Use distinct active local example.com fixtures'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=a AND role IN('admin','superadmin')) THEN RAISE EXCEPTION 'Fixture operator is not an admin'; END IF;
 IF EXISTS(SELECT 1 FROM account_private.close_jobs WHERE user_id=b) OR account_private.blockers(b)<>'{}'::jsonb THEN RAISE EXCEPTION 'Fixture buyer must have no approved closure or unclassified history'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.account_deletion_requests WHERE id=r AND user_id=b AND status IN('requested','in_review')) THEN RAISE EXCEPTION 'Fixture needs a preexisting requested/in_review row created by its API'; END IF;
 PERFORM set_config('account_test.auth_hash',(SELECT md5(to_jsonb(u)::text) FROM auth.users u WHERE id=b),true);
 PERFORM set_config('account_test.profile_hash',(SELECT md5(to_jsonb(p)::text) FROM public.profiles p WHERE id=b),true);
 PERFORM set_config('account_test.request_hash',(SELECT md5(to_jsonb(d)::text) FROM public.account_deletion_requests d WHERE id=r),true);
END $guard$;

-- ACL: actual SQL roles, not just claims. These are SQL unit assertions, not JWT verification.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims','{"role":"anon"}',true) \gset
DO $acl$
DECLARE q text; r uuid:=current_setting('account_test.request')::uuid; nonce uuid:=gen_random_uuid();
BEGIN
 FOREACH q IN ARRAY ARRAY[
  'select public.account_close_claim($1)',
  'select public.account_close_targets($1,$2)',
  'select public.account_close_clean_data($1,$2)',
  'select public.account_close_finish($1,$2)',
  'select public.account_close_auth_ready($1,$2)',
  'select public.account_close_fail($1,$2,$3)'
 ] LOOP
  BEGIN EXECUTE q USING r,nonce,'test'; RAISE EXCEPTION 'Anon unexpectedly executed service RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 END LOOP;
END $acl$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('account_test.buyer'))::text,true) \gset
DO $acl$
DECLARE q text; r uuid:=current_setting('account_test.request')::uuid; nonce uuid:=gen_random_uuid();
BEGIN
 FOREACH q IN ARRAY ARRAY[
  'select public.account_close_claim($1)',
  'select public.account_close_targets($1,$2)',
  'select public.account_close_clean_data($1,$2)',
  'select public.account_close_finish($1,$2)',
  'select public.account_close_auth_ready($1,$2)',
  'select public.account_close_fail($1,$2,$3)'
 ] LOOP
  BEGIN EXECUTE q USING r,nonce,'test'; RAISE EXCEPTION 'Buyer unexpectedly executed service RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 END LOOP;
 BEGIN PERFORM public.process_account_deletion(r,true,'SQL isolated fixture'); RAISE EXCEPTION 'Buyer unexpectedly approved closure';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $acl$;
RESET ROLE;
SELECT set_config('request.jwt.claims','',true) \gset

-- No receipt exists, so even an operator's direct update must not fabricate completed.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('account_test.admin'))::text,true) \gset
DO $receipt$
DECLARE hint text;
BEGIN
 BEGIN
  UPDATE public.account_deletion_requests SET status='completed',cleanup_state='completed' WHERE id=current_setting('account_test.request')::uuid;
  RAISE EXCEPTION 'Operator fabricated completed without a receipt';
 EXCEPTION WHEN raise_exception THEN
  GET STACKED DIAGNOSTICS hint=PG_EXCEPTION_HINT;
  IF hint IS DISTINCT FROM 'closure_not_verified' THEN RAISE; END IF;
 END;
END $receipt$;
RESET ROLE;
SELECT set_config('request.jwt.claims','',true) \gset

SAVEPOINT staff_case;
INSERT INTO public.user_roles(user_id,role,granted_by) VALUES(current_setting('account_test.buyer')::uuid,'admin',current_setting('account_test.admin')::uuid);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('account_test.admin'))::text,true) \gset
DO $staff$
DECLARE hint text;
BEGIN
 BEGIN PERFORM public.process_account_deletion(current_setting('account_test.request')::uuid,true,'Local staff guard'); RAISE EXCEPTION 'Staff closure was accepted';
 EXCEPTION WHEN raise_exception THEN
  GET STACKED DIAGNOSTICS hint=PG_EXCEPTION_HINT;
  IF hint IS DISTINCT FROM 'has_roles' THEN RAISE; END IF;
 END;
END $staff$;
RESET ROLE;
SELECT set_config('request.jwt.claims','',true) \gset
DO $preserve$ BEGIN
 IF EXISTS(SELECT 1 FROM account_private.close_jobs WHERE request_id=current_setting('account_test.request')::uuid) THEN RAISE EXCEPTION 'Staff guard left an irreversible marker'; END IF;
END $preserve$;
ROLLBACK TO SAVEPOINT staff_case;

-- Disposable transaction-only order. No place_order/payment API, external money, ledger or receipt.
SAVEPOINT open_order_case;
INSERT INTO public.orders(number,buyer_id,status,items_usd,total_usd,plan_code,ship_to,idempotency_key,is_demo)
VALUES('LOCAL-CLOSE-'||gen_random_uuid()::text,current_setting('account_test.buyer')::uuid,'placed',0,0,'full','{}'::jsonb,'local-close-'||gen_random_uuid()::text,true);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('account_test.admin'))::text,true) \gset
DO $orders$
DECLARE hint text;
BEGIN
 BEGIN PERFORM public.process_account_deletion(current_setting('account_test.request')::uuid,true,'Local open-order guard'); RAISE EXCEPTION 'Open order closure was accepted';
 EXCEPTION WHEN raise_exception THEN
  GET STACKED DIAGNOSTICS hint=PG_EXCEPTION_HINT;
  IF hint IS DISTINCT FROM 'open_orders' THEN RAISE; END IF;
 END;
END $orders$;
RESET ROLE;
SELECT set_config('request.jwt.claims','',true) \gset
DO $preserve$ BEGIN
 IF EXISTS(SELECT 1 FROM account_private.close_jobs WHERE request_id=current_setting('account_test.request')::uuid) THEN RAISE EXCEPTION 'Open-order guard left an irreversible marker'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.orders WHERE buyer_id=current_setting('account_test.buyer')::uuid AND number LIKE 'LOCAL-CLOSE-%' AND status='placed' AND total_usd=0) THEN RAISE EXCEPTION 'Guard changed its order fixture'; END IF;
END $preserve$;
ROLLBACK TO SAVEPOINT open_order_case;


-- Historical commerce is held for classification; never sent to Auth/Storage cleanup.
SAVEPOINT commercial_history_case;
INSERT INTO public.orders(number,buyer_id,status,items_usd,total_usd,plan_code,ship_to,idempotency_key,is_demo)
VALUES('LOCAL-CLOSE-'||gen_random_uuid()::text,current_setting('account_test.buyer')::uuid,'cancelled',0,0,'full','{}'::jsonb,'local-close-'||gen_random_uuid()::text,true);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('account_test.admin'))::text,true) \gset
SELECT public.process_account_deletion(current_setting('account_test.request')::uuid,true,'Local history hold');
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true) \gset
DO $history$
DECLARE j jsonb;
BEGIN
 j:=public.account_close_claim(current_setting('account_test.request')::uuid);
 IF j->>'state'<>'retention_pending' OR j->'blockers'->>'orders.buyer_id'<>'1' OR j ? 'lease_token' THEN RAISE EXCEPTION 'Commercial history was not held before cleanup'; END IF;
END $history$;
RESET ROLE;
SELECT set_config('request.jwt.claims','',true) \gset
DO $history_preserved$ BEGIN
 IF (SELECT md5(to_jsonb(u)::text) FROM auth.users u WHERE id=current_setting('account_test.buyer')::uuid) IS DISTINCT FROM current_setting('account_test.auth_hash') THEN RAISE EXCEPTION 'Commercial hold changed Auth'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.orders WHERE buyer_id=current_setting('account_test.buyer')::uuid AND number LIKE 'LOCAL-CLOSE-%' AND status='cancelled') THEN RAISE EXCEPTION 'Commercial history was deleted'; END IF;
END $history_preserved$;
ROLLBACK TO SAVEPOINT commercial_history_case;

SAVEPOINT approved_case;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('account_test.admin'))::text,true) \gset
SELECT public.process_account_deletion(current_setting('account_test.request')::uuid,true,'Local rollback-only approval');
-- Approval replay cannot change the target or reopen/delete its receipt.
SELECT public.process_account_deletion(current_setting('account_test.request')::uuid,true,'Replay');
DO $receipt$
DECLARE hint text;
BEGIN
 BEGIN DELETE FROM public.account_deletion_requests WHERE id=current_setting('account_test.request')::uuid; RAISE EXCEPTION 'Approved receipt was deleted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; WHEN raise_exception THEN GET STACKED DIAGNOSTICS hint=PG_EXCEPTION_HINT; IF hint IS DISTINCT FROM 'closure_in_progress' THEN RAISE; END IF; END;
 BEGIN UPDATE public.account_deletion_requests SET status='completed',cleanup_state='completed' WHERE id=current_setting('account_test.request')::uuid; RAISE EXCEPTION 'Unverified closure was completed';
 EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS hint=PG_EXCEPTION_HINT; IF hint IS DISTINCT FROM 'closure_not_verified' THEN RAISE; END IF; END;
END $receipt$;
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true) \gset
DO $lease$
DECLARE j jsonb; busy jsonb; q text; hint text; r uuid:=current_setting('account_test.request')::uuid; wrong uuid:=gen_random_uuid();
BEGIN
 j:=public.account_close_claim(r);
 IF j->>'state'<>'processing' OR j->>'user_id'<>current_setting('account_test.buyer') THEN RAISE EXCEPTION 'Unexpected service claim'; END IF;
 PERFORM set_config('account_test.lease',j->>'lease_token',true);
 busy:=public.account_close_claim(r); IF busy->>'state'<>'busy' THEN RAISE EXCEPTION 'A second worker acquired an active lease'; END IF;
 FOREACH q IN ARRAY ARRAY[
  'select public.account_close_targets($1,$2)',
  'select public.account_close_clean_data($1,$2)',
  'select public.account_close_finish($1,$2)',
  'select public.account_close_auth_ready($1,$2)',
  'select public.account_close_fail($1,$2,$3)'
 ] LOOP
  BEGIN EXECUTE q USING r,wrong,'test'; RAISE EXCEPTION 'Wrong lease was accepted';
  EXCEPTION WHEN insufficient_privilege THEN GET STACKED DIAGNOSTICS hint=PG_EXCEPTION_HINT; IF hint IS DISTINCT FROM 'closure_lease_invalid' THEN RAISE; END IF; END;
 END LOOP;
 -- No Auth API ran and the buyer remains live; finishing must fail closed.
 IF public.account_close_auth_ready(r,(j->>'lease_token')::uuid) IS NOT FALSE THEN RAISE EXCEPTION 'Live Auth fixture incorrectly ready'; END IF;
 BEGIN PERFORM public.account_close_finish(r,(j->>'lease_token')::uuid); RAISE EXCEPTION 'Live Auth was marked completed';
 EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS hint=PG_EXCEPTION_HINT; IF hint IS DISTINCT FROM 'auth_cleanup_incomplete' THEN RAISE; END IF; END;
END $lease$;
RESET ROLE;
SELECT set_config('request.jwt.claims','',true) \gset
UPDATE account_private.close_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE request_id=current_setting('account_test.request')::uuid;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true) \gset
DO $expired$
DECLARE hint text;
BEGIN
 BEGIN PERFORM public.account_close_targets(current_setting('account_test.request')::uuid,current_setting('account_test.lease')::uuid); RAISE EXCEPTION 'Expired lease accepted';
 EXCEPTION WHEN insufficient_privilege THEN GET STACKED DIAGNOSTICS hint=PG_EXCEPTION_HINT; IF hint IS DISTINCT FROM 'closure_lease_invalid' THEN RAISE; END IF; END;
END $expired$;
RESET ROLE;
SELECT set_config('request.jwt.claims','',true) \gset
ROLLBACK TO SAVEPOINT approved_case;

DO $preserved$
DECLARE b uuid:=current_setting('account_test.buyer')::uuid; r uuid:=current_setting('account_test.request')::uuid;
BEGIN
 IF (SELECT md5(to_jsonb(u)::text) FROM auth.users u WHERE id=b) IS DISTINCT FROM current_setting('account_test.auth_hash') THEN RAISE EXCEPTION 'Auth fixture changed'; END IF;
 IF (SELECT md5(to_jsonb(p)::text) FROM public.profiles p WHERE id=b) IS DISTINCT FROM current_setting('account_test.profile_hash') THEN RAISE EXCEPTION 'Profile changed'; END IF;
 IF (SELECT md5(to_jsonb(d)::text) FROM public.account_deletion_requests d WHERE id=r) IS DISTINCT FROM current_setting('account_test.request_hash') THEN RAISE EXCEPTION 'Request changed after rollback'; END IF;
 IF EXISTS(SELECT 1 FROM account_private.close_jobs WHERE request_id=r) THEN RAISE EXCEPTION 'A cleanup marker survived rollback'; END IF;
END $preserved$;
ROLLBACK;
\echo 'PASS: ACL, unverified completed, staff/open-order rejection, lease and row preservation; all transactions rolled back.'
