import type { Session, User } from '@supabase/supabase-js';

/** Client support. Each sign-in screen also checks the project's enabled Auth providers. */
export const GOOGLE_AUTH_ACTIVATED = true;
const MAX_AGE = 10 * 60_000;
const EXCHANGE_TIMEOUT = 30_000;
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
  invalidate(expected?: GoogleTicket): void;
  isCurrent(ticket: GoogleTicket): boolean;
  capture(): Promise<GoogleTicket>;
  commit(ticket: GoogleTicket, session: string, current: () => boolean): Promise<boolean>;
}
export interface GoogleAuthOptions {
  /** A local implementation switch is not proof of provider configuration or consent. */
  enabled: boolean;
  supabaseUrl: string; anonKey: string; callbackBase: string;
  store: GoogleAttemptStore; crypto: GoogleCrypto; boundary: GoogleBoundary;
  safeReturn(input: string): string;
  verifyUser(accessToken: string, signal?: AbortSignal): Promise<User>;
  fetch: typeof fetch;
  /** Shared one-use claim, before a copied tab can submit the same grant. */
  claimAttempt?: (attempt: GoogleAttempt) => Promise<boolean>;
  now?: () => number;
}
export type GoogleResult =
  | { status: 'accepted'; returnTo: string; purpose: Purpose; actorId: string; attemptId: string; intentStamp: string }
  | { status: 'cancelled' | 'unavailable' | 'invalid' | 'failed' | 'uncertain' };

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
/** Availability belongs to the Auth project and can change independently of an app release. */
export async function googleProviderEnabled(url: string, anonKey: string, signal?: AbortSignal): Promise<boolean> {
  const response = await fetch(authBase(url) + '/settings', {
    headers: { apikey: anonKey },
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'error',
    signal,
  });
  if (!response.ok) throw new Error('No pudimos comprobar el acceso con Google.');
  const settings = await response.json();
  return settings.external?.google === true;
}

export function isGoogleAuthCallback(value: string): boolean {
  try {
    const url = new URL(value);
    return url.searchParams.has('google_flow') || new URLSearchParams(url.hash.slice(1)).has('google_flow');
  } catch { return false; }
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

function readCode(raw: string, a: GoogleAttempt): { code: string } | { failure: 'cancelled' | 'failed' } {
  if (raw.length > 16_384) throw new Error('Invalid callback');
  const url = new URL(raw), expected = new URL(a.callback);
  if (url.protocol !== expected.protocol || url.host !== expected.host || url.pathname !== expected.pathname ||
      url.username || url.password || url.searchParams.get('google_flow') !== a.id) throw new Error('Unrelated callback');
  const keys = new Set(['google_flow', 'code', 'error', 'error_code', 'error_description']);
  for (const [key] of url.searchParams) if (!keys.has(key) || url.searchParams.getAll(key).length !== 1) throw new Error('Ambiguous callback');
  const code = url.searchParams.get('code');
  const failed = url.searchParams.has('error') || url.searchParams.has('error_code') || url.searchParams.has('error_description');
  // GoTrue copies its OAuth error fields into the fragment. Only accept that exact mirror.
  if (url.hash) {
    const mirror = new URLSearchParams(url.hash.slice(1));
    if (!failed || !mirror.size) throw new Error('Unexpected fragment');
    for (const [key, value] of mirror) {
      if (!['error', 'error_code', 'error_description'].includes(key) || mirror.getAll(key).length !== 1 ||
          value !== url.searchParams.get(key)) throw new Error('Ambiguous fragment');
    }
  }
  if (failed && url.searchParams.has('code')) throw new Error('Ambiguous result');
  if (failed) {
    const refused = url.searchParams.get('error') === 'access_denied' && !url.searchParams.get('error_code');
    return { failure: refused ? 'cancelled' : 'failed' };
  }
  if (!code || code.length > 4096 || /[\u0000-\u0020\u007f]/.test(code)) throw new Error('Missing code');
  return { code };
}

function freshSession(raw: unknown, user: User, now: number, issuer: string): Session {
  const s = raw as Partial<Session> | null;
  if (!s || typeof s.access_token !== 'string' || !s.access_token || typeof s.refresh_token !== 'string' || !s.refresh_token ||
      s.token_type !== 'bearer' || typeof s.expires_in !== 'number' || !Number.isFinite(s.expires_in) ||
      (s.expires_at !== undefined && (typeof s.expires_at !== 'number' || !Number.isFinite(s.expires_at))) ||
      !user?.id || s.user?.id !== user.id) throw new Error('Invalid session');
  const payload = JSON.parse(atob(s.access_token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as { sub?: string; exp?: number; iss?: string };
  // The server verifies the token via /user. These claims only bind the verified actor and reject expiry;
  // they never authorize roles, stores, money, or access to data.
  if (payload.sub !== user.id || payload.iss !== issuer || typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) throw new Error('Invalid actor');
  const expires = Math.min(payload.exp, s.expires_at ?? payload.exp);
  const seconds = Math.floor(now / 1000);
  if (!Number.isFinite(expires) || expires - seconds < 60) throw new Error('Expired candidate');
  // Deliberately omit provider_token/provider_refresh_token and unknown token response fields.
  return { access_token: s.access_token, refresh_token: s.refresh_token, token_type: 'bearer',
    expires_in: expires - seconds, expires_at: expires, user };
}

/** Public Auth /user validation, independent of the global SDK and its persistence/events. */
export function createGoogleUserVerifier(supabaseUrl: string, anonKey: string, request: typeof fetch) {
  const endpoint = authBase(supabaseUrl) + '/user';
  return async (accessToken: string, signal?: AbortSignal): Promise<User> => {
    const response = await request(endpoint, { method: 'GET', redirect: 'error', cache: 'no-store', credentials: 'omit', signal,
      headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error('User verification failed');
    const user: unknown = await response.json();
    if (!user || typeof user !== 'object' || typeof (user as User).id !== 'string' || !(user as User).id) throw new Error('Invalid verified user');
    return user as User;
  };
}

/** Owns the attempt, never mutates guest selections, and never calls global SDK setSession/exchange. */
export function createGoogleAuth(options: GoogleAuthOptions) {
  const o = options, now = o.now ?? Date.now;
  let epoch = 0;
  let invalidationFailed = false;
  let flight: { raw: string; promise: Promise<GoogleResult>; abort(): void } | null = null;
  let ownedTicket: GoogleTicket | null = null;
  const current = (a: GoogleAttempt, run: number) => epoch === run && now() < a.expiresAt && o.boundary.isCurrent(a.ticket);
  const forget = (id?: string) => {
    try {
      const stored = o.store.read() as Partial<GoogleAttempt> | null;
      if (!id || stored?.id === id) o.store.clear();
    } catch {
      // A blocked store must not undo invalidation or turn an already committed session into a retry.
      // A surviving exchanging attempt remains one-use and fails closed on the next callback.
    }
  };
  const cancel = (force = false) => {
    epoch++; flight?.abort(); flight = null;
    try {
      // Cancelling an obsolete tab must not revoke a newer tab's unrelated intent.
      if (force) o.boundary.invalidate();
      else {
        const pending = o.store.read() as Partial<GoogleAttempt> | null;
        const ticket = pending?.ticket ?? ownedTicket;
        if (ticket && o.boundary.isCurrent(ticket)) o.boundary.invalidate(ticket);
      }
    }
    catch { invalidationFailed = true; }
    finally { forget(); }
  };
  return {
    returnDestination(raw: string): string | null {
      try {
        const attempt = readGoogleAttempt(o.store.read(), o.callbackBase, now());
        if (!attempt) return null;
        readCode(raw, attempt);
        return o.safeReturn(attempt.returnTo);
      } catch { return null; }
    },
    cancel: () => cancel(),
    invalidatePrimary: () => cancel(true),
    async begin(purpose: Purpose, returnTo: string): Promise<{ url: string; callback: string }> {
      if (!o.enabled) throw new Error('Google is not activated');
      if (invalidationFailed) throw new Error('Google attempt invalidation unavailable');
      cancel(true); const run = epoch;
      if (invalidationFailed) throw new Error('Google attempt invalidation unavailable');
      const ticket = await o.boundary.capture();
      ownedTicket = ticket;
      if (run !== epoch || ticket.baseline !== null) throw new Error('Session changed');
      const verifier = encode(await o.crypto.randomBytes());
      const challenge = url64(await o.crypto.sha256Base64(verifier));
      const id = encode(await o.crypto.randomBytes());
      if (run !== epoch || !o.boundary.isCurrent(ticket) || !opaque.test(challenge)) throw new Error('Invalid S256 attempt');
      const cb = callbackBase(o.callbackBase); cb.searchParams.set('google_flow', id);
      const created = now();
      const a: GoogleAttempt = { version: 1, id, verifier, createdAt: created, expiresAt: created + MAX_AGE,
        purpose, returnTo: o.safeReturn(returnTo), callback: cb.toString(), ticket, phase: 'pending' };
      const url = new URL(authBase(o.supabaseUrl) + '/authorize');
      url.searchParams.set('provider', 'google'); url.searchParams.set('redirect_to', a.callback);
      url.searchParams.set('code_challenge', challenge); url.searchParams.set('code_challenge_method', 's256');
      url.searchParams.set('scopes', 'openid email profile');
      // Supabase owns provider state and basic Google scopes. No offline request or extra Google APIs.
      o.store.write(a);
      return { url: url.toString(), callback: a.callback };
    },
    complete(raw: string): Promise<GoogleResult> {
      if (!o.enabled) return Promise.resolve({ status: 'unavailable' });
      if (invalidationFailed) return Promise.resolve({ status: 'failed' });
      // React StrictMode/double delivery share one exchange; another callback cannot steal that flight.
      if (flight) return flight.raw === raw ? flight.promise : Promise.resolve({ status: 'invalid' });
      let a: GoogleAttempt | null;
      try { a = readGoogleAttempt(o.store.read(), o.callbackBase, now()); }
      catch { return Promise.resolve({ status: 'failed' }); }
      if (!a) { forget(); return Promise.resolve({ status: 'invalid' }); }
      if (!o.boundary.isCurrent(a.ticket)) { forget(a.id); return Promise.resolve({ status: 'cancelled' }); }
      let returned: ReturnType<typeof readCode>;
      try { returned = readCode(raw, a); } catch { return Promise.resolve({ status: 'invalid' }); }
      if ('failure' in returned) { cancel(); return Promise.resolve({ status: returned.failure }); }
      const { code } = returned;
      ownedTicket = a.ticket; // A callback after a full-page redirect belongs to this restored controller too.
      const run = epoch;
      // Persist consumption before sending the one-use code. Interrupted/uncertain exchanges require retry.
      try { o.store.write({ ...a, phase: 'exchanging' }); }
      catch { cancel(); return Promise.resolve({ status: 'failed' }); }
      // Bound network/response parsing even if a transport ignores AbortSignal. The one-use code
      // stays consumed; a timeout never retries it or leaves a late response able to promote a session.
      const controller = new AbortController();
      let abort!: () => void;
      const stopped = new Promise<never>((_, reject) => {
        abort = () => { controller.abort(); reject(new Error('Google exchange interrupted')); };
      });
      const timer = setTimeout(abort, Math.max(0, Math.min(EXCHANGE_TIMEOUT, a.expiresAt - now())));
      const network = <T>(work: () => Promise<T>): Promise<T> => Promise.race([
        Promise.resolve().then(() => {
          if (controller.signal.aborted) throw new Error('Google exchange interrupted');
          return work();
        }), stopped,
      ]);
      const promise = (async (): Promise<GoogleResult> => {
        try {
          if (o.claimAttempt && !await network(() => o.claimAttempt!(a))) return { status: 'invalid' };
          if (!current(a, run)) return { status: 'cancelled' };
          const response = await network(() => o.fetch(authBase(o.supabaseUrl) + '/token?grant_type=pkce', {
            method: 'POST', redirect: 'error', cache: 'no-store', credentials: 'omit', signal: controller.signal,
            headers: { apikey: o.anonKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ auth_code: code, code_verifier: a.verifier }),
          }));
          if (!current(a, run)) return { status: 'cancelled' };
          if (!response.ok) throw new Error('Exchange failed');
          const data: unknown = await network(() => response.json());
          if (!current(a, run)) return { status: 'cancelled' };
          const token = (data as Partial<Session> | null)?.access_token;
          if (typeof token !== 'string' || !token) throw new Error('Missing token');
          const user = await network(() => o.verifyUser(token, controller.signal));
          if (!current(a, run)) return { status: 'cancelled' };
          const session = freshSession(data, user, now(), authBase(o.supabaseUrl));
          // Do not race durable commit against a timer: its own boundary reports uncertain outcomes.
          clearTimeout(timer);
          const candidateCurrent = () => !controller.signal.aborted && current(a, run) && session.expires_at! - Math.floor(now() / 1000) >= 60;
          const accepted = await o.boundary.commit(a.ticket, JSON.stringify(session), candidateCurrent);
          // commit=true is the acceptance point. A later cancellation cannot undo a committed login.
          // The caller separately rechecks actor ownership before navigating.
          if (!accepted) return { status: 'cancelled' };
          return { status: 'accepted', returnTo: o.safeReturn(a.returnTo), purpose: a.purpose, actorId: user.id, attemptId: a.id, intentStamp: a.ticket.stamp };
        } catch (error) {
          if ((error as { code?: string } | null)?.code === 'commit_uncertain') return { status: 'uncertain' };
          return { status: current(a, run) ? 'failed' : 'cancelled' };
        }
        finally { clearTimeout(timer); forget(a.id); }
      })();
      flight = { raw, promise, abort };
      void promise.then(() => { if (flight?.promise === promise) flight = null; });
      return promise;
    },
  };
}
