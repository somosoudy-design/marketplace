import 'react-native-url-polyfill/auto';
import { createApi, createKoraClient, isGoogleAuthCallback, publicImageUrl } from '@kora/api';
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
  // Reserved Google callbacks must be consumed only by the reviewed attempt controller.
  // Email link handling retains the existing SDK behavior on web.
  detectSessionInUrl: Platform.OS === 'web' ? url => !isGoogleAuthCallback(url.toString()) : false,
  // the query client (lib/query) owns retries and knows which errors are worth repeating
  retryReads: false,
});

export const api = createApi(supabase);

/** Keep in-flight operations on their original actor even if the global session changes. */
export async function apiForActor(actorId: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== actorId) throw new Error('Tu sesión cambió. Vuelve a abrir esta pantalla.');
  const token = data.session.access_token;
  const client = createKoraClient({ url: env.supabaseUrl, anonKey: env.supabaseAnonKey, accessToken: token, retryReads: false });
  const assertCurrent = async () => {
    const next = await supabase.auth.getSession();
    if (next.error || next.data.session?.user.id !== actorId) throw new Error('Tu sesión cambió. Vuelve a abrir esta pantalla.');
  };
  return { api: createApi(client), client, assertCurrent };
}

// Refresh tokens only while the app is in the foreground (recommended for React Native).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export const catalogImage = (path: string | null | undefined) => publicImageUrl(env.supabaseUrl, 'catalog', path);
export const storeImage = (path: string | null | undefined) => publicImageUrl(env.supabaseUrl, 'stores', path);
