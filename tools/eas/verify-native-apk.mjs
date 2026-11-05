// Strict Android artifact gate. No build, publication, channel change, or private-key access.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const EXPECTED = Object.freeze({
  package: 'com.example.kora.preview', label: 'mayami', channel: 'preview',
  project: '9f629f10-d679-4a99-9965-8a9e588afc85',
  oldRuntime: 'eb5ed1179b9c76c9c3cf27333aa48306728eb4ba', oldVersionCode: 4,
});
const SHA40 = /^[a-f0-9]{40}$/i;
const SHA256 = /^[a-f0-9]{64}$/i;
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const normalizeCert = value => String(value ?? '').replace(/:/g, '').trim().toLowerCase();

export function validateBuild(build, { source, runtime, certificate }) {
  assert(SHA40.test(source), 'Expected source commit is required');
  assert(SHA40.test(runtime) && runtime !== EXPECTED.oldRuntime, 'Expected new native runtime is required');
  assert(SHA256.test(normalizeCert(certificate)), 'Trusted signing-reference SHA256 is required');
  assert(UUID.test(build.id), 'Invalid build ID');
  assert.equal(build.status, 'FINISHED', 'Build did not finish');
  assert.equal(String(build.platform).toLowerCase(), 'android', 'Not Android');
  assert.equal(String(build.distribution).toUpperCase(), 'INTERNAL', 'Not internal distribution');
  assert.equal(build.buildProfile, 'preview', 'Not preview profile');
  assert.equal(build.channel ?? build.updateChannel?.name, EXPECTED.channel, 'Wrong update channel');
  assert.equal(build.appIdentifier, EXPECTED.package, 'Wrong Android package');
  assert.equal(build.app?.id, EXPECTED.project, 'Wrong build project');
  assert.equal(build.gitCommitHash, source, 'Build source mismatch');
  if (build.isGitWorkingTreeDirty !== undefined) assert.equal(build.isGitWorkingTreeDirty, false, 'Dirty build source');
  assert.equal(build.runtimeVersion ?? build.runtime?.version, runtime, 'Build runtime mismatch');
  const versionCode = Number(build.appBuildVersion);
  assert(Number.isSafeInteger(versionCode) && versionCode > EXPECTED.oldVersionCode, 'versionCode must increase beyond APK5');
  return { id: build.id, versionCode, source, runtime, certificate: normalizeCert(certificate) };
}

function quotedAttribute(line) {
  const match = line.match(/=\s*("(?:\\.|[^"\\])*")/);
  return match ? JSON.parse(match[1]) : null;
}

export function parseResources(text) {
  const values = new Map();
  const lines = text.split('\n');
  let current = null;
  for (const line of lines) {
    const resource = line.match(/\bresource\s+(0x[0-9a-f]+)\s+(?:[\w.]+:)?string\/([\w.]+)/i);
    if (resource) { current = { id: resource[1].toLowerCase(), name: resource[2] }; continue; }
    if (/\bresource\s+0x/.test(line)) current = null;
    if (!current) continue;
    const value = line.match(/^\s*\(\)\s+("(?:\\.|[^"\\])*")/);
    if (value) {
      const parsed = JSON.parse(value[1]);
      values.set(current.id, parsed);
      values.set(`@string/${current.name}`, parsed);
      current = null;
    }
  }
  return values;
}

export function parseMetaData(manifest, resources) {
  // AAPT2 37 prints the full Android namespace URI; earlier releases use its android alias.
  manifest = manifest.replaceAll('http://schemas.android.com/apk/res/android:', 'android:');
  const metas = new Map();
  const elements = [];
  let applicationCount = 0;
  let attributes = null;
  function save() {
    if (attributes?.name && attributes.value !== undefined) {
      assert(!metas.has(attributes.name), 'Duplicate Android metadata');
      metas.set(attributes.name, attributes.value);
    }
  }
  for (const line of manifest.split('\n')) {
    const element = line.match(/^(\s*)E:\s+(\S+)/);
    if (element) {
      save();
      const indent = element[1].length;
      while (elements.length && elements.at(-1).indent >= indent) elements.pop();
      const parent = elements.at(-1)?.name;
      const name = element[2];
      if (name === 'application' && parent === 'manifest') applicationCount++;
      // expo-updates reads ApplicationInfo.metaData, not an activity/service's metadata.
      attributes = name === 'meta-data' && parent === 'application' ? {} : null;
      elements.push({ name, indent });
    } else if (attributes && /A: android:name\b/.test(line)) {
      attributes.name = quotedAttribute(line);
    } else if (attributes && /A: android:value\b/.test(line)) {
      let value = quotedAttribute(line);
      if (value === null) {
        const reference = line.match(/=\s*(@(?:0x[0-9a-f]+|string\/[\w.]+))/i)?.[1];
        value = reference ? resources.get(reference.startsWith('@0x') ? reference.slice(1).toLowerCase() : reference) : undefined;
      }
      attributes.value = value;
    }
  }
  save();
  assert.equal(applicationCount, 1, 'Expected one Android application element');
  return metas;
}

export function validateArtifact({ badging, manifest, resources, signature, embeddedConfig, fingerprintAsset }, build) {
  const pkg = badging.match(/^package: name='([^']+)' versionCode='(\d+)'/m);
  assert(pkg, 'Missing package/version in APK');
  assert.equal(pkg[1], EXPECTED.package, 'APK package mismatch');
  assert.equal(Number(pkg[2]), build.versionCode, 'APK versionCode differs from build metadata');
  const labels = [...badging.matchAll(/^application-label(?:-[\w-]+)?:'([^']*)'/gm)].map(m => m[1]);
  assert(labels.length && labels.every(label => label === EXPECTED.label), 'APK label is not mayami in every declared locale');
  assert(!/^application-debuggable\b/m.test(badging), 'Debuggable APK');
  assert(!/android:testOnly[^\n]*(?:0xffffffff|true)/i.test(manifest), 'Test-only APK');
  const abis = badging.match(/^native-code:(.*)$/m)?.[1] ?? '';
  assert(abis.includes("'arm64-v8a'"), 'Missing Samsung ARM64 ABI');
  assert(abis.includes("'x86_64'"), 'Missing emulator x86_64 ABI');
  const certificates = [...signature.matchAll(/^\s*(?:Signer #\d+ certificate|V2 Signer: certificate) SHA-256 digest:\s*([a-f0-9:]+)\s*$/gim)].map(m => normalizeCert(m[1]));
  const signerCount = signature.match(/^\s*Number of signers:\s*(\d+)\s*$/mi)?.[1];
  if (signerCount !== undefined || /^\s*V2 Signer:/mi.test(signature))
    assert.equal(signerCount, '1', 'Expected exactly one reported APK signer');
  assert.equal(certificates.length, 1, 'Expected one readable signing certificate; inspect apksigner output format');
  assert.deepEqual(certificates, [build.certificate], 'APK signing certificate differs from the trusted signing reference');
  const metadata = parseMetaData(manifest, parseResources(resources));
  const declaredRuntime = metadata.get('expo.modules.updates.EXPO_RUNTIME_VERSION');
  // Expo Updates 57 reads assets/fingerprint verbatim for this exact sentinel (no trim/JSON fallback).
  const nativeRuntime = declaredRuntime === 'file:fingerprint' ? fingerprintAsset : declaredRuntime;
  if (declaredRuntime === 'file:fingerprint')
    assert(typeof fingerprintAsset === 'string' && fingerprintAsset.length === 40 && SHA40.test(fingerprintAsset), 'Missing or invalid assets/fingerprint runtime');
  assert.equal(nativeRuntime, build.runtime, 'Embedded Android runtime mismatch');
  assert.equal(metadata.get('expo.modules.updates.EXPO_UPDATE_URL'), `https://u.expo.dev/${EXPECTED.project}`, 'Wrong native update project URL');
  const headers = JSON.parse(metadata.get('expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY') ?? '{}');
  assert.equal(headers['expo-channel-name'], EXPECTED.channel, 'Native channel is not preview');
  assert.equal(embeddedConfig.extra?.eas?.projectId, EXPECTED.project, 'Wrong embedded Expo project');
  assert.equal(embeddedConfig.extra?.variant, 'preview', 'Wrong embedded app variant');
  assert.equal(embeddedConfig.android?.package, EXPECTED.package, 'Wrong embedded app package');
  assert.equal(embeddedConfig.scheme, 'kora', 'Installed deep-link scheme changed');
  return { package: pkg[1], label: EXPECTED.label, versionCode: Number(pkg[2]),
    runtime: build.runtime, channel: EXPECTED.channel, certificateSha256: certificates[0],
    abis: abis.trim(), minSdk: badging.match(/^(?:minSdkVersion|sdkVersion):'(\d+)'/m)?.[1] ?? null,
    targetSdk: badging.match(/^targetSdkVersion:'(\d+)'/m)?.[1] ?? null };
}

export async function main(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 2) {
    assert(/^--[a-z-]+$/.test(argv[i]) && argv[i + 1], 'Arguments require --name value');
    assert(!args.has(argv[i]), 'Duplicate argument'); args.set(argv[i], argv[i + 1]);
  }
  for (const key of ['--build-json', '--source', '--runtime', '--certificate', '--output']) assert(args.has(key), `Missing ${key}`);
  const raw = readFileSync(args.get('--build-json'), 'utf8');
  const parsed = JSON.parse(raw.slice(raw.indexOf('[')));
  assert(Array.isArray(parsed) && parsed.length === 1, 'Expected exactly one build');
  const metadata = parsed[0];
  const build = validateBuild(metadata, { source: args.get('--source'), runtime: args.get('--runtime'), certificate: args.get('--certificate') });
  const artifact = metadata.artifacts?.buildUrl ?? metadata.artifacts?.applicationArchiveUrl;
  assert(artifact && new URL(artifact).protocol === 'https:', 'Missing secure artifact URL');
  const out = resolve(args.get('--output')); mkdirSync(out, { recursive: true });
  let bytes;
  if (args.has('--apk')) {
    bytes = readFileSync(resolve(args.get('--apk')));
  } else {
    const response = await fetch(artifact, { signal: AbortSignal.timeout(120_000) });
    assert(response.ok, `APK download failed (HTTP ${response.status})`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  assert(bytes.length > 0 && bytes.length < 512 * 1024 * 1024, 'Invalid APK size');
  const apk = join(out, 'mayami-preview.apk'); writeFileSync(apk, bytes);
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  assert(sdk, 'Android SDK path is required');
  const version = readdirSync(join(sdk, 'build-tools')).filter(x => /^\d+(?:\.\d+)+$/.test(x)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
  assert(version, 'Android build tools missing');
  const tool = name => join(sdk, 'build-tools', version, name);
  const run = (name, arguments_) => execFileSync(name, arguments_, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  run('unzip', ['-tq', apk]);
  // Each command must exit successfully; printing a failure is never sufficient.
  const signature = run(tool('apksigner'), ['verify', '--verbose', '--print-certs', apk]);
  run(tool('zipalign'), ['-c', '-P', '16', '4', apk]);
  const manifest = run(tool('aapt2'), ['dump', 'xmltree', '--file', 'AndroidManifest.xml', apk]);
  const resources = run(tool('aapt2'), ['dump', 'resources', apk]);
  const fingerprintAsset = parseMetaData(manifest, parseResources(resources)).get('expo.modules.updates.EXPO_RUNTIME_VERSION') === 'file:fingerprint'
    ? run('unzip', ['-p', apk, 'assets/fingerprint']) : undefined;
  const report = validateArtifact({
    badging: run(tool('aapt2'), ['dump', 'badging', apk]),
    manifest, resources, signature, fingerprintAsset,
    embeddedConfig: JSON.parse(run('unzip', ['-p', apk, 'assets/app.config'])),
  }, build);
  const receipt = { buildId: build.id, source: build.source, ...report,
    sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
    buildUrl: `https://expo.dev/accounts/marketplacebrand/projects/marketplace/builds/${build.id}`,
    nativeArtifactVerified: true, emulatorVerified: false, physicalDeviceVerified: false };
  writeFileSync(join(out, 'native-apk-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(`::notice title=APK Android mayami verificado::${JSON.stringify(receipt)}`);
  return receipt;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => {
    // Do not print EAS bodies, signed URLs, command stderr, or credential data.
    const message = error.code && error.code !== 'ERR_ASSERTION' ? 'Artifact/tool verification failed; inspect the isolated runner evidence' : error.message;
    console.error(`::error::${String(message).replace(/[\r\n]+/g, ' ').slice(0, 240)}`);
    process.exitCode = 1;
  });
}
