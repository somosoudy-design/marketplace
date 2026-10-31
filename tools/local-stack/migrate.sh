#!/usr/bin/env bash
# Applies supabase/migrations/*.sql in order, recording each version (same table name the Supabase CLI uses).
set -euo pipefail
source "$(dirname "$0")/env.sh"
export PGPASSWORD="$DB_PASSWORD"
psql "$DB_URL" -q -c "create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text primary key, name text, applied_at timestamptz default now());"
for f in "$ROOT_DIR"/supabase/migrations/*.sql; do
  [ -e "$f" ] || continue
  base=$(basename "$f" .sql); version=${base%%_*}; name=${base#*_}
  if [ -z "$(psql "$DB_URL" -tAc "select 1 from supabase_migrations.schema_migrations where version='$version'")" ]; then
    echo "· migration $base"
    psql "$DB_URL" -q -v ON_ERROR_STOP=1 --single-transaction -f "$f"
    psql "$DB_URL" -q -c "insert into supabase_migrations.schema_migrations(version,name) values ('$version','$name')"
  fi
done
psql "$DB_URL" -q -c "notify pgrst, 'reload schema'" || true
