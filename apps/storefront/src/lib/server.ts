import { createApi, createKoraClient } from '@kora/api';
import { env, configured } from './env';
/** New anonymous client per server read. No browser credentials or private response cache. */
export function publicApi() {
  if (!configured) throw new Error('Falta configurar la conexión del sitio.');
  return createApi(
    createKoraClient({
      url: env.url,
      anonKey: env.anon,
      detectSessionInUrl: false,
      retryReads: false,
      storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    }),
  );
}
