#!/usr/bin/env bash
# Prints what decides whether Android installs an APK: archive integrity, package and version, minimum Android,
# CPU architectures, test-only/debuggable flags and the signing certificate. Needs the Android SDK build tools
# (present on GitHub's ubuntu runners). Usage: inspect-apk.sh <apk-url>...
set -uo pipefail
BT="$ANDROID_HOME/build-tools/$(ls "$ANDROID_HOME/build-tools" | sort -V | tail -1)"
out="${GITHUB_STEP_SUMMARY:-/dev/stdout}"
for url in "$@"; do
  f="$(mktemp --suffix=.apk)"
  curl -sSfL --retry 3 -o "$f" "$url" || { echo "no se pudo descargar $url"; continue; }
  {
    echo "### $(basename "$url")"
    echo '```'
    echo "tamaño: $(stat -c %s "$f") bytes · sha256: $(sha256sum "$f" | cut -c1-16)…"
    echo "tipo: $(file -b "$f" | cut -c1-60)"
    unzip -tq "$f" >/dev/null 2>&1 && echo "zip: íntegro" || echo "zip: DAÑADO"
    unzip -l "$f" | grep -q 'AndroidManifest.xml' && echo "AndroidManifest.xml: sí (es APK)" || echo "AndroidManifest.xml: NO (¿AAB?)"
    "$BT/aapt2" dump badging "$f" 2>&1 | grep -E "^(package|sdkVersion|targetSdkVersion|native-code|alt-native-code|application-debuggable|testOnly|uses-permission:)" | sed "s/compileSdkVersion.*//"
    "$BT/aapt2" dump xmltree --file AndroidManifest.xml "$f" 2>/dev/null | grep -E "testOnly|debuggable|extractNativeLibs|installLocation" | sed 's/^ *//'
    echo "librerías nativas: $(unzip -l "$f" | grep -oE 'lib/[^/]+/' | sort -u | tr '\n' ' ')"
    "$BT/apksigner" verify --verbose --print-certs "$f" 2>&1 | grep -E "^(Verifies|Verified using|Signer #1 certificate (DN|SHA-256)|Number of signers|WARNING|ERROR|DOES NOT VERIFY)" | grep -v "WARNING: META-INF" | head -12
    echo '```'
  } >>"$out"
  rm -f "$f"
done
[ "$out" = /dev/stdout ] || cat "$out"
