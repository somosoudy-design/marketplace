import type { Env } from './env.ts';

/** Error raised by PostgREST: `hint` carries the code our SQL functions raise (see packages/core/src/errors.ts). */
export class RestError extends Error {
  constructor(public status: number, public code: string | null, public hint: string | null, message: string) {
    super(message);
  }
}

export interface Rest {
  /** Calls a SQL function. `as` = a user's JWT to act as that user (RLS applies); default is the service role. */
  rpc<T>(fn: string, args: Record<string, unknown>, opts?: { as?: string }): Promise<T>;
  get<T>(path: string, opts?: { as?: string }): Promise<T>;
}

const isJwt = (k: string) => k.split('.').length === 3;

/** Minimal PostgREST client over fetch: no npm dependency, so cold starts stay fast. */
export function rest(env: Env): Rest {
  const url = env('SUPABASE_URL');
  const service = env('SUPABASE_SERVICE_ROLE_KEY');
  const anon = env('SUPABASE_ANON_KEY');
  if (!url || !service) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');

  const headers = (as?: string): Record<string, string> => {
    if (as) return { apikey: anon ?? service, authorization: `Bearer ${as}` };
    // New-style secret keys (sb_secret_…) go only in `apikey`; legacy JWT keys also as the bearer.
    return isJwt(service) ? { apikey: service, authorization: `Bearer ${service}` } : { apikey: service };
  };

  async function call<T>(method: string, path: string, body: unknown, as?: string): Promise<T> {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      method,
      headers: { ...headers(as), 'content-type': 'application/json', accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const e = (data ?? {}) as { code?: string; hint?: string; message?: string };
      throw new RestError(res.status, e.code ?? null, e.hint ?? null, e.message ?? `HTTP ${res.status}`);
    }
    return data as T;
  }

  return {
    rpc: (fn, args, opts) => call('POST', `rpc/${fn}`, args, opts?.as),
    get: (path, opts) => call('GET', path, undefined, opts?.as),
  };
}
