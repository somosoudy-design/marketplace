'use client';
import { createGoogleAuthRuntime, createApi, type GoogleRuntimeOptions, GOOGLE_ACCESS_ENABLED, createWebAttemptRepository, googleAttemptCodec, createWebCryptoPorts } from '@kora/api';
import { env } from './env';
import { safeReturnPath } from './auth-return';
type RuntimeConfig = Partial<Pick<GoogleRuntimeOptions, 'enabled' | 'url' | 'anonKey' | 'fetch' | 'callbackBase'>>;
/** Explicit composition seam for isolated local validation; production browser() passes no overrides. */
export function createBrowserConnection(options: RuntimeConfig = {}) {
  if (typeof window === 'undefined') throw new Error('Browser client used outside the browser');
  const url = options.url ?? env.url, callback = options.callbackBase ?? 'https://mayami.app/auth/callback';
  const enabled = options.enabled ?? (GOOGLE_ACCESS_ENABLED && window.location.origin === 'https://mayami.app' &&
    url === 'https://mimnotafmfasvwrclxan.supabase.co' && !!navigator.locks && !!globalThis.crypto?.subtle);
  const runtime = createGoogleAuthRuntime({
    enabled, url, anonKey: options.anonKey ?? env.anon,
    storage: window.localStorage, synchronous: true, callbackBase: callback,
    attemptStore: enabled ? createWebAttemptRepository(window.sessionStorage, googleAttemptCodec(callback))
      : { read: () => null, write: () => undefined, clear: () => undefined },
    crypto: createWebCryptoPorts(globalThis.crypto), newIntentId: () => crypto.randomUUID(), safeReturn: safeReturnPath,
    fetch: options.fetch, withLock: async work => {
      if (!navigator.locks) throw new Error('Este navegador no puede coordinar el acceso entre pestañas.');
      return navigator.locks.request(`mayami.auth:${new URL(url).hostname}`, work);
    },
  });
  return { client: runtime.client, api: createApi(runtime.client), runtime };
}
let connection: ReturnType<typeof createBrowserConnection> | undefined;
export function browser() {
  if (typeof window === 'undefined') throw new Error('Browser client used outside the browser');
  if (!connection) {
    connection = createBrowserConnection();
  }
  return connection;
}
