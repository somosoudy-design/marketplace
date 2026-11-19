import test from 'node:test';
import assert from 'node:assert/strict';
import { selectReference, OLD_BUILD, QUERY } from './signing-reference.mjs';
import { EXPECTED } from './verify-native-apk.mjs';
const credential = { id: 'credential-id', isDefault: true,
  androidKeystore: { id: 'key-id', createdAt: '2026-10-09T00:00:00Z', sha256CertificateFingerprint: 'c'.repeat(64) } };
const data = () => ({
  app: { byFullName: { id: EXPECTED.project, fullName: '@marketplacebrand/marketplace',
    androidAppCredentials: [{ applicationIdentifier: EXPECTED.package, androidAppBuildCredentialsList: [structuredClone(credential)] }] } },
  builds: { byId: { id: OLD_BUILD, createdAt: '2026-10-10T04:07:32Z', status: 'FINISHED', appIdentifier: EXPECTED.package,
    appBuildVersion: '4', gitCommitHash: 'cc5b1010691a492745a52e5842a4baaaf8ec3da8',
    runtime: { version: EXPECTED.oldRuntime }, updateChannel: { name: 'preview' }, app: { id: EXPECTED.project } } },
});
test('outputs only public reference identifiers and explicitly limits historical claim', () => {
  const ref = selectReference(data());
  assert.equal(ref.certificateSha256, credential.androidKeystore.sha256CertificateFingerprint);
  assert.equal(ref.historicalBinaryComparison, false);
  assert.equal(ref.privateKeyMaterialRequested, false);
  assert(!/keystorePassword|keyPassword|keystoreBase64|keyAlias|privateKey/i.test(QUERY));
});
test('rejects ambiguity, non-default or recently created keystores', () => {
  for (const mutate of [
    records => records.push({ ...structuredClone(credential), id: 'other', isDefault: false, androidKeystore: { ...credential.androidKeystore, id: 'other-key' } }),
    records => { records[0].isDefault = false; },
    records => { records[0].androidKeystore.createdAt = '2026-11-01T00:00:00Z'; },
  ]) {
    const value = data(); mutate(value.app.byFullName.androidAppCredentials[0].androidAppBuildCredentialsList);
    assert.throws(() => selectReference(value));
  }
});
test('rejects wrong historical build and wrong project', () => {
  const a = data(); a.builds.byId.id = 'another-build'; assert.throws(() => selectReference(a));
  const b = data(); b.app.byFullName.id = 'another-project'; assert.throws(() => selectReference(b));
});
