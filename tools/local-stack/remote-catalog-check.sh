#!/usr/bin/env bash
# Checks supabase/remote-demo/*.sql against a scratch database built like the hosted project (migrations only, no
# seed): load, refuse a second load, remove, load again, buy as a new user and report a payment, then remove
# with an order present (must hide, not delete). Leaves the local development database untouched.
set -euo pipefail
source "$(dirname "$0")/env.sh"
export PGPASSWORD="$DB_PASSWORD"
SIM="postgres://postgres:${DB_PASSWORD}@127.0.0.1:${PGPORT}/remote_sim"
LOAD="$ROOT_DIR/supabase/remote-demo/catalogo-demo.sql"
REMOVE="$ROOT_DIR/supabase/remote-demo/quitar-catalogo-demo.sql"
q() { psql "$SIM" -v ON_ERROR_STOP=1 -tAq "$@"; }
expect() { [ "$2" = "$3" ] && echo "  ok  $1" || { echo "  FAIL $1: got '$2', want '$3'"; exit 1; }; }

psql "$DB_URL" -qc "drop database if exists remote_sim" 2>/dev/null
psql "$DB_URL" -qc "create database remote_sim"
trap 'psql "$DB_URL" -qc "drop database if exists remote_sim" >/dev/null 2>&1 || true' EXIT
q -f "$(dirname "$0")/bootstrap.sql" >/dev/null 2>&1
GOTRUE_DB_DRIVER=postgres GOTRUE_DB_DATABASE_URL="postgres://supabase_auth_admin:postgres@127.0.0.1:$PGPORT/remote_sim?search_path=auth" \
  GOTRUE_DB_MIGRATIONS_PATH="$BIN_DIR/auth/migrations" API_EXTERNAL_URL=http://127.0.0.1 GOTRUE_SITE_URL=http://127.0.0.1 \
  GOTRUE_JWT_SECRET="$JWT_SECRET" "$BIN_DIR/auth/auth" migrate >/dev/null 2>&1
q -f "$(dirname "$0")/post-auth.sql"
for f in "$ROOT_DIR"/supabase/migrations/*.sql; do q --single-transaction -f "$f" >/dev/null 2>&1 || { echo "migration failed: $f"; exit 1; }; done
echo "· remote demo catalog against migrations only"

q -f "$LOAD"
expect "loads 5 stores" "$(q -c "select count(*) from stores where is_demo")" 5
expect "every image is a Storage path, none on GitHub" "$(q -c "select (select count(*) from product_images where path not like 'demo/%') + (select count(*) from stores where logo_path not like 'demo/%' or cover_path not like 'demo/%')")" 0
expect "creates no users or members" "$(q -c "select (select count(*) from auth.users) + (select count(*) from store_members)")" 0
expect "adds no exchange rates" "$(q -c "select count(*) from exchange_rates")" 0
expect "second load refused" "$(q -f "$LOAD" 2>&1 | grep -c 'ya está cargado')" 1
expect "anon sees the catalog" "$(q -c "set role anon; select count(*) > 30 from search_products(null, null, null, null, null, null, 'relevance', 50, 0, null)" | tail -1)" t

q -f "$REMOVE" 2>/dev/null
expect "removal leaves nothing" "$(q -c "select (select count(*) from stores) + (select count(*) from products) + (select count(*) from categories) + (select count(*) from carriers) + (select count(*) from shipping_zones) + (select count(*) from collections) + (select count(*) from payment_methods where enabled or instructions <> '{}')")" 0

q -f "$LOAD"
UID_='11111111-1111-4111-a111-111111111111'
q -c "insert into exchange_rates (source_code, pair, rate, observed_at, raw) values ('dolarapi_oficial', 'USD/VES', 875.65, now(), '{\"check\":true}')"
q -c "insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, reauthentication_token, phone_change, phone_change_token)
  values ('00000000-0000-0000-0000-000000000000', '$UID_', 'authenticated', 'authenticated', 'check-buyer@example.com', '', now(), '{\"provider\":\"email\"}', '{\"full_name\":\"Comprador de prueba\"}', now(), now(), '', '', '', '', '', '', '', '')"
paid=$(q <<SQL
begin;
select set_config('request.jwt.claims', '{"sub":"$UID_","role":"authenticated"}', true) \\g /dev/null
set local role authenticated;
insert into addresses (user_id, recipient, phone, region_code, city, line1) values ('$UID_', 'Comprador de prueba', '+58 412 000 0000', 'A', 'Caracas', 'Dirección de prueba') returning id as addr \\gset
select cart_add((select v.id from product_variants v join products p on p.id = v.product_id where p.slug = 'ugreen-nexode-65w' order by v.sort limit 1), 1) \\g /dev/null
select (place_order(:'addr', '{}', 'full', 'check-order'))::jsonb ->> 'order_id' as oid \\gset
select (create_payment_quote(:'oid', 'pago_movil', null))::jsonb ->> 'id' as qid \\gset
select (submit_payment(:'qid'::uuid, '12345678', null, '{}'::jsonb, 'check-pay'))::jsonb ->> 'status';
commit;
SQL
)
expect "a new buyer orders and reports a payment" "$(echo "$paid" | grep -v '^$' | tail -1)" pending_verification
expect "the order stays unpaid until verified" "$(q -c "select payment_status from orders")" unpaid

q -f "$REMOVE" 2>/dev/null
expect "with orders, removal hides instead of deleting" "$(q -c "select (select count(*) from stores where status = 'suspended') || '/' || (select count(*) from orders)")" 5/1
expect "hidden catalog is out of search" "$(q -c "set role anon; select count(*) from search_products(null, null, null, null, null, null, 'relevance', 50, 0, null)" | tail -1)" 0
echo "remote demo catalog: all checks passed"
