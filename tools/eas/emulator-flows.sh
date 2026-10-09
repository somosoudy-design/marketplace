#!/usr/bin/env bash
# Run by .github/workflows/apk-emulator.yml after emulator-install.sh: installs the last APK of the request
# clean, opens it once so it downloads the latest EAS Update (it runs from the next cold start), then runs every
# Maestro flow in tests/apk-flows against it. Screenshots and Maestro's own report end up in shots/.
set -u
PKG=com.example.kora.preview
report=shots/flujos/resumen.md
apk=$(ls apks/*.apk | sort -V | tail -1)
mkdir -p shots/flujos
: >"$report"
adb uninstall "$PKG" >/dev/null 2>&1
adb install "$apk" >/dev/null
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 30
adb shell am force-stop "$PKG"

status=0
{
  echo "### Recorridos con Maestro ($(maestro --version 2>/dev/null | tail -1)) sobre $(basename "$apk")"
  echo '```'
} >>"$report"
for flow in tests/apk-flows/*.yaml; do
  name=$(basename "$flow" .yaml)
  if (cd shots/flujos && maestro test --format junit --output "$name.xml" "../../$flow") >"shots/flujos/$name.log" 2>&1; then
    echo "$name: pasó" >>"$report"
  else
    echo "$name: FALLÓ" >>"$report"
    tail -60 "shots/flujos/$name.log" >>"$report"
    status=1
  fi
done
echo '```' >>"$report"

# Maestro keeps a screenshot and the hierarchy of the failing step under ~/.maestro/tests
[ -d "$HOME/.maestro/tests" ] && cp -r "$HOME/.maestro/tests" shots/flujos/maestro 2>/dev/null
# the report goes to the job summary and to the log (artifacts are not always reachable from where the log is read)
[ -n "${GITHUB_STEP_SUMMARY:-}" ] && cat "$report" >>"$GITHUB_STEP_SUMMARY"
cat "$report"
exit $status
