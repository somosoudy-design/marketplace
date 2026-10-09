import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createApi, createKoraClient, publicImageUrl } from '@kora/api';
import { AppState, Platform } from 'react-native';
import { env } from './env';

// Session tokens live in AsyncStorage (the Supabase-recommended storage for Expo). Only the public anon key ships
// in the app; every permission is enforced by Row Level Security and database functions.
export const supabase = createKoraClient({
  url: env.supabaseUrl || 'http://127.0.0.1:54321',
  anonKey: env.supabaseAnonKey || 'missing-anon-key',
  storage: Platform.OS === 'web' && typeof window === 'undefined' ? undefined : AsyncStorage,
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
