// Links that Supabase Auth would email (reset password, magic link), produced by the local GoTrue admin API so the
// UI tests can open them like a buyer tapping the email. Local stack only.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function localKeys() {
  const p = join(import.meta.dirname, '../../../../.local/keys.env');
  const env: Record<string, string> = {};
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]!] = m[2]!;
  }
  if (!env.SUPABASE_URL || !/127\.0\.0\.1|localhost/.test(env.SUPABASE_URL)) throw new Error('auth links only come from the local stack');
  return env as { SUPABASE_URL: string; SUPABASE_ANON_KEY: string; SUPABASE_SERVICE_ROLE_KEY: string };
}

/** The link an email of this kind would carry, sending the user back to `redirectTo`. */
export async function emailLink(type: 'recovery' | 'magiclink', email: string, redirectTo: string): Promise<string> {
  const k = localKeys();
  const res = await fetch(`${k.SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: k.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${k.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ type, email, redirect_to: redirectTo }),
  });
  const j = (await res.json()) as { action_link?: string; properties?: { action_link?: string } };
  const link = j.action_link ?? j.properties?.action_link;
  if (!res.ok || !link) throw new Error(`generate_link ${res.status}: ${JSON.stringify(j)}`);
  // the local GoTrue drops the /auth/v1 prefix of API_EXTERNAL_URL in admin links (emails keep it)
  return link.replace(/^(https?:\/\/[^/]+)\/verify/, '$1/auth/v1/verify');
}

/** Whether these credentials sign in (status of the password grant). */
export async function canSignIn(email: string, password: string): Promise<boolean> {
  const k = localKeys();
  const res = await fetch(`${k.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: k.SUPABASE_ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.ok;
}

/** True when the auth server confirms new accounts without an email (local: AUTH_AUTOCONFIRM=true pnpm stack:start). */
export async function signUpWithoutEmail(): Promise<boolean> {
  const k = localKeys();
  const res = await fetch(`${k.SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: k.SUPABASE_ANON_KEY } });
  return ((await res.json()) as { mailer_autoconfirm?: boolean }).mailer_autoconfirm === true;
}
