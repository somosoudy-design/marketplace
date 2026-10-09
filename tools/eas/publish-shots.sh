#!/usr/bin/env bash
# Run by .github/workflows/apk-emulator.yml after the emulator: copies the screenshots of the run, reduced to
# JPEG, to the branch ci/capturas (folder ultima/, replaced on every run). Agents working from a container
# cannot download Actions artifacts (blob storage is outside their network policy) but can fetch a branch:
#   git fetch origin ci/capturas && git worktree add /tmp/capturas origin/ci/capturas
# The branch only holds screenshots; nothing builds from it and it never merges anywhere.
set -eu
[ -d shots ] || exit 0
command -v convert >/dev/null || { sudo apt-get update -qq && sudo apt-get install -y -qq imagemagick >/dev/null; }

work=$(mktemp -d)
git config --global user.name 'kora-ci'
git config --global user.email 'kora-ci@users.noreply.github.com'
if git fetch -q origin ci/capturas 2>/dev/null; then
  git worktree add -q "$work/tree" FETCH_HEAD
  git -C "$work/tree" checkout -q -B ci/capturas
else
  git worktree add -q --detach "$work/tree"
  git -C "$work/tree" checkout -q --orphan ci/capturas
  git -C "$work/tree" rm -rq . >/dev/null 2>&1 || true
fi

out="$work/tree/ultima"
rm -rf "$out" && mkdir -p "$out"
find shots -name '*.png' | sort | while read -r png; do
  rel=${png#shots/}
  # Maestro's own failure folders keep long timestamped names; flatten them
  name=$(echo "${rel%.png}" | tr '/ ' '__')
  convert "$png" -resize 540x -quality 72 "$out/$name.jpg"
done
cp shots/flujos/resumen.md "$out/" 2>/dev/null || true
{
  echo "# Capturas del emulador"
  echo
  echo "Ejecución ${GITHUB_RUN_ID:-local} del commit ${GITHUB_SHA:-?} ($(date -u +%Y-%m-%dT%H:%MZ))."
  echo "Solicitud: $(grep -v '^#' .github/apk-emulator-request | head -1)"
} >"$out/LEEME.md"

cd "$work/tree"
git add -A
git commit -qm "Capturas de la ejecución ${GITHUB_RUN_ID:-local}" || exit 0
git push -q origin ci/capturas
echo "Capturas publicadas en la rama ci/capturas (carpeta ultima/)."
