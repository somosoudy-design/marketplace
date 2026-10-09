#!/usr/bin/env bash
source "$(dirname "$0")/env.sh"
for p in gateway postgrest auth; do [ -f "$LOCAL_DIR/$p.pid" ] && kill "$(cat "$LOCAL_DIR/$p.pid")" 2>/dev/null; rm -f "$LOCAL_DIR/$p.pid"; done
as_pg_user "'$PG_BIN/pg_ctl' -D '$PGDATA' stop -m fast" >/dev/null 2>&1 || true
echo "stopped"
