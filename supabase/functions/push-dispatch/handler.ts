// POST /functions/v1/push-dispatch  { ids?: uuid[] }  (service role only; scheduled every minute)
// Sends pending notifications through the Expo push service. Each batch is claimed in the database first,
// so overlapping runs never send twice. Test notifications are never pushed.
import { isServiceCaller } from '../_shared/auth.ts';
import { defaultDeps, type Deps } from '../_shared/env.ts';
import { cors, fail, json, readJson } from '../_shared/http.ts';
import { rest } from '../_shared/rest.ts';

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface Claimed { id: string; kind: string; title: string; body: string; data: Record<string, unknown>; tokens: string[] }
interface Ticket { status: 'ok' | 'error'; id?: string; message?: string; details?: { error?: string } }
type Outcome = { id: string; status: 'sent' | 'skipped' | 'failed' | 'retry'; error?: string };

const PERMANENT = new Set(['DeviceNotRegistered', 'InvalidCredentials', 'MessageTooBig', 'MismatchSenderId']);

export function createHandler(deps: Deps = defaultDeps()) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Usa POST.');
    if (!(await isServiceCaller(req, deps.env))) return fail(401, 'unauthorized', 'Solo para tareas programadas.');
    const body = (await readJson<{ ids?: string[] }>(req)) ?? {};
    const db = rest(deps.env);
    const batch = await db.rpc<Claimed[]>('claim_push_batch', { p_limit: 100, p_ids: Array.isArray(body.ids) ? body.ids : null });
    if (!batch.length) return json({ claimed: 0 });

    const messages = batch.flatMap((n) => n.tokens.map((to) => ({
      n: n.id, to, msg: { to, title: n.title, body: n.body, sound: 'default', data: { ...n.data, notification_id: n.id, kind: n.kind } },
    })));
    const tickets = new Map<string, Ticket[]>(); // notification id -> tickets
    const dead = new Set<string>();
    const transport = new Map<string, string>(); // notification id -> transport error
    const accessToken = deps.env('EXPO_ACCESS_TOKEN');
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      try {
        const res = await deps.fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { accept: 'application/json', 'content-type': 'application/json', ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) },
          body: JSON.stringify(chunk.map((m) => m.msg)),
          signal: AbortSignal.timeout(15_000),
        });
        const j = (await res.json().catch(() => null)) as { data?: Ticket[] } | null;
        if (!res.ok || !Array.isArray(j?.data)) throw new Error(`Expo HTTP ${res.status}`);
        chunk.forEach((m, k) => {
          const t = j!.data![k] ?? { status: 'error', message: 'missing ticket' };
          tickets.set(m.n, [...(tickets.get(m.n) ?? []), t]);
          if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') dead.add(m.to);
        });
      } catch (e) {
        for (const m of chunk) transport.set(m.n, e instanceof Error ? e.message : String(e));
      }
    }

    const results: Outcome[] = batch.map((n) => {
      if (!n.tokens.length) return { id: n.id, status: 'skipped', error: 'no device registered' };
      const ts = tickets.get(n.id) ?? [];
      if (ts.some((t) => t.status === 'ok')) return { id: n.id, status: 'sent' };
      if (transport.has(n.id)) return { id: n.id, status: 'retry', error: transport.get(n.id) };
      const errs = ts.map((t) => t.details?.error ?? t.message ?? 'error');
      return { id: n.id, status: errs.every((x) => PERMANENT.has(x)) ? 'failed' : 'retry', error: errs.join(', ') };
    });
    await db.rpc('complete_push', { p_results: results, p_dead_tokens: [...dead] });
    const count = (s: Outcome['status']) => results.filter((r) => r.status === s).length;
    return json({ claimed: batch.length, sent: count('sent'), skipped: count('skipped'), failed: count('failed'), retry: count('retry') });
  };
}
