// POST /functions/v1/push-dispatch  { ids?: uuid[] }  (service role only; scheduled every minute)
// Sends pending notifications through the Expo push service. Each batch is claimed in the database first,
// so overlapping runs never send twice. Test notifications are never pushed.
// Then collects due delivery receipts: Expo's ticket only says a message was accepted, the receipt (ready about
// 15 minutes later) says whether Apple or Google delivered it. With ids, only those notifications are handled.
import { isServiceCaller } from '../_shared/auth.ts';
import { defaultDeps, type Deps } from '../_shared/env.ts';
import { cors, fail, json, readJson } from '../_shared/http.ts';
import { rest, type Rest } from '../_shared/rest.ts';

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

interface Claimed { id: string; kind: string; title: string; body: string; data: Record<string, unknown>; tokens: string[] }
interface Ticket { status: 'ok' | 'error'; id?: string; message?: string; details?: { error?: string } }
type Receipt = Omit<Ticket, 'id'>;
type Outcome = { id: string; status: 'sent' | 'skipped' | 'failed' | 'retry'; error?: string };

const PERMANENT = new Set(['DeviceNotRegistered', 'InvalidCredentials', 'MessageTooBig', 'MismatchSenderId']);

export function createHandler(deps: Deps = defaultDeps()) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Usa POST.');
    if (!(await isServiceCaller(req, deps.env))) return fail(401, 'unauthorized', 'Solo para tareas programadas.');
    const body = (await readJson<{ ids?: string[] }>(req)) ?? {};
    const db = rest(deps.env);
    const ids = Array.isArray(body.ids) ? body.ids : null;
    const headers = { accept: 'application/json', 'content-type': 'application/json', ...(deps.env('EXPO_ACCESS_TOKEN') ? { authorization: `Bearer ${deps.env('EXPO_ACCESS_TOKEN')}` } : {}) };
    const sent = await send(deps, db, ids, headers);
    const receipts = await collectReceipts(deps, db, ids, headers);
    return json({ ...sent, receipts });
  };
}

type Headers_ = Record<string, string>;

async function send(deps: Deps, db: Rest, ids: string[] | null, headers: Headers_) {
  const batch = await db.rpc<Claimed[]>('claim_push_batch', { p_limit: 100, p_ids: ids });
  if (!batch.length) return { claimed: 0 };

  const messages = batch.flatMap((n) => n.tokens.map((to) => ({
    n: n.id, to, msg: { to, title: n.title, body: n.body, sound: 'default', data: { ...n.data, notification_id: n.id, kind: n.kind } },
  })));
  const tickets = new Map<string, Ticket[]>(); // notification id -> tickets
  const accepted: { ticket_id: string; notification_id: string; token: string }[] = [];
  const dead = new Set<string>();
  const transport = new Map<string, string>(); // notification id -> transport error
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await deps.fetch(EXPO_PUSH_URL, { method: 'POST', headers, body: JSON.stringify(chunk.map((m) => m.msg)), signal: AbortSignal.timeout(15_000) });
      const j = (await res.json().catch(() => null)) as { data?: Ticket[] } | null;
      if (!res.ok || !Array.isArray(j?.data)) throw new Error(`Expo HTTP ${res.status}`);
      chunk.forEach((m, k) => {
        const t = j!.data![k] ?? { status: 'error', message: 'missing ticket' };
        tickets.set(m.n, [...(tickets.get(m.n) ?? []), t]);
        if (t.status === 'ok' && t.id) accepted.push({ ticket_id: t.id, notification_id: m.n, token: m.to });
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
  await db.rpc('complete_push', { p_results: results, p_dead_tokens: [...dead], p_tickets: accepted });
  const count = (s: Outcome['status']) => results.filter((r) => r.status === s).length;
  return { claimed: batch.length, sent: count('sent'), skipped: count('skipped'), failed: count('failed'), retry: count('retry') };
}

/** Asks Expo for the receipts that are due. A receipt Expo does not return yet stays pending for a later run. */
async function collectReceipts(deps: Deps, db: Rest, ids: string[] | null, headers: Headers_) {
  const due = await db.rpc<string[]>('claim_push_receipts', { p_limit: 1000, p_ids: ids });
  if (!due.length) return { checked: 0 };
  let data: Record<string, Receipt>;
  try {
    const res = await deps.fetch(EXPO_RECEIPTS_URL, { method: 'POST', headers, body: JSON.stringify({ ids: due }), signal: AbortSignal.timeout(15_000) });
    const j = (await res.json().catch(() => null)) as { data?: Record<string, Receipt> } | null;
    if (!res.ok || !j?.data || typeof j.data !== 'object') throw new Error(`Expo HTTP ${res.status}`);
    data = j.data;
  } catch (e) {
    // the claim already pushed these back by 10 minutes; nothing is lost
    return { checked: due.length, error: e instanceof Error ? e.message : String(e) };
  }
  const receipts = due.flatMap((id) => {
    const r = data[id];
    if (!r || (r.status !== 'ok' && r.status !== 'error')) return [];
    return [{ ticket_id: id, status: r.status, error: r.status === 'error' ? (r.details?.error ?? r.message ?? 'error') : null }];
  });
  const done = await db.rpc<{ ok: number; error: number; notifications_failed: number; devices_removed: number }>('complete_push_receipts', { p_receipts: receipts });
  return { checked: due.length, ...done, not_ready: due.length - receipts.length };
}
