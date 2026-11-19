// POST /functions/v1/rates-sync  (service role only; scheduled by pg_cron through invoke_edge_function)
// Reads every enabled automatic rate source once and stores each value with ingest_rate. A source that
// fails, or whose value jumps more than the sanity threshold, is reported and left alone: no value is
// ever guessed, and quotes stop when the policy's rate goes stale.
import { isRateAdapter, rateReadError, readRateSource } from '../_shared/core/rates.ts';
import { isServiceCaller } from '../_shared/auth.ts';
import { defaultDeps, type Deps } from '../_shared/env.ts';
import { cors, fail, json } from '../_shared/http.ts';
import { rest } from '../_shared/rest.ts';

export interface SyncResult { source: string; ok: boolean; pair?: string; rate?: number; observedAt?: string; error?: string }

export function createHandler(deps: Deps = defaultDeps()) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Usa POST.');
    if (!(await isServiceCaller(req, deps.env))) return fail(401, 'unauthorized', 'Solo para tareas programadas.');
    const db = rest(deps.env);
    const sources = await db.get<{ code: string; adapter: string }[]>('exchange_rate_sources?select=code,adapter&enabled=eq.true&order=code');
    const userAgent = deps.env('RATES_USER_AGENT') ?? 'KoraRates/1.0';
    const results: SyncResult[] = await Promise.all(
      sources.filter((s) => isRateAdapter(s.adapter)).map(async (s): Promise<SyncResult> => {
        try {
          const obs = await readRateSource(s.adapter as Parameters<typeof readRateSource>[0], s.code, { fetch: deps.fetch, userAgent });
          await db.rpc('ingest_rate', { p_source: s.code, p_pair: obs.pair, p_rate: obs.rate, p_observed_at: obs.observedAt, p_raw: obs.raw ?? null });
          return { source: s.code, ok: true, pair: obs.pair, rate: obs.rate, observedAt: obs.observedAt };
        } catch (e) {
          return { source: s.code, ok: false, error: rateReadError(e) };
        }
      }),
    );
    for (const r of results) if (!r.ok) console.warn('rates-sync', r.source, r.error);
    return json({ results });
  };
}
