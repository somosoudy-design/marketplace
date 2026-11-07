// Prepared ports. No screen imports these while Google activation is pending.
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { GOOGLE_AUTH_ACTIVATED, type GoogleAttempt, type GoogleAttemptStore } from '@kora/api';

/** Production remains disabled until provider/policy/redirects are separately approved. */
export const GOOGLE_ACCESS_ENABLED = GOOGLE_AUTH_ACTIVATED;
export const GOOGLE_CALLBACK = 'kora://auth-callback' as const;
export const GOOGLE_FLOW_PARAMETER = 'google_flow' as const;

export type BrowserResult = { type: 'success'; url: string } | { type: 'cancel' };

/** Exactly 32 CSPRNG bytes; no Math.random/debugger fallback. */
export async function randomBytes(): Promise<Uint8Array> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== 32) throw new Error('Secure random unavailable');
  return bytes;
}

export async function sha256Base64(value: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  if (!/^[A-Za-z0-9+/]{43}=$/.test(digest)) throw new Error('Invalid SHA-256 result');
  return digest;
}

/** Callback validation/exchange belongs to the engine, never to a second Linking listener here. */
export function mapBrowserResult(result: { type: string; url?: string }): BrowserResult {
  switch (result.type) {
    case 'success':
      if (!result.url) throw new Error('Missing browser callback');
      return { type: 'success', url: result.url };
    case 'cancel':
    case 'dismiss':
      return { type: 'cancel' };
    default:
      // An unexpected native result is a failure, never successful authentication.
      throw new Error('Unexpected browser outcome');
  }
}

export const browser = {
  async open(url: string, callback: string): Promise<BrowserResult> {
    return mapBrowserResult(await WebBrowser.openAuthSessionAsync(url, callback));
  },
};

/** Native attempts are process memory only. No AsyncStorage/SecureStore/URL material recovery. */
export function createMemoryAttemptRepository(): GoogleAttemptStore {
  let attempt: GoogleAttempt | null = null;
  return {
    read: (): GoogleAttempt | null => attempt,
    write: (value: GoogleAttempt): void => { attempt = value; },
    clear: (): void => { attempt = null; },
  };
}

// Deliberately no dismissAuthSession wrapper: Android Custom Tabs may need manual close.
// Engine cancellation invalidates the in-memory attempt and ignores its later callback.
// Gate is evaluated by the engine before these ports are invoked; no effect runs on import.
