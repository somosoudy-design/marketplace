import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPECTED, validateBuild, validateArtifact } from './verify-native-apk.mjs';

const source = 'a'.repeat(40);
const runtime = 'b'.repeat(40);
const certificate = 'c'.repeat(64);
const options = { source, runtime, certificate };
const metadata = {
  id: '12345678-1234-1234-1234-123456789abc', status: 'FINISHED', platform: 'ANDROID',
  distribution: 'INTERNAL', buildProfile: 'preview', channel: 'preview',
  appIdentifier: EXPECTED.package, app: { id: EXPECTED.project }, gitCommitHash: source, appBuildVersion: '5', runtimeVersion: runtime,
};
const build = validateBuild(metadata, options);
const resources = `resource 0x7f120001 string/expo_runtime_version\n  () "${runtime}"\n`;
const meta = (name, value) => `    E: meta-data (line=10)\n      A: android:name(0x01010003)=${JSON.stringify(name)}\n      A: android:value(0x01010024)=${value}\n`;
const applicationStart = 'E: manifest (line=1)\n  E: application (line=5)\n';
const manifest = applicationStart + meta('expo.modules.updates.EXPO_RUNTIME_VERSION', '@0x7f120001') +
  meta('expo.modules.updates.EXPO_UPDATE_URL', JSON.stringify(`https://u.expo.dev/${EXPECTED.project}`)) +
  meta('expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY', JSON.stringify(JSON.stringify({ 'expo-channel-name': 'preview' })));
const artifact = {
  badging: `package: name='${EXPECTED.package}' versionCode='5' versionName='0.1.0'\napplication-label:'mayami'\napplication-label-es:'mayami'\nsdkVersion:'24'\ntargetSdkVersion:'36'\nnative-code: 'arm64-v8a' 'x86_64'\n`,
  manifest, resources, signature: `Signer #1 certificate SHA-256 digest: ${certificate}\n`,
  embeddedConfig: { scheme: 'kora', android: { package: EXPECTED.package }, extra: { variant: 'preview', eas: { projectId: EXPECTED.project } } },
};

test('accepts pinned preview build and reads actual linked native runtime', () => {
  const result = validateArtifact(artifact, build);
  assert.equal(result.runtime, runtime);
  assert.equal(result.certificateSha256, certificate);
  assert.equal(result.versionCode, 5);
});
test('rejects production, wrong package, dirty source and nonfinal builds', () => {
  for (const change of [{ channel: 'production' }, { buildProfile: 'production' },
    { distribution: 'STORE' }, { appIdentifier: 'com.other.app' },
    { gitCommitHash: 'd'.repeat(40) }, { isGitWorkingTreeDirty: true }, { status: 'IN_PROGRESS' }]) {
    assert.throws(() => validateBuild({ ...metadata, ...change }, options));
  }
});
test('requires an increased versionCode, genuinely new runtime and trusted certificate', () => {
  assert.throws(() => validateBuild({ ...metadata, appBuildVersion: '4' }, options));
  assert.throws(() => validateBuild(metadata, { ...options, runtime: EXPECTED.oldRuntime }));
  assert.throws(() => validateBuild(metadata, { ...options, certificate: '' }));
});
test('does not accept a desired runtime hidden in an unrelated resource', () => {
  const malicious = resources.replace(runtime, EXPECTED.oldRuntime) + `resource 0x7f120002 string/other\n  () "${runtime}"\n`;
  assert.throws(() => validateArtifact({ ...artifact, resources: malicious }, build), /runtime mismatch/);
});
test('rejects correct metadata placed on an activity instead of the application', () => {
  const activityMetadata = applicationStart + '    E: activity (line=8)\n' +
    manifest.slice(applicationStart.length).split('\n').map(line => '  ' + line).join('\n');
  assert.throws(() => validateArtifact({ ...artifact, manifest: activityMetadata }, build), /runtime mismatch/);
});
test('resolves symbolic resource references and rejects missing references', () => {
  const symbolic = manifest.replace('@0x7f120001', '@string/expo_runtime_version');
  assert.equal(validateArtifact({ ...artifact, manifest: symbolic }, build).runtime, runtime);
  assert.throws(() => validateArtifact({ ...artifact, resources: '' }, build), /runtime mismatch/);
});
test('rejects a different signer or an additional signer', () => {
  assert.throws(() => validateArtifact({ ...artifact, signature: artifact.signature.replace(certificate, 'd'.repeat(64)) }, build));
  assert.throws(() => validateArtifact({ ...artifact, signature: artifact.signature + `Signer #2 certificate SHA-256 digest: ${certificate}\n` }, build));
});
test('checks installed name, package, ABI and build version from APK', () => {
  for (const badging of [artifact.badging.replace("application-label:'mayami'", "application-label:'Kora'"),
    artifact.badging.replace(EXPECTED.package, 'com.other.app'), artifact.badging.replace("versionCode='5'", "versionCode='4'"),
    artifact.badging.replace("'x86_64'", "'x86'"), artifact.badging + 'application-debuggable\n']) {
    assert.throws(() => validateArtifact({ ...artifact, badging }, build));
  }
});
test('rejects production channel, foreign project and ambiguous metadata', () => {
  assert.throws(() => validateArtifact({ ...artifact, manifest: manifest.replace('preview', 'production') }, build));
  assert.throws(() => validateArtifact({ ...artifact, embeddedConfig: { extra: { eas: { projectId: 'foreign' } } } }, build));
  assert.throws(() => validateArtifact({ ...artifact, manifest: manifest + meta('expo.modules.updates.EXPO_RUNTIME_VERSION', JSON.stringify(runtime)) }, build), /Duplicate/);
});
test('accepts equivalent nested EAS metadata fields without weakening constraints', () => {
  const nested = { ...metadata, runtimeVersion: undefined, channel: undefined, runtime: { version: runtime }, updateChannel: { name: 'preview' } };
  assert.equal(validateBuild(nested, options).runtime, runtime);
});

test('supports apksigner 37 observed V2 certificate format and full Android namespace', () => {
  const current = { ...artifact,
    signature: `Verifies\nVerified using v2 scheme (APK Signature Scheme v2): true\nNumber of signers: 1\nV2 Signer: certificate SHA-256 digest: ${certificate}\nV2 Signer: public key SHA-256 digest: ${'e'.repeat(64)}\n`,
    manifest: artifact.manifest.replaceAll('android:', 'http://schemas.android.com/apk/res/android:'),
    badging: artifact.badging.replace('sdkVersion:', 'minSdkVersion:'),
  };
  const result = validateArtifact(current, build);
  assert.equal(result.certificateSha256, certificate);
  assert.equal(result.minSdk, '24');
  assert.throws(() => validateArtifact({ ...current, signature: current.signature.replace('Number of signers: 1', 'Number of signers: 2') }, build));
  assert.throws(() => validateArtifact({ ...current, signature: current.signature.replace('certificate SHA-256', 'public key SHA-256') }, build), /readable signing certificate/);
  assert.throws(() => validateArtifact({ ...current, signature: current.signature.replace(certificate, 'd'.repeat(64)) }, build), /differs/);
});
