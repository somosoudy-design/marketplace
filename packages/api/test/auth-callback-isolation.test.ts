import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isGoogleAuthCallback } from '../src/google-auth';
import { emailWebCallbackUrl, productionNativeEmailCallback } from '../src/email-auth-url';

function sourceModule(file: string, modules: Record<string, unknown>) {
  const js = ts.transpileModule(readFileSync(new URL('../../../' + file, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  new Function('require', 'exports', 'module', js)((name: string) => {
    if (!(name in modules)) throw Error('Unexpected import ' + name); return modules[name];
  }, module.exports, module); return module.exports;
}
afterEach(() => vi.unstubAllGlobals());
describe('Google callbacks are isolated from existing email access', () => {
  it.each(['?google_flow=x&code=mock', '#google_flow=x&access_token=mock&refresh_token=mock'])('native email hook refuses reserved callback %s before touching Auth', async suffix => {
    const exchange = vi.fn(), setSession = vi.fn(), getSession = vi.fn(); let last: unknown;
    const mod = sourceModule('apps/mobile/src/lib/auth-link.ts', {
      'expo-linking': { useURL: () => 'kora://auth-callback' + suffix }, 'react-native': { Platform: { OS: 'android' } },
      react: { useState: () => [{ status: 'working' }, (s: unknown) => { last = s; }], useEffect: (effect: () => void) => effect() },
      './supabase': { supabase: { auth: { exchangeCodeForSession: exchange, setSession, getSession } } },
      '@kora/api': { emailWebCallbackUrl, productionNativeEmailCallback }, './env': { env: { supabaseUrl: 'https://mimnotafmfasvwrclxan.supabase.co' } },
    });
    (mod.useAuthLinkSession as () => unknown)();
    await vi.waitFor(() => expect(last).toEqual({ status: 'invalid', reason: 'failed' }));
    expect(exchange).not.toHaveBeenCalled(); expect(setSession).not.toHaveBeenCalled(); expect(getSession).not.toHaveBeenCalled();
  });
  it('native email code callback retains the existing exchange path', async () => {
    const exchange = vi.fn(async () => ({ error: null })); let last: unknown;
    const mod = sourceModule('apps/mobile/src/lib/auth-link.ts', {
      'expo-linking': { useURL: () => 'kora://auth-callback?code=email-code' }, 'react-native': { Platform: { OS: 'android' } },
      react: { useState: () => [{ status: 'working' }, (s: unknown) => { last = s; }], useEffect: (effect: () => void) => effect() },
      './supabase': { supabase: { auth: { exchangeCodeForSession: exchange, getSession: async () => ({ data: { session: { user: { id: 'email-buyer' } } } }) } } },
      '@kora/api': { emailWebCallbackUrl, productionNativeEmailCallback }, './env': { env: { supabaseUrl: 'https://mimnotafmfasvwrclxan.supabase.co' } },
    });
    (mod.useAuthLinkSession as () => unknown)();
    await vi.waitFor(() => expect(last).toEqual({ status: 'ready', type: null })); expect(exchange).toHaveBeenCalledWith('email-code');
  });
  it.each(['', '?access_token=partial', '?code=email&access_token=mixed&refresh_token=mixed'])('an incomplete callback never treats existing buyer B as a confirmed link: %s', suffix => {
    let last: unknown;
    const getSession = vi.fn(async () => ({ data: { session: { user: { id: 'buyer-b' } } } }));
    const exchange = vi.fn(), install = vi.fn();
    const mod = sourceModule('apps/mobile/src/lib/auth-link.ts', {
      'expo-linking': { useURL: () => 'kora://auth-callback' + suffix }, 'react-native': { Platform: { OS: 'android' } },
      react: { useState: () => [{ status: 'working' }, (s: unknown) => { last = s; }], useEffect: (effect: () => void) => effect() },
      './supabase': { supabase: { auth: { exchangeCodeForSession: exchange, setSession: install, getSession } } },
      '@kora/api': { emailWebCallbackUrl, productionNativeEmailCallback }, './env': { env: { supabaseUrl: 'https://mimnotafmfasvwrclxan.supabase.co' } },
    });
    (mod.useAuthLinkSession as () => unknown)();
    expect(last).toEqual({ status: 'invalid', reason: suffix ? 'failed' : 'missing' });
    expect(exchange).not.toHaveBeenCalled(); expect(install).not.toHaveBeenCalled(); expect(getSession).not.toHaveBeenCalled();
  });
  it('mobile web SDK detector excludes query and fragment markers while retaining email auto-detection', () => {
    let detector: ((url: URL) => boolean) | undefined;
    sourceModule('apps/mobile/src/lib/supabase.ts', {
      'react-native-url-polyfill/auto': {}, '@kora/api': { isGoogleAuthCallback, createApi: () => ({}),
        createKoraClient: (opts: { detectSessionInUrl: (url: URL) => boolean }) => { detector = opts.detectSessionInUrl; return {}; } },
      'react-native': { Platform: { OS: 'web' } }, './env': { env: { supabaseUrl: 'https://testonly.supabase.co', supabaseAnonKey: 'public-test' } },
      './session-storage': { sessionStorage: {} },
    });
    expect(detector!(new URL('https://mayami.app/auth/callback?google_flow=x&code=x'))).toBe(false);
    expect(detector!(new URL('https://mayami.app/auth/callback#google_flow=x&access_token=x'))).toBe(false);
    expect(detector!(new URL('https://mayami.app/auth/callback#access_token=email&refresh_token=email'))).toBe(true);
  });
  it.each([true, false])('storefront callback rejects marked Google and preserves email exchange (marked=%s)', async marked => {
    const exchange = vi.fn(async () => ({ error: null })), replace = vi.fn(), cleaned = vi.fn();
    let failed = false;
    vi.stubGlobal('window', { location: { href: 'https://mayami.app/auth/callback?code=email-code' + (marked ? '#google_flow=x' : '') } });
    vi.stubGlobal('history', { replaceState: cleaned });
    const mod = sourceModule('apps/storefront/src/app/auth/callback/page.tsx', {
      react: { useRef: () => ({ current: null }), useState: (initial: unknown) => [initial, (value: unknown) => { if (value === true) failed = true; }],
        useEffect: (effect: () => void) => effect() },
      'react/jsx-runtime': { jsx: () => null, jsxs: () => null }, 'next/link': { default: () => null },
      'next/navigation': { useRouter: () => ({ replace }) }, '@kora/api': { isGoogleAuthCallback },
      '@/lib/browser': { browser: () => ({ client: { auth: { exchangeCodeForSession: exchange } } }) },
      '@/lib/auth-return': { safeReturnPath: () => '/cuenta', authHref: () => '/cuenta' },
    });
    (mod.default as () => unknown)();
    if (marked) { await vi.waitFor(() => expect(failed).toBe(true)); expect(exchange).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled(); }
    else { await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/cuenta')); expect(exchange).toHaveBeenCalledWith('email-code'); }
    expect(cleaned).toHaveBeenCalledWith(null, '', '/auth/callback');
  });
});
