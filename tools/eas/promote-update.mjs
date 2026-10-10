// Production promotion of an immutable APK-5-compatible update. All checks precede the mutation.
// GitHub provides EXPO_TOKEN and GITHUB_TOKEN; no tokens or signed asset URLs are written to the report.
import assert from 'node:assert/strict';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const mobile = resolve(repo, 'apps/mobile');
const trackedApp = ['apps/mobile', 'packages', 'config', 'pnpm-lock.yaml', 'package.json', 'pnpm-workspace.yaml'];
const apk5Runtime = 'eb5ed1179b9c76c9c3cf27333aa48306728eb4ba';

export function validateRequest(request) {
  assert.equal(request.destinationChannel, 'production', 'Only the authorized production channel is allowed');
  assert.equal(request.sourceBranch, 'preview', 'Source must be the APK 5 preview branch');
  assert.equal(request.runtime, apk5Runtime, 'Keep the installed APK 5 runtime');
  for (const field of ['sourceCommit', 'androidCommit']) {
    assert.match(request[field] ?? '', /^[a-f0-9]{40}$/, 'Invalid commit: ' + field);
  }
  for (const field of ['previewRun', 'androidRun']) {
    assert(Number.isSafeInteger(request[field]) && request[field] > 0, 'Invalid run: ' + field);
  }
  assert(typeof request.message === 'string' && request.message.trim(), 'A release message is required');
  return request;
}

export function validateRun(run, workflow, commit) {
  assert.equal(run.path, '.github/workflows/' + workflow, 'Unexpected validation workflow');
  assert.equal(run.head_branch, 'claude/marketplace-v1', 'Unexpected validation branch');
  assert.equal(run.head_sha, commit, 'Validation belongs to a different commit');
  assert.equal(run.status, 'completed', 'Validation is not complete');
  assert.equal(run.conclusion, 'success', 'Validation did not pass');
}

export function selectUpdate(updates, request) {
  return updates.find(update =>
    update.platform === 'android' &&
    update.branch === request.sourceBranch &&
    update.gitCommitHash === request.sourceCommit &&
    update.runtimeVersion === request.runtime &&
    !update.isRollBackToEmbedded,
  );
}

function command(binary, args, cwd = repo) {
  const result = spawnSync(binary, args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
    timeout: 120000, maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(result.status, 0, 'Command failed: ' + binary + ' ' + args[0]);
  return result.stdout;
}

function eas(args) {
  return JSON.parse(command('npx', ['--yes', 'eas-cli@24.12.1', ...args, '--json'], mobile));
}

async function runInfo(id) {
  assert(process.env.GITHUB_TOKEN, 'Missing GitHub validation token');
  const response = await fetch('https://api.github.com/repos/' + process.env.GITHUB_REPOSITORY + '/actions/runs/' + id, {
    headers: {
      authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
      accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(30000),
  });
  assert(response.ok, 'Cannot verify validation run: HTTP ' + response.status);
  return response.json();
}

async function main() {
  const request = validateRequest(JSON.parse(readFileSync(resolve(repo, '.github/eas-production-update-request'), 'utf8')));
  validateRun(await runInfo(request.previewRun), 'eas-update-preview.yml', request.sourceCommit);
  validateRun(await runInfo(request.androidRun), 'apk-emulator.yml', request.androidCommit);
  // Documentation/CI files may change after staging; app code, config and dependencies may not.
  for (const target of [request.androidCommit, 'HEAD']) {
    command('git', ['diff', '--exit-code', request.sourceCommit, target, '--', ...trackedApp]);
  }

  const groups = eas(['update:list', '--branch', request.sourceBranch, '--limit', '10', '--non-interactive']);
  assert(Array.isArray(groups.currentPage), 'Unexpected update inventory');
  let source;
  for (const group of groups.currentPage) {
    if (group.runtimeVersion !== request.runtime) continue;
    const updates = eas(['update:view', group.group]);
    source = selectUpdate(updates, request);
    if (source) break;
  }
  assert(source, 'No Android update matches the tested commit and APK 5 runtime');

  const builds = eas(['build:list', '--platform', 'android', '--status', 'finished',
    '--channel', 'production', '--runtime-version', request.runtime, '--limit', '10', '--non-interactive']);
  assert(Array.isArray(builds), 'Unexpected build inventory');
  const consumers = builds.map(build => ({ id: build.id, channel: build.channel, runtime: build.runtimeVersion }));

  // EAS creates/links a missing destination channel, or uses its existing single branch without remapping.
  const promoted = eas(['update:republish', '--group', source.group, '--destination-channel', 'production',
    '--platform', 'android', '--message', request.message, '--non-interactive']);
  const group = promoted[0]?.group;
  assert(group, 'Promotion did not return an update group');
  const published = eas(['update:view', group]);
  assert(published.some(update => update.platform === 'android' && update.runtimeVersion === request.runtime),
    'Production result does not retain APK 5 compatibility');

  const report = {
    channel: 'production', sourceGroup: source.group, sourceUpdate: source.id,
    sourceCommit: request.sourceCommit, runtime: request.runtime,
    productionGroup: group, productionUpdate: published.find(update => update.platform === 'android')?.id,
    previewRun: request.previewRun, androidRun: request.androidRun, matchingProductionBuilds: consumers,
    apk5Channel: 'preview',
  };
  writeFileSync(resolve(repo, 'eas-production-release.json'), JSON.stringify(report, null, 2));
  const lines = [
    '### Frente A V2 publicado en production',
    '- Canal: production · runtime APK 5: ' + request.runtime,
    '- Grupo origen validado: ' + source.group + ' · commit: ' + request.sourceCommit,
    '- Grupo publicado: ' + group,
    '- https://expo.dev/accounts/marketplacebrand/projects/marketplace/updates/' + group,
    '- Runs aprobados: preview ' + request.previewRun + ' · Android ' + request.androidRun,
    '- APK 5 (d1d10c28) consume preview; también conserva allí esta versión.',
    '- Builds Android terminados con canal production y este runtime: ' + consumers.length,
    ...consumers.map(build => '  - ' + build.id),
  ];
  const summary = lines.join('\n') + '\n';
  console.log(summary);
  // The annotation remains readable from a public run page even without artifact-download credentials.
  console.log('::notice title=EAS production::Canal production; grupo ' + group +
    '; origen ' + source.group + '; runtime ' + request.runtime +
    '; APK 5 consume preview; builds production compatibles: ' + consumers.length +
    (consumers.length ? ' (' + consumers.map(build => build.id).join(', ') + ')' : ''));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
