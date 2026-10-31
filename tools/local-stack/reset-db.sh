#!/usr/bin/env bash
# Destroys the LOCAL database and storage, then starts fresh with migrations + seed.
set -euo pipefail
source "$(dirname "$0")/env.sh"
bash "$(dirname "$0")/stop.sh"
rm -rf "$PGDATA" "$STORAGE_DIR"
bash "$(dirname "$0")/start.sh"
