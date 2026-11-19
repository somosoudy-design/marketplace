#!/usr/bin/env bash
# Copies the committed state to the shared project folder so another session can resume:
#   kora-repo.bundle  full git history (git clone kora-repo.bundle marketplace)
#   repo/             plain copy of the current commit
set -euo pipefail
DEST="${1:-/mnt/project-files/marketplace}"
cd "$(dirname "$0")/.."
mkdir -p "$DEST"
git bundle create "$DEST/kora-repo.bundle.tmp" --all >/dev/null 2>&1
mv "$DEST/kora-repo.bundle.tmp" "$DEST/kora-repo.bundle"
rm -rf "$DEST/repo.tmp" && mkdir -p "$DEST/repo.tmp"
git archive HEAD | tar -x -C "$DEST/repo.tmp"
rm -rf "$DEST/repo" && mv "$DEST/repo.tmp" "$DEST/repo"
echo "· backup $(git rev-parse --short HEAD) -> $DEST"
