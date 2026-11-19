-- Metadata-only preflight for Marketplace/mimnotafmfasvwrclxan.
-- The operator MUST verify the official project/account in the dashboard first.
-- One SELECT; no business RPC/helper, client data, DDL/DML, locks or role changes.
-- pg_get_functiondef/pg_get_expr/has_* inspect metadata; they do not execute targets.
BEGIN TRANSACTION READ ONLY;
WITH
migration_targets(version) AS (VALUES
 ('20261107203116'),('20261107130620'),('20261107213544'),('20261107221337')
), migration_metadata AS (
 SELECT t.version,count(m.version) AS version_count,
  coalesce(jsonb_agg(jsonb_build_object('name',m.name,
   'statement_count',coalesce(cardinality(m.statements),0)))
   FILTER(WHERE m.version IS NOT NULL),'[]'::jsonb) AS rows
 FROM migration_targets t LEFT JOIN supabase_migrations.schema_migrations m USING(version)
 GROUP BY t.version
), function_targets(signature,expected_before_md5,expected_after_md5,include_definition) AS (VALUES
 ('public._build_checkout(uuid,uuid,jsonb,text)',
  '2052c218ca383e8366fd8bf85b27a833','c0cdff602e045c6bc2a976b1ed5f57c7',true),
 ('public.product_detail_commercial(uuid)',
  '62fee35a611d6593055bad973f016d6b','b8a5d5fc7b0699d66911a19cebecad53',true),
 ('checkout_private.installment_plan_eligible(public.installment_plans,numeric,public.fulfillment_flow[],boolean)',
  NULL,'e97402dedabb61fef26cc8ee7194c0b4',true),
 ('public.require_user()',NULL,NULL,false),
 ('account_private.session_open()',NULL,NULL,false),
 ('account_private.current_open_uid()',NULL,NULL,false),
 ('public._build_checkout_reviewed(uuid,uuid,jsonb,text)',NULL,NULL,false),
 ('public.cart_summary_reviewed(uuid)',NULL,NULL,false),
 ('public.checkout_preview_reviewed(uuid,jsonb,text)',NULL,NULL,false)
), function_metadata AS (
 SELECT t.signature,p.oid IS NOT NULL AS present,t.expected_before_md5,t.expected_after_md5,
  md5(p.prosrc) AS actual_body_md5,
  CASE WHEN t.expected_before_md5 IS NOT NULL THEN md5(p.prosrc)=t.expected_before_md5 END AS before_guard_matches,
  CASE WHEN t.expected_after_md5 IS NOT NULL THEN md5(p.prosrc)=t.expected_after_md5 END AS reviewed_after_matches,
  pg_get_userbyid(p.proowner) AS owner,l.lanname AS language,
  p.prosecdef,p.provolatile,p.proconfig,p.proacl::text AS acl_explicit,
  (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
    'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable)
    ORDER BY a.grantee,a.privilege_type),'[]'::jsonb)
   FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a) AS effective_acl,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') AS service_role_execute,
  position('auth.uid()' IN coalesce(p.prosrc,''))>0 AS raw_auth_uid_present,
  p.prosecdef AND has_function_privilege('authenticated',p.oid,'EXECUTE')
    AND position('auth.uid()' IN coalesce(p.prosrc,''))>0 AS matches_closure_rewrite_predicate_now,
  CASE WHEN t.include_definition THEN pg_get_functiondef(p.oid) END AS definition
 FROM function_targets t LEFT JOIN pg_proc p ON p.oid=to_regprocedure(t.signature)
 LEFT JOIN pg_language l ON l.oid=p.prolang
), schema_targets(name) AS (VALUES('public'),('checkout_private'),('account_private')),
schema_metadata AS (
 SELECT t.name,n.oid IS NOT NULL AS present,pg_get_userbyid(n.nspowner) AS owner,
  n.nspacl::text AS acl_explicit,
  (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
    'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable)
    ORDER BY a.grantee,a.privilege_type),'[]'::jsonb)
   FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a) AS effective_acl,
  has_schema_privilege('anon',n.oid,'USAGE') AS anon_usage,
  has_schema_privilege('authenticated',n.oid,'USAGE') AS authenticated_usage,
  has_schema_privilege('service_role',n.oid,'USAGE') AS service_role_usage,
  has_schema_privilege('anon',n.oid,'CREATE') AS anon_create,
  has_schema_privilege('authenticated',n.oid,'CREATE') AS authenticated_create,
  has_schema_privilege('service_role',n.oid,'CREATE') AS service_role_create
 FROM schema_targets t LEFT JOIN pg_namespace n ON n.nspname=t.name
), table_targets(name) AS (VALUES
 ('public.installment_plans'),('public.products'),('public.stores'),
 ('public.product_variants'),('public.product_images'),('public.product_variant_images'),
 ('public.addresses'),('public.cart_items'),('checkout_private.cart_intent_journal'),
 ('public.orders'),('public.order_items'),('public.fulfillments'),
 ('public.payment_obligations'),('public.payments'),('public.payment_quotes'),
 ('public.ledger_entries'),('public.refunds')
), table_metadata AS (
 SELECT t.name,c.oid IS NOT NULL AS present,pg_get_userbyid(c.relowner) AS owner,
  c.relrowsecurity,c.relforcerowsecurity,c.relacl::text AS acl_explicit,
  has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
  has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_select,
  (SELECT coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,
    'permissive',p.polpermissive,
    'roles',(SELECT jsonb_agg(CASE WHEN r=0 THEN 'PUBLIC' ELSE pg_get_userbyid(r) END ORDER BY r)
      FROM unnest(p.polroles) r),
    'using',pg_get_expr(p.polqual,p.polrelid),
    'with_check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname),'[]'::jsonb)
   FROM pg_policy p WHERE p.polrelid=c.oid) AS policies,
  (SELECT coalesce(jsonb_agg(jsonb_build_object('name',g.tgname,'enabled',g.tgenabled,
    'definition',pg_get_triggerdef(g.oid)) ORDER BY g.tgname),'[]'::jsonb)
   FROM pg_trigger g WHERE g.tgrelid=c.oid AND NOT g.tgisinternal
    AND g.tgname='account_00_open') AS closure_statement_guard
 FROM table_targets t LEFT JOIN pg_class c ON c.oid=to_regclass(t.name)
), three_parts AS (
 SELECT code,active,down_payment_pct,installments,interval_days,surcharge_pct,
  min_order_usd,allowed_flows,sort,
  active AND down_payment_pct=0 AND installments=3 AND interval_days=15
   AND surcharge_pct=0 AND min_order_usd=60
   AND allowed_flows @> ARRAY['local_stock','import_order']::public.fulfillment_flow[]
   AND allowed_flows <@ ARRAY['local_stock','import_order']::public.fulfillment_flow[] AS exact_migration_terms_guard
 FROM public.installment_plans WHERE code='three_parts'
), plan_columns AS (
 SELECT a.attnum,a.attname,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,
  pg_get_expr(d.adbin,d.adrelid) AS default_expression
 FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE a.attrelid=to_regclass('public.installment_plans') AND a.attnum>0 AND NOT a.attisdropped
), default_acl_metadata AS (
 SELECT pg_get_userbyid(d.defaclrole) AS owner,
  CASE WHEN d.defaclnamespace=0 THEN '(global)' ELSE n.nspname END AS schema,
  d.defaclobjtype,d.defaclacl::text AS acl
 FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
 WHERE d.defaclnamespace=0 OR n.nspname IN ('public','checkout_private','account_private')
)
SELECT jsonb_build_object(
 'context',jsonb_build_object('read_only',current_setting('transaction_read_only'),
   'database',current_database(),'caller',current_user,'server_version_num',current_setting('server_version_num'),
   'project_verified_by_sql',false,'project_verification','Operator must verify Marketplace/mimnotafmfasvwrclxan in the official dashboard.'),
 'migration_metadata',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.version) FROM migration_metadata m),
 'preflight_guard_summary',jsonb_build_object(
   'installments_version_absent',(SELECT version_count=0 FROM migration_metadata WHERE version='20261107203116'),
   'checkout_body_matches',(SELECT before_guard_matches FROM function_metadata WHERE signature='public._build_checkout(uuid,uuid,jsonb,text)'),
   'reader_body_matches',(SELECT before_guard_matches FROM function_metadata WHERE signature='public.product_detail_commercial(uuid)'),
   'helper_absent',(SELECT NOT present FROM function_metadata WHERE signature LIKE 'checkout_private.installment_plan_eligible(%'),
   'one_three_parts_row',(SELECT count(*)=1 FROM three_parts),
   'three_parts_terms_match',(SELECT coalesce(bool_and(exact_migration_terms_guard),false) FROM three_parts)),
 'functions',(SELECT jsonb_agg(to_jsonb(f) ORDER BY f.signature) FROM function_metadata f),
 'schemas',(SELECT jsonb_agg(to_jsonb(s) ORDER BY s.name) FROM schema_metadata s),
 'tables_and_rls',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.name) FROM table_metadata t),
 'three_parts',(SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) FROM three_parts p),
 'plan_columns',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.attnum) FROM plan_columns c),
 'default_acls',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.owner,d.schema,d.defaclobjtype),'[]'::jsonb) FROM default_acl_metadata d)
) AS installments_readonly_preflight;
ROLLBACK;
