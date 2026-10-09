import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { env } from '../env';

/**
 * Server-side client that acts as the calling user (their access token), never as service role.
 * Route handlers use it so the database applies the same authorization as in the browser.
 */
export function clientForRequest(req: Request) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export async function requireAdmin(req: Request) {
  const sb = clientForRequest(req);
  if (!sb) return { error: Response.json({ error: 'auth_required' }, { status: 401 }) } as const;
  const { data, error } = await sb.rpc('is_admin');
  if (error || data !== true) return { error: Response.json({ error: 'admin_required' }, { status: 403 }) } as const;
  return { sb } as const;
}
