'use client';
import { createApi, createKoraClient, publicImageUrl, run, type Api, type KoraClient } from '@kora/api';
import { env } from './env';

// One browser client per tab. The panel only ever holds the public anon key and the signed-in user's
// session: what each person can read or change is decided by RLS and the database functions.
let client: KoraClient | null = null;
let api: Api | null = null;

export function kora(): { client: KoraClient; api: Api } {
  if (typeof window === 'undefined') throw new Error('kora() is browser-only');
  if (!client) {
    // react-query (lib/providers) retries transport failures; supabase-js retrying underneath would stack
    client = createKoraClient({ url: env.supabaseUrl, anonKey: env.supabaseAnonKey, storage: window.localStorage, detectSessionInUrl: true, retryReads: false });
    api = createApi(client);
  }
  return { client, api: api! };
}

/** Table access with typed rows; errors become ApiError with Spanish copy. */
export function db(table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table names are dynamic here; RLS and the generated types guard the shapes
  return (kora().client.from as unknown as (t: string) => any)(table);
}

export function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  return run<T>((kora().client.rpc as unknown as (f: string, a?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>)(fn, args));
}

export { run };

export const catalogImage = (path: string | null | undefined) => publicImageUrl(env.supabaseUrl, 'catalog', path);
export const storeImage = (path: string | null | undefined) => publicImageUrl(env.supabaseUrl, 'stores', path);

/** Calls one of the panel's own route handlers as the signed-in user. Errors carry the handler's Spanish message. */
export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const { data } = await kora().client.auth.getSession();
  const res = await fetch(path, {
    method: 'POST',
    headers: { authorization: `Bearer ${data.session?.access_token ?? ''}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new Error(json?.error && !['auth_required', 'admin_required'].includes(json.error) ? json.error : res.status === 403 ? 'Requiere permisos de administración.' : res.status === 401 ? 'Tu sesión expiró. Vuelve a iniciar sesión.' : `Error ${res.status}`);
  return json as T;
}
