// Read-only public identifiers for the configured EAS signing identity. Never requests key material.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { EXPECTED } from './verify-native-apk.mjs';

export const OLD_BUILD = 'd1d10c28-1d9e-4123-8487-602dc10b9710';
export const QUERY = `query MayamiSigningReference($fullName: String!, $pkg: String, $buildId: ID!) {
  app { byFullName(fullName: $fullName) {
    id fullName androidAppCredentials(filter: {applicationIdentifier: $pkg}) {
      applicationIdentifier androidAppBuildCredentialsList {
        id isDefault androidKeystore { id createdAt sha256CertificateFingerprint }
      }
    }
  } }
  builds { byId(buildId: $buildId) {
    id createdAt status appIdentifier appBuildVersion gitCommitHash
    runtime { version } updateChannel { name } app { id }
  } }
}`;

export function selectReference(data) {
  const app = data?.app?.byFullName;
  const old = data?.builds?.byId;
  assert.equal(app?.id, EXPECTED.project, 'Wrong EAS project');
  assert.equal(app?.fullName, '@marketplacebrand/marketplace', 'Wrong Expo owner/project');
  assert.equal(old?.id, OLD_BUILD, 'Wrong historical build');
  assert.equal(old.app?.id, EXPECTED.project, 'Historical build project mismatch');
  assert.equal(old.appIdentifier, EXPECTED.package, 'Historical build package mismatch');
  assert.equal(old.appBuildVersion, '4', 'Historical build version mismatch');
  assert.equal(old.runtime?.version, EXPECTED.oldRuntime, 'Historical runtime mismatch');
  assert.equal(old.updateChannel?.name, 'preview', 'Historical channel mismatch');
  assert.equal(old.gitCommitHash, 'cc5b1010691a492745a52e5842a4baaaf8ec3da8', 'Historical source mismatch');
  assert.equal(old.status, 'FINISHED', 'Historical build was not finished');
  const records = (app.androidAppCredentials ?? [])
    .filter(c => c.applicationIdentifier === EXPECTED.package)
    .flatMap(c => c.androidAppBuildCredentialsList ?? []).filter(c => c.androidKeystore);
  const unique = new Map(records.map(c => [c.androidKeystore.id, c.androidKeystore]));
  assert.equal(unique.size, 1, 'Expected exactly one configured keystore');
  const defaults = records.filter(c => c.isDefault);
  assert.equal(defaults.length, 1, 'Expected one default build credential');
  const credential = defaults[0];
  const keystore = credential.androidKeystore;
  const certificateSha256 = String(keystore.sha256CertificateFingerprint ?? '').replace(/:/g, '').toLowerCase();
  assert(/^[a-f0-9]{64}$/.test(certificateSha256), 'Missing public signing certificate fingerprint');
  const createdAt = Date.parse(keystore.createdAt), oldCreatedAt = Date.parse(old.createdAt);
  assert(Number.isFinite(createdAt) && Number.isFinite(oldCreatedAt) && createdAt < oldCreatedAt,
    'Configured keystore must predate APK5');
  return { projectId: app.id, package: EXPECTED.package, credentialId: credential.id, keystoreId: keystore.id,
    certificateSha256, keystoreCreatedAt: keystore.createdAt, apk5BuildId: old.id, apk5CreatedAt: old.createdAt,
    basis: 'Only configured EAS keystore, default credential, created before APK5',
    historicalBinaryComparison: false, privateKeyMaterialRequested: false };
}

export async function main(argv) {
  assert(argv[0] === '--output' && argv[1] && argv.length === 2, 'Usage: --output PATH');
  assert(process.env.EXPO_TOKEN, 'EXPO_TOKEN must be supplied privately by CI');
  const response = await fetch('https://api.expo.dev/graphql', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.EXPO_TOKEN}` },
    body: JSON.stringify({ query: QUERY, variables: { fullName: '@marketplacebrand/marketplace', pkg: EXPECTED.package, buildId: OLD_BUILD } }),
  });
  assert(response.ok, 'EAS metadata request failed');
  const body = await response.json();
  assert(!body.errors, 'EAS signing metadata unavailable');
  const reference = selectReference(body.data);
  writeFileSync(resolve(argv[1]), JSON.stringify(reference, null, 2) + '\n');
  console.log(`::notice title=Referencia pública de firma Android::${JSON.stringify(reference)}`);
  return reference;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => {
    console.error(`::error::${String(error.message).replace(/[\r\n]+/g, ' ').slice(0, 220)}`);
    process.exitCode = 1;
  });
}
