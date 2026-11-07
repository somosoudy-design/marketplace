#!/usr/bin/env bash
# Read-only guest check of an already published OTA on a disposable emulator.
set -Eeuo pipefail
pkg=com.example.kora.preview
out="$PWD/shots/ota"
mkdir -p "$out/logs" "$out/raw"
receipt_case=${MAYAMI_RECEIPT_CASE:-all}
case "$receipt_case" in all|standard|font-1.3|font-1.6) ;; *) echo 'Invalid receipt case' >&2; exit 1 ;; esac
case "${MAYAMI_RECEIPT_THEME:-all}" in
  all) receipt_themes=(light dark) ;;
  light|dark) receipt_themes=("$MAYAMI_RECEIPT_THEME") ;;
  *) echo 'Invalid receipt theme' >&2; exit 1 ;;
esac
receipt_fonts=(1.3 1.6)
case "$receipt_case" in font-1.3) receipt_fonts=(1.3) ;; font-1.6) receipt_fonts=(1.6) ;; esac
# Keep transport/host evidence even when the virtual device disappears. Never mask a test failure.
capture_runner_state() {
  local result=$?
  trap - EXIT
  set +e
  free -m > "$out/logs/host-memory.txt" 2>&1
  ps -eo pid,comm,rss --sort=-rss | head -20 > "$out/logs/host-process-memory.txt"
  sudo -n dmesg --ctime 2> "$out/logs/kernel-read-error.txt" | tail -200 > "$out/logs/kernel-tail.txt"
  timeout 10s adb devices -l > "$out/logs/adb-final-devices.txt" 2>&1
  timeout 10s adb logcat -d -b crash > "$out/logs/android-crash-buffer.txt" 2>&1
  timeout 10s adb shell cat /proc/meminfo > "$out/logs/android-final-memory.txt" 2>&1
  # Inventory only: a raw crash dump could contain process memory or credentials.
  if [ -d /tmp/android-runner ]; then find /tmp/android-runner -maxdepth 2 -type f -printf '%f %s bytes\n' > "$out/logs/emulator-crash-file-inventory.txt"; fi
  exit "$result"
}
trap capture_runner_state EXIT
: "${MAYAMI_UPDATE_ID:?Expected Android update UUID}"
: "${MAYAMI_RUNTIME:?Expected Android runtime}"
: "${ANDROID_HOME:?Android SDK required}"
python3 - "$MAYAMI_UPDATE_ID" apks/native-apk-receipt.json apks/mayami-preview.apk <<'PY'
import hashlib,json,re,sys
assert re.fullmatch(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',sys.argv[1]), 'Invalid Android update id'
r=json.load(open(sys.argv[2])); assert r['nativeArtifactVerified'] is True
assert hashlib.sha256(open(sys.argv[3],'rb').read()).hexdigest()==r['sha256']
PY
adb wait-for-device
[ "$(adb shell getprop ro.kernel.qemu | tr -d '\r')" = 1 ] || { echo 'Emulator required' >&2; exit 1; }
adb install -r apks/mayami-preview.apk > "$out/logs/install.txt" 2>&1
grep -q '^Success' "$out/logs/install.txt"
component=$(adb shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER "$pkg" | tr -d '\r' | tail -1)
case "$component" in "$pkg/"*) ;; *) echo 'Launcher not found' >&2; exit 1 ;; esac
received=0
for attempt in $(seq 1 8); do
  adb shell am force-stop "$pkg"
  adb logcat -c
  adb shell am start -W -n "$component" > "$out/logs/launch-$attempt.txt"
  sleep 20
  adb shell am start -W -a android.intent.action.VIEW -d kora://diagnostico "$pkg" > "$out/logs/diagnostics-$attempt.txt"
  sleep 10
  adb logcat -d -s ReactNativeJS | grep -F 'KoraDiag ' > "$out/logs/app-$attempt.txt" || true
  if python3 - "$out/logs/app-$attempt.txt" "$MAYAMI_UPDATE_ID" "$MAYAMI_RUNTIME" "$out/receipt.json" <<'PY'
import json,sys
found=[]
for line in open(sys.argv[1],errors='replace'):
 if 'KoraDiag ' in line:
  try: found.append(json.loads(line.split('KoraDiag ',1)[1]))
  except json.JSONDecodeError: pass
for d in found[-1:]:
 if d.get('Código') == 'actualización '+sys.argv[2] and d.get('Runtime') == sys.argv[3] and d.get('Canal') == 'preview' and d.get('Cuenta') == 'sin sesión' and d.get('Backend') == 'mimnotafmfasvwrclxan.supabase.co':
  open(sys.argv[4],'w').write(json.dumps(d,ensure_ascii=False,indent=2)+'\n'); print('Exact Android update received'); sys.exit(0)
sys.exit(1)
PY
  then received=1; break; fi
done
[ "$received" = 1 ] || { echo 'Update receipt not confirmed before deadline' >&2; exit 1; }
verify_theme_process() {
  local name=$1
  adb logcat -d -s ReactNativeJS | grep -F 'KoraDiag ' > "$out/logs/$name-diagnostics.txt" || true
  python3 - "$out/logs/$name-diagnostics.txt" "$MAYAMI_UPDATE_ID" "$MAYAMI_RUNTIME" <<'PY'
import json,sys
rows=[]
for line in open(sys.argv[1],errors='replace'):
 if 'KoraDiag ' in line:
  try: rows.append(json.loads(line.split('KoraDiag ',1)[1]))
  except json.JSONDecodeError: pass
assert rows and rows[-1].get('Código') == 'actualización '+sys.argv[2] and rows[-1].get('Runtime') == sys.argv[3] and rows[-1].get('Canal') == 'preview' and rows[-1].get('Cuenta') == 'sin sesión' and rows[-1].get('Backend') == 'mimnotafmfasvwrclxan.supabase.co', 'Theme capture has no matching current update'
PY
}
for theme in "${receipt_themes[@]}"; do
  adb shell settings put system font_scale 1.0
  adb shell settings get system font_scale > "$out/logs/$theme-font-1.0.txt"
  if [ "$theme" = light ]; then adb shell cmd uimode night no >/dev/null; else adb shell cmd uimode night yes >/dev/null; fi
  if [ "$receipt_case" = all ] || [ "$receipt_case" = standard ]; then
  adb shell am force-stop "$pkg"
  adb logcat -c
  adb shell am start -W -n "$component" >/dev/null
  sleep 12
  mkdir -p "$out/raw/$theme"
  maestro test --test-output-dir "$out/raw/$theme" -e MAYAMI_SHOT_PREFIX="$theme" --format junit --output "$out/logs/$theme.xml" tests/apk-flows/21-native-identity.yaml > "$out/logs/$theme-maestro.log" 2>&1
  verify_theme_process "$theme"
  adb shell am force-stop "$pkg"
  adb logcat -c
  adb shell am start -W -n "$component" >/dev/null
  sleep 12
  maestro test --test-output-dir "$out/raw/$theme-store" -e MAYAMI_SHOT_PREFIX="$theme" --format junit --output "$out/logs/$theme-store.xml" tests/apk-flows/24-mayami-store-mark.yaml > "$out/logs/$theme-store-maestro.log" 2>&1
  verify_theme_process "$theme-store"
  adb shell am force-stop "$pkg"
  adb logcat -c
  adb shell am start -W -n "$component" >/dev/null
  sleep 10
  maestro test --test-output-dir "$out/raw/$theme-banners" -e MAYAMI_SHOT_PREFIX="$theme" --format junit --output "$out/logs/$theme-banners.xml" tests/apk-flows/25-banners-and-product-copy.yaml > "$out/logs/$theme-banners-maestro.log" 2>&1
  verify_theme_process "$theme-banners"
  fi
  if [ "$receipt_case" != standard ]; then
  for font in "${receipt_fonts[@]}"; do
    adb shell settings put system font_scale "$font"
    adb shell settings get system font_scale > "$out/logs/$theme-font-$font.txt"
    adb shell am force-stop "$pkg"
    adb logcat -c
    adb shell am start -W -n "$component" >/dev/null
    sleep 10
    maestro test --test-output-dir "$out/raw/$theme-font-$font" -e MAYAMI_SHOT_PREFIX="$theme-font-$font" --format junit --output "$out/logs/$theme-font-$font.xml" tests/apk-flows/26-banner-enlarged-text.yaml > "$out/logs/$theme-font-$font-maestro.log" 2>&1
    verify_theme_process "$theme-font-$font"
  done
  fi
  adb shell settings put system font_scale 1.0
  timeout 10s adb logcat -d -b crash > "$out/logs/$theme-completed-crash.txt"
  if grep -Fq "Process: $pkg" "$out/logs/$theme-completed-crash.txt"; then echo "App crash: $theme" >&2; exit 1; fi
done
