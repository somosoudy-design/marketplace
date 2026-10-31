import { createClient } from '@supabase/supabase-js';
import { createApi, type Database } from '@kora/api';
import { env, configured } from './env';
/** New anonymous client per server read. No browser credentials or private response cache. */
export function publicApi() {
  if (!configured) throw new Error('Falta configurar la conexión del sitio.');
  return createApi(
    createClient<Database>(env.url, env.anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    }),
  );
}
