#!/usr/bin/env bash
# Read-only guest check of an already published OTA on a disposable emulator.
set -Eeuo pipefail
pkg=com.example.kora.preview
out="$PWD/shots/ota"
mkdir -p "$out/logs" "$out/raw"
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
for theme in light dark; do
  if [ "$theme" = light ]; then adb shell cmd uimode night no >/dev/null; else adb shell cmd uimode night yes >/dev/null; fi
  adb shell am force-stop "$pkg"
  adb logcat -c
  adb shell am start -W -n "$component" >/dev/null
  sleep 12
  mkdir -p "$out/raw/$theme"
  maestro test --test-output-dir "$out/raw/$theme" -e MAYAMI_SHOT_PREFIX="$theme" --format junit --output "$out/logs/$theme.xml" tests/apk-flows/21-native-identity.yaml > "$out/logs/$theme-maestro.log" 2>&1
  adb logcat -d -s ReactNativeJS | grep -F 'KoraDiag ' > "$out/logs/$theme-diagnostics.txt" || true
  python3 - "$out/logs/$theme-diagnostics.txt" "$MAYAMI_UPDATE_ID" "$MAYAMI_RUNTIME" <<'PY'
import json,sys
rows=[]
for line in open(sys.argv[1],errors='replace'):
 if 'KoraDiag ' in line:
  try: rows.append(json.loads(line.split('KoraDiag ',1)[1]))
  except json.JSONDecodeError: pass
assert rows and rows[-1].get('Código') == 'actualización '+sys.argv[2] and rows[-1].get('Runtime') == sys.argv[3] and rows[-1].get('Canal') == 'preview' and rows[-1].get('Cuenta') == 'sin sesión', 'Theme capture has no matching current update'
PY
  if adb logcat -d -b crash | grep -Fq "Process: $pkg"; then echo "App crash: $theme" >&2; exit 1; fi
done
