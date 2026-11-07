import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type KoraClient = SupabaseClient<Database>;

export interface ClientOptions {
  url: string;
  /** Public anon key. Never pass the service role key to an app or browser bundle. */
  anonKey: string;
  storage?: SupportedStorage;
  /** React Native needs detectSessionInUrl=false; the web admin keeps the default. */
  detectSessionInUrl?: boolean | ((url: URL, params: { [parameter: string]: string }) => boolean);
  fetch?: typeof fetch;
  /**
   * Let supabase-js retry failed reads on its own (1 s, 2 s, 4 s). Off when the caller already retries, like
   * the app's query client: stacked retries made a dead connection take about a minute to surface.
   */
  retryReads?: boolean;
  /** Capture one user's token for an operation. Never persists or refreshes another session. */
  accessToken?: string;
}

export function createKoraClient(opts: ClientOptions): KoraClient {
  if (/service_role/.test(decodeRole(opts.anonKey))) {
    throw new Error('Refusing to create a client with a service role key. Use the anon key.');
  }
  const accessToken = opts.accessToken;
  return createClient<Database>(opts.url, opts.anonKey, {
    ...(accessToken ? { accessToken: async () => accessToken } : {}),
    auth: {
      storage: opts.storage,
      autoRefreshToken: !opts.accessToken,
      persistSession: !opts.accessToken,
      detectSessionInUrl: opts.detectSessionInUrl ?? false,
    },
    db: { retry: opts.retryReads ?? true },
    global: opts.fetch ? { fetch: opts.fetch } : undefined,
  });
}

function decodeRole(jwt: string): string {
  try {
    const payload = jwt.split('.')[1] ?? '';
    const json = typeof atob === 'function' ? atob(payload.replace(/-/g, '+').replace(/_/g, '/')) : '';
    return (JSON.parse(json) as { role?: string }).role ?? '';
  } catch {
    return '';
  }
}

/** Public URL for images in the public buckets (catalog, stores). */
export function publicImageUrl(baseUrl: string, bucket: 'catalog' | 'stores', path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${baseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
}
