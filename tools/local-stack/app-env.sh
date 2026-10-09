#!/usr/bin/env bash
# Writes apps/mobile/.env.local and apps/admin/.env.local with the LOCAL stack's public keys (gitignored).
set -euo pipefail
source "$(dirname "$0")/env.sh"
source "$LOCAL_DIR/keys.env"
HOST="${APP_HOST:-127.0.0.1}"
cat > "$ROOT_DIR/apps/mobile/.env.local" <<EOT
EXPO_PUBLIC_SUPABASE_URL=http://${HOST}:${GATEWAY_PORT}
EXPO_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
EXPO_PUBLIC_PANEL_URL=http://${HOST}:3100
EOT
if [ -d "$ROOT_DIR/apps/admin" ]; then
cat > "$ROOT_DIR/apps/admin/.env.local" <<EOT
NEXT_PUBLIC_SUPABASE_URL=http://${HOST}:${GATEWAY_PORT}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
EOT
fi
echo "· wrote app env files for http://${HOST}:${GATEWAY_PORT}"
