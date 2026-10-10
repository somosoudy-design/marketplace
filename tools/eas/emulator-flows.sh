#!/usr/bin/env bash
# Run by .github/workflows/apk-emulator.yml after emulator-install.sh: installs the last APK of the request
# clean, opens it once so it downloads the latest EAS Update (it runs from the next cold start), then runs every
# Maestro flow in tests/apk-flows against it. Optional "flows:" and "themes:" lines in the request restrict the
# run to selected journeys/themes (e.g. visitor-only UI checks, without creating remote accounts or orders).
# Screenshots and Maestro's own report end up in shots/.
set -u
repo_root=$(pwd)
requested=$(sed -n 's/^flows: //p' .github/apk-emulator-request | head -1)
themes=$(sed -n 's/^themes: //p' .github/apk-emulator-request | head -1)
flows=(tests/apk-flows/*.yaml)
if [ -n "$requested" ]; then
  flows=()
  for name in $requested; do
    # Only paths beneath tests/apk-flows; reject typos before opening the emulator or running other journeys.
    if ! [[ "$name" =~ ^[a-z0-9][a-z0-9/-]*$ ]] || [ ! -f "tests/apk-flows/$name.yaml" ]; then
      echo "Recorrido solicitado inválido: $name" >&2
      exit 1
    fi
    flows+=("tests/apk-flows/$name.yaml")
  done
fi
for theme in ${themes:-system}; do
  case "$theme" in system|light|dark) ;; *) echo "Tema solicitado inválido: $theme" >&2; exit 1 ;; esac
done
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

run_flow() { # flow, log name
  mkdir -p "shots/flujos/$theme"
  (cd "shots/flujos/$theme" && maestro test --format junit --output "$2.xml" "$repo_root/$1") >"shots/flujos/$2.log" 2>&1
}
# a second attempt must see the notification prompt again: Android stops asking after the first attempt's answers
reset_prompts() {
  adb shell pm revoke "$PKG" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1
  adb shell pm clear-permission-flags "$PKG" android.permission.POST_NOTIFICATIONS user-set user-fixed >/dev/null 2>&1
  return 0
}

status=0
{
  echo "### Recorridos con Maestro ($(maestro --version 2>/dev/null | tail -1)) sobre $(basename "$apk")"
  echo '```'
} >>"$report"
for theme in ${themes:-system}; do
  if [ "$theme" = light ]; then adb shell cmd uimode night no >/dev/null; fi
  if [ "$theme" = dark ]; then adb shell cmd uimode night yes >/dev/null; fi
  adb shell am force-stop "$PKG"
for flow in "${flows[@]}"; do
  name=$(basename "$flow" .yaml)
  name="$theme-$name"
  # flows that create a tester account need the test project with "Confirm email" off (see the workflow)
  if grep -q '^# requiere: registro-sin-correo' "$flow" && [ "${KORA_SIGNUP_AUTOCONFIRM:-false}" != true ]; then
    echo "$name: omitido (el proyecto de pruebas pide confirmar el correo)" >>"$report"
    continue
  fi
  adb logcat -c
  if run_flow "$flow" "$name"; then
    echo "$name: pasó" >>"$report"
  elif sleep 5 && adb shell am force-stop "$PKG" && reset_prompts && run_flow "$flow" "$name-2"; then
    # Maestro sometimes loses the emulator for a moment ("device not found", "Stream Closed") and the flow fails in
    # its first seconds: one more attempt, with the first failure in the report so it is not hidden
    echo "$name: pasó al segundo intento; el primero falló así:" >>"$report"
    tail -15 "shots/flujos/$name.log" >>"$report"
  else
    echo "$name: FALLÓ (dos intentos)" >>"$report"
    tail -20 "shots/flujos/$name.log" >>"$report"
    echo "-- segundo intento --" >>"$report"
    tail -60 "shots/flujos/$name-2.log" >>"$report"
    # whether the app crashed, was closed by a back press or stopped answering
    echo "-- logcat de la app --" >>"$report"
    adb logcat -d -b crash 2>/dev/null | grep -E "FATAL|Exception|Error|at " | head -25 >>"$report"
    adb logcat -d 2>/dev/null | grep -vE " I Maestro|ConnectivityService" | grep -E "ReactNativeJS|AndroidRuntime|$PKG|ActivityTaskManager|lowmemorykiller|lmkd" \
      | grep -iE "error|exception|fatal|died|finish|destroy|back|crash|ANR|kill" | cut -c1-240 | head -25 >>"$report"
    status=1
  fi
done
done
echo '```' >>"$report"

# Maestro keeps a screenshot and the hierarchy of the failing step under ~/.maestro/tests
[ -d "$HOME/.maestro/tests" ] && cp -r "$HOME/.maestro/tests" shots/flujos/maestro 2>/dev/null
# the report goes to the job summary and to the log (artifacts are not always reachable from where the log is read)
[ -n "${GITHUB_STEP_SUMMARY:-}" ] && cat "$report" >>"$GITHUB_STEP_SUMMARY"
cat "$report"
exit $status
