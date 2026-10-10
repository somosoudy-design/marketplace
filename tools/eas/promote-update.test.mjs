import assert from 'node:assert/strict';
import test from 'node:test';
import { selectUpdate, validateAndroidRequest, validateRequest, validateRun } from './promote-update.mjs';

const request = {
  destinationChannel: 'production', sourceBranch: 'preview',
  runtime: 'eb5ed1179b9c76c9c3cf27333aa48306728eb4ba',
  sourceCommit: 'a'.repeat(40), androidCommit: 'b'.repeat(40),
  previewRun: 100, androidRun: 101, message: 'Front A V2',
};

test('rejects native-runtime changes and unintended channels before release', () => {
  assert.equal(validateRequest(request), request);
  for (const bad of [{ runtime: 'c'.repeat(40) }, { destinationChannel: 'development' },
    { sourceBranch: 'other' }, { sourceCommit: 'short' }, { androidRun: null }]) {
    assert.throws(() => validateRequest({ ...request, ...bad }));
  }
});

test('requires completed successful validation for the exact workflow, branch and commit', () => {
  const run = { path: '.github/workflows/apk-emulator.yml', head_branch: 'claude/marketplace-v1',
    head_sha: request.androidCommit, status: 'completed', conclusion: 'success' };
  validateRun(run, 'apk-emulator.yml', request.androidCommit);
  for (const bad of [{ conclusion: 'failure' }, { status: 'in_progress' },
    { head_sha: request.sourceCommit }, { head_branch: 'main' }, { path: '.github/workflows/other.yml' }]) {
    assert.throws(() => validateRun({ ...run, ...bad }, 'apk-emulator.yml', request.androidCommit));
  }
});

test('selects the tested Android update and rejects another commit, runtime, branch or rollback', () => {
  const update = { platform: 'android', branch: 'preview', gitCommitHash: request.sourceCommit,
    runtimeVersion: request.runtime, isRollBackToEmbedded: false };
  const invalid = [{ platform: 'ios' }, { branch: 'production' }, { gitCommitHash: request.androidCommit },
    { runtimeVersion: 'old' }, { isRollBackToEmbedded: true }].map(bad => ({ ...update, ...bad }));
  assert.equal(selectUpdate(invalid, request), undefined);
  assert.equal(selectUpdate([...invalid, update], request), update);
});

test('requires the existing APK 5 and the complete visitor validation in both themes', () => {
  const text = [
    '# Only the existing APK 5',
    'APK 5 (build d1d10c28): https://expo.dev/artifacts/eas/gEaZhiqcOWHmuWuUJN3H6aU4bdWl7Kow_SU5l4pQefk.apk',
    'flows: frente-a-v2/01-visitante 01b-volver-favoritos 01c-volver-favoritos-atras',
    'themes: light dark',
  ].join('\n');
  validateAndroidRequest(text);
  for (const bad of [text.replace('d1d10c28', 'other'), text.replace('themes: light dark', 'themes: light'),
    text.replace('frente-a-v2/01-visitante', '01-visitante'), text + '\nAPK 4: other.apk']) {
    assert.throws(() => validateAndroidRequest(bad));
  }
});
