# Shared configuration for the local Supabase-lite stack.
# These values are LOCAL-ONLY development defaults (same idea as `supabase start`).
# Never reuse them in any deployed environment.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOCAL_DIR="$ROOT_DIR/.local"
BIN_DIR="$LOCAL_DIR/bin"
PGDATA="$LOCAL_DIR/pg"
LOG_DIR="$LOCAL_DIR/logs"
STORAGE_DIR="$LOCAL_DIR/storage"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PGPORT="${PGPORT:-54322}"
GOTRUE_PORT="${GOTRUE_PORT:-9999}"
POSTGREST_PORT="${POSTGREST_PORT:-3000}"
GATEWAY_PORT="${GATEWAY_PORT:-54321}"
JWT_SECRET="${JWT_SECRET:-local-dev-jwt-secret-not-for-production-0123456789}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_URL="postgres://postgres:${DB_PASSWORD}@127.0.0.1:${PGPORT}/postgres"
POSTGREST_VERSION="v12.2.3"
GOTRUE_VERSION="v2.180.0"
RUN_AS="${RUN_AS:-}"
if [ "$(id -u)" = "0" ] && [ -z "$RUN_AS" ]; then RUN_AS="claude"; fi
as_pg_user() { if [ -n "$RUN_AS" ]; then su "$RUN_AS" -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
export ROOT_DIR LOCAL_DIR BIN_DIR PGDATA LOG_DIR STORAGE_DIR PG_BIN PGPORT GOTRUE_PORT POSTGREST_PORT GATEWAY_PORT JWT_SECRET DB_URL
