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
# a slow emulator makes the Pixel Launcher stop answering and its "isn't responding" dialog covers the app: the flows
# start the app themselves, so the launcher is turned off and error dialogs are hidden
adb shell settings put global hide_error_dialogs 1 >/dev/null 2>&1
adb shell pm disable-user --user 0 com.google.android.apps.nexuslauncher >/dev/null 2>&1
adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null 2>&1
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
  # flows that create a tester account need the test project with "Confirm email" off (see the workflow)
  if grep -q '^# requiere: registro-sin-correo' "$flow" && [ "${KORA_SIGNUP_AUTOCONFIRM:-false}" != true ]; then
    echo "$name: omitido (el proyecto de pruebas pide confirmar el correo)" >>"$report"
    continue
  fi
  adb logcat -c
  if (cd shots/flujos && maestro test --format junit --output "$name.xml" "../../$flow") >"shots/flujos/$name.log" 2>&1; then
    echo "$name: pasó" >>"$report"
  else
    echo "$name: FALLÓ" >>"$report"
    tail -60 "shots/flujos/$name.log" >>"$report"
    # whether the app crashed, was closed by a back press or stopped answering
    echo "-- logcat de la app --" >>"$report"
    adb logcat -d -b crash 2>/dev/null | grep -E "FATAL|Exception|Error|at " | head -25 >>"$report"
    adb logcat -d 2>/dev/null | grep -E "ReactNativeJS|AndroidRuntime|$PKG|ActivityTaskManager|WindowManager: .*kora" \
      | grep -iE "error|exception|fatal|died|finish|destroy|back|crash|ANR" | head -25 >>"$report"
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
