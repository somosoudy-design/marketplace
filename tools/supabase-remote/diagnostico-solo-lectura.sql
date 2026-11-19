-- Diagnosis only. Run exclusively in Marketplace (mimnotafmfasvwrclxan).
-- Verify project identity in the dashboard/Management API BEFORE opening this transaction.
-- Never use an application service_role key. Never run the activation bundle in this phase.
-- No business writes, migrations, rate synchronization, repricing, uploads or payments.
begin transaction read only;
set local statement_timeout = '15s';

select now() as observed_at_utc,
       now() at time zone 'America/Caracas' as observed_at_caracas,
       current_setting('transaction_read_only') as transaction_read_only,
       current_setting('server_version') as server_version;

-- History only: exclude migration statement bodies, which can contain sensitive material.
select version, name from supabase_migrations.schema_migrations order by version;

-- These are migration NAMES, not both RPC names. Do not infer history from a REST 404.
select version, name from supabase_migrations.schema_migrations
 where version in ('20261011172600', '20261011174200')
    or name in ('seller_product_editor', 'seller_fulfillment_detail') order by version;

-- Existence, mode, privileges and opaque definition hash. Never emit function bodies.
select p.proname as name, pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer, p.provolatile as volatility,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute,
       md5(pg_get_functiondef(p.oid)) as definition_md5
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in (
   'current_rate', 'rate_status', 'ingest_rate', 'pricing_today', 'pricing_snapshot_current',
   'ensure_pricing_snapshot', 'invoke_edge_function', 'job_token_valid',
   'seller_dashboard', 'seller_fulfillments', 'seller_sales', 'require_store_member',
   'seller_save_product', 'seller_editor_ready', 'seller_fulfillment_detail', 'seller_orders_ready',
   'advance_fulfillment', 'set_product_costs', 'enforce_product_moderation')
 order by p.proname, arguments;

select code, name, pair, kind, adapter, enabled from public.exchange_rate_sources order by code;
select pair, primary_source, fallback_sources, enabled, max_age_minutes, margin_pct, rounding_decimals,
       manual_rate is not null and manual_valid_until > now() as manual_active,
       manual_valid_until from public.rate_policies order by pair;

-- Observation time is not automatically BCV's effective/value date. Inspect that distinction separately.
select source_code, pair, count(*) as records,
       count(*) filter (where observed_at > now()) as future_observations,
       max(observed_at) as latest_observation, max(fetched_at) as latest_fetch
  from public.exchange_rates group by source_code, pair order by pair, source_code;
select id, source_code, pair, rate, observed_at, fetched_at,
       observed_at > now() as future_observation
  from public.exchange_rates order by fetched_at desc, id desc limit 30;
select id, source_code, pair, rate, observed_at, fetched_at
  from public.exchange_rates where observed_at > now() order by observed_at, id limit 30;

-- Check rate_status / pricing_today through the existing anon REST client separately.
-- Management API read_only uses supabase_read_only_user, which can deny execution of
-- those security-definer functions even when anon is correctly authorized. Never change
-- grants or switch to service_role to work around that diagnostic restriction.
-- A future valid_until is an expiration boundary, not evidence of a future BCV rate.
select id, taken_at, valid_until, taken_at > now() as future_snapshot,
       bcv_rate, bcv_source, usdt_ves_rate, usdt_source, usd_usdt_rate, gap_pct
  from public.pricing_snapshots order by taken_at desc limit 10;
select code, currency, kind, enabled, integration_status
  from public.payment_methods order by sort, code;

-- Aggregate catalogue state only; no customers, orders, bank instructions or private assets.
select count(*) as total_products, count(*) filter (where is_demo) as demo_products,
       count(*) filter (where not is_demo) as non_demo_products from public.products;
select moderation_status, availability, is_demo, count(*) as products
  from public.products group by moderation_status, availability, is_demo
 order by moderation_status, availability, is_demo;

select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id;
select bucket_id, count(*) as objects from storage.objects group by bucket_id order by bucket_id;
select n.nspname as schema, c.relname as table_name, c.relrowsecurity as rls_enabled,
       has_table_privilege('anon', c.oid, 'INSERT') as anon_insert,
       has_table_privilege('authenticated', c.oid, 'INSERT') as authenticated_insert,
       has_table_privilege('authenticated', c.oid, 'UPDATE') as authenticated_update
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where (n.nspname = 'storage' and c.relname = 'objects')
    or (n.nspname = 'public' and c.relname in ('stores', 'store_members', 'products', 'product_images', 'product_variants'))
 order by n.nspname, c.relname;
-- Omit raw policy expressions; a policy/grant listing does not prove tenant isolation end-to-end.
select schemaname, tablename, policyname, cmd, roles,
       md5(coalesce(qual, '') || '|' || coalesce(with_check, '')) as predicate_md5
  from pg_policies where (schemaname = 'storage' and tablename = 'objects')
    or (schemaname = 'public' and tablename in ('stores', 'store_members', 'products', 'product_images', 'product_variants'))
 order by schemaname, tablename, policyname;

-- Optional domains: inspect availability first. No decrypted Vault secrets or cron commands.
select extname, extversion from pg_extension where extname in ('pg_cron', 'pg_net', 'supabase_vault');
select to_regclass('cron.job') is not null as cron_jobs_available,
       to_regclass('cron.job_run_details') is not null as cron_history_available,
       to_regclass('net._http_response') is not null as http_response_history_available,
       to_regclass('vault.secrets') is not null as vault_metadata_available;

rollback;
