# Environment the edge functions see locally (hosted Supabase injects the same three variables).
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"
set -a
source "$LOCAL_DIR/keys.env"
SUPABASE_URL="http://127.0.0.1:$GATEWAY_PORT"
set +a
DENO="$ROOT_DIR/node_modules/.bin/deno"
