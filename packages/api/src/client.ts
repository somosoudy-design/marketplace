import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type KoraClient = SupabaseClient<Database>;

export interface ClientOptions {
  url: string;
  /** Public anon key. Never pass the service role key to an app or browser bundle. */
  anonKey: string;
  storage?: SupportedStorage;
  /** React Native needs detectSessionInUrl=false; the web admin keeps the default. */
  detectSessionInUrl?: boolean;
  fetch?: typeof fetch;
}

export function createKoraClient(opts: ClientOptions): KoraClient {
  if (/service_role/.test(decodeRole(opts.anonKey))) {
    throw new Error('Refusing to create a client with a service role key. Use the anon key.');
  }
  return createClient<Database>(opts.url, opts.anonKey, {
    auth: {
      storage: opts.storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: opts.detectSessionInUrl ?? false,
    },
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
