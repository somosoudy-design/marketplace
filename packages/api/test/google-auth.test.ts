import { createHash, randomBytes } from 'node:crypto';
import type { User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createGoogleAuth, googleRecoveryMessage, createGoogleUserVerifier, isGoogleAuthCallback, readGoogleAttempt, type GoogleAttempt, type GoogleAuthOptions } from '../src/google-auth';

const now = 1_800_000_000_000;
const user = { id: 'buyer-a', identities: [{ provider: 'google' }] } as User;
const jwt = (id = user.id, exp = now / 1000 + 3600, iss = 'https://testonly.supabase.co/auth/v1') =>
  `header.${Buffer.from(JSON.stringify({ sub: id, exp, iss })).toString('base64url')}.signature`;
const token = () => ({ access_token: jwt(), refresh_token: 'supabase-refresh', token_type: 'bearer',
  expires_in: 3600, expires_at: now / 1000 + 3600, user,
  provider_token: 'never-persist-google-access', provider_refresh_token: 'never-persist-google-refresh' });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve };
}
function fixture(patch: Partial<GoogleAuthOptions> = {}) {
  let saved: GoogleAttempt | null = null, stamp = 0, session: string | null = null;
  const request = vi.fn(async () => Response.json(token()));
  const verify = vi.fn(async () => user);
  const options: GoogleAuthOptions = {
    enabled: true, supabaseUrl: 'https://testonly.supabase.co', anonKey: 'test-public-key',
    callbackBase: 'https://mayami.app/auth/callback', now: () => now,
    safeReturn: input => input === '/checkout' ? input : '/cuenta',
    crypto: { randomBytes: async () => randomBytes(32), sha256Base64: async s => createHash('sha256').update(s).digest('base64') },
    store: { read: () => saved, write: a => { saved = structuredClone(a); }, clear: () => { saved = null; } },
    boundary: {
      invalidate: () => { stamp++; }, isCurrent: ticket => ticket.stamp === String(stamp),
      capture: async () => ({ stamp: String(stamp), baseline: session }),
      commit: async (ticket, value, current) => {
        if (!current() || ticket.stamp !== String(stamp) || session !== ticket.baseline) return false;
        session = value; return true;
      },
    },
    verifyUser: verify, fetch: request, ...patch,
  };
  return { flow: createGoogleAuth(options), options, request, verify,
    saved: () => saved, session: () => session, installB: () => { stamp++; session = 'session-b'; } };
}
async function start(f: ReturnType<typeof fixture>, purpose: 'login' | 'register' = 'login') {
  const result = await f.flow.begin(purpose, '/checkout');
  const callback = new URL(result.callback); callback.searchParams.set('code', 'one-use-code');
  return { ...result, raw: callback.toString() };
}

describe('Google preparation: mocked protocol, no provider or real sessions', () => {
  it.each(['register', 'login'] as const)('accepts %s and returns to checkout only after verified session promotion', async purpose => {
    const f = fixture(); const { raw, url } = await start(f, purpose);
    const authorize = new URL(url), attempt = f.saved()!;
    expect(authorize.pathname).toBe('/auth/v1/authorize');
    expect(authorize.searchParams.get('provider')).toBe('google');
    expect(authorize.searchParams.get('code_challenge_method')).toBe('s256');
    expect(authorize.searchParams.get('code_challenge')).toBe(createHash('sha256').update(attempt.verifier).digest('base64url'));
    expect(url).not.toContain(attempt.verifier); expect(url).not.toContain('offline');
    expect([...authorize.searchParams.keys()].sort()).toEqual(['code_challenge', 'code_challenge_method', 'provider', 'redirect_to', 'scopes']);
    expect(authorize.searchParams.get('scopes')).toBe('openid email profile');
    expect(await f.flow.complete(raw)).toEqual({ status: 'accepted', returnTo: '/checkout', purpose, actorId: user.id, attemptId: attempt.id, intentStamp: attempt.ticket.stamp });
    expect(f.request).toHaveBeenCalledTimes(1); expect(f.verify).toHaveBeenCalledWith(jwt(), expect.any(AbortSignal));
    expect(JSON.parse(f.session()!)).not.toHaveProperty('provider_token');
    expect(f.session()).not.toContain('never-persist'); expect(f.saved()).toBeNull();
    expect(await f.flow.complete(raw)).toEqual({ status: 'invalid' });
  });
  it('closed gate neither stores material nor starts transport', async () => {
    const f = fixture({ enabled: false });
    await expect(f.flow.begin('login', '/checkout')).rejects.toThrow('not activated');
    expect(await f.flow.complete('https://mayami.app/auth/callback?code=x')).toEqual({ status: 'unavailable' });
    expect(f.saved()).toBeNull(); expect(f.request).not.toHaveBeenCalled();
  });
  it('requires secure random and S256; has no plain/Math.random fallback', async () => {
    const f = fixture({ crypto: { randomBytes: async () => new Uint8Array(0), sha256Base64: async () => '' } });
    await expect(start(f)).rejects.toThrow('randomness'); expect(f.saved()).toBeNull();
  });
  it('does not return an obsolete authorize URL if B signs in during secure-random generation', async () => {
    const hold = deferred<Uint8Array>();
    const f = fixture({ crypto: { randomBytes: () => hold.promise, sha256Base64: async s => createHash('sha256').update(s).digest('base64') } });
    const result = start(f); await Promise.resolve(); f.installB(); hold.resolve(randomBytes(32));
    await expect(result).rejects.toThrow('Invalid S256 attempt'); expect(f.saved()).toBeNull();
  });
  it.each(['https://evil.invalid/auth/callback', 'https://mayami.app/auth/other',
    'https://mayami.app/auth/callback?google_flow=wrong&code=x'])('rejects a callback outside the attempt: %s', async bad => {
    const f = fixture(); await start(f);
    expect(await f.flow.complete(bad)).toEqual({ status: 'invalid' }); expect(f.request).not.toHaveBeenCalled();
    expect(f.saved()?.phase).toBe('pending');
  });
  it.each(['&code=second', '&access_token=not-accepted', '#access_token=not-accepted', '&error=access_denied', '&error_description=failed'])('rejects ambiguous/token callback %s', async suffix => {
    const f = fixture(); const { raw } = await start(f);
    expect(await f.flow.complete(raw + suffix)).toEqual({ status: 'invalid' }); expect(f.request).not.toHaveBeenCalled();
  });
  it.each([
    ['&error=access_denied#error=access_denied', 'cancelled'],
    ['&error=access_denied&error_description=#error=access_denied&sb=', 'cancelled'],
    ['&error=server_error&error_code=unexpected_failure#error=server_error&error_code=unexpected_failure&sb=', 'failed'],
    ['&error=access_denied#sb=', 'invalid'],
    ['&error=access_denied#error=access_denied&sb=unexpected', 'invalid'],
    ['&error=access_denied#error=access_denied&sb=&sb=', 'invalid'],
    ['&error=access_denied&sb=#error=access_denied', 'invalid'],
    ['&code=local#sb=', 'invalid'],
    ['&error=server_error&error_description=failed#error=server_error&error_description=failed', 'failed'],
    ['&error=server_error#error=access_denied', 'invalid'],
    ['&error=access_denied#access_token=foreign', 'invalid'],
  ])('treats GoTrue error return %s as %s without exchanging a code', async (suffix, status) => {
    const f = fixture(); const { callback } = await start(f);
    expect(await f.flow.complete(callback + suffix)).toEqual({ status });
    expect(f.request).not.toHaveBeenCalled(); expect(f.session()).toBeNull();
  });
  it('provider refusal and back/cancel do not install a session', async () => {
    const f = fixture(); const { callback } = await start(f);
    expect(await f.flow.complete(callback + '&error=access_denied')).toEqual({ status: 'cancelled' });
    f.flow.cancel(); expect(f.session()).toBeNull(); expect(f.request).not.toHaveBeenCalled();
  });
  it('double callback shares one exchange, while a different callback cannot reuse the flight', async () => {
    const hold = deferred<Response>(); const f = fixture({ fetch: vi.fn(() => hold.promise) }); const { raw } = await start(f);
    const a = f.flow.complete(raw), b = f.flow.complete(raw);
    expect(a).toBe(b); expect(await f.flow.complete(raw.replace('one-use-code', 'different'))).toEqual({ status: 'invalid' });
    hold.resolve(Response.json(token())); expect((await a).status).toBe('accepted');
  });
  it.each(['cancel', 'buyer-b'] as const)('late token response after %s cannot install A', async kind => {
    const hold = deferred<Response>(); const f = fixture({ fetch: vi.fn(() => hold.promise) }); const { raw } = await start(f);
    const result = f.flow.complete(raw); if (kind === 'cancel') f.flow.cancel(); else f.installB();
    hold.resolve(Response.json(token())); expect(await result).toEqual({ status: 'cancelled' });
    expect(f.session()).toBe(kind === 'cancel' ? null : 'session-b'); expect(f.verify).not.toHaveBeenCalled();
  });
  it('late verified-user response cannot replace buyer B', async () => {
    const hold = deferred<User>(); const f = fixture({ verifyUser: vi.fn(() => hold.promise) }); const { raw } = await start(f);
    const result = f.flow.complete(raw); await vi.waitFor(() => expect(f.saved()?.phase).toBe('exchanging'));
    f.installB(); hold.resolve(user); expect(await result).toEqual({ status: 'cancelled' }); expect(f.session()).toBe('session-b');
  });
  it('rejects a candidate that expires while waiting for the commit boundary', async () => {
    let clock = now; const entered = deferred<void>(), release = deferred<void>();
    const value = token(); value.access_token = jwt(user.id, now / 1000 + 70); value.expires_at = now / 1000 + 70;
    const f = fixture({ now: () => clock, fetch: vi.fn(async () => Response.json(value)) });
    f.options.boundary.commit = async (_ticket, _value, current) => { entered.resolve(); await release.promise; return current(); };
    const { raw } = await start(f), result = f.flow.complete(raw); await entered.promise;
    clock += 80_000; release.resolve(); expect(await result).toEqual({ status: 'cancelled' }); expect(f.session()).toBeNull();
  });
  it('cancelling an obsolete controller cannot revoke a newer tab intent', async () => {
    const a = fixture(); await start(a);
    let saved: GoogleAttempt | null = null;
    const b = createGoogleAuth({ ...a.options, store: { read: () => saved, write: value => { saved = value; }, clear: () => { saved = null; } } });
    const opened = await b.begin('login', '/checkout'); const raw = new URL(opened.callback); raw.searchParams.set('code', 'new-tab-code');
    a.flow.cancel();
    expect((await b.complete(raw.toString())).status).toBe('accepted');
    expect(a.request).toHaveBeenCalledTimes(1);
  });
  it('reports uncertain durable commit separately from cancellation or a retryable exchange failure', async () => {
    const f = fixture(); const { raw } = await start(f);
    f.options.boundary.commit = async () => { throw Object.assign(Error('Lost acknowledgement'), { code: 'commit_uncertain' }); };
    expect(await f.flow.complete(raw)).toEqual({ status: 'uncertain' });
    expect(f.request).toHaveBeenCalledTimes(1); expect(f.saved()).toBeNull();
    expect(await f.flow.complete(raw)).toEqual({ status: 'invalid' });
  });
  it('retry uses new verifier/nonce and a late first result cannot erase the newer attempt', async () => {
    const hold = deferred<Response>(); const f = fixture({ fetch: vi.fn(() => hold.promise) }); const first = await start(f);
    const old = f.saved()!, result = f.flow.complete(first.raw); await start(f); const next = f.saved()!;
    hold.resolve(Response.json(token())); expect(await result).toEqual({ status: 'cancelled' });
    expect(f.saved()?.id).toBe(next.id); expect(next.id).not.toBe(old.id); expect(next.verifier).not.toBe(old.verifier);
  });
  it('failed cancellation invalidation closes the controller even if temporary storage cannot be cleared', async () => {
    const f = fixture(); const { raw } = await start(f);
    f.options.boundary.invalidate = () => { throw Error('Mock stamp storage blocked'); };
    f.options.store.clear = () => { throw Error('Mock attempt store blocked'); };
    f.flow.cancel(); expect(f.saved()?.phase).toBe('pending');
    expect(await f.flow.complete(raw)).toEqual({ status: 'failed' });
    await expect(start(f)).rejects.toThrow('invalidation unavailable'); expect(f.request).not.toHaveBeenCalled();
  });
  it('web reload can resume pending state; process death during exchange requires a new attempt', async () => {
    const f = fixture(); const { raw } = await start(f); const ticket = f.saved()!.ticket; const restored = createGoogleAuth(f.options);
    expect((await restored.complete(raw)).status).toBe('accepted');
    restored.cancel(); expect(f.options.boundary.isCurrent(ticket)).toBe(false);
    const g = fixture(); const next = await start(g); g.options.store.write({ ...g.saved()!, phase: 'exchanging' });
    expect(await createGoogleAuth(g.options).complete(next.raw)).toEqual({ status: 'invalid' }); expect(g.request).not.toHaveBeenCalled();
  });
  it('expires state and revalidates return destination rather than trusting callback input', async () => {
    let clock = now; const f = fixture({ now: () => clock }); const { raw } = await start(f); clock += 600_001;
    expect(await f.flow.complete(raw)).toEqual({ status: 'invalid' }); expect(f.request).not.toHaveBeenCalled();
    const g = fixture(); const next = await start(g); g.options.store.write({ ...g.saved()!, returnTo: '//evil.invalid' });
    const expected = g.saved()!;
    expect(await g.flow.complete(next.raw)).toEqual({ status: 'accepted', purpose: 'login', returnTo: '/cuenta', actorId: user.id, attemptId: expected.id, intentStamp: expected.ticket.stamp });
  });
  it.each(['expired', 'actor', 'issuer', 'failure'] as const)('rejects %s candidate without changing primary session', async kind => {
    const response = token(); if (kind === 'expired') response.access_token = jwt(user.id, now / 1000 - 1);
    if (kind === 'actor') response.access_token = jwt('other-buyer');
    if (kind === 'issuer') response.access_token = jwt(user.id, now / 1000 + 3600, 'https://other-project.supabase.co/auth/v1');
    const f = fixture({ fetch: vi.fn(async () => kind === 'failure' ? new Response('untrusted provider text', { status: 400 }) : Response.json(response)) });
    const { raw } = await start(f); expect(await f.flow.complete(raw)).toEqual({ status: 'failed' }); expect(f.session()).toBeNull();
    expect(f.saved()).toBeNull(); expect(f.options.fetch).toHaveBeenCalledTimes(1);
  });
  it('verifies the candidate through the selected project /user without cookies, redirects or global SDK state', async () => {
    const request = vi.fn(async () => Response.json(user));
    const verify = createGoogleUserVerifier('https://testonly.supabase.co', 'public-test-key', request);
    expect(await verify('candidate-only')).toEqual(user);
    expect(request).toHaveBeenCalledWith('https://testonly.supabase.co/auth/v1/user', expect.objectContaining({
      method: 'GET', redirect: 'error', credentials: 'omit', headers: { apikey: 'public-test-key', Authorization: 'Bearer candidate-only' },
    }));
    await expect(createGoogleUserVerifier('https://testonly.supabase.co', 'public-test-key', async () => new Response('', { status: 401 }))('candidate')).rejects.toThrow('verification failed');
  });
  it('refuses account replacement and classifies marked callbacks without accepting tokens', async () => {
    const f = fixture(); f.installB(); await expect(start(f)).rejects.toThrow('Session changed');
    expect(isGoogleAuthCallback('kora://auth-callback?google_flow=x')).toBe(true);
    expect(isGoogleAuthCallback('https://mayami.app/auth/callback#google_flow=x&access_token=x')).toBe(true);
    expect(isGoogleAuthCallback('kora://auth-callback#access_token=x')).toBe(false);
    expect(readGoogleAttempt({}, 'https://mayami.app/auth/callback', now)).toBeNull();
  });
});


describe('bounded Google network completion, without racing durable commit', () => {
  it('times out a non-cooperative token request, rejects replay and ignores its late response', async () => {
    vi.useFakeTimers();
    try {
      const hold = deferred<Response>();
      const request = vi.fn(() => hold.promise);
      const f = fixture({ fetch: request }); const { raw } = await start(f);
      const result = f.flow.complete(raw);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(await result).toEqual({ status: 'failed' });
      expect((request.mock.calls[0] as unknown as [string, RequestInit])[1].signal?.aborted).toBe(true);
      expect(f.saved()).toBeNull(); expect(f.session()).toBeNull();
      expect(await f.flow.complete(raw)).toEqual({ status: 'invalid' });
      await start(f); const next = f.saved();
      hold.resolve(Response.json(token())); await Promise.resolve();
      expect(f.session()).toBeNull(); expect(f.saved()).toEqual(next);
      expect(f.verify).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it('also bounds a response body that never completes', async () => {
    vi.useFakeTimers();
    try {
      const f = fixture({ fetch: vi.fn(async () => ({ ok: true, json: () => new Promise(() => {}) }) as Response) });
      const { raw } = await start(f); const result = f.flow.complete(raw);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(await result).toEqual({ status: 'failed' }); expect(f.session()).toBeNull();
    } finally { vi.useRealTimers(); }
  });
  it('explicit cancellation releases a stuck user verifier without a late promotion', async () => {
    const hold = deferred<User>(), entered = deferred<void>(); let signal: AbortSignal | undefined;
    const f = fixture({ verifyUser: vi.fn((_token, input) => { signal = input; entered.resolve(); return hold.promise; }) });
    const { raw } = await start(f), result = f.flow.complete(raw); await entered.promise;
    f.flow.cancel(); expect(await result).toEqual({ status: 'cancelled' }); expect(signal?.aborted).toBe(true);
    hold.resolve(user); await Promise.resolve(); expect(f.session()).toBeNull();
  });
  it('uses the remaining attempt lifetime when it is less than the network deadline', async () => {
    vi.useFakeTimers();
    try {
      let clock = now; const f = fixture({ now: () => clock, fetch: vi.fn(() => new Promise<Response>(() => {})) });
      const { raw } = await start(f); clock = now + 600_000 - 50;
      const result = f.flow.complete(raw); clock += 50;
      await vi.advanceTimersByTimeAsync(50);
      expect(await result).toEqual({ status: 'cancelled' }); expect(f.session()).toBeNull();
    } finally { vi.useRealTimers(); }
  });
  it('does not report timeout after a durable commit has begun', async () => {
    vi.useFakeTimers();
    try {
      const entered = deferred<void>(), release = deferred<void>(); const f = fixture();
      const commit = f.options.boundary.commit;
      f.options.boundary.commit = async (...args) => { entered.resolve(); await release.promise; return commit(...args); };
      const { raw } = await start(f), result = f.flow.complete(raw); await entered.promise;
      await vi.advanceTimersByTimeAsync(31_000); release.resolve();
      expect((await result).status).toBe('accepted'); expect(f.session()).not.toBeNull();
    } finally { vi.useRealTimers(); }
  });
});

describe('notice after verified account recovery', () => {
  it('shows the local eligibility time only for the current recovery and keeps ordinary resets quiet', () => {
    const time = Date.UTC(2026, 10, 17, 8);
    const status = { allow_after: new Date(time).toISOString(), other_sessions_open: false };
    expect(googleRecoveryMessage(null)).toBeNull();
    expect(googleRecoveryMessage({ ...status, allow_after: 'invalid' })).toBeNull();
    expect(googleRecoveryMessage(status, time - 10)).toContain('hora de este dispositivo');
    expect(googleRecoveryMessage(status, time)).toContain('volver a entrar con Google');
    expect(googleRecoveryMessage({ ...status, other_sessions_open: true })).toContain('otras sesiones');
  });
});
