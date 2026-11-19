-- READ ONLY. Run only through a connection independently confirmed as Marketplace
-- (mimnotafmfasvwrclxan), after authorization. This query cannot establish project
-- identity from the generic database name. Never use bfuggvbgttvcygbexqyn.
-- No row contents, credentials, grant/role changes, migration or cleanup execution.
begin read only;
select jsonb_build_object(
 'database',current_database(),'session_role',session_user,'effective_role',current_user,
 'audit_owner',(select relowner::regrole::text from pg_class where oid='auth.audit_log_entries'::regclass),
 'audit_rls',(select relrowsecurity from pg_class where oid='auth.audit_log_entries'::regclass),
 'caller_audit_privileges',jsonb_build_object(
  'select',has_table_privilege(current_user,'auth.audit_log_entries','SELECT'),
  'update',has_table_privilege(current_user,'auth.audit_log_entries','UPDATE'),
  'delete',has_table_privilege(current_user,'auth.audit_log_entries','DELETE'),
  'trigger',has_table_privilege(current_user,'auth.audit_log_entries','TRIGGER')),
 'auth_writer_attributes',(select jsonb_build_object('superuser',rolsuper,'bypass_rls',rolbypassrls)
   from pg_roles where rolname='supabase_auth_admin'),
 'audit_columns',(select jsonb_agg(jsonb_build_object('name',column_name,'type',data_type,'nullable',is_nullable) order by ordinal_position)
   from information_schema.columns where table_schema='auth' and table_name='audit_log_entries'),
 'preclosure_body_hash',(select md5(prosrc) from pg_proc where oid=to_regprocedure('public.process_account_deletion(uuid,boolean,text)')),
 'retention_executor_exists',to_regprocedure('public.account_retention_run(integer)') is not null,
 'periodic_extension_installed',exists(select 1 from pg_extension where extname='pg_cron')
);
commit;
-- Metadata alone does NOT prove the hosted Auth writer/trigger behavior or log TTL.
-- A deployment trial on authorized fixtures and provider retention confirmation remain separate.
