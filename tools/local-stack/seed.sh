#!/usr/bin/env bash
# Loads reproducible development data (supabase/seed.sql) and demo assets.
set -euo pipefail
source "$(dirname "$0")/env.sh"
export PGPASSWORD="$DB_PASSWORD"
echo "· seed"
psql "$DB_URL" -q -v ON_ERROR_STOP=1 --single-transaction -f "$ROOT_DIR/supabase/seed.sql"
if [ -d "$ROOT_DIR/supabase/seed-assets" ]; then
  mkdir -p "$STORAGE_DIR"; cp -r "$ROOT_DIR/supabase/seed-assets/." "$STORAGE_DIR/"
fi
