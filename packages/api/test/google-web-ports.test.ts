import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createGoogleAuth, type GoogleAuthOptions } from '../src/google-auth';
import { createWebAttemptRepository, createWebCryptoPorts, googleAttemptCodec, GOOGLE_ACCESS_ENABLED,
  GOOGLE_ATTEMPT_STORAGE_KEY } from '../../../apps/storefront/src/lib/google-auth-ports';

const callbackBase = 'https://mayami.app/auth/callback';
function storage() {
  const map = new Map<string, string>();
  return { map, getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); }, removeItem: (k: string) => { map.delete(k); } };
}
function options(store = createWebAttemptRepository(storage(), googleAttemptCodec(callbackBase))) {
  return {
    enabled: true, supabaseUrl: 'https://testonly.supabase.co', anonKey: 'public-test-key', callbackBase,
    store, crypto: createWebCryptoPorts(webcrypto as unknown as Crypto), safeReturn: () => '/checkout',
    boundary: { invalidate() {}, isCurrent: () => true, capture: async () => ({ stamp: 'nonce', baseline: null }), commit: async () => true },
    verifyUser: async () => { throw new Error('No network expected'); },
    fetch: async () => { throw new Error('No network expected'); },
  } satisfies GoogleAuthOptions;
}
describe('prepared web ports with real WebCrypto and per-tab storage, no network', () => {
  it('production gate remains closed', () => { expect(GOOGLE_ACCESS_ENABLED).toBe(false); });
  it('persists S256 before redirect, keeps tabs separate, and rejects a consumed attempt after reload', async () => {
    const disk = storage(), repo = createWebAttemptRepository(disk, googleAttemptCodec(callbackBase));
    const o = options(repo); const result = await createGoogleAuth(o).begin('register', '/checkout');
    const stored = repo.read() as { id: string; phase: string; verifier: string };
    expect(stored.phase).toBe('pending'); expect(stored.verifier).toHaveLength(43);
    expect(JSON.stringify([...disk.map.values()])).not.toContain('access_token');
    const reload = createWebAttemptRepository(disk, googleAttemptCodec(callbackBase));
    expect(reload.read()).toEqual(repo.read());
    expect(createWebAttemptRepository(storage(), googleAttemptCodec(callbackBase)).read()).toBeNull();
    const decoded = repo.read() as Parameters<typeof repo.write>[0]; repo.write({ ...decoded, phase: 'exchanging' });
    expect(await createGoogleAuth(o).complete(result.callback + '&code=unused')).toEqual({ status: 'invalid' });
    expect(disk.map.has(GOOGLE_ATTEMPT_STORAGE_KEY)).toBe(false);
  });
  it('fails closed when storage is blocked or malformed, without exposing data in errors', async () => {
    const blocked = createWebAttemptRepository({ getItem() { throw Error('private data'); }, setItem() {}, removeItem() {} }, googleAttemptCodec(callbackBase));
    const flow = createGoogleAuth(options(blocked));
    await expect(flow.begin('login', '/checkout')).rejects.toThrow('storage unavailable');
    expect(await flow.complete(callbackBase + '?google_flow=x&code=x')).toEqual({ status: 'failed' });
    const disk = storage(); disk.map.set(GOOGLE_ATTEMPT_STORAGE_KEY, '{bad');
    expect(await createGoogleAuth(options(createWebAttemptRepository(disk, googleAttemptCodec(callbackBase)))).complete(callbackBase)).toEqual({ status: 'failed' });
    expect(disk.map.get(GOOGLE_ATTEMPT_STORAGE_KEY)).toBe('{bad');
  });
  it('rejects unexpected state keys before writing', async () => {
    const disk = storage(), repo = createWebAttemptRepository(disk, googleAttemptCodec(callbackBase));
    await createGoogleAuth(options(repo)).begin('login', '/checkout');
    const value = repo.read() as object;
    expect(() => repo.write({ ...value, provider_token: 'must-not-store' } as unknown as Parameters<typeof repo.write>[0])).toThrow('storage invalid');
    expect([...disk.map.values()].join('')).not.toContain('must-not-store');
  });
});
