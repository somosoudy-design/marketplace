// Prepared ports. No effects on import or server-side window/storage access.
import { GOOGLE_AUTH_ACTIVATED, type GoogleAttempt, type GoogleAttemptStore } from '@kora/api';
export const GOOGLE_ACCESS_ENABLED = GOOGLE_AUTH_ACTIVATED;
export const GOOGLE_CALLBACK_PATH = '/auth/callback' as const;
export const GOOGLE_FLOW_PARAMETER = 'google_flow' as const;
export const GOOGLE_ATTEMPT_STORAGE_KEY = 'mayami.google-pkce-attempt.v1' as const;
const MAX_ATTEMPT_CHARACTERS = 16_384;

type CryptoPort = {
  getRandomValues: (array: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;
  subtle: { digest: (algorithm: string, bytes: Uint8Array<ArrayBuffer>) => Promise<ArrayBuffer> };
};
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type LocationPort = Pick<Location, 'assign'>;

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function createWebCryptoPorts(crypto: CryptoPort) {
  return {
    async randomBytes(): Promise<Uint8Array> {
      const bytes = new Uint8Array(32);
      // Missing/insecure-context WebCrypto throws. There is no plain-PKCE or Math.random path.
      crypto.getRandomValues(bytes);
      return bytes;
    },
    async sha256Base64(value: string): Promise<string> {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
      if (digest.byteLength !== 32) throw new Error('Invalid SHA-256 result');
      return encodeBase64(new Uint8Array(digest));
    },
  };
}

export async function randomBytes(): Promise<Uint8Array> {
  return createWebCryptoPorts(globalThis.crypto).randomBytes();
}
export async function sha256Base64(value: string): Promise<string> {
  return createWebCryptoPorts(globalThis.crypto).sha256Base64(value);
}

/** The engine supplies its strict payload schema: unknown keys/types/versions must be rejected. */
export interface AttemptCodec<T> {
  encode: (value: T) => unknown;
  decode: (value: unknown) => T | null;
  /** Correlation nonce google_flow; never an email or account/user identifier. */
  flow: (value: T) => string;
}

/** Structural decoder, deliberately NOT readGoogleAttempt's pending/freshness acceptance gate. */
export function googleAttemptCodec(callbackBase: string): AttemptCodec<GoogleAttempt> {
  const keys = ['version', 'id', 'verifier', 'createdAt', 'expiresAt', 'purpose', 'returnTo', 'callback', 'ticket', 'phase'];
  const opaque = /^[A-Za-z0-9_-]{43}$/;
  const decode = (raw: unknown): GoogleAttempt | null => {
    if (!object(raw) || Object.keys(raw).length !== keys.length || keys.some(key => !Object.hasOwn(raw, key))) return null;
    if (raw.version !== 1 || typeof raw.id !== 'string' || !opaque.test(raw.id) || typeof raw.verifier !== 'string' || !opaque.test(raw.verifier) ||
        typeof raw.createdAt !== 'number' || !Number.isFinite(raw.createdAt) || typeof raw.expiresAt !== 'number' || raw.expiresAt !== raw.createdAt + 600_000 ||
        (raw.purpose !== 'register' && raw.purpose !== 'login') || typeof raw.returnTo !== 'string' || raw.returnTo.length > 4096 ||
        (raw.phase !== 'pending' && raw.phase !== 'exchanging') || !object(raw.ticket) || Object.keys(raw.ticket).length !== 2 ||
        !Object.hasOwn(raw.ticket, 'stamp') || !Object.hasOwn(raw.ticket, 'baseline') || typeof raw.ticket.stamp !== 'string' || !raw.ticket.stamp || raw.ticket.stamp.length > 256 || raw.ticket.baseline !== null) return null;
    try {
      const callback = new URL(callbackBase);
      if (callback.username || callback.password || callback.search || callback.hash || callback.protocol !== 'https:' || callback.pathname !== GOOGLE_CALLBACK_PATH) return null;
      callback.searchParams.set(GOOGLE_FLOW_PARAMETER, raw.id);
      if (raw.callback !== callback.toString()) return null;
    } catch { return null; }
    return raw as unknown as GoogleAttempt;
  };
  return { decode, encode: value => value, flow: value => value.id };
}

export class GoogleAttemptStorageError extends Error {
  constructor(readonly reason: 'invalid' | 'unavailable' | 'conflict') {
    super(`Google attempt storage ${reason}`);
    this.name = 'GoogleAttemptStorageError';
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** sessionStorage belongs to one tab. Invalid bytes are preserved, not silently replaced/cleared. */
export function createWebAttemptRepository(storage: StoragePort, codec: AttemptCodec<GoogleAttempt>): GoogleAttemptStore {
  const get = (): string | null => {
    try { return storage.getItem(GOOGLE_ATTEMPT_STORAGE_KEY); }
    catch { throw new GoogleAttemptStorageError('unavailable'); }
  };
  const parse = (raw: string): GoogleAttempt => {
    try {
      if (raw.length > MAX_ATTEMPT_CHARACTERS) throw new Error();
      const envelope: unknown = JSON.parse(raw);
      if (!object(envelope) || Object.keys(envelope).length !== 3 || envelope.version !== 1 || envelope.provider !== 'google' || !Object.hasOwn(envelope, 'payload')) throw new Error();
      const value = codec.decode(envelope.payload);
      if (value === null || !/^[A-Za-z0-9_-]{16,128}$/.test(codec.flow(value))) throw new Error();
      return value;
    } catch { throw new GoogleAttemptStorageError('invalid'); }
  };
  return {
    read(): GoogleAttempt | null { const raw = get(); return raw === null ? null : parse(raw); },
    write(value: GoogleAttempt): void {
      let raw: string;
      try {
        raw = JSON.stringify({ version: 1, provider: 'google', payload: codec.encode(value) });
        parse(raw); // A codec must accept exactly the value it serializes, before any write.
      } catch { throw new GoogleAttemptStorageError('invalid'); }
      const previous = get();
      if (previous !== null) parse(previous); // Do not overwrite malformed previous state.
      try { storage.setItem(GOOGLE_ATTEMPT_STORAGE_KEY, raw); }
      catch { throw new GoogleAttemptStorageError('unavailable'); }
    },
    clear(): void {
      const raw = get();
      if (raw === null) return;
      parse(raw);
      // Synchronous same-tab compare before remove; stale A callback cannot remove pending B.
      // Engine forget(id) first checks the ID synchronously before invoking clear().
      if (get() !== raw) throw new GoogleAttemptStorageError('conflict');
      try { storage.removeItem(GOOGLE_ATTEMPT_STORAGE_KEY); }
      catch { throw new GoogleAttemptStorageError('unavailable'); }
    },
  };
}

/** Only the engine calls this, strictly AFTER repository.save succeeds. Never persists implicitly. */
export function createWebRedirect(location: LocationPort) {
  return (url: string): void => { location.assign(url); };
}

// Engine constructs existing same-origin /auth/callback?google_flow=<nonce>.
// Google/Supabase provider state is not overwritten; provider configuration remains untouched.
