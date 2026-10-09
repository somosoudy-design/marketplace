import type { Env } from './env.ts';
import { bearer } from './http.ts';

async function digest(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}

/** Constant-time comparison (both sides hashed first, so length differences don't leak either). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}

/** Jobs (pg_cron through invoke_edge_function) and operators call internal functions with the service key. */
export async function isServiceCaller(req: Request, env: Env): Promise<boolean> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const presented = bearer(req) ?? req.headers.get('apikey');
  if (!key || !presented) return false;
  return safeEqual(presented, key);
}
