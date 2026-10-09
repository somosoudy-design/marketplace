#!/usr/bin/env bash
# Run by .github/workflows/apk-emulator.yml inside a booted emulator: for each apks/apk<N>.apk checks zip
# alignment, installs it on a clean device (the exact INSTALL_* result), opens it and records whether it is
# still running, any crash in logcat and a screenshot. Then installs them in order over each other, as a phone
# that updates would.
set -u
PKG=com.example.kora.preview
BT="$ANDROID_HOME/build-tools/$(ls "$ANDROID_HOME/build-tools" | sort -V | tail -1)"
out="${GITHUB_STEP_SUMMARY:-/dev/stdout}"
echo "### Android $(adb shell getprop ro.build.version.release | tr -d '\r') · $(adb shell getprop ro.product.cpu.abilist | tr -d '\r')" >>"$out"

for apk in apks/*.apk; do
  name=$(basename "$apk" .apk)
  {
    echo "#### $name"
    echo '```'
    "$BT/zipalign" -c -p 4 "$apk" >/dev/null 2>&1 && echo "zipalign 4 KB (librerías alineadas a página): sí" || echo "zipalign 4 KB: NO"
    "$BT/zipalign" -c -P 16 4 "$apk" >/dev/null 2>&1 && echo "zipalign 16 KB: sí" || echo "zipalign 16 KB: no"
    adb uninstall "$PKG" >/dev/null 2>&1
    echo "instalación limpia: $(adb install "$apk" 2>&1 | tr -d '\r' | tail -1)"
    if adb shell pm path "$PKG" >/dev/null 2>&1; then
      adb logcat -c
      adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
      sleep 25
      pid=$(adb shell pidof "$PKG" | tr -d '\r')
      echo "abierta tras 25 s: $([ -n "$pid" ] && echo "sí (pid $pid)" || echo "NO")"
      adb logcat -d -b crash 2>/dev/null | grep -E "FATAL|Exception|Error" | head -8
      adb logcat -d 2>/dev/null | grep -E "ReactNativeJS|E AndroidRuntime" | grep -iE "error|exception|fatal" | head -8
      adb exec-out screencap -p >"shots/$name.png" 2>/dev/null
    fi
    echo '```'
  } >>"$out"
done

{
  echo "#### Actualizar uno encima del otro"
  echo '```'
  adb uninstall "$PKG" >/dev/null 2>&1
  for apk in apks/*.apk; do echo "$(basename "$apk"): $(adb install -r "$apk" 2>&1 | tr -d '\r' | tail -1)"; done
  echo '```'
} >>"$out"
[ "$out" = /dev/stdout ] || cat "$out"
