import { createKoraClient } from './client';
import { createGoogleAuth, createGoogleUserVerifier, type GoogleAttemptStore, type GoogleCrypto, type GoogleResult } from './google-auth';
import { createGoogleSessionBoundary, type GoogleSessionLock, type GoogleSessionStorage } from './google-session-boundary';
import { createWebGoogleSessionBoundary } from './google-web-session';

export interface GoogleRuntimeOptions {
  enabled: boolean; url: string; anonKey: string;
  storage: GoogleSessionStorage; storageKey?: string;
  attemptStore: GoogleAttemptStore; crypto: GoogleCrypto;
  callbackBase: string; safeReturn(input: string): string;
  newIntentId(): string; withLock?: GoogleSessionLock; synchronous?: boolean;
  fetch?: typeof fetch;
}

/** The application and the local integration test use the same SDK, storage and controller composition. */
export function createGoogleAuthRuntime(o: GoogleRuntimeOptions) {
  const request = o.fetch ?? globalThis.fetch.bind(globalThis);
  const key = o.storageKey ?? `sb-${new URL(o.url).hostname.split('.')[0]}-auth-token`;
  let intent: string | null = null, primaryInFlight = 0;
  const navigated = new Set<string>();
  const listeners = new Set<() => void>();
  const hint = () => { for (const listener of listeners) { try { listener(); } catch { /* Observers reread authoritative storage. */ } } };
  const boundary = o.synchronous
    ? createWebGoogleSessionBoundary(o.storage as Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, key,
      o.withLock ?? (async () => { throw new Error('Este navegador no puede coordinar el acceso entre pestañas.'); }), o.newIntentId)
    : createGoogleSessionBoundary(o.storage, key, { read: () => intent, write: value => { intent = value; } }, o.newIntentId, undefined, { durable: true });
  const storage = o.enabled ? boundary.storage : o.storage;
  const sdkStorage = {
    getItem: async (name: string) => await storage.getItem(name),
    setItem: async (name: string, value: string) => { await storage.setItem(name, value); },
    removeItem: async (name: string) => { await storage.removeItem(name); },
  };
  const client = createKoraClient({ url: o.url, anonKey: o.anonKey, storage: sdkStorage, storageKey: key, retryReads: false, fetch: request,
    // URL-based email session adoption remains prohibited; only the correlated engine may admit Google.
    ...(o.synchronous ? { flowType: 'pkce' as const } : {}), detectSessionInUrl: false });
  const engine = createGoogleAuth({ enabled: o.enabled, supabaseUrl: o.url, anonKey: o.anonKey, callbackBase: o.callbackBase,
    store: o.attemptStore, crypto: o.crypto, boundary, safeReturn: o.safeReturn, fetch: request,
    verifyUser: (token, signal) => createGoogleUserVerifier(o.url, o.anonKey, request)(token, signal),
    claimAttempt: 'claimAttempt' in boundary ? boundary.claimAttempt : undefined });
  boundary.subscribe(hint);
  return {
    enabled: o.enabled, client, storage,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    google: {
      cancel: engine.cancel,
      returnDestination: engine.returnDestination,
      complete: async (raw: string) => {
        const result = await engine.complete(raw);
        if (result.status === 'uncertain') hint();
        return result;
      },
      begin: (purpose: 'register' | 'login', returnTo: string) => {
        if (primaryInFlight) return Promise.reject(new Error('Espera a que termine el acceso actual.'));
        return engine.begin(purpose, returnTo);
      },
    },
    async primary<T>(work: () => Promise<T>): Promise<T> {
      primaryInFlight++;
      try {
        if (o.enabled) { engine.invalidatePrimary(); await boundary.storage.getItem(key); }
        return await work();
      } finally { primaryInFlight--; }
    },
    async currentActor(actorId: string): Promise<boolean> {
      const { data, error } = await client.auth.getSession();
      return !error && data.session?.user.id === actorId;
    },
    async claimNavigation(result: GoogleResult, stillCurrent: () => boolean = () => true): Promise<boolean> {
      if (result.status !== 'accepted' || !stillCurrent() || navigated.has(result.attemptId) || !boundary.isCurrent({ stamp: result.intentStamp, baseline: null })) return false;
      const { data, error } = await client.auth.getSession();
      if (error || !stillCurrent() || data.session?.user.id !== result.actorId || navigated.has(result.attemptId) || !boundary.isCurrent({ stamp: result.intentStamp, baseline: null })) return false;
      navigated.add(result.attemptId);
      if (navigated.size > 128) navigated.delete(navigated.values().next().value!);
      return true;
    },
  };
}
