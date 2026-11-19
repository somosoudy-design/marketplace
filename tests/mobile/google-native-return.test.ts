import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { redirectSystemPath } from '../../apps/mobile/src/app/+native-intent';
import { nextEmailCode, validEmailCode } from '../../apps/mobile/src/lib/email-code';

const fixture = vi.hoisted(() => ({
  open: vi.fn<(authorize: string, returnUrl: string) => Promise<{ type: string; url?: string }>>(),
  values: new Map<string, string>(),
}));
vi.mock('../../apps/mobile/node_modules/expo-web-browser', () => ({ openAuthSessionAsync: fixture.open }));
vi.mock('../../apps/mobile/node_modules/expo-crypto', () => ({
  randomUUID, getRandomBytesAsync: async (n: number) => randomBytes(n),
  CryptoDigestAlgorithm: { SHA256: 'sha256' }, CryptoEncoding: { BASE64: 'base64' },
  digestStringAsync: async (_: string, value: string) => createHash('sha256').update(value).digest('base64'),
}));
vi.mock('../../apps/mobile/node_modules/react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('../../apps/mobile/node_modules/react-native-url-polyfill/auto', () => ({}));
vi.mock('../../apps/mobile/node_modules/expo-router', () => ({}));
vi.mock('../../apps/mobile/src/lib/env', () => ({ env: { supabaseUrl: 'https://fixture.supabase.co', supabaseAnonKey: 'public-test-key' } }));
vi.mock('../../apps/mobile/src/lib/session-storage', () => ({ sessionStorage: {
  getItem: async (key: string) => fixture.values.get(key) ?? null,
  setItem: async (key: string, value: string) => { fixture.values.set(key, value); },
  removeItem: async (key: string) => { fixture.values.delete(key); },
} }));

const base = 'kora://auth-callback';
const back = base + '?code=fixture-code&google_flow=example';
describe('Android intent ownership', () => {
  it('leaves the warm Google callback to the browser and restarts cold without transferring the grant', () => {
    expect(redirectSystemPath({ path: back, initial: false })).toBeNull();
    expect(redirectSystemPath({ path: back, initial: true })).toBe('/sign-in?googleRetry=1');
  });
  it.each(['kora://p/item', 'kora://reset-password', base + '?code=legacy', 'kora://auth-callback/somewhere?google_flow=x', 'https://mayami.app/p/item'])('keeps ordinary links intact: %s', path => {
    expect(redirectSystemPath({ path, initial: false })).toBe(path);
  });
});

describe('native signup and recovery codes', () => {
  it('retains all eight digits, including leading zeroes, typing, paste, and a new code after a failed attempt', () => {
    expect(nextEmailCode('0123456', '012345')).toBe('0123456');
    expect(nextEmailCode('Tu código: 0123 4567', '')).toBe('01234567');
    expect(nextEmailCode('9999999901234567', '99999999')).toBe('01234567');
    expect(validEmailCode('01234567')).toBe(true); expect(validEmailCode('012345')).toBe(true);
    expect(validEmailCode('01234')).toBe(false); expect(validEmailCode('012345678')).toBe(false);
  });
});

describe('native browser coordinator, real auth engine and SDK, simulated provider', () => {
  const user = { id: '08caa09e-08a1-4d06-8888-0827b496e19f', email: 'buyer@example.com' };
  const issuer = 'https://fixture.supabase.co/auth/v1';
  let challenge = '', exchanges = 0;
  beforeEach(() => {
    vi.resetModules(); fixture.values.clear(); fixture.open.mockReset(); exchanges = 0; challenge = '';
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
    const token = enc({ alg: 'HS256' }) + '.' + enc({ sub: user.id, iss: issuer, exp: expiry }) + '.fixture';
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, opts?: RequestInit) => {
      const req = new Request(input, opts);
      if (req.url === issuer + '/token?grant_type=pkce') {
        exchanges++;
        const body = await req.json();
        expect(body.auth_code).toBe('local-code');
        expect(createHash('sha256').update(body.code_verifier).digest('base64url')).toBe(challenge);
        return Response.json({ token_type: 'bearer', expires_in: 3600, expires_at: expiry, access_token: token,
          refresh_token: 'mock-refresh', provider_token: 'provider-secret-never-stored', user });
      }
      if (req.url === issuer + '/user' && req.headers.get('authorization') === 'Bearer ' + token) return Response.json(user);
      throw Error('Unexpected URL during isolated native test');
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it.each(['login', 'register'] as const)('admits %s after code + nonce and navigates only once', async purpose => {
    fixture.open.mockImplementation(async (authorize, returnUrl) => {
      expect(returnUrl).toBe(base);
      const url = new URL(authorize);
      expect(url.searchParams.get('provider')).toBe('google');
      challenge = url.searchParams.get('code_challenge')!;
      const callback = new URL(url.searchParams.get('redirect_to')!);
      return { type: 'success', url: base + '?code=local-code&google_flow=' + callback.searchParams.get('google_flow') };
    });
    const { startGoogleAccess, googleRuntime } = await import('../../apps/mobile/src/lib/google-runtime');
    const result = await startGoogleAccess(purpose, '/checkout');
    expect(result).toMatchObject({ status: 'accepted', purpose, returnTo: '/checkout', actorId: user.id });
    expect(exchanges).toBe(1); expect((await googleRuntime.client.auth.getSession()).data.session?.user.id).toBe(user.id);
    expect(await googleRuntime.claimNavigation(result)).toBe(true); expect(await googleRuntime.claimNavigation(result)).toBe(false);
    expect([...fixture.values.values()].join()).not.toContain('provider-secret-never-stored');
    await googleRuntime.client.auth.stopAutoRefresh();
  });
  it('rejects foreign grants, dismissals and callbacks after cancellation without contacting Auth', async () => {
    const { startGoogleAccess, cancelGoogleAccess, googleRuntime } = await import('../../apps/mobile/src/lib/google-runtime');
    fixture.open.mockResolvedValueOnce({ type: 'success', url: back });
    expect((await startGoogleAccess('login', '/checkout')).status).not.toBe('accepted');
    fixture.open.mockResolvedValueOnce({ type: 'dismiss' });
    expect((await startGoogleAccess('login', '/checkout')).status).toBe('cancelled');
    fixture.open.mockImplementationOnce(async authorize => {
      cancelGoogleAccess();
      return { type: 'success', url: new URL(authorize).searchParams.get('redirect_to') + '&code=local-code' };
    });
    expect((await startGoogleAccess('login', '/checkout')).status).toBe('cancelled');
    expect(exchanges).toBe(0); expect((await googleRuntime.client.auth.getSession()).data.session).toBeNull();
    await googleRuntime.client.auth.stopAutoRefresh();
  });
});
