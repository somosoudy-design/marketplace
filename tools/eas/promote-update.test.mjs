import assert from 'node:assert/strict';
import test from 'node:test';
import { selectUpdate, validateRequest, validateRun } from './promote-update.mjs';

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
