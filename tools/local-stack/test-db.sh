#!/usr/bin/env bash
# Clones the local development database into `kora_test` so test suites never write to the dev data.
# Tests then run against an exact copy (schema, grants, auth tables, seed) that is rebuilt on every run.
set -euo pipefail
source "$(dirname "$0")/env.sh"
export PGPASSWORD="$DB_PASSWORD"
TEST_DB="${TEST_DB:-kora_test}"
BASE="postgres://postgres:${DB_PASSWORD}@127.0.0.1:${PGPORT}"
psql "$BASE/postgres" -q -c "drop database if exists $TEST_DB with (force)" -c "create database $TEST_DB"
"$PG_BIN/pg_dump" -Fc "$BASE/postgres" | "$PG_BIN/pg_restore" --exit-on-error -d "$BASE/$TEST_DB"
echo "· test database $TEST_DB ready"
