/**
 * Integration: installed SDK + candidate runtime + actual loopback HTTP.
 * No Google/GoTrue provider, credentials, remote requests, native UI or AuthProvider fixture.
 * Run only with the accompanying config pointing at the isolated candidate source.
 */
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage } from 'node:http';
import { once } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGoogleAuthRuntime } from '../src/google-auth-runtime';
import { createApi } from '../src/api';

const AUTH = 'https://testonly.supabase.co';
const CALLBACK = 'https://mayami.test.invalid/auth/callback';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const PRODUCT = '33333333-3333-4333-8333-333333333333';
const VARIANT = '44444444-4444-4444-8444-444444444444';
type Actor = typeof A | typeof B;
type Trace = { method: string; path: string; actor: Actor | null; status: number };
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const cleanup: (() => Promise<void>)[] = [];
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
async function bodyOf(request: IncomingMessage) {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.from(chunk); size += bytes.length;
    assert(size <= 32_768, 'Fixture request exceeds body limit'); chunks.push(bytes);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown> : {};
}

async function fixture(enabled = true, synchronous = true) {
  const now = Math.floor(Date.now() / 1000);
  const user = (id: Actor) => ({ id, aud: 'authenticated', role: 'authenticated',
    email: id === A ? 'google-a@example.com' : 'password-b@example.com',
    app_metadata: { provider: id === A ? 'google' : 'email', providers: [id === A ? 'google' : 'email'] },
    user_metadata: {}, identities: [{ provider: id === A ? 'google' : 'email', user_id: id }],
    created_at: new Date(now * 1000).toISOString() });
  const token = (id: Actor) => `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id,
    iss: AUTH + '/auth/v1', aud: 'authenticated', role: 'authenticated', exp: now + 3600, iat: now })}.fixture-signature`;
  const session = (id: Actor) => ({ access_token: token(id), refresh_token: 'fixture-refresh-' + (id === A ? 'a' : 'b'),
    token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user: user(id),
    provider_token: 'fixture-provider-access-must-not-persist',
    provider_refresh_token: 'fixture-provider-refresh-must-not-persist' });
  const actorOf = (header: string | undefined): Actor | null => header === `Bearer ${token(A)}` ? A : header === `Bearer ${token(B)}` ? B : null;
  const trace: Trace[] = [], violations: string[] = [];
  const codes = new Map<string, { verifier: string; consumed: boolean }>();
  const barriers = new Map<string, { entered: ReturnType<typeof deferred<void>>; release: ReturnType<typeof deferred<void>> }>();
  const transportFetch = globalThis.fetch.bind(globalThis);
  let socketRequests = 0;
  const server = createServer(async (request, response) => {
    socketRequests++;
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const method = request.method ?? 'GET';
    const actor = actorOf(request.headers.authorization);
    const reply = (status: number, data: unknown) => {
      trace.push({ method, path: url.pathname, actor, status });
      response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify(data));
    };
    try {
      const key = method + ' ' + url.pathname + (actor === A ? ':A' : actor === B ? ':B' : '');
      const barrier = barriers.get(key);
      if (barrier) { barrier.entered.resolve(); await barrier.release.promise; }
      const data = await bodyOf(request);
      if (method === 'POST' && url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'pkce') {
        const code = codes.get(String(data.auth_code));
        if (!code || code.consumed || code.verifier !== data.code_verifier) { reply(400, { error: 'invalid_grant', error_description: 'Fixture code rejected' }); return; }
        code.consumed = true; reply(200, session(A)); return;
      }
      if (method === 'POST' && url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
        if (data.email !== 'password-b@example.com' || data.password !== 'local-fixture-only') { reply(400, { error: 'invalid_grant' }); return; }
        reply(200, session(B)); return;
      }
      if (method === 'GET' && url.pathname === '/auth/v1/user' && !url.search) {
        reply(actor ? 200 : 401, actor ? user(actor) : { message: 'Fixture token rejected' }); return;
      }
      if (method === 'POST' && ['/rest/v1/rpc/cart_merge_intent', '/rest/v1/rpc/favorites_merge_intent'].includes(url.pathname) && !url.search) {
        if (!actor) { reply(401, { code: '42501', message: 'Fixture actor required' }); return; }
        assert.match(String(data.p_idempotency_key), /^[a-f0-9-]{36}$/i);
        if (url.pathname.endsWith('/cart_merge_intent')) assert.deepEqual(data.p_lines, [{ variant_id: VARIANT, quantity: 1 }]);
        else assert.deepEqual(data.p_product_ids, [PRODUCT]);
        reply(200, { replayed: false, applied: true, merged_lines: 1, merged_products: 1 }); return;
      }
      violations.push(method + ' ' + url.pathname); reply(403, { message: 'Fixture route forbidden' });
    } catch {
      violations.push('fixture_handler_rejected'); reply(500, { message: 'Fixture protocol failed' });
    }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  cleanup.push(async () => {
    for (const barrier of barriers.values()) barrier.release.resolve();
    server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  // Only this explicit bridge uses the real socket. Nothing delegates to the virtual remote origin.
  const request: typeof fetch = async (input, init) => {
    const incoming = new Request(input, init), url = new URL(incoming.url);
    assert.equal(url.origin, AUTH, 'Only the synthetic Auth origin is allowed');
    assert(!url.username && !url.password && !url.hash, 'Credential/fragment URL forbidden');
    assert(/^\/auth\/v1\/(token|user)$/.test(url.pathname) || /^\/rest\/v1\/rpc\/(cart_merge_intent|favorites_merge_intent)$/.test(url.pathname), 'Unlisted fixture path');
    const local = new URL(url.pathname + url.search, origin);
    return transportFetch(local, { method: incoming.method, headers: incoming.headers,
      body: ['GET', 'HEAD'].includes(incoming.method) ? undefined : await incoming.text(),
      redirect: 'error', signal: AbortSignal.timeout(15_000) });
  };
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  let attempt: unknown = null;
  const runtime = createGoogleAuthRuntime({ enabled, url: AUTH, anonKey: 'fixture-public-anon', storage,
    storageKey: 'fixture-runtime-' + randomUUID(), synchronous,
    attemptStore: { read: () => attempt, write: value => { attempt = structuredClone(value); }, clear: () => { attempt = null; } },
    crypto: { randomBytes: async () => randomBytes(32), sha256Base64: async value => createHash('sha256').update(value).digest('base64') },
    callbackBase: CALLBACK, safeReturn: value => value === '/checkout?plan=three_parts' ? value : '/cuenta',
    newIntentId: () => randomUUID(), withLock: async work => work(), fetch: request });
  const sdkEvents: { event: string; actor: string | null }[] = [];
  const initial = deferred<void>();
  const { data: listener } = runtime.client.auth.onAuthStateChange((event, value) => {
    sdkEvents.push({ event, actor: value?.user.id ?? null }); if (event === 'INITIAL_SESSION') initial.resolve();
  });
  cleanup.push(async () => {
    runtime.google.cancel(); listener.subscription.unsubscribe(); runtime.client.auth.stopAutoRefresh();
  });
  await runtime.client.auth.getSession(); await initial.promise;
  const code = async (purpose: 'login' | 'register' = 'login') => {
    const result = await runtime.google.begin(purpose, '/checkout?plan=three_parts');
    const saved = attempt as { verifier: string; id: string };
    const auth = new URL(result.url), callback = new URL(result.callback);
    expect(auth.origin).toBe(AUTH); expect(auth.pathname).toBe('/auth/v1/authorize');
    expect(auth.searchParams.get('provider')).toBe('google');
    expect(auth.searchParams.get('code_challenge_method')).toBe('s256');
    expect(auth.searchParams.get('code_challenge')).toBe(createHash('sha256').update(saved.verifier).digest('base64url'));
    expect(auth.searchParams.get('scopes')).toBe('openid email profile');
    const value = 'fixture-code-' + randomUUID(); codes.set(value, { verifier: saved.verifier, consumed: false });
    callback.searchParams.set('code', value); return callback.toString();
  };
  const hold = (key: string) => {
    const barrier = { entered: deferred<void>(), release: deferred<void>() }; barriers.set(key, barrier); return barrier;
  };
  return { runtime, request, trace, violations, values, sdkEvents, code, hold, socketRequests: () => socketRequests,
    tokenCalls: () => trace.filter(t => t.method === 'POST' && t.path === '/auth/v1/token').length,
    mergeCalls: () => trace.filter(t => t.path.startsWith('/rest/v1/rpc/')),
    signInB: () => runtime.primary(async () => {
      const result = await runtime.client.auth.signInWithPassword({ email: 'password-b@example.com', password: 'local-fixture-only' });
      expect(result.error).toBeNull(); expect(result.data.user?.id).toBe(B);
    }) };
}

afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });
describe('candidate Google runtime + installed SDK + real loopback HTTP; no provider', () => {
  it('closed gate makes no HTTP request or session visible', async () => {
    const f = await fixture(false);
    expect(f.runtime.enabled).toBe(false);
    await expect(f.runtime.google.begin('login', '/cuenta')).rejects.toThrow();
    expect((await f.runtime.google.complete(CALLBACK + '?google_flow=absent&code=absent')).status).not.toBe('accepted');
    expect((await f.runtime.client.auth.getSession()).data.session).toBeNull();
    expect(f.socketRequests()).toBe(0); expect(f.mergeCalls()).toHaveLength(0); expect(f.violations).toEqual([]);
  });
  it('admitted register is SDK-visible and cloned callbacks share one exchange without replay', async () => {
    const f = await fixture(); const raw = await f.code('register'); let receipts = 0;
    const unsubscribe = f.runtime.subscribe(() => { receipts++; });
    const [one, two] = await Promise.all([f.runtime.google.complete(raw), f.runtime.google.complete(String(raw))]);
    expect(one).toMatchObject({ status: 'accepted', actorId: A, purpose: 'register', returnTo: '/checkout?plan=three_parts' });
    expect(two).toEqual(one);
    expect((await f.runtime.client.auth.getSession()).data.session?.user.id).toBe(A);
    expect(await f.runtime.currentActor(A)).toBe(true); expect(await f.runtime.currentActor(B)).toBe(false);
    expect((await f.runtime.client.auth.getUser()).data.user?.id).toBe(A);
    expect(f.tokenCalls()).toBe(1); expect(receipts).toBe(1);
    expect((await f.runtime.google.complete(raw)).status).not.toBe('accepted');
    expect(f.tokenCalls()).toBe(1); expect(receipts).toBe(1);
    expect([...f.values.values()].some(value => value.includes('fixture-provider-'))).toBe(false);
    expect(f.socketRequests()).toBeGreaterThanOrEqual(3); expect(f.violations).toEqual([]); unsubscribe();
  });
  it('native durable admission stays accepted after a late cancellation but cannot navigate the old intent', async () => {
    const f = await fixture(true, false); const raw = await f.code();
    const stop = f.runtime.subscribe(() => f.runtime.google.cancel());
    const result = await f.runtime.google.complete(raw);
    expect(result).toMatchObject({ status: 'accepted', actorId: A });
    expect((await f.runtime.client.auth.getSession()).data.session?.user.id).toBe(A);
    expect(await f.runtime.claimNavigation(result)).toBe(false);
    expect(f.tokenCalls()).toBe(1); stop();
  });
  it('cancelling during token HTTP cannot expose A or admit guest work after response release', async () => {
    const f = await fixture(); const raw = await f.code(); let receipts = 0;
    const unsubscribe = f.runtime.subscribe(() => { receipts++; });
    const gate = f.hold('POST /auth/v1/token'); const result = f.runtime.google.complete(raw);
    await gate.entered.promise; f.runtime.google.cancel(); gate.release.resolve();
    expect((await result).status).toBe('cancelled');
    expect((await f.runtime.client.auth.getSession()).data.session).toBeNull();
    expect(receipts).toBe(0); expect(f.mergeCalls()).toHaveLength(0);
    expect(f.sdkEvents.some(value => value.event === 'SIGNED_IN' && value.actor === A)).toBe(false);
    expect(f.trace.some(value => value.path === '/auth/v1/user')).toBe(false);
    expect(f.violations).toEqual([]); unsubscribe();
  });
  it('B through primary plus real SDK password login survives A delayed user verification', async () => {
    const f = await fixture(); const raw = await f.code();
    const gate = f.hold('GET /auth/v1/user:A'); const result = f.runtime.google.complete(raw);
    await gate.entered.promise; await f.signInB();
    expect((await f.runtime.client.auth.getSession()).data.session?.user.id).toBe(B);
    gate.release.resolve(); expect((await result).status).toBe('cancelled');
    expect((await f.runtime.client.auth.getSession()).data.session?.user.id).toBe(B);
    expect(await f.runtime.currentActor(A)).toBe(false); expect(await f.runtime.currentActor(B)).toBe(true);
    expect(f.sdkEvents.some(value => value.event === 'SIGNED_IN' && value.actor === A)).toBe(false);
    expect(f.mergeCalls()).toHaveLength(0); expect(f.violations).toEqual([]);
  });
  it('consumer of real runtime subscription sends actor-bound guest RPCs only after admission', async () => {
    const f = await fixture(); const api = createApi(f.runtime.client); const runs: Promise<void>[] = [];
    let admitted = false; let scheduleCount = 0;
    const unsubscribe = f.runtime.subscribe(() => {
      // Same event shape a Provider consumes; the actual React Provider is covered by root's UI runner.
      const work = new Promise<void>((resolve, reject) => setTimeout(() => {
        void (async () => {
          if (!await f.runtime.currentActor(A) || admitted) return;
          admitted = true; scheduleCount++;
          await api.cart.mergeWithIntent([{ variant_id: VARIANT, quantity: 1 }], randomUUID());
          if (!await f.runtime.currentActor(A)) throw Error('Fixture actor changed');
          await api.account.mergeFavoritesWithIntent([PRODUCT], randomUUID());
        })().then(resolve, reject);
      }, 0)); runs.push(work);
    });
    const raw = await f.code(); expect(f.mergeCalls()).toHaveLength(0);
    const gate = f.hold('GET /auth/v1/user:A'); const result = f.runtime.google.complete(raw);
    await gate.entered.promise; expect(f.mergeCalls()).toHaveLength(0); expect(scheduleCount).toBe(0);
    gate.release.resolve(); expect((await result).status).toBe('accepted');
    await vi.waitFor(() => expect(runs.length).toBeGreaterThan(0)); await Promise.all(runs);
    expect(scheduleCount).toBe(1); expect(f.mergeCalls().map(value => ({ path: value.path, actor: value.actor }))).toEqual([
      { path: '/rest/v1/rpc/cart_merge_intent', actor: A }, { path: '/rest/v1/rpc/favorites_merge_intent', actor: A },
    ]);
    expect((await f.runtime.google.complete(raw)).status).not.toBe('accepted');
    expect(f.mergeCalls()).toHaveLength(2); expect(f.violations).toEqual([]); unsubscribe();
  });
});
