#!/usr/bin/env node
// Read-only EAS metadata/download. Never builds, publishes or changes a channel.
// Token goes only to GraphQL; archive URLs and upstream bodies never reach output.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createWriteStream, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';

export const EXPECTED = Object.freeze({
  projectId: '9f629f10-d679-4a99-9965-8a9e588afc85',
  fullName: '@marketplacebrand/marketplace',
  buildPrefix: 'd1d10c28',
  buildId: 'd1d10c28-1d9e-4123-8487-602dc10b9710',
  buildCommit: 'cc5b1010691a492745a52e5842a4baaaf8ec3da8',
  runtime: 'eb5ed1179b9c76c9c3cf27333aa48306728eb4ba',
  package: 'com.example.kora.preview',
  versionCode: '4',
  updateCommit: 'f23ffdc06006db6f0127df12144bb33b1fd4377b',
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BUILD_FIELDS = `id status platform distribution buildProfile appIdentifier
  appBuildVersion gitCommitHash runtime { version } updateChannel { name }
  app { id fullName } expirationDate`;
// Fields/arguments match EAS CLI24.12.1 BuildQuery/ChannelQuery/UpdateFragment.
export const METADATA_QUERY = `query ExistingApk5Receipt(
  $appId: String!, $updateFilter: UpdatesFilter!
) { app { byId(appId: $appId) {
  id fullName
  updateChannelByName(name: "preview") {
    name isPaused
    updateBranches(offset: 0, limit: 5) {
      id name
      updateGroups(offset: 0, limit: 20, filter: $updateFilter) {
        id group platform gitCommitHash isGitWorkingTreeDirty isRollBackToEmbedded
        createdAt runtime { version } branch { id name }
      }
    }
  }
} } }`;
export const ARCHIVE_QUERY = `query ExistingApk5Archive($buildId: ID!) {
  builds { byId(buildId: $buildId) {
    ${BUILD_FIELDS}
    artifacts { applicationArchiveUrl }
  } }
}`;

export class ReceiptError extends Error {
  constructor(code) { super(code); this.name = 'ReceiptError'; this.code = code; }
}
const fail = (code) => { throw new ReceiptError(code); };
export function notice(title, value) {
  const escape = (s) => s.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
  return `::notice title=${escape(title)},file=.github/workflows/apk-emulator.yml,line=1::${escape(JSON.stringify(value))}`;
}

export async function graphql(query, variables, { token, fetchImpl = globalThis.fetch }) {
  if (!token) fail('missing_expo_token');
  let response;
  try {
    response = await fetchImpl('https://api.expo.dev/graphql', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(30_000),
      redirect: 'error',
    });
  } catch { fail('graphql_network_error'); }
  if (!response.ok) fail('graphql_http_' + response.status);
  let json;
  try { json = await response.json(); } catch { fail('graphql_invalid_json'); }
  // GraphQL messages can contain URLs or request details: expose only a bounded code.
  if (json?.errors?.length) {
    const code = json.errors[0]?.extensions?.code;
    fail('graphql_error_' + (/^[A-Z0-9_]{1,60}$/.test(code ?? '') ? code : 'unknown'));
  }
  if (!json?.data) fail('graphql_missing_data');
  return json.data;
}

export function validateBuild(build, fullId = EXPECTED.buildId) {
  if (!build || !UUID.test(build.id ?? '') || !build.id.startsWith(EXPECTED.buildPrefix + '-')) fail('build_id_mismatch');
  if (fullId && build.id !== fullId) fail('build_id_changed');
  if (build.app?.id !== EXPECTED.projectId || build.app?.fullName !== EXPECTED.fullName) fail('build_project_mismatch');
  if (build.platform !== 'ANDROID' || build.status !== 'FINISHED') fail('build_not_finished_android');
  if (build.distribution !== 'INTERNAL' || build.buildProfile !== 'preview' || build.updateChannel?.name !== 'preview') fail('build_profile_channel_mismatch');
  if (build.gitCommitHash !== EXPECTED.buildCommit) fail('build_commit_mismatch');
  if (build.runtime?.version !== EXPECTED.runtime) fail('build_runtime_mismatch');
  if (build.appIdentifier !== EXPECTED.package || build.appBuildVersion !== EXPECTED.versionCode) fail('build_package_version_mismatch');
  return build;
}

export function selectBuild(app) {
  if (app?.id !== EXPECTED.projectId || app?.fullName !== EXPECTED.fullName) fail('project_mismatch');
  if (!Array.isArray(app.builds)) fail('builds_missing');
  const candidates = app.builds.filter((b) => b.id?.startsWith(EXPECTED.buildPrefix + '-'));
  if (candidates.length !== 1) fail(candidates.length ? 'build_prefix_ambiguous' : 'build_prefix_not_found');
  return validateBuild(candidates[0]);
}

export function validateApkRequest(text) {
  const entries = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.startsWith('APK '));
  if (entries.length !== 1 || entries[0] !== 'APK 5 (build d1d10c28): https://expo.dev/artifacts/eas/gEaZhiqcOWHmuWuUJN3H6aU4bdWl7Kow_SU5l4pQefk.apk') fail('request_not_exact_apk5');
}

export function selectUpdate(channel) {
  if (channel?.name !== 'preview' || channel.isPaused !== false) fail('preview_channel_missing_or_paused');
  if (!Array.isArray(channel.updateBranches) || channel.updateBranches.length !== 1) fail('preview_branch_ambiguous');
  const branch = channel.updateBranches[0];
  if (!UUID.test(branch?.id ?? '') || !/^[a-zA-Z0-9._/-]{1,128}$/.test(branch?.name ?? '')) fail('preview_branch_invalid');
  if (!Array.isArray(branch.updateGroups)) fail('preview_updates_missing');
  const updates = branch.updateGroups.flat().filter((u) => u?.platform === 'android' && u.runtime?.version === EXPECTED.runtime);
  const matching = updates.filter((u) => u.gitCommitHash === EXPECTED.updateCommit);
  if (!matching.length) fail('ota_source_runtime_not_found');
  for (const u of matching) {
    if (!UUID.test(u.id ?? '') || !UUID.test(u.group ?? '') || !Number.isFinite(Date.parse(u.createdAt))) fail('ota_metadata_invalid');
    for (const flag of ['isGitWorkingTreeDirty', 'isRollBackToEmbedded']) {
      if (u[flag] != null && typeof u[flag] !== 'boolean') fail('ota_flag_invalid');
    }
    if (u.branch?.id !== branch.id || u.branch?.name !== branch.name) fail('ota_branch_mismatch');
  }
  matching.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const latest = updates.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  const u = matching[0];
  return {
    id: u.id, group: u.group, runtime: EXPECTED.runtime, commit: EXPECTED.updateCommit,
    platform: 'android', channel: 'preview', branch: branch.name,
    createdAt: u.createdAt, matchingUpdates: matching.length,
    latestCompatibleInBranch: latest?.id === u.id,
    isGitWorkingTreeDirty: u.isGitWorkingTreeDirty ?? null,
    isRollBackToEmbedded: u.isRollBackToEmbedded ?? null,
    workingTreeState: u.isGitWorkingTreeDirty === true ? 'dirty' : u.isGitWorkingTreeDirty === false ? 'clean' : 'unknown',
    rollbackState: u.isRollBackToEmbedded === true ? 'rollback' : u.isRollBackToEmbedded === false ? 'standard_update' : 'unknown',
    workingTreeFlagPresent: Object.hasOwn(u, 'isGitWorkingTreeDirty'),
    rollbackFlagPresent: Object.hasOwn(u, 'isRollBackToEmbedded'),
  };
}

export function archiveUrl(value) {
  let url;
  try { url = new URL(value); } catch { fail('archive_url_missing_or_invalid'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) fail('archive_url_not_safe_https');
  return url;
}

export function verifyZip(file) {
  try {
    execFileSync('unzip', ['-tq', file], { stdio: 'pipe', timeout: 60_000, maxBuffer: 1_048_576 });
    const entries = execFileSync('unzip', ['-Z', '-1', file], { encoding: 'utf8', stdio: 'pipe', timeout: 30_000, maxBuffer: 8_388_608 }).split(/\r?\n/);
    if (!entries.includes('AndroidManifest.xml') || !entries.includes('classes.dex')) fail('archive_not_apk');
  } catch (error) {
    if (error instanceof ReceiptError) throw error;
    fail(error?.code === 'ENOENT' ? 'unzip_unavailable' : 'archive_zip_invalid');
  }
}

export async function downloadArchive(urlValue, target, { fetchImpl = globalThis.fetch, verify = verifyZip } = {}) {
  let url = archiveUrl(urlValue);
  let response;
  for (let redirects = 0; redirects <= 5; redirects++) {
    try {
      // Deliberately no authorization header on archive hosts or redirects.
      response = await fetchImpl(url.href, { redirect: 'manual', signal: AbortSignal.timeout(180_000) });
    } catch { fail('archive_network_error'); }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel().catch(() => {});
      if (!location || redirects === 5) fail('archive_redirect_invalid');
      try { url = archiveUrl(new URL(location, url).href); } catch { fail('archive_redirect_not_safe_https'); }
      continue;
    }
    break;
  }
  if (response.status !== 200) { await response.body?.cancel().catch(() => {}); fail('archive_http_' + response.status); }
  if (!response.body) fail('archive_empty_body');
  const destination = resolve(target);
  await mkdir(dirname(destination), { recursive: true });
  const temp = await mkdtemp(join(dirname(destination), '.apk5-'));
  const file = join(temp, 'archive.apk');
  let bytes = 0;
  const hash = createHash('sha256');
  try {
    await pipeline(Readable.fromWeb(response.body), new Transform({
      transform(chunk, _encoding, callback) {
        bytes += chunk.length;
        if (bytes > 1_073_741_824) return callback(new ReceiptError('archive_too_large'));
        hash.update(chunk); callback(null, chunk);
      },
    }), createWriteStream(file, { flags: 'wx', mode: 0o600 }));
    if (!bytes) fail('archive_empty_body');
    verify(file);
    await rename(file, destination);
    return { path: target, bytes, sha256: hash.digest('hex'), zip: 'valid', apkEntries: true };
  } catch (error) {
    if (error instanceof ReceiptError) throw error;
    fail('archive_write_or_stream_error');
  } finally { await rm(temp, { recursive: true, force: true }); }
}

export async function recover({ token, download = false, target = 'apks/apk1.apk', fetchImpl = globalThis.fetch, emit = console.log }) {
  const options = { token, fetchImpl };
  if (!download) {
    // OTA observation is independent of the old build and its expired archive.
    const data = await graphql(METADATA_QUERY, {
      appId: EXPECTED.projectId,
      updateFilter: { platform: 'ANDROID', runtimeVersions: [EXPECTED.runtime] },
    }, options);
    const app = data.app?.byId;
    if (app?.id !== EXPECTED.projectId || app?.fullName !== EXPECTED.fullName) fail('project_mismatch');
    const update = selectUpdate(app.updateChannelByName);
    emit(notice('Published Android OTA identity', update));
    // Report before rejecting: null is unknown; true remains an explicit objection.
    if (update.isGitWorkingTreeDirty === true || update.isRollBackToEmbedded === true) fail('ota_dirty_or_rollback');
    if (!update.latestCompatibleInBranch) fail('ota_source_not_latest_in_preview');
    return { update, observationOnly: true };
  }
  // Archive retrieval is independent of OTA flags. The full historical UUID was
  // observed in CI40415242434; validate all its approved build fields again.
  const build = validateBuild((await graphql(ARCHIVE_QUERY, { buildId: EXPECTED.buildId }, options)).builds?.byId);
  emit(notice('Existing APK5 identity', {
    id: build.id, projectId: EXPECTED.projectId, commit: EXPECTED.buildCommit,
    runtime: EXPECTED.runtime, package: EXPECTED.package, versionCode: EXPECTED.versionCode,
    channel: 'preview', profile: 'preview', expirationDate: build.expirationDate ?? null,
  }));
  const url = archiveUrl(build.artifacts?.applicationArchiveUrl);
  emit(notice('Existing APK5 archive', { id: build.id, archiveAvailable: true, downloadRequested: true }));
  // One refreshed archive query and one download attempt; no automatic retries.
  const archive = await downloadArchive(url.href, target, { fetchImpl });
  emit(notice('Existing APK5 downloaded', { id: build.id, ...archive }));
  return { buildId: build.id, archive };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some((arg) => !['--download', '--archive-only', '--observe-ota'].includes(arg))) fail('invalid_argument');
  const download = args.includes('--download') || args.includes('--archive-only');
  if (download) {
    let request;
    try { request = readFileSync('.github/apk-emulator-request', 'utf8'); } catch { fail('apk_request_missing'); }
    validateApkRequest(request);
  }
  await recover({ token: process.env.EXPO_TOKEN, download });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    // Never print error.message/stack from fetch, GraphQL, unzip or the filesystem.
    const code = error instanceof ReceiptError ? error.code : 'unexpected_read_or_download_error';
    console.error('::error title=APK5 recovery::' + code);
    process.exitCode = 1;
  });
}
