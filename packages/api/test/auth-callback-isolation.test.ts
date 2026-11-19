import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isGoogleAuthCallback } from '../src/google-auth';

function sourceModule(file: string, modules: Record<string, unknown>) {
  const js = ts.transpileModule(readFileSync(new URL('../../../' + file, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  new Function('require', 'exports', 'module', js)((name: string) => {
    if (!(name in modules)) throw Error('Unexpected import ' + name); return modules[name];
  }, module.exports, module); return module.exports;
}
const redirectSystemPath = sourceModule('apps/mobile/src/app/+native-intent.tsx', {}).redirectSystemPath as
  (intent: { path: string; initial: boolean }) => string | null;
afterEach(() => vi.unstubAllGlobals());
describe('Google callbacks are isolated from existing email access', () => {
  it.each(['auth-callback', 'reset-password'])('legacy native %s screen requires an explicit code for every credential-bearing URL', screen => {
    const replace = vi.fn(), useLocalSearchParams = vi.fn();
    const authNavigation = sourceModule('apps/mobile/src/lib/auth-navigation.ts', {
      'expo-router': { useLocalSearchParams }, '@kora/core': { safePlanCode: () => undefined },
    });
    const jsx = (type: unknown, props: unknown) => ({ type, props });
    const component = sourceModule('apps/mobile/src/app/' + screen + '.tsx', {
      'expo-router': { router: { replace } }, 'react-native': { View: 'View' },
      'react/jsx-runtime': { jsx, jsxs: jsx }, '@/components/ui/States': { EmptyState: 'EmptyState' },
      '@/theme': { useTheme: () => ({ colors: {} }) }, '@/lib/auth-navigation': authNavigation,
    });
    // This restricted module surface fails if either screen accesses an auth client.
    for (const suffix of ['', '?code=email-code', '#access_token=a&refresh_token=b',
      '#google_flow=x&access_token=a', '?code=mixed&access_token=a&refresh_token=b']) {
      const url = 'kora://' + screen + suffix;
      expect(redirectSystemPath({ path: url, initial: false })).toBe(url);
      useLocalSearchParams.mockReturnValue(Object.fromEntries(new URL(url).searchParams));
      replace.mockClear();
      const render = component.default as () => { props: { children: { props: { title: string; onAction(): void } } } };
      const prompt = render().props.children.props;
      expect(prompt.title).toMatch(/código/i);
      expect(replace).not.toHaveBeenCalled();
      prompt.onAction();
      expect(replace).toHaveBeenCalledWith({ pathname: screen === 'auth-callback' ? '/sign-in' : '/forgot-password', params: {} });
    }
  });

  it('routes a live Google return only to the system browser and an interrupted return to a fresh sign-in', () => {
    const path = 'kora://auth-callback?google_flow=opaque&code=grant';
    expect(redirectSystemPath({ path, initial: false })).toBeNull();
    expect(redirectSystemPath({ path, initial: true })).toBe('/sign-in?googleRetry=1');
  });

  it.each([true, false])('configures the SDK to reject URL-supplied sessions with synchronous storage=%s', synchronous => {
    const createKoraClient = vi.fn(() => ({}));
    const boundary = () => ({ storage: {}, subscribe: vi.fn() });
    const mod = sourceModule('packages/api/src/google-auth-runtime.ts', {
      './client': { createKoraClient }, './google-auth': { createGoogleAuth: () => ({}) },
      './google-session-boundary': { createGoogleSessionBoundary: boundary },
      './google-web-session': { createWebGoogleSessionBoundary: boundary },
    });
    (mod.createGoogleAuthRuntime as (options: object) => unknown)({ url: 'https://localtest.supabase.co', enabled: true, synchronous });
    expect(createKoraClient).toHaveBeenCalledWith(expect.objectContaining({ detectSessionInUrl: false }));
  });

  it.each([
    ['?code=legacy', 'email'], ['#access_token=a&refresh_token=b', 'email'],
    ['?code=legacy&access_token=mixed', 'email'], ['?google_flow=x&code=grant', 'error'],
    ['#google_flow=x&access_token=a&refresh_token=b', 'error'],
  ])('scrubs the storefront URL and isolates unsolicited callback %s', async (suffix, state) => {
    const href = 'https://mayami.app/auth/callback' + suffix;
    const replace = vi.fn(), cleaned = vi.fn(), update = vi.fn();
    const complete = vi.fn(async () => ({ status: 'invalid' }));
    const claimNavigation = vi.fn();
    const browser = vi.fn(() => ({ runtime: { google: { returnDestination: () => null, complete }, claimNavigation } }));
    vi.stubGlobal('window', { location: { href } });
    vi.stubGlobal('history', { state: { previous: 1 }, replaceState: cleaned });
    const mod = sourceModule('apps/storefront/src/app/auth/callback/page.tsx', {
      react: { useRef: (current: unknown) => ({ current }), useState: (initial: unknown) => [initial, update],
        useEffect: (effect: () => void) => effect() },
      'react/jsx-runtime': { jsx: () => null, jsxs: () => null }, 'next/link': { default: () => null },
      'next/navigation': { useRouter: () => ({ replace }) }, '@kora/api': { isGoogleAuthCallback },
      '@/lib/browser': { browser }, '@/lib/auth-return': { safeReturnPath: () => '/cuenta', authHref: () => '/cuenta' },
    });
    (mod.default as () => unknown)();
    await vi.waitFor(() => expect(update).toHaveBeenCalledWith(state));
    expect(cleaned).toHaveBeenCalledWith({ previous: 1 }, '', '/auth/callback');
    if (state === 'email') expect(browser).not.toHaveBeenCalled();
    else expect(complete).toHaveBeenCalledWith(href);
    expect(claimNavigation).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled();
  });
});
