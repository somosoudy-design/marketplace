import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyCloudflareArtifact } from './check-cloudflare-release.mjs';

function fixture(t) {
  const app = mkdtempSync(join(tmpdir(), 'mayami-cloudflare-release-'));
  t.after(() => rmSync(app, { recursive: true, force: true }));
  mkdirSync(join(app, '.open-next/assets/_next/static'), { recursive: true });
  mkdirSync(join(app, '.open-next/cloudflare'));
  writeFileSync(join(app, '.open-next/cloudflare/next-env.mjs'), 'export const production = {};\nexport const development = {};\nexport const test = {};\n');
  writeFileSync(join(app, '.open-next/worker.js'), 'export default {fetch(){return new Response("ready")}};');
  writeFileSync(join(app, '.open-next/assets/_next/static/app.js'), 'console.log("public bundle");');
  return app;
}

test('accepts the release worker and public assets', t => {
  const report = verifyCloudflareArtifact(fixture(t));
  assert.equal(report.files, 3);
  assert(report.bytes > 0);
});

test('rejects a private photograph copied into the adapted asset directory', t => {
  const app = fixture(t);
  mkdirSync(join(app, '.open-next/assets/_exhibition'));
  writeFileSync(join(app, '.open-next/assets/_exhibition/private.jpg'), Buffer.from([255, 216, 255]));
  assert.throws(() => verifyCloudflareArtifact(app), /Private exhibition entry/);
});

test('rejects a private registry reference embedded in the adapted server bundle', t => {
  const app = fixture(t);
  writeFileSync(join(app, '.open-next/worker.js'), 'const image="/_exhibition/private.jpg";');
  assert.throws(() => verifyCloudflareArtifact(app), /Private exhibition reference/);
});

test('rejects an environment file copied into the deployment artifact', t => {
  const app = fixture(t);
  writeFileSync(join(app, '.open-next/assets/.env.local'), 'PRIVATE_VALUE=must-not-ship');
  assert.throws(() => verifyCloudflareArtifact(app), /Environment file/);
});

test('rejects an incomplete adapted build', t => {
  const app = fixture(t);
  rmSync(join(app, '.open-next/worker.js'));
  assert.throws(() => verifyCloudflareArtifact(app), /Build the Cloudflare worker first/);
});


test('rejects Cloudflare development variable files', t => {
  for (const filename of ['.dev.vars', '.dev.vars.production']) {
    const app = fixture(t);
    writeFileSync(join(app, '.open-next/assets', filename), 'PRIVATE_VALUE=must-not-ship');
    assert.throws(() => verifyCloudflareArtifact(app), /Environment file/);
  }
});

test('rejects environment symbolic links before following their contents', t => {
  const app = fixture(t);
  writeFileSync(join(app, 'private.env'), 'PRIVATE_VALUE=must-not-ship');
  symlinkSync(join(app, 'private.env'), join(app, '.open-next/assets/.env.local'));
  assert.throws(() => verifyCloudflareArtifact(app), /Environment file/);
});


test('accepts empty and partial public dotenv profiles without requiring values from process env', t => {
  const app = fixture(t);
  writeFileSync(join(app, '.open-next/cloudflare/next-env.mjs'), 'export const production = {"NEXT_PUBLIC_SUPABASE_URL":"http://127.0.0.1:54321"};\nexport const development = {};\nexport const test = {};\n');
  assert.doesNotThrow(() => verifyCloudflareArtifact(app));
});

test('rejects private variables embedded by the adapter without printing their values', t => {
  const app = fixture(t);
  writeFileSync(join(app, '.open-next/cloudflare/next-env.mjs'), 'export const production = {"PRIVATE_VALUE":"must-not-be-revealed"};\nexport const development = {};\nexport const test = {};\n');
  assert.throws(() => verifyCloudflareArtifact(app), error => /Unapproved compiled environment variable/.test(error.message) && !error.message.includes('must-not-be-revealed'));
});

test('rejects malformed compiled dotenv JSON without exposing its contents', t => {
  const app = fixture(t);
  writeFileSync(join(app, '.open-next/cloudflare/next-env.mjs'), 'export const production = {"PRIVATE_VALUE":must-not-be-revealed};\nexport const development = {};\nexport const test = {};\n');
  assert.throws(() => verifyCloudflareArtifact(app), error => error.message === 'Invalid compiled environment JSON.');
});


test('accepts pnpm dependency directory links contained in the adapted standalone server', t => {
  const app = fixture(t);
  const target = join(app, '.open-next/server-functions/default/node_modules/.pnpm/next/node_modules/next');
  const parent = join(app, '.open-next/server-functions/default/apps/storefront/node_modules');
  mkdirSync(target, { recursive: true });
  mkdirSync(parent, { recursive: true });
  writeFileSync(join(target, 'index.js'), 'export const module = true;');
  symlinkSync(target, join(parent, 'next'));
  assert.doesNotThrow(() => verifyCloudflareArtifact(app));
});

test('rejects a server dependency link that escapes the deployment artifact', t => {
  const app = fixture(t);
  const target = join(app, 'private-files');
  const parent = join(app, '.open-next/server-functions/default/node_modules');
  mkdirSync(target);
  mkdirSync(parent, { recursive: true });
  symlinkSync(target, join(parent, 'next'));
  assert.throws(() => verifyCloudflareArtifact(app), /Unsafe symbolic link/);
});

test('rejects public asset symlinks even when their target is inside the artifact', t => {
  const app = fixture(t);
  symlinkSync(join(app, '.open-next/assets/_next'), join(app, '.open-next/assets/alias'));
  assert.throws(() => verifyCloudflareArtifact(app), /Unsafe symbolic link/);
});
