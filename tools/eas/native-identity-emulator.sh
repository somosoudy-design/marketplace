#!/usr/bin/env bash
# Focal verification on a disposable Android emulator. Never uninstall/clear data or mutate a remote account.
set -Eeuo pipefail
PKG=com.example.kora.preview
APK=${1:-apks/mayami-preview.apk}
RECEIPT=${2:-apks/native-apk-receipt.json}
repo_root=$(pwd)
out="$repo_root/shots/native"
mkdir -p "$out/raw" "$out/logs"
record_failure() {
  local code=$? line=$1
  trap - ERR
  echo "::error title=Comprobación Android nativa::Fallo en línea $line (código $code); revisar captura failure.png de esta ejecución."
  printf '{"line":%s,"exitCode":%s}\n' "$line" "$code" > "$out/failure.json"
  adb exec-out screencap -p > "$out/raw/failure.png" 2>/dev/null || true
  exit "$code"
}
trap 'record_failure $LINENO' ERR
: "${ANDROID_HOME:?Android SDK required}"
for tool in adb maestro ffmpeg python3; do command -v "$tool" >/dev/null || { echo "Missing tool: $tool" >&2; exit 1; }; done
maestro --version > "$out/logs/maestro-version.txt"
maestro test --help > "$out/logs/maestro-test-help.txt"
grep -q -- '--test-output-dir' "$out/logs/maestro-test-help.txt"
cp "$RECEIPT" "$out/receipt.json"
# Binary metadata, signature and alignment were verified by verify-native-apk.mjs before starting Android.
python3 - "$RECEIPT" "$APK" <<'PYVERIFY'
import json,sys,hashlib
receipt=json.load(open(sys.argv[1]))
assert receipt['nativeArtifactVerified'] is True, 'Unverified APK'
assert hashlib.sha256(open(sys.argv[2],'rb').read()).hexdigest()==receipt['sha256'], 'APK changed after verification'
PYVERIFY
adb wait-for-device
# Require a disposable emulator, never run this device test against an attached owner phone.
[ "$(adb shell getprop ro.kernel.qemu | tr -d '\r')" = 1 ] || { echo 'Emulator required' >&2; exit 1; }
adb shell settings put global window_animation_scale 1 >/dev/null
adb shell settings put global transition_animation_scale 1 >/dev/null
adb shell settings put global animator_duration_scale 1 >/dev/null
adb shell settings put system font_scale 1.0 >/dev/null
# No uninstall, pm clear, disabled launcher, hidden ANR dialogs or permission bypasses.
adb install -r "$APK" > "$out/logs/install.txt" 2>&1
grep -q '^Success' "$out/logs/install.txt"
component=$(adb shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER "$PKG" | tr -d '\r' | tail -1)
case "$component" in "$PKG/"*) ;; *) echo 'No launcher activity' >&2; exit 1 ;; esac
{
  echo "Android $(adb shell getprop ro.build.version.release | tr -d '\r')"
  echo "ABI $(adb shell getprop ro.product.cpu.abilist | tr -d '\r')"
  echo "Component $component"
} > "$out/logs/device.txt"

check_crash() {
  local stem=$1
  adb logcat -d -b crash > "$out/logs/$stem-crash.txt"
  adb logcat -d -s ReactNativeJS AndroidRuntime > "$out/logs/$stem-app.txt"
  if grep -Fq "Process: $PKG" "$out/logs/$stem-crash.txt" || grep -Eq "Fatal signal.*$PKG|$PKG.*Fatal signal" "$out/logs/$stem-crash.txt"; then
    echo "App crash: $stem" >&2; exit 1
  fi
  [ -n "$(adb shell pidof "$PKG" | tr -d '\r')" ] || { echo "App not running: $stem" >&2; exit 1; }
}
collect_flow_screenshots() {
  local stem=$1 theme=$2
  shift 2
  # Maestro stores takeScreenshot in its test artifacts, not the shell's cwd.
  # Preserve those originals and require every requested screenshot before accepting the run.
  python3 - "$out/maestro/$stem" "$out/raw/$theme/$stem" "$stem" "$@" <<'PYSCREENS'
import pathlib,shutil,sys
source,destination=map(pathlib.Path,sys.argv[1:3]);stem=sys.argv[3]
files=list(source.rglob('*.png'))
for suffix in sys.argv[4:]:
 expected=stem+'-'+suffix
 assert any(expected in f.name for f in files), 'Missing Maestro screenshot: '+expected
for f in files:
 assert not f.is_symlink(), 'Unexpected screenshot symlink'
 assert f.read_bytes()[:8]==b'\x89PNG\r\n\x1a\n', 'Invalid screenshot PNG'
 target=destination/f.relative_to(source);target.parent.mkdir(parents=True,exist_ok=True)
 shutil.copyfile(f,target)
print('Preserved original Maestro screenshots:',stem,len(files))
PYSCREENS
}
run_flow() {
  local file=$1 theme=$2 stem=$3
  mkdir -p "$out/raw/$theme"
  echo "Android flow: $file, $theme"
  maestro test --test-output-dir "$out/maestro/$stem" -e MAYAMI_SHOT_PREFIX="$stem" --format junit --output "$out/logs/$stem.xml" "$repo_root/tests/apk-flows/$file.yaml" > "$out/logs/$stem-maestro.log" 2>&1
  if [ "$file" = 21-native-identity ]; then
    collect_flow_screenshots "$stem" "$theme" home search diagnostics guest
  else
    collect_flow_screenshots "$stem" "$theme" launcher
  fi
}
for theme in light dark; do
  if [ "$theme" = light ]; then adb shell cmd uimode night no >/dev/null; else adb shell cmd uimode night yes >/dev/null; fi
  adb shell input keyevent HOME
  adb shell am force-stop "$PKG"
  adb logcat -c
  mkdir -p "$out/raw/$theme/early-frames"
  remote="/sdcard/mayami-cold-$theme.mp4"
  adb shell screenrecord --time-limit 12 --bit-rate 8000000 "$remote" > "$out/logs/$theme-video.txt" 2>&1 &
  recorder=$!
  sleep 0.5
  adb shell am start -W -n "$component" > "$out/logs/$theme-cold-start.txt"
  wait "$recorder"
  adb pull "$remote" "$out/raw/$theme/cold-start.mp4" > "$out/logs/$theme-video-pull.txt" 2>&1
  adb shell rm "$remote"
  # Uncropped original video frames: selection only, no resize/retouch or generated mockups.
  ffmpeg -hide_banner -loglevel error -i "$out/raw/$theme/cold-start.mp4" -t 3 -vf fps=10 "$out/raw/$theme/early-frames/frame-%03d.png"
  run_flow 21-native-identity "$theme" "$theme-identity"
  check_crash "$theme-identity"
  # Launcher tap must open Inicio, not resume the preceding diagnostics screen.
  adb shell am force-stop "$PKG"
  run_flow 22-native-launcher "$theme" "$theme-launcher"
  check_crash "$theme-launcher"
done
# Exact diagnostics from the actual process, with no tokens. Keep the KoraDiag log key for compatibility.
python3 - "$out" <<'PY'
import json,pathlib,sys
p=pathlib.Path(sys.argv[1]);receipt=json.loads((p/'receipt.json').read_text())
for theme in ['light','dark']:
 lines=(p/'logs'/f'{theme}-identity-app.txt').read_text().splitlines()
 found=[]
 for line in lines:
  if 'KoraDiag ' in line:
   try: found.append(json.loads(line.split('KoraDiag ',1)[1]))
   except json.JSONDecodeError: pass
 assert found, 'Missing real device diagnostics: '+theme
 d=found[-1]
 assert d.get('App','').startswith('mayami '),'Wrong visible app brand'
 assert d.get('Canal')=='preview','Wrong channel'
 assert d.get('Runtime')==receipt['runtime'],'Wrong device runtime'
 assert d.get('Cuenta')=='sin sesión','Unexpected remote session'
 assert d.get('Backend')=='mimnotafmfasvwrclxan.supabase.co','Wrong backend'
 (p/f'device-diagnostics-{theme}.json').write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
PY

# Same-APK reinstall: verifies local preference retention, NOT migration from unavailable APK5.
adb shell cmd uimode night no >/dev/null
maestro test --test-output-dir "$out/maestro/preinstall" -e MAYAMI_PREFERENCE=Oscuro -e MAYAMI_SHOT_PREFIX=preinstall --format junit --output "$out/logs/preference-before.xml" "$repo_root/tests/apk-flows/23-native-preference.yaml" > "$out/logs/preference-before.log" 2>&1
collect_flow_screenshots preinstall preferences appearance
adb shell uiautomator dump /sdcard/mayami-preference.xml >/dev/null
adb pull /sdcard/mayami-preference.xml "$out/logs/preference-before.xmltree" >/dev/null 2>&1
adb shell dumpsys package "$PKG" | sed -n '/userId=/p;/firstInstallTime=/p' > "$out/logs/install-identity-before.txt"
adb shell am force-stop "$PKG"
adb install -r "$APK" > "$out/logs/reinstall.txt" 2>&1
grep -q '^Success' "$out/logs/reinstall.txt"
adb shell am start -W -a android.intent.action.VIEW -d 'kora://settings' "$PKG" > "$out/logs/preference-reopen.txt"
sleep 5
adb shell uiautomator dump /sdcard/mayami-preference.xml >/dev/null
adb pull /sdcard/mayami-preference.xml "$out/logs/preference-after.xmltree" >/dev/null 2>&1
adb shell rm /sdcard/mayami-preference.xml
adb exec-out screencap -p > "$out/raw/preference-after-reinstall.png"
adb shell dumpsys package "$PKG" | sed -n '/userId=/p;/firstInstallTime=/p' > "$out/logs/install-identity-after.txt"
cmp "$out/logs/install-identity-before.txt" "$out/logs/install-identity-after.txt"
python3 - "$out" <<'PY'
import sys,pathlib,xml.etree.ElementTree as ET
p=pathlib.Path(sys.argv[1])
for part in ['before','after']:
 tree=ET.parse(p/'logs'/f'preference-{part}.xmltree')
 nodes=[n for n in tree.iter('node') if n.get('selected')=='true' and any('Oscuro' in (c.get('text','')+' '+c.get('content-desc','')) for c in n.iter('node'))]
 assert nodes,'Dark appearance preference not selected '+part
print('Same-APK reinstall preserved selected local appearance, uid and firstInstallTime. APK5 migration NOT tested.')
PY
check_crash final
python3 - "$out" <<'PY'
import pathlib,json,hashlib,sys
p=pathlib.Path(sys.argv[1]);records=[]
for f in sorted((p/'raw').rglob('*')):
 if f.is_file(): records.append({'path':str(f.relative_to(p)),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
(p/'evidence-manifest.json').write_text(json.dumps(records,indent=2)+'\n')
PY
cat > "$out/RESULTADO.md" <<'MD'
# mayami · comprobación Android nativa

Verificación focal en emulador Android 15: paquete/versión/firma/label, arranque frío claro y oscuro en video, captura real del launcher, búsqueda, regreso y diagnóstico del proceso. Revisar visualmente videos y frames antes de afirmar que no aparece K o que el splash es correcto; una prueba técnica no sustituye esa inspección.

Sin cuentas, pedidos, pagos ni datos remotos escritos. Se reinstaló el mismo APK con -r y se conservó la preferencia local, uid y primera instalación. **No se comprobó migración de APK5**, cuyo artefacto está caducado. Si el dispositivo no descargó ninguna OTA del runtime nuevo, su diagnóstico «el del APK» prueba sólo el bundle embebido; no declarar recepción OTA.

PNG/MP4 originales bajo raw y manifiesto SHA256. Máscaras ilustradas en navegador no son prueba del launcher; el launcher real de este emulador comprueba únicamente su máscara activa. Icono monocromo y notificación no se consideran visualmente comprobados sin captura nativa correspondiente.
MD
cat "$out/RESULTADO.md"
