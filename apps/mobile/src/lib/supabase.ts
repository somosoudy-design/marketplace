import 'react-native-url-polyfill/auto';
import { createApi, createKoraClient, publicImageUrl } from '@kora/api';
import { AppState, Platform } from 'react-native';
import { env } from './env';
import { sessionStorage } from './session-storage';

// Session tokens are sealed with a key from the device keystore (lib/session-storage). Only the public anon key
// ships in the app; every permission is enforced by Row Level Security and database functions.
export const supabase = createKoraClient({
  // without configuration the app shows ConfigMissing; the placeholder only keeps the client constructible
  url: env.supabaseUrl || 'https://not-configured.invalid',
  anonKey: env.supabaseAnonKey || 'missing-anon-key',
  storage: sessionStorage,
  detectSessionInUrl: Platform.OS === 'web',
  // the query client (lib/query) owns retries and knows which errors are worth repeating
  retryReads: false,
});

export const api = createApi(supabase);

// Refresh tokens only while the app is in the foreground (recommended for React Native).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export const catalogImage = (path: string | null | undefined) => publicImageUrl(env.supabaseUrl, 'catalog', path);
export const storeImage = (path: string | null | undefined) => publicImageUrl(env.supabaseUrl, 'stores', path);
