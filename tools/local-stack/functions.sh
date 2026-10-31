#!/usr/bin/env bash
# pnpm functions:serve  -> run the edge functions locally (foreground)
# pnpm test:functions   -> run their tests against the local stack
set -euo pipefail
source "$(dirname "$0")/functions-env.sh"
cd "$ROOT_DIR"
case "${1:-serve}" in
  serve) exec "$DENO" run --allow-net --allow-env --allow-read=supabase/functions tools/local-stack/functions-serve.ts ;;
  test)
    node tools/sync-edge-shared.mjs --check
    "$DENO" check supabase/functions/*/index.ts tools/local-stack/functions-serve.ts
    # The job token never leaves the database on a real project; locally the tests read it to play pg_cron.
    KORA_TEST_JOB_TOKEN=$(PGPASSWORD="$DB_PASSWORD" psql "$DB_URL" -Atc "select decrypted_secret from vault.decrypted_secrets where name = 'kora_job_token'")
    export KORA_TEST_JOB_TOKEN
    exec "$DENO" test --allow-net --allow-env supabase/functions/tests ;;
  *) echo "usage: functions.sh serve|test" >&2; exit 2 ;;
esac
