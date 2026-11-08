// node --test tools/auth/web-session-boundary.test.mjs
// Portable: run from a repository root, or set MAYAMI_SOURCE_ROOT. No HTTP socket or external fetch.
// Actual TS source + installed Supabase SDK; React/Next are controlled effect/form ports, not a DOM render.
import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(process.env.MAYAMI_SOURCE_ROOT || process.cwd());
const require = createRequire(resolve(root, 'package.json'));
const sdkRequire = createRequire(resolve(root, 'apps/storefront/package.json'));
const ts = require('typescript'), sdk = sdkRequire('@supabase/supabase-js');
const sourceHashes = {}, receipts = [];
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const issuer = 'https://testonly.supabase.co', storageKey = 'sb-testonly-auth-token';
const origin = 'https://mayami.test.invalid', back = '/checkout?plan=three_parts';
const now = Math.floor(Date.now() / 1000);
const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = id => `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: id, exp: now + 3600, iss: issuer + '/auth/v1', role: 'authenticated' })}.synthetic`;
const user = id => ({ id, aud: 'authenticated', role: 'authenticated', email: `actor-${id === A ? 'a' : 'b'}@example.com`, app_metadata: {}, user_metadata: {}, identities: [], created_at: new Date().toISOString() });
const session = id => ({ access_token: token(id), refresh_token: `synthetic-refresh-${id === A ? 'a' : 'b'}`, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user: user(id) });
function source(path) {
  const text = readFileSync(resolve(root, path), 'utf8');
  sourceHashes[path] = createHash('sha256').update(text).digest('hex');
  return text;
}
function compile(text, modules, fileName = 'module.ts') {
  const js = ts.transpileModule(text, { fileName, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  new Function('require', 'exports', 'module', js)(name => {
    assert(name in modules, 'Unlisted source import: ' + name);
    return modules[name];
  }, module.exports, module);
  return module.exports;
}
const apiClient = compile(source('packages/api/src/client.ts'), { '@supabase/supabase-js': sdk });
const authReturn = compile(source('apps/storefront/src/lib/auth-return.ts'), { '@kora/core': {} });
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const googleMarker = url => new URL(url).searchParams.has('google_flow');
function attack(suffix = '') {
  const url = new URL(origin + '/auth/callback' + suffix);
  url.hash = new URLSearchParams({ access_token: token(A), refresh_token: session(A).refresh_token, type: 'recovery' }).toString();
  return url.href;
}
async function setup(href, initial = B, type = 'web') {
  const originals = {}, clients = [], calls = [], values = new Map();
  if (initial) values.set(storageKey, JSON.stringify(session(initial)));
  let location = new URL(href), handler = () => { throw new Error('Unexpected synthetic transport route'); };
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const history = { replaceState: (_state, _unused, next) => { location = new URL(next, location); } };
  const request = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    assert.equal(url.origin, issuer, 'No external origin is permitted');
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ method: init.method || 'GET', path: url.pathname, grant: url.searchParams.get('grant_type') });
    return handler(url, init, body);
  };
  const replace = (name, value) => {
    originals[name] = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
  };
  replace('window', { get location() { return location; }, history, localStorage: storage, addEventListener() {}, removeEventListener() {} });
  replace('document', { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} });
  replace('history', history); replace('BroadcastChannel', undefined); replace('fetch', request);
  const create = options => { const client = apiClient.createKoraClient({ ...options, fetch: request }); clients.push(client); return client; };
  const factory = compile(source(type === 'panel' ? 'apps/admin/src/lib/kora.ts' : 'apps/storefront/src/lib/browser.ts'), {
    '@kora/api': { ...apiClient, createKoraClient: create, createApi: () => ({}), run: work => work },
    './env': { env: { url: issuer, anon: 'synthetic-public-anon', supabaseUrl: issuer, supabaseAnonKey: 'synthetic-public-anon' } },
  });
  const connection = type === 'panel' ? factory.kora() : factory.browser();
  await connection.client.auth.getSession();
  return { ...connection, calls, values, storage, request,
    setHandler(fn) { handler = fn; },
    navigate(next) { location = new URL(next, location); },
    dispose() { clients.forEach(c => c.auth.stopAutoRefresh()); for (const [name, descriptor] of Object.entries(originals)) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; } },
  };
}
async function runCallback(env) {
  const effects = [], routes = [], states = [];
  let calls = 0, setCalls = 0, exchangeCalls = 0;
  const realSet = env.client.auth.setSession.bind(env.client.auth), realExchange = env.client.auth.exchangeCodeForSession.bind(env.client.auth);
  env.client.auth.setSession = (...args) => { setCalls++; return realSet(...args); };
  env.client.auth.exchangeCodeForSession = (...args) => { exchangeCalls++; return realExchange(...args); };
  const component = compile(source('apps/storefront/src/app/auth/callback/page.tsx'), {
    react: { useRef: () => ({ current: null }), useState: initial => { const index = calls++; states[index] = initial; return [initial, next => { states[index] = next; }]; }, useEffect: fn => effects.push(fn) },
    'react/jsx-runtime': jsx, 'next/link': { default: () => null },
    'next/navigation': { useRouter: () => ({ replace: path => routes.push(path) }) },
    '@/lib/browser': { browser: () => env }, '@/lib/auth-return': authReturn,
    '@kora/api': { isGoogleAuthCallback: googleMarker },
  }, 'callback.tsx');
  component.default(); const disposals = effects.map(fn => fn());
  for (let count = 0; count < 100 && states[0] !== true && routes.length === 0; count++) await new Promise(done => setTimeout(done, 2));
  disposals.forEach(fn => fn?.());
  return { failed: states[0] === true, routes, setCalls, exchangeCalls, actor: (await env.client.auth.getSession()).data.session?.user.id ?? null };
}
function verifier(values) { return JSON.parse(values.get(storageKey + '-code-verifier')).split('/')[0]; }
function checkS256(body, expectedVerifier) {
  assert.equal(body.code_challenge_method, 's256');
  assert.equal(body.code_challenge, createHash('sha256').update(expectedVerifier).digest('base64url'));
  assert.notEqual(body.code_challenge, expectedVerifier);
}

for (const [label, url] of [
  ['unrelated access+refresh fragment', attack()],
  ['unrelated access-only fragment', origin + '/auth/callback#access_token=' + token(A)],
  ['fragment plus code and recovery purpose', attack('?code=synthetic-code&tipo=recuperar&volver=' + encodeURIComponent(back))],
]) test(label + ' preserves B without Auth fetch or setSession', async () => {
  const env = await setup(url);
  try {
    const result = await runCallback(env);
    assert.equal(result.failed, true); assert.equal(result.actor, B);
    assert.equal(result.setCalls, 0); assert.equal(result.exchangeCalls, 0); assert.deepEqual(env.calls, []); assert.deepEqual(result.routes, []);
    receipts.push({ case: label, outcome: 'rejected; B preserved', authRequests: 0, setSessionCalls: 0 });
  } finally { env.dispose(); }
});

test('foreign PKCE code with no local verifier fails before token request and preserves B', async () => {
  const env = await setup(origin + '/auth/callback?code=synthetic-foreign-code');
  try {
    const result = await runCallback(env);
    assert.equal(result.failed, true); assert.equal(result.actor, B); assert.equal(result.setCalls, 0);
    assert.equal(result.exchangeCalls, 1); assert.deepEqual(env.calls, []); assert.deepEqual(result.routes, []);
    receipts.push({ case: 'foreign code without verifier', outcome: 'rejected; B preserved', authRequests: 0 });
  } finally { env.dispose(); }
});

for (const purpose of ['signup', 'recovery']) test(purpose + ' emits S256 and its own verifier exchanges into the expected destination', async () => {
  const env = await setup(origin + '/cuenta', null);
  try {
    let started = null, exchanges = 0;
    env.setHandler((url, init, body) => {
      assert.equal(init.method, 'POST');
      if (url.pathname === (purpose === 'signup' ? '/auth/v1/signup' : '/auth/v1/recover')) {
        started = { body, redirect: url.searchParams.get('redirect_to') };
        return Response.json(purpose === 'signup' ? { user: user(A), session: null } : {});
      }
      assert.equal(url.pathname, '/auth/v1/token'); assert.equal(url.searchParams.get('grant_type'), 'pkce');
      assert.equal(body.auth_code, 'synthetic-own-code'); assert.equal(body.code_verifier, started.expectedVerifier);
      exchanges++; return Response.json(session(A));
    });
    const redirect = origin + authReturn.callbackPath(back, purpose === 'recovery');
    const start = purpose === 'signup'
      ? await env.client.auth.signUp({ email: 'actor-a@example.com', password: 'synthetic-password-only', options: { emailRedirectTo: redirect } })
      : await env.client.auth.resetPasswordForEmail('actor-a@example.com', { redirectTo: redirect });
    assert.equal(start.error, null); assert(started); started.expectedVerifier = verifier(env.values); checkS256(started.body, started.expectedVerifier);
    const callback = new URL(started.redirect); callback.searchParams.set('code', 'synthetic-own-code');
    env.navigate(callback.href); const result = await runCallback(env);
    assert.equal(result.failed, false); assert.equal(result.actor, A); assert.equal(result.setCalls, 0); assert.equal(exchanges, 1);
    assert.deepEqual(result.routes, [purpose === 'recovery' ? '/recuperar?cambiar=1&volver=' + encodeURIComponent(back) : back]);
    receipts.push({ case: purpose + ' own PKCE', outcome: 'S256 verifier validated by synthetic Auth transport; correct destination', tokenRequests: 1 });
  } finally { env.dispose(); }
});

for (const purpose of ['signup', 'recovery']) test('existing VerifyCode form still submits six digits with ' + purpose + ' purpose', async () => {
  const env = await setup(origin + '/cuenta', null);
  try {
    let done = 0, verification = 0, stateIndex = 0, refIndex = 0, pending;
    const states = [], refs = [], effects = [], disposals = [];
    env.setHandler((url, init, body) => {
      assert.equal(url.pathname, '/auth/v1/verify'); assert.equal(init.method, 'POST');
      assert.equal(body.email, 'actor-a@example.com'); assert.equal(body.token, '123456'); assert.equal(body.type, purpose);
      verification++; return Response.json(session(A));
    });
    const component = compile(source('apps/storefront/src/components/verify-code.tsx'), {
      react: {
        useState: initial => { const index = stateIndex++; if (!(index in states)) states[index] = initial; return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }]; },
        useRef: initial => refs[refIndex++] ?? (refs[refIndex - 1] = { current: initial }),
        useEffect: fn => effects.push(fn),
      }, 'react/jsx-runtime': jsx, '@/lib/browser': { browser: () => env },
      '@tanstack/react-query': { useMutation: options => ({ isPending: false, mutate: input => { pending = Promise.resolve(options.mutationFn(input)).then(result => options.onSuccess?.(result, input)); } }) },
    }, 'verify-code.tsx');
    const props = { email: 'actor-a@example.com', type: purpose, onDone: () => { done++; }, resend: async () => {} };
    let tree = component.VerifyCode(props); effects.splice(0).forEach(fn => disposals.push(fn()));
    const find = (node, type) => { if (!node || typeof node !== 'object') return null; if (node.type === type) return node; return [node.props?.children].flat(Infinity).map(child => find(child, type)).find(Boolean); };
    find(tree, 'input').props.onChange({ target: { value: '123456' } });
    stateIndex = 0; refIndex = 0; tree = component.VerifyCode(props);
    tree.props.onSubmit({ preventDefault() {} }); await pending;
    assert.equal(done, 1); assert.equal(verification, 1); assert.equal((await env.client.auth.getSession()).data.session?.user.id, A);
    disposals.forEach(fn => fn?.());
    receipts.push({ case: purpose + ' six digit form', outcome: 'actual form mutation and SDK verifyOtp accepted explicit purpose', verifyRequests: 1 });
  } finally { env.dispose(); }
});

test('panel ignores unrelated hash and its existing password SDK path remains usable', async () => {
  const env = await setup(attack().replace('/auth/callback', '/login'), B, 'panel');
  try {
    assert.equal((await env.client.auth.getSession()).data.session?.user.id, B); assert.deepEqual(env.calls, []);
    env.setHandler((url, init, body) => {
      assert.equal(url.pathname, '/auth/v1/token'); assert.equal(url.searchParams.get('grant_type'), 'password'); assert.equal(init.method, 'POST');
      assert.equal(body.email, 'actor-a@example.com'); assert.equal(body.password, 'synthetic-password-only'); return Response.json(session(A));
    });
    const result = await env.client.auth.signInWithPassword({ email: 'actor-a@example.com', password: 'synthetic-password-only' });
    assert.equal(result.error, null); assert.equal((await env.client.auth.getSession()).data.session?.user.id, A);
    receipts.push({ case: 'panel hash rejection and explicit password', outcome: 'B preserved before explicit password; password route accepted', passwordRequests: 1 });
  } finally { env.dispose(); }
});

after(() => {
  if (process.env.MAYAMI_AUTH_RECEIPT) writeFileSync(resolve(process.env.MAYAMI_AUTH_RECEIPT), JSON.stringify({ recordedAt: new Date().toISOString(), sdkVersion: sdkRequire('@supabase/supabase-js/package.json').version, scope: 'Real source/SDK with controlled React effect/form ports and synthetic in-memory Auth transport. No browser, GoTrue or external network; not hosted email verification.', sourceSha256: sourceHashes, receipts }, null, 2) + '\n');
});
