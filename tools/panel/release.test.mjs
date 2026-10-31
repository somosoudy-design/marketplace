import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { inspectRequest, parseRequest, validateRequest, REQUEST_PATH } from './release-request.mjs';
import { parseMarker, sameMarker, writeMarker } from './release-marker.mjs';
import { verifyDeployment, headerFailures, cspForbidsFrames, MISSING_PATH, PAGES } from './check-deploy.mjs';

const SOURCE = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);
const EXPECTED = { schemaVersion: 1, sourceSha: SOURCE, buildVersion: '40000000000.1' };
const IMMUTABLE = 'https://kora-panel--approved.expo.app';
const PRODUCTION = 'https://kora-panel.expo.app';
const SECURITY = {
  'x-frame-options': 'DENY',
  'content-security-policy': "frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-robots-tag': 'noindex, nofollow',
};
const HTML = '<!doctype html><html><script src="/_next/static/chunks/generic.js"></script></html>';
const request = (overrides = {}) => ({ text: '# Release\nsource: ' + SOURCE + '\nmessage: Panel revisado\n', headSha: HEAD, parents: [SOURCE], changedPaths: [REQUEST_PATH], ...overrides });

test('request parser accepts one complete SHA with comments and a message', () => {
  assert.deepEqual(parseRequest(request().text), { sourceSha: SOURCE, message: 'Panel revisado' });
  assert.equal(parseRequest('source: ' + SOURCE).sourceSha, SOURCE);
});

test('request parser refuses missing, shortened, duplicated and injected source fields', () => {
  for (const text of [
    '# Sin fuente', 'source: aaaaaaa', 'source: ' + SOURCE + '\nsource: ' + SOURCE,
    'source: ' + SOURCE + '; deploy', 'source: ' + SOURCE + '\nrun: anything',
    'source: ' + SOURCE + '\nmessage: one\nmessage: two',
  ]) assert.throws(() => parseRequest(text));
});

test('request guard only accepts the immediate approved parent and a request-only commit', () => {
  assert.equal(validateRequest(request()).sourceSha, SOURCE);
  assert.throws(() => validateRequest(request({ parents: [HEAD] })), /HEAD\^/);
  assert.throws(() => validateRequest(request({ parents: [] })), /único padre/);
  assert.throws(() => validateRequest(request({ parents: [SOURCE, HEAD] })), /único padre/);
  for (const path of ['apps/admin/src/app/page.tsx', 'packages/core/src/index.ts', '.github/workflows/panel-deploy.yml', 'tools/panel/release-request.mjs', 'pnpm-lock.yaml', 'docs/ESTADO_ACTUAL.md']) {
    assert.throws(() => validateRequest(request({ changedPaths: [REQUEST_PATH, path] })), /sólo puede cambiar/);
  }
  assert.throws(() => validateRequest(request({ changedPaths: [] })), /sólo puede cambiar/);
});

test('real Git guard accepts a depth-two checkout and refuses code in a request commit', () => {
  const root = mkdtempSync(join(tmpdir(), 'kora-panel-release-'));
  const repo = join(root, 'source');
  mkdirSync(join(repo, '.github'), { recursive: true });
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = (message) => {
    git('add', '.');
    git('-c', 'user.name=Panel Release Test', '-c', 'user.email=release-test@example.com', 'commit', '--quiet', '-m', message);
  };
  try {
    git('init', '--quiet');
    writeFileSync(join(repo, 'build-input.txt'), 'approved');
    commit('approved source');
    const approved = git('rev-parse', 'HEAD');
    writeFileSync(join(repo, REQUEST_PATH), 'source: ' + approved + '\n');
    commit('release request only');
    const shallow = join(root, 'checkout');
    execFileSync('git', ['clone', '--quiet', '--depth', '2', '--no-local', repo, shallow], { stdio: 'pipe' });
    assert.equal(inspectRequest(shallow).sourceSha, approved);
    const parent = git('rev-parse', 'HEAD');
    writeFileSync(join(repo, REQUEST_PATH), 'source: ' + parent + '\n');
    writeFileSync(join(repo, 'build-input.txt'), 'unreviewed');
    commit('unsafe request plus code');
    assert.throws(() => inspectRequest(repo), /sólo puede cambiar/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('marker rejects missing, extra, unsafe or unsupported fields', () => {
  assert.deepEqual(parseMarker(JSON.stringify(EXPECTED)), EXPECTED);
  for (const marker of [
    null, [], { ...EXPECTED, schemaVersion: 2 }, { ...EXPECTED, sourceSha: 'short' },
    { ...EXPECTED, buildVersion: 'line\nbreak' }, { ...EXPECTED, buildVersion: null },
    { ...EXPECTED, extra: true }, { sourceSha: SOURCE, buildVersion: '1' },
  ]) assert.throws(() => parseMarker(marker));
  assert.equal(sameMarker(EXPECTED, EXPECTED), true);
  assert.equal(sameMarker({ ...EXPECTED, sourceSha: HEAD }, EXPECTED), false);
  assert.equal(sameMarker({ ...EXPECTED, buildVersion: 'old' }, EXPECTED), false);
});

test('marker writer checks the built checkout SHA before writing the exact expected marker', () => {
  const out = mkdtempSync(join(tmpdir(), 'kora-panel-marker-'));
  try {
    assert.throws(() => writeMarker(out, SOURCE, EXPECTED.buildVersion, HEAD), /checkout compilado/);
    assert.deepEqual(writeMarker(out, SOURCE, EXPECTED.buildVersion, SOURCE), EXPECTED);
    assert.deepEqual(JSON.parse(readFileSync(join(out, 'release.json'), 'utf8')), EXPECTED);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('CSP and the other three security headers remain independently required', () => {
  assert.deepEqual(headerFailures(new Headers(SECURITY)), []);
  for (const header of Object.keys(SECURITY).filter((name) => name !== 'x-frame-options')) {
    const headers = new Headers(SECURITY);
    headers.delete(header);
    assert.deepEqual(headerFailures(headers), [header]);
  }
  assert.deepEqual(headerFailures(new Headers({ ...SECURITY, 'content-security-policy': "default-src 'self'; frame-ancestors 'none';", 'x-robots-tag': 'nofollow, noindex' })), []);
});


test('EAS may remove XFO only while effective enforcing CSP forbids every frame', () => {
  const headers = new Headers(SECURITY);
  headers.delete('x-frame-options');
  assert.deepEqual(headerFailures(headers), []);
  headers.delete('content-security-policy');
  assert.deepEqual(headerFailures(headers), ['x-frame-options', 'content-security-policy']);
  headers.set('content-security-policy-report-only', "frame-ancestors 'none'");
  assert.deepEqual(headerFailures(headers), ['x-frame-options', 'content-security-policy']);
  for (const value of ['', 'SAMEORIGIN', 'DENY, SAMEORIGIN', 'DENY, DENY', 'ALLOW-FROM https://example.com']) {
    const conflicting = new Headers({ ...SECURITY, 'x-frame-options': value });
    assert.deepEqual(headerFailures(conflicting), ['x-frame-options']);
  }
});

test('CSP evaluates the first frame-ancestors directive of each conjunctive policy', () => {
  for (const value of [
    "frame-ancestors 'self'; frame-ancestors 'none'",
    "default-src 'none'", "frame-ancestors 'none' https://example.com",
    "frame-ancestors 'self', frame-ancestors https://example.com",
  ]) {
    assert.equal(cspForbidsFrames(value), false);
    assert.ok(headerFailures(new Headers({ ...SECURITY, 'content-security-policy': value })).includes('content-security-policy'));
  }
  for (const value of [
    "frame-ancestors 'none'", "default-src 'self'; frame-ancestors 'none';",
    "frame-ancestors 'none'; frame-ancestors 'self'",
    "frame-ancestors 'self', frame-ancestors 'none'",
    "frame-ancestors 'self'; frame-ancestors 'none', frame-ancestors 'none'",
  ]) assert.equal(cspForbidsFrames(value), true);
});

function fakeHosting(options = {}) {
  const calls = [];
  let aliases = 0;
  const fetchImpl = async (input, init) => {
    const url = new URL(input);
    calls.push({ url: input, init });
    assert.equal(init.redirect, 'manual');
    assert.equal(init.cache, 'no-store');
    if (url.pathname === '/release.json') {
      const isAlias = url.origin === PRODUCTION;
      aliases += Number(isAlias);
      const marker = isAlias
        ? (aliases <= (options.staleAttempts ?? 0) ? { ...EXPECTED, buildVersion: 'old' } : options.aliasMarker ?? EXPECTED)
        : options.deploymentMarker ?? EXPECTED;
      return new Response(JSON.stringify(marker), { status: options.markerStatus ?? 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.pathname === MISSING_PATH) return new Response('Missing', { status: options.missingStatus ?? 404, headers: { 'content-type': 'text/html' } });
    if (url.pathname.startsWith('/_next/static/')) return new Response('console.log("loaded")', { status: options.jsStatus ?? 200, headers: { 'content-type': options.jsType ?? 'application/javascript' } });
    return new Response(HTML, { status: options.pageStatus ?? 200, headers: { 'content-type': 'text/html; charset=utf-8', ...(options.security ?? SECURITY) } });
  };
  return { fetchImpl, calls };
}

async function verify(options = {}, overrides = {}) {
  const hosting = fakeHosting(options);
  const pauses = [];
  const result = await verifyDeployment({
    deployment: IMMUTABLE, production: PRODUCTION, expected: EXPECTED,
    fetchImpl: hosting.fetchImpl, pause: async (ms) => pauses.push(ms), aliasAttempts: 3, intervalMs: 1,
    ...overrides,
  });
  return { result, calls: hosting.calls, pauses };
}

test('matching marker passes both origins, all pages, 404s, headers and JavaScript', async () => {
  const { result, calls } = await verify();
  assert.equal(result.rows.length, 2 * (PAGES.length + 2));
  assert.ok(result.rows.every((row) => row.ok));
  assert.equal(calls.filter((call) => new URL(call.url).pathname === '/release.json').length, 2);
});


test('converted EAS headers pass with exact public values retained on both origins', async () => {
  const security = { ...SECURITY };
  delete security['x-frame-options'];
  const { result } = await verify({ security });
  assert.equal(result.rows.length, 22);
  assert.deepEqual(result.security.map((item) => item.base), [IMMUTABLE, PRODUCTION]);
  for (const item of result.security) {
    assert.equal(item.path, '/login');
    assert.equal(item.headers['x-frame-options'], null);
    assert.equal(item.headers['content-security-policy'], "frame-ancestors 'none'");
    assert.deepEqual(Object.keys(item.headers).sort(), Object.keys(SECURITY).sort());
  }
  security['content-security-policy'] = "frame-ancestors 'self'; frame-ancestors 'none'";
  await assert.rejects(verify({ security }), (error) => {
    assert.ok(error.failures.every((failure) => /x-frame-options|content-security-policy/.test(failure)));
    assert.equal(error.security.length, 2);
    assert.equal(error.security[0].headers['content-security-policy'], security['content-security-policy']);
    return true;
  });
});

test('a stale alias can catch up within the bounded wait', async () => {
  const { pauses } = await verify({ staleAttempts: 1 });
  assert.deepEqual(pauses, [1]);
});

test('an old alias fails even if every page and generic first chunk is unchanged', async () => {
  await assert.rejects(verify({ aliasMarker: { ...EXPECTED, buildVersion: 'old' } }), /alias de producción/);
});

test('wrong immutable SHA fails before accepting an alias', async () => {
  const hosting = fakeHosting({ deploymentMarker: { ...EXPECTED, sourceSha: HEAD } });
  await assert.rejects(verify({}, { fetchImpl: hosting.fetchImpl }), /deployment inmutable/);
  assert.equal(hosting.calls.length, 1);
});

test('marker redirects and unsupported schemas cannot prove receipt', async () => {
  await assert.rejects(verify({ markerStatus: 302 }), /JSON HTTP200/);
  await assert.rejects(verify({ aliasMarker: { ...EXPECTED, schemaVersion: 2 } }), /alias de producción/);
});

test('an unexpected 404 result makes verification fail', async () => {
  await assert.rejects(verify({ missingStatus: 200 }), /se esperaba HTTP404/);
});

test('missing security headers make verification fail', async () => {
  const security = { ...SECURITY };
  delete security['x-content-type-options'];
  await assert.rejects(verify({ security }), /x-content-type-options/);
});

test('bad HTML or missing JavaScript makes verification fail', async () => {
  await assert.rejects(verify({ pageStatus: 503 }), /HTML HTTP200/);
  await assert.rejects(verify({ jsStatus: 404 }), /JavaScript/);
  await assert.rejects(verify({ jsType: 'text/html' }), /JavaScript/);
});

test('alias and deployment must be distinct HTTPS roots', async () => {
  await assert.rejects(verify({}, { production: IMMUTABLE }), /deben ser distintos/);
  await assert.rejects(verify({}, { production: 'http://kora-panel.expo.app' }), /HTTPS/);
  await assert.rejects(verify({}, { deployment: 'https://user:secret@example.com' }), /HTTPS/);
});
