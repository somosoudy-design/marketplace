-- =====================================================================
-- Function privileges. Postgres grants EXECUTE to PUBLIC by default and Supabase adds default
-- grants for anon/authenticated, so every internal helper would be callable through /rest/v1/rpc.
-- Internal helpers, trigger functions and job entry points are revoked here and reachable only from
-- other SECURITY DEFINER functions, the service role (edge functions, cron) or migrations.
-- A test (tests/db-tests/test/db/privileges.test.ts) keeps the exposed surface equal to an allowlist.
-- =====================================================================
do $$
declare
  r record;
  internal text[] := array[
    -- helpers used only inside SECURITY DEFINER functions
    '_group_label', '_order_payment_level', '_outstanding', '_plan_schedule', 'flow_for', 'commission_pct',
    'audit', 'check_rate_limit', 'notify', 'notify_store', 'require_store_member', 'require_admin', 'require_user',
    'is_service_role', 'setting',
    -- trigger functions
    'addresses_single_default', 'audit_trigger', 'enforce_product_moderation', 'guard_store_fields', 'handle_new_user',
    'ledger_group_balanced', 'ledger_immutable', 'notify_back_in_stock', 'products_search_vector',
    'sync_product_price', 'sync_product_stock_state', 'touch_updated_at',
    -- jobs and provider plumbing (service role only)
    'refresh_popularity', 'expire_unpaid_orders', 'record_provider_event', 'attach_provider_payment',
    'custom_access_token_hook'
  ];
begin
  for r in
    select p.oid::regprocedure as sig, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = any (internal)
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    if r.proname <> 'custom_access_token_hook' then
      execute format('grant execute on function %s to service_role', r.sig);
    end if;
  end loop;
end $$;


-- The catalog view is read-only for API roles (default privileges granted writes on it too).
revoke insert, update, delete, truncate on public.product_cards from anon, authenticated;
