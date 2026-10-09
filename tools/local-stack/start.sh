#!/usr/bin/env bash
# Starts a Docker-free "Supabase-lite" stack: Postgres + GoTrue (Supabase Auth) + PostgREST + gateway.
# Prefer `supabase start` (Supabase CLI + Docker) on a workstation; this exists for CI/sandboxes without Docker.
set -euo pipefail
source "$(dirname "$0")/env.sh"
mkdir -p "$BIN_DIR" "$LOG_DIR" "$STORAGE_DIR"
[ -n "$RUN_AS" ] && chown -R "$RUN_AS" "$LOCAL_DIR"

if [ ! -x "$BIN_DIR/postgrest" ]; then
  echo "· downloading PostgREST $POSTGREST_VERSION"
  curl -fsSL "https://github.com/PostgREST/postgrest/releases/download/$POSTGREST_VERSION/postgrest-$POSTGREST_VERSION-linux-static-x64.tar.xz" | tar xJ -C "$BIN_DIR"
fi
if [ ! -x "$BIN_DIR/auth/auth" ]; then
  echo "· downloading Supabase Auth (GoTrue) $GOTRUE_VERSION"
  mkdir -p "$BIN_DIR/auth"
  curl -fsSL "https://github.com/supabase/auth/releases/download/$GOTRUE_VERSION/auth-$GOTRUE_VERSION-x86.tar.gz" | tar xz -C "$BIN_DIR/auth"
fi

FRESH=0
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  echo "· initdb"
  mkdir -p "$PGDATA"; [ -n "$RUN_AS" ] && chown -R "$RUN_AS" "$LOCAL_DIR"
  echo "$DB_PASSWORD" > "$LOCAL_DIR/.pwfile"; [ -n "$RUN_AS" ] && chown "$RUN_AS" "$LOCAL_DIR/.pwfile"
  as_pg_user "'$PG_BIN/initdb' -D '$PGDATA' -U postgres --pwfile='$LOCAL_DIR/.pwfile' -A scram-sha-256 >/dev/null"
  FRESH=1
fi
if ! as_pg_user "'$PG_BIN/pg_ctl' -D '$PGDATA' status" >/dev/null 2>&1; then
  as_pg_user "'$PG_BIN/pg_ctl' -D '$PGDATA' -l '$LOG_DIR/postgres.log' -o '-p $PGPORT -k /tmp -c listen_addresses=127.0.0.1' -w start" >/dev/null
fi
export PGPASSWORD="$DB_PASSWORD"
psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f "$(dirname "$0")/bootstrap.sql"

# Auth: run its own migrations, then serve
export GOTRUE_DB_DRIVER=postgres
export GOTRUE_DB_DATABASE_URL="postgres://supabase_auth_admin:postgres@127.0.0.1:$PGPORT/postgres?search_path=auth"
export GOTRUE_DB_MIGRATIONS_PATH="$BIN_DIR/auth/migrations"
export GOTRUE_API_HOST=127.0.0.1 PORT="$GOTRUE_PORT"
export API_EXTERNAL_URL="http://127.0.0.1:$GATEWAY_PORT/auth/v1"
export GOTRUE_SITE_URL="${SITE_URL:-http://127.0.0.1:3100}"
export GOTRUE_URI_ALLOW_LIST="kora://**,exp://**,http://127.0.0.1:*/**,http://localhost:*/**"
export GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated
export GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role
export GOTRUE_DISABLE_SIGNUP=false GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=true
export GOTRUE_SMTP_HOST=127.0.0.1 GOTRUE_SMTP_PORT=2500 GOTRUE_SMTP_ADMIN_EMAIL=no-reply@example.com GOTRUE_SMTP_SENDER_NAME=Kora
export GOTRUE_RATE_LIMIT_EMAIL_SENT=1000 GOTRUE_LOG_LEVEL=warn
export GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED="${GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED:-false}"
export GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI="pg-functions://postgres/public/custom_access_token_hook"
"$BIN_DIR/auth/auth" migrate >"$LOG_DIR/auth-migrate.log" 2>&1
psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f "$(dirname "$0")/post-auth.sql"

bash "$(dirname "$0")/migrate.sh"
if [ "$FRESH" = "1" ] || [ "${SEED:-0}" = "1" ]; then bash "$(dirname "$0")/seed.sh"; fi

# enable the access-token hook only once the function exists
if psql "$DB_URL" -tAc "select 1 from pg_proc where proname='custom_access_token_hook'" | grep -q 1; then
  export GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED=true
fi
pkill -f "$BIN_DIR/auth/auth serve" 2>/dev/null || true
nohup "$BIN_DIR/auth/auth" serve >"$LOG_DIR/auth.log" 2>&1 &
echo $! > "$LOCAL_DIR/auth.pid"

cat > "$LOCAL_DIR/postgrest.conf" <<CONF
db-uri = "postgres://authenticator:postgres@127.0.0.1:$PGPORT/postgres"
db-schemas = "public"
db-anon-role = "anon"
db-extra-search-path = "public, extensions"
jwt-secret = "$JWT_SECRET"
server-host = "127.0.0.1"
server-port = $POSTGREST_PORT
db-max-rows = 500
CONF
pkill -f "$BIN_DIR/postgrest" 2>/dev/null || true
nohup "$BIN_DIR/postgrest" "$LOCAL_DIR/postgrest.conf" >"$LOG_DIR/postgrest.log" 2>&1 &
echo $! > "$LOCAL_DIR/postgrest.pid"

pkill -f "local-stack/gateway.mjs" 2>/dev/null || true
nohup node "$(dirname "$0")/gateway.mjs" >"$LOG_DIR/gateway.log" 2>&1 &
echo $! > "$LOCAL_DIR/gateway.pid"

ANON_KEY=$(node "$(dirname "$0")/jwt.mjs" anon)
SERVICE_KEY=$(node "$(dirname "$0")/jwt.mjs" service_role)
cat > "$LOCAL_DIR/keys.env" <<KEYS
SUPABASE_URL=http://127.0.0.1:$GATEWAY_PORT
SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY
DATABASE_URL=$DB_URL
JWT_SECRET=$JWT_SECRET
KEYS
for i in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:$GATEWAY_PORT/auth/v1/health" >/dev/null 2>&1 && curl -fsS "http://127.0.0.1:$GATEWAY_PORT/rest/v1/" -H "apikey: $ANON_KEY" >/dev/null 2>&1; then
    echo "✓ local stack ready at http://127.0.0.1:$GATEWAY_PORT (keys in .local/keys.env)"; exit 0
  fi
  sleep 0.5
done
echo "✗ stack did not become healthy; see $LOG_DIR" >&2; exit 1
