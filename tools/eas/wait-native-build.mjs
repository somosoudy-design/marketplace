// Waits for the owner's existing build. Never starts, retries or cancels a build.
import assert from 'node:assert/strict';
import { graphql } from './recover-apk5.mjs';
import { EXPECTED } from './verify-native-apk.mjs';

const [buildId, source, runtime] = process.argv.slice(2);
const query = `query WaitNativeBuild($buildId:ID!) { builds { byId(buildId:$buildId) {
  id status gitCommitHash appIdentifier buildProfile isGitWorkingTreeDirty
  runtime { version } updateChannel { name } app { id }
} } }`;
try {
  assert(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(buildId ?? ''));
  assert(/^[a-f0-9]{40}$/.test(source ?? '') && /^[a-f0-9]{40}$/.test(runtime ?? ''));
  const deadline = Date.now() + 120 * 60_000;
  let previous;
  for (;;) {
    const data = await graphql(query, { buildId }, { token: process.env.EXPO_TOKEN });
    const b = data.builds.byId;
    assert.equal(b.id, buildId);
    assert.equal(b.app.id, EXPECTED.project);
    assert.equal(b.gitCommitHash, source);
    assert.equal(b.appIdentifier, EXPECTED.package);
    assert.equal(b.buildProfile, 'preview');
    assert.equal(b.updateChannel?.name, 'preview');
    assert.equal(b.runtime?.version, runtime);
    assert.equal(b.isGitWorkingTreeDirty, false);
    if (b.status !== previous) {
      console.log('::notice title=Estado del APK esperado::' + JSON.stringify({ buildId, status: b.status, observedAt: new Date().toISOString() }));
      previous = b.status;
    }
    if (b.status === 'FINISHED') break;
    assert(['NEW', 'IN_QUEUE', 'IN_PROGRESS'].includes(b.status), `Build stopped: ${b.status}`);
    assert(Date.now() < deadline, 'Existing build still pending after bounded wait; do not start a duplicate');
    await new Promise(resolve => setTimeout(resolve, 30_000));
  }
} catch (error) {
  console.error('::error title=Esperando APK existente::' + String(error.message).replace(/[\r\n]+/g, ' ').slice(0, 240));
  process.exitCode = 1;
}
