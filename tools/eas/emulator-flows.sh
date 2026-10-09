#!/usr/bin/env bash
# Run by .github/workflows/apk-emulator.yml after emulator-install.sh: installs the last APK of the request
# clean, opens it once so it downloads the latest EAS Update (it runs from the next cold start), then runs every
# Maestro flow in tests/apk-flows against it. Screenshots and Maestro's own report end up in shots/.
set -u
PKG=com.example.kora.preview
out="${GITHUB_STEP_SUMMARY:-/dev/stdout}"
apk=$(ls apks/*.apk | sort -V | tail -1)
mkdir -p shots/flujos

adb uninstall "$PKG" >/dev/null 2>&1
adb install "$apk" >/dev/null
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 30
adb shell am force-stop "$PKG"

status=0
{
  echo "### Recorridos con Maestro ($(maestro --version 2>/dev/null | tail -1)) sobre $(basename "$apk")"
  echo '```'
} >>"$out"
for flow in tests/apk-flows/*.yaml; do
  name=$(basename "$flow" .yaml)
  if (cd shots/flujos && maestro test --format junit --output "$name.xml" "../../$flow") >"shots/flujos/$name.log" 2>&1; then
    echo "$name: pasó" >>"$out"
  else
    echo "$name: FALLÓ" >>"$out"
    tail -25 "shots/flujos/$name.log" >>"$out"
    status=1
  fi
done
echo '```' >>"$out"

# Maestro keeps a screenshot and the hierarchy of the failing step under ~/.maestro/tests
[ -d "$HOME/.maestro/tests" ] && cp -r "$HOME/.maestro/tests" shots/flujos/maestro 2>/dev/null
exit $status
