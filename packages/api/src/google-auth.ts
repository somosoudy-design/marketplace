import type { Session, User } from '@supabase/supabase-js';

/** Prepared protocol only. Production callers must remain gated until the provider/identity review. */
export const GOOGLE_AUTH_ACTIVATED = false;
const MAX_AGE = 10 * 60_000;
const opaque = /^[A-Za-z0-9_-]{43}$/;
type Purpose = 'register' | 'login';
export interface GoogleTicket { stamp: string; baseline: string | null }
export interface GoogleAttempt {
  version: 1; id: string; verifier: string; createdAt: number; expiresAt: number;
  purpose: Purpose; returnTo: string; callback: string; ticket: GoogleTicket;
  phase: 'pending' | 'exchanging';
}
export interface GoogleAttemptStore {
  read(): unknown;
  write(attempt: GoogleAttempt): void;
  clear(): void;
}
export interface GoogleCrypto {
  randomBytes(): Promise<Uint8Array>;
  sha256Base64(value: string): Promise<string>;
}
export interface GoogleBoundary {
  invalidate(): void;
  capture(): Promise<GoogleTicket>;
  commit(ticket: GoogleTicket, session: string, current: () => boolean): Promise<boolean>;
}
export interface GoogleAuthOptions {
  /** A local implementation switch is not proof of provider configuration or consent. */
  enabled: boolean;
  supabaseUrl: string; anonKey: string; callbackBase: string;
  store: GoogleAttemptStore; crypto: GoogleCrypto; boundary: GoogleBoundary;
  safeReturn(input: string): string;
  verifyUser(accessToken: string): Promise<User>;
  fetch: typeof fetch;
  now?: () => number;
}
export type GoogleResult =
  | { status: 'accepted'; returnTo: string; purpose: Purpose }
  | { status: 'cancelled' | 'unavailable' | 'invalid' | 'failed' };

const url64 = (value: string) => value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function encode(bytes: Uint8Array) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== 32) throw new Error('Secure randomness unavailable');
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  return url64(btoa(binary));
}
function callbackBase(value: string) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash ||
      !(url.protocol === 'https:' || url.protocol === 'kora:')) throw new Error('Invalid callback');
  return url;
}
function authBase(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      url.pathname !== '/' || !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname)) throw new Error('Invalid Auth origin');
  return url.origin + '/auth/v1';
}
export function isGoogleAuthCallback(value: string): boolean {
  try { return new URL(value).searchParams.has('google_flow'); } catch { return false; }
}

/** Strict decoder for per-tab state; a stale/interrupted exchange cannot be resumed or replayed. */
export function readGoogleAttempt(value: unknown, base: string, now: number): GoogleAttempt | null {
  if (!value || typeof value !== 'object') return null;
  const a = value as Partial<GoogleAttempt>;
  if (a.version !== 1 || !opaque.test(a.id ?? '') || !opaque.test(a.verifier ?? '') ||
      a.phase !== 'pending' || (a.purpose !== 'register' && a.purpose !== 'login') ||
      typeof a.createdAt !== 'number' || !Number.isFinite(a.createdAt) || a.createdAt > now ||
      typeof a.expiresAt !== 'number' || a.expiresAt !== a.createdAt + MAX_AGE || now >= a.expiresAt ||
      typeof a.returnTo !== 'string' || a.returnTo.length > 4096 || !a.ticket ||
      typeof a.ticket.stamp !== 'string' || !a.ticket.stamp || a.ticket.stamp.length > 256 || a.ticket.baseline !== null) return null;
  try {
    const expected = callbackBase(base); expected.searchParams.set('google_flow', a.id!);
    if (a.callback !== expected.toString()) return null;
    return a as GoogleAttempt;
  } catch { return null; }
}

function readCode(raw: string, a: GoogleAttempt): string | null {
  const url = new URL(raw), expected = new URL(a.callback);
  if (url.protocol !== expected.protocol || url.host !== expected.host || url.pathname !== expected.pathname ||
      url.username || url.password || url.hash || url.searchParams.get('google_flow') !== a.id) throw new Error('Unrelated callback');
  const keys = new Set(['google_flow', 'code', 'error', 'error_code', 'error_description']);
  for (const [key] of url.searchParams) if (!keys.has(key) || url.searchParams.getAll(key).length !== 1) throw new Error('Ambiguous callback');
  const code = url.searchParams.get('code');
  const failed = url.searchParams.has('error') || url.searchParams.has('error_code');
  if (failed && code) throw new Error('Ambiguous result');
  if (failed) return null;
  if (!code || code.length > 4096 || /[\u0000-\u0020\u007f]/.test(code)) throw new Error('Missing code');
  return code;
}

function freshSession(raw: unknown, user: User, now: number): Session {
  const s = raw as Partial<Session> | null;
  if (!s || typeof s.access_token !== 'string' || !s.access_token || typeof s.refresh_token !== 'string' || !s.refresh_token ||
      s.token_type !== 'bearer' || typeof s.expires_in !== 'number' || !Number.isFinite(s.expires_in) ||
      !user?.id || s.user?.id !== user.id) throw new Error('Invalid session');
  const payload = JSON.parse(atob(s.access_token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as { sub?: string; exp?: number };
  // The server verifies the token via /user. These claims only bind the verified actor and reject expiry;
  // they never authorize roles, stores, money, or access to data.
  if (payload.sub !== user.id || typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) throw new Error('Invalid actor');
  const expires = Math.min(payload.exp, s.expires_at ?? payload.exp);
  const seconds = Math.floor(now / 1000);
  if (!Number.isFinite(expires) || expires - seconds < 60) throw new Error('Expired candidate');
  // Deliberately omit provider_token/provider_refresh_token and unknown token response fields.
  return { access_token: s.access_token, refresh_token: s.refresh_token, token_type: 'bearer',
    expires_in: expires - seconds, expires_at: expires, user };
}

/** Owns the attempt, never mutates guest selections, and never calls global SDK setSession/exchange. */
export function createGoogleAuth(options: GoogleAuthOptions) {
  const o = options, now = o.now ?? Date.now;
  let epoch = 0;
  let flight: { raw: string; promise: Promise<GoogleResult> } | null = null;
  const current = (a: GoogleAttempt, run: number) => epoch === run && now() < a.expiresAt;
  const forget = (id?: string) => {
    const stored = o.store.read() as Partial<GoogleAttempt> | null;
    if (!id || stored?.id === id) o.store.clear();
  };
  const cancel = () => { epoch++; o.boundary.invalidate(); forget(); flight = null; };
  return {
    cancel,
    async begin(purpose: Purpose, returnTo: string): Promise<{ url: string; callback: string }> {
      if (!o.enabled) throw new Error('Google is not activated');
      cancel(); const run = epoch;
      const ticket = await o.boundary.capture();
      if (run !== epoch || ticket.baseline !== null) throw new Error('Session changed');
      const verifier = encode(await o.crypto.randomBytes());
      const challenge = url64(await o.crypto.sha256Base64(verifier));
      const id = encode(await o.crypto.randomBytes());
      if (run !== epoch || !opaque.test(challenge)) throw new Error('Invalid S256 attempt');
      const cb = callbackBase(o.callbackBase); cb.searchParams.set('google_flow', id);
      const created = now();
      const a: GoogleAttempt = { version: 1, id, verifier, createdAt: created, expiresAt: created + MAX_AGE,
        purpose, returnTo: o.safeReturn(returnTo), callback: cb.toString(), ticket, phase: 'pending' };
      const url = new URL(authBase(o.supabaseUrl) + '/authorize');
      url.searchParams.set('provider', 'google'); url.searchParams.set('redirect_to', a.callback);
      url.searchParams.set('code_challenge', challenge); url.searchParams.set('code_challenge_method', 's256');
      // Supabase owns provider state and basic Google scopes. No offline request or extra Google APIs.
      o.store.write(a);
      return { url: url.toString(), callback: a.callback };
    },
    complete(raw: string): Promise<GoogleResult> {
      if (!o.enabled) return Promise.resolve({ status: 'unavailable' });
      // React StrictMode/double delivery share one exchange; another callback cannot steal that flight.
      if (flight) return flight.raw === raw ? flight.promise : Promise.resolve({ status: 'invalid' });
      const a = readGoogleAttempt(o.store.read(), o.callbackBase, now());
      if (!a) { forget(); return Promise.resolve({ status: 'invalid' }); }
      let code: string | null;
      try { code = readCode(raw, a); } catch { return Promise.resolve({ status: 'invalid' }); }
      if (!code) { cancel(); return Promise.resolve({ status: 'cancelled' }); }
      const run = epoch;
      // Persist consumption before sending the one-use code. Interrupted/uncertain exchanges require retry.
      o.store.write({ ...a, phase: 'exchanging' });
      const promise = (async (): Promise<GoogleResult> => {
        try {
          const response = await o.fetch(authBase(o.supabaseUrl) + '/token?grant_type=pkce', {
            method: 'POST', redirect: 'error', cache: 'no-store', credentials: 'omit',
            headers: { apikey: o.anonKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ auth_code: code, code_verifier: a.verifier }),
          });
          if (!current(a, run)) return { status: 'cancelled' };
          if (!response.ok) throw new Error('Exchange failed');
          const data: unknown = await response.json();
          if (!current(a, run)) return { status: 'cancelled' };
          const token = (data as Partial<Session> | null)?.access_token;
          if (typeof token !== 'string' || !token) throw new Error('Missing token');
          const user = await o.verifyUser(token);
          if (!current(a, run)) return { status: 'cancelled' };
          const session = freshSession(data, user, now());
          const accepted = await o.boundary.commit(a.ticket, JSON.stringify(session), () => current(a, run));
          if (!accepted || !current(a, run)) return { status: 'cancelled' };
          return { status: 'accepted', returnTo: o.safeReturn(a.returnTo), purpose: a.purpose };
        } catch { return { status: current(a, run) ? 'failed' : 'cancelled' }; }
        finally { forget(a.id); }
      })();
      flight = { raw, promise }; return promise;
    },
  };
}
