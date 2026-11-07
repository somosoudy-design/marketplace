import type { Env } from './env.ts';
import { bearer } from './http.ts';
import { rest } from './rest.ts';

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

/** Operators call internal functions with the service key; scheduled jobs (pg_cron through
 * invoke_edge_function) present the Vault job token instead, which only the database can check. */
export async function isServiceCaller(req: Request, env: Env): Promise<boolean> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const presented = bearer(req) ?? req.headers.get('apikey');
  if (key && presented && (await safeEqual(presented, key))) return true;
  const token = req.headers.get('x-kora-job-token');
  if (!key || !token || token.length < 32 || token.length > 256) return false;
  try {
    return (await rest(env).rpc<boolean>('job_token_valid', { p_token: token })) === true;
  } catch {
    return false;
  }
}
