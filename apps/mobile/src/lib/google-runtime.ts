import 'react-native-url-polyfill/auto';
import { createGoogleAuthRuntime, type GoogleResult } from '@kora/api';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { env } from './env';
import { sessionStorage } from './session-storage';
import { safeAuthReturn } from './auth-navigation';
import {
  GOOGLE_CALLBACK, browser, createMemoryAttemptRepository, randomBytes, sha256Base64,
} from './google-auth-ports';

const unavailableStorage = {
  getItem: async () => null,
  setItem: async () => { throw new Error('Session storage unavailable'); },
  removeItem: async () => { throw new Error('Session storage unavailable'); },
};

export const googleRuntime = createGoogleAuthRuntime({
  enabled: Platform.OS === 'android' || Platform.OS === 'ios',
  url: env.supabaseUrl || 'https://not-configured.invalid',
  anonKey: env.supabaseAnonKey || 'missing-anon-key',
  storage: sessionStorage ?? unavailableStorage,
  callbackBase: GOOGLE_CALLBACK,
  attemptStore: createMemoryAttemptRepository(),
  crypto: { randomBytes, sha256Base64 },
  newIntentId: () => Crypto.randomUUID(),
  safeReturn: value => safeAuthReturn(value) ?? '/account',
});

let browserRun = 0;
export function cancelGoogleAccess() {
  browserRun++;
  googleRuntime.google.cancel();
}

export async function startGoogleAccess(purpose: 'register' | 'login', returnTo: string): Promise<GoogleResult> {
  const run = ++browserRun;
  const opened = await googleRuntime.google.begin(purpose, returnTo);
  if (run !== browserRun) return { status: 'cancelled' };
  try {
    // Expo's Android matcher uses startsWith. The Auth server may reorder query parameters.
    // Match the base here. complete() then checks the exact URI, nonce, expiry and PKCE proof.
    const result = await browser.open(opened.url, GOOGLE_CALLBACK);
    if (run !== browserRun) return { status: 'cancelled' };
    if (result.type === 'success') return await googleRuntime.google.complete(result.url);
    cancelGoogleAccess();
    return { status: 'cancelled' };
  } catch {
    if (run !== browserRun) return { status: 'cancelled' };
    cancelGoogleAccess();
    return { status: 'failed' };
  }
}
