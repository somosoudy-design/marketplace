import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ARCHIVE_QUERY, EXPECTED, METADATA_QUERY, downloadArchive, graphql, notice, recover, selectBuild, selectUpdate, validateApkRequest, validateBuild, verifyZip } from './recover-apk5.mjs';

// Synthetic ZIP tests only archive integrity/entries, never impersonates a real APK.
const ZIP = Buffer.from('UEsDBBQAAAAAAHC1Wl0fZCKCFAAAABQAAAATAAAAQW5kcm9pZE1hbmlmZXN0LnhtbG9mZmxpbmUgdGVzdCBmaXh0dXJlUEsDBBQAAAAAAHC1Wl0fZCKCFAAAABQAAAALAAAAY2xhc3Nlcy5kZXhvZmZsaW5lIHRlc3QgZml4dHVyZVBLAQIUAxQAAAAAAHC1Wl0fZCKCFAAAABQAAAATAAAAAAAAAAAAAACAAQAAAABBbmRyb2lkTWFuaWZlc3QueG1sUEsBAhQDFAAAAAAAcLVaXR9kIoIUAAAAFAAAAAsAAAAAAAAAAAAAAIABRQAAAGNsYXNzZXMuZGV4UEsFBgAAAAACAAIAegAAAIIAAAAAAA==', 'base64');
const ID = 'd1d10c28-1234-4567-890a-123456789abc';
const BRANCH = { id: '10101010-1234-4567-890a-123456789abc', name: 'preview' };
const UPDATE = {
  id: '20202020-1234-4567-890a-123456789abc', group: '30303030-1234-4567-890a-123456789abc',
  gitCommitHash: EXPECTED.updateCommit, runtime: { version: EXPECTED.runtime }, platform: 'android',
  isGitWorkingTreeDirty: false, isRollBackToEmbedded: false, createdAt: '2026-10-26T22:45:00.000Z', branch: BRANCH,
};
const BUILD = {
  id: ID, status: 'FINISHED', platform: 'ANDROID', distribution: 'INTERNAL', buildProfile: 'preview',
  appIdentifier: EXPECTED.package, appBuildVersion: EXPECTED.versionCode, gitCommitHash: EXPECTED.buildCommit,
  runtime: { version: EXPECTED.runtime }, updateChannel: { name: 'preview' },
  app: { id: EXPECTED.projectId, fullName: EXPECTED.fullName }, expirationDate: '2026-11-09T00:00:00.000Z',
};
function app(builds = [BUILD], updates = [UPDATE]) {
  return { id: EXPECTED.projectId, fullName: EXPECTED.fullName, builds,
    updateChannelByName: { name: 'preview', isPaused: false, updateBranches: [{ ...BRANCH, updateGroups: [updates] }] } };
}
const response = (data) => new Response(JSON.stringify({ data }), { status: 200 });

test('download integration accepts only the existing APK5 request', () => {
  const entry = 'APK 5 (build d1d10c28): https://expo.dev/artifacts/eas/gEaZhiqcOWHmuWuUJN3H6aU4bdWl7Kow_SU5l4pQefk.apk';
  validateApkRequest('# comment\n' + entry + '\nflows: 19-commercial\nthemes: light dark\n');
  for (const invalid of ['', entry.replace('d1d10c28', '12345678'), entry + '\nAPK 4 (build other): https://expo.dev/other.apk', entry.replace('apk', 'aab')]) {
    assert.throws(() => validateApkRequest(invalid), /request_not_exact_apk5/);
  }
});

test('resolve unique historical build; never accept an arbitrary latest or duplicate prefix', () => {
  assert.equal(selectBuild(app()).id, ID);
  assert.throws(() => selectBuild(app([])), /build_prefix_not_found/);
  assert.throws(() => selectBuild(app([BUILD, { ...BUILD, id: ID.replace('1234-', '2345-') } ])), /build_prefix_ambiguous/);
  assert.throws(() => selectBuild({ ...app(), id: 'other' }), /project_mismatch/);
});
test('reject each identity mismatch before any archive access', () => {
  for (const [field, value] of Object.entries({
    gitCommitHash: 'a'.repeat(40), runtime: { version: 'other' }, appIdentifier: 'other', appBuildVersion: '5',
    app: { ...BUILD.app, id: 'other' }, status: 'ERRORED', platform: 'IOS', distribution: 'STORE',
    buildProfile: 'production', updateChannel: { name: 'production' },
  })) assert.throws(() => validateBuild({ ...BUILD, [field]: value }), undefined, field);
  assert.throws(() => validateBuild(BUILD, ID.replace('1234-', '2345-')), /build_id_changed/);
});
test('read exact Android OTA UUID separately from its group; reject dirty/rollback/wrong source', () => {
  const found = selectUpdate(app().updateChannelByName);
  assert.equal(found.id, UPDATE.id); assert.equal(found.group, UPDATE.group); assert.notEqual(found.id, found.group);
  assert.equal(found.latestCompatibleInBranch, true);
  for (const change of [{ gitCommitHash: 'a'.repeat(40) }, { runtime: { version: 'other' } }, { platform: 'ios' }, { isGitWorkingTreeDirty: true }, { isRollBackToEmbedded: true }]) {
    assert.throws(() => selectUpdate(app([BUILD], [{ ...UPDATE, ...change }]).updateChannelByName));
  }
  assert.throws(() => selectUpdate({ ...app().updateChannelByName, updateBranches: [] }), /preview_branch_ambiguous/);
});
test('diagnostic makes only GraphQL read queries and never emits URL/token', async () => {
  const secret = 'test-secret-token'; const signed = 'https://expo.dev/artifacts/eas/apk?signature=do-not-print';
  const output = []; const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init }); const body = JSON.parse(init.body);
    assert.equal(init.headers.authorization, 'Bearer ' + secret);
    if (body.query === METADATA_QUERY) return response({ app: { byId: app() } });
    assert.equal(body.query, ARCHIVE_QUERY); assert.deepEqual(body.variables, { buildId: ID });
    return response({ builds: { byId: { ...BUILD, artifacts: { applicationArchiveUrl: signed } } } });
  };
  const result = await recover({ token: secret, fetchImpl, emit: (line) => output.push(line) });
  assert.equal(result.buildId, ID); assert.equal(result.update.id, UPDATE.id); assert.equal(calls.length, 2);
  assert(output.length < 10); assert(!output.join('').includes(signed)); assert(!output.join('').includes(secret));
  for (const call of calls) { assert.equal(call.url, 'https://api.expo.dev/graphql'); assert(!/\bmutation\b/.test(JSON.parse(call.init.body).query)); }
});
test('changed fresh metadata or a newer foreign OTA blocks archive download', async () => {
  let calls = 0;
  await assert.rejects(recover({ token: 'hidden', download: true, emit: () => {}, fetchImpl: async (_url, init) => {
    calls++; const query = JSON.parse(init.body).query;
    return response(query === METADATA_QUERY ? { app: { byId: app() } } : { builds: { byId: { ...BUILD, runtime: { version: 'other' }, artifacts: { applicationArchiveUrl: 'https://must-not-fetch.test/archive' } } } });
  } }), /build_runtime_mismatch/);
  assert.equal(calls, 2);
  calls = 0;
  const newer = { ...UPDATE, id: '40404040-1234-4567-890a-123456789abc', gitCommitHash: 'a'.repeat(40), createdAt: '2026-10-26T23:59:00.000Z' };
  await assert.rejects(recover({ token: 'hidden', download: true, emit: () => {}, fetchImpl: async () => {
    calls++; return response({ app: { byId: app([BUILD], [UPDATE, newer]) } });
  } }), /ota_source_not_latest_in_preview/);
  assert.equal(calls, 1);
});
test('download is atomic, checks ZIP and reports digest; token is not sent on redirects', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'apk5-test-'));
  try {
    const target = join(temp, 'apks', 'apk1.apk'); const output = []; let requests = 0;
    const result = await recover({ token: 'not-forwarded', download: true, target, emit: (line) => output.push(line), fetchImpl: async (url, init) => {
      if (url === 'https://api.expo.dev/graphql') {
        const query = JSON.parse(init.body).query;
        return response(query === METADATA_QUERY ? { app: { byId: app() } } : { builds: { byId: { ...BUILD, artifacts: { applicationArchiveUrl: 'https://expo.dev/artifact?signed=hidden' } } } });
      }
      assert.equal(init.headers, undefined); requests++;
      return requests === 1 ? new Response(null, { status: 302, headers: { location: 'https://cdn.example/archive?secret=hidden' } }) : new Response(ZIP, { status: 200 });
    } });
    assert.equal(requests, 2); assert.equal(result.archive.bytes, ZIP.length); assert.match(result.archive.sha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(await readFile(target), ZIP); assert.deepEqual(await readdir(join(temp, 'apks')), ['apk1.apk']);
    assert(output.length < 10); assert(!output.join('').includes('signed=hidden')); assert(!output.join('').includes('secret=hidden'));
  } finally { await rm(temp, { recursive: true, force: true }); }
});
test('invalid ZIP never replaces prior target and leaves no partial file', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'apk5-test-'));
  try {
    const target = join(temp, 'apk1.apk'); await writeFile(target, 'previous');
    await assert.rejects(downloadArchive('https://expo.dev/archive', target, { fetchImpl: async () => new Response('not an APK') }), /archive_zip_invalid/);
    assert.equal(await readFile(target, 'utf8'), 'previous'); assert.deepEqual(await readdir(temp), ['apk1.apk']);
  } finally { await rm(temp, { recursive: true, force: true }); }
});
test('reject HTTP redirect and expose only precise safe errors for denied downloads', async () => {
  await assert.rejects(downloadArchive('https://expo.dev/archive', '/unused', { fetchImpl: async () => new Response(null, { status: 302, headers: { location: 'http://example.test/unsafe' } }) }), /archive_redirect_not_safe_https/);
  await assert.rejects(downloadArchive('https://expo.dev/archive?secret=hidden', '/unused', { fetchImpl: async () => new Response('upstream token=secret', { status: 404 }) }), /^ReceiptError: archive_http_404$/);
  await assert.rejects(graphql('query {}', {}, { token: 'hidden', fetchImpl: async () => { throw new Error('hidden signed URL'); } }), /^ReceiptError: graphql_network_error$/);
  await assert.rejects(graphql('query {}', {}, { token: 'hidden', fetchImpl: async () => new Response(JSON.stringify({ errors: [{ message: 'do not print', extensions: { code: 'FORBIDDEN' } }] })) }), /^ReceiptError: graphql_error_FORBIDDEN$/);
});
test('notices escape Actions commands and ZIP verifier rejects an unrelated file', async () => {
  assert(!notice('test', { text: 'a\n::error::injected%' }).includes('\n'));
  const temp = await mkdtemp(join(tmpdir(), 'apk5-test-'));
  try {
    const file = join(temp, 'bad.apk'); await writeFile(file, 'bad'); assert.throws(() => verifyZip(file), /archive_zip_invalid/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});
