import assert from 'node:assert/strict';
import test from 'node:test';
import { APPROVED, PROJECT_ID, FULL_NAME, REQUEST_PATH, QUERY, CANONICAL, parseRequest, validateRequest, publicMetadata, publicRoot, probeRelease, readReceipt, notice } from './receipt.mjs';

const REQUEST = `source: ${APPROVED.sourceSha}\nbuild: ${APPROVED.buildVersion}\n`;
const URL = 'https://kora-panel--local-test.expo.app';
const app = () => ({ id: PROJECT_ID, fullName: FULL_NAME, privateSecret: 'never-print', workerDeploymentAlias: { url: CANONICAL, workerDeployment: { deploymentIdentifier: 'local-test', token: 'never-print' } }, workerDeployments: { edges: [{ node: { deploymentIdentifier: 'local-test', url: URL, privateSecret: 'never-print', aliases: [{ aliasName: null, url: CANONICAL, token: 'never-print' }] } }] } });

test('only the approved source/build request and an isolated request commit are accepted', () => {
  assert.deepEqual(parseRequest(REQUEST), APPROVED);
  assert.deepEqual(validateRequest({ text: REQUEST, parents: ['a'.repeat(40)], changedPaths: [REQUEST_PATH] }), APPROVED);
  for (const text of [REQUEST + 'source: ' + APPROVED.sourceSha, REQUEST + 'token: never-print', REQUEST.replace(APPROVED.sourceSha, 'b'.repeat(40)), REQUEST.replace(APPROVED.buildVersion, '40410656172.2')]) assert.throws(() => parseRequest(text));
  assert.throws(() => validateRequest({ text: REQUEST, parents: ['a'.repeat(40)], changedPaths: [REQUEST_PATH, 'apps/admin/page.tsx'] }));
  assert.throws(() => validateRequest({ text: REQUEST, parents: ['a'.repeat(40), 'b'.repeat(40)], changedPaths: [REQUEST_PATH] }));
});

test('Hosting metadata keeps only public identifier, URLs and aliases of the exact project', () => {
  const value = publicMetadata(app());
  assert.deepEqual(value.production, { identifier: 'local-test', url: CANONICAL });
  assert.deepEqual(value.deployments[0], { identifier: 'local-test', url: URL, production: { url: CANONICAL }, aliases: [{ name: null, url: CANONICAL }] });
  assert.ok(!JSON.stringify(value).includes('never-print'));
  assert.throws(() => publicMetadata({ ...app(), id: 'wrong-project' }), /project_mismatch/);
  for (const url of ['http://kora-panel.expo.app', 'https://127.0.0.1', 'https://user:secret@kora-panel.expo.app', CANONICAL + '?token=secret', CANONICAL + '/private']) assert.throws(() => publicRoot(url));
});

test('HTTP diagnosis exposes status, type and sanitized redirects without arbitrary response bodies', async () => {
  let readBody = false;
  const result = await probeRelease(CANONICAL, APPROVED, async () => ({ status: 307, headers: new Headers({ 'content-type': 'text/html; charset=utf-8', location: '/other?token=never-print' }), text: async () => { readBody = true; return 'never-print'; } }));
  assert.equal(result.status, 307);
  assert.equal(result.contentType, 'text/html');
  assert.equal(result.location, CANONICAL + '/other');
  assert.equal(result.locationParametersOmitted, true);
  assert.equal(readBody, false);
  assert.ok(!JSON.stringify(result).includes('never-print'));
  const invalid = await probeRelease(CANONICAL, APPROVED, async () => new Response(JSON.stringify({ ...APPROVED, token: 'never-print' }), { headers: { 'content-type': 'application/json' } }));
  assert.equal(invalid.marker, null);
  assert.equal(invalid.markerError, 'invalid_marker');
  assert.ok(!JSON.stringify(invalid).includes('never-print'));
  const valid = await probeRelease(CANONICAL, APPROVED, async () => new Response(JSON.stringify(APPROVED), { headers: { 'content-type': 'application/json' } }));
  assert.deepEqual(valid.marker, APPROVED);
  assert.equal(valid.matchesExpected, true);
});

test('receipt uses one read GraphQL query and public GET requests, emitting safe notices', async () => {
  const calls = [];
  const notices = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url === 'https://api.expo.dev/graphql') return Response.json({ data: { app: { byFullName: app() } } });
    return Response.json(APPROVED);
  };
  const result = await readReceipt({ token: 'fixture-token-never-print', expected: APPROVED, fetchImpl, emit: (line) => notices.push(line) });
  assert.match(QUERY, /^query /);
  assert.ok(!/mutation/i.test(QUERY));
  assert.equal(calls.filter(({ options }) => options.method === 'POST').length, 1);
  assert.deepEqual(calls.slice(1).map(({ options }) => options.method), ['GET', 'GET']);
  assert.ok(result.probes.every((probe) => probe.matchesExpected));
  assert.equal(notices.length, 3);
  assert.ok(notices.every((line) => line.startsWith('::notice title=Panel receipt ')));
  assert.ok(!notices.join('\n').includes('never-print'));
  assert.ok(!notice('safe', { value: '%\n::error::injection' }).includes('\n'));
});

test('historic deployments cannot exhaust the annotation budget before the strict verdict', async () => {
  const value = app();
  for (let i = 1; i < 10; i++) value.workerDeployments.edges.push({ node: {
    deploymentIdentifier: 'old-' + i, url: `https://kora-panel--old-${i}.expo.app`, aliases: [],
  } });
  const notices = [];
  const result = await readReceipt({ token: 'fixture', expected: APPROVED,
    fetchImpl: async (url) => url === 'https://api.expo.dev/graphql'
      ? Response.json({ data: { app: { byFullName: value } } }) : Response.json(APPROVED),
    emit: (line) => notices.push(line),
  });
  assert.equal(result.metadata.deployments.length, 10);
  assert.equal(result.probes.length, 2);
  assert.equal(notices.length, 3);
});
