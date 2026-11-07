import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import type * as NativePorts from '../../../apps/mobile/src/lib/google-auth-ports';

// Execute the versioned native adapter with native module calls replaced. This is not a device test.
function loadNative(random: () => Promise<Uint8Array> = async () => randomBytes(32)) {
  const file = new URL('../../../apps/mobile/src/lib/google-auth-ports.ts', import.meta.url);
  const js = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } }).outputText;
  let browserResult: { type: string; url?: string } = { type: 'cancel' };
  const calls: string[] = [];
  const modules: Record<string, unknown> = {
    '@kora/api': { GOOGLE_AUTH_ACTIVATED: false },
    'expo-crypto': { getRandomBytesAsync: random, CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
      CryptoEncoding: { BASE64: 'base64' }, digestStringAsync: async (_: string, text: string) => createHash('sha256').update(text).digest('base64') },
    'expo-web-browser': { openAuthSessionAsync: async () => { calls.push('browser'); return browserResult; } },
  };
  const module = { exports: {} };
  new Function('require', 'exports', 'module', js)((name: string) => {
    if (!(name in modules)) throw Error('Unexpected module'); return modules[name];
  }, module.exports, module);
  return { ports: module.exports as typeof NativePorts, calls, outcome: (value: typeof browserResult) => { browserResult = value; } };
}
describe('versioned native Google ports, mocked native modules only', () => {
  it('has no browser effects on import, gate remains closed and uses existing scheme', () => {
    const f = loadNative(); expect(f.calls).toEqual([]); expect(f.ports.GOOGLE_ACCESS_ENABLED).toBe(false);
    expect(f.ports.GOOGLE_CALLBACK).toBe('kora://auth-callback');
  });
  it('uses 32 secure bytes and agrees with the RFC7636 S256 example', async () => {
    const f = loadNative(); expect(await f.ports.randomBytes()).toHaveLength(32);
    expect(await f.ports.sha256Base64('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw+cM=');
    await expect(loadNative(async () => new Uint8Array(0)).ports.randomBytes()).rejects.toThrow('Secure random unavailable');
  });
  it('distinguishes success, refusal/back/dismiss and unexpected native errors', async () => {
    const f = loadNative();
    for (const type of ['cancel', 'dismiss']) { f.outcome({ type }); expect(await f.ports.browser.open('mock-authorize', 'kora://auth-callback')).toEqual({ type: 'cancel' }); }
    f.outcome({ type: 'success', url: 'kora://auth-callback?google_flow=mock&code=mock' });
    expect((await f.ports.browser.open('mock-authorize', 'kora://auth-callback')).type).toBe('success');
    f.outcome({ type: 'unexpected' }); await expect(f.ports.browser.open('mock-authorize', 'kora://auth-callback')).rejects.toThrow();
    f.outcome({ type: 'success' }); await expect(f.ports.browser.open('mock-authorize', 'kora://auth-callback')).rejects.toThrow();
  });
  it('stores verifier only in process memory and a fresh process has no attempt', () => {
    const f = loadNative(), repo = f.ports.createMemoryAttemptRepository();
    const value = { id: 'mock', phase: 'pending' } as Parameters<typeof repo.write>[0];
    repo.write(value); expect(repo.read()).toEqual(value);
    expect(f.ports.createMemoryAttemptRepository().read()).toBeNull(); repo.clear(); expect(repo.read()).toBeNull();
  });
});
