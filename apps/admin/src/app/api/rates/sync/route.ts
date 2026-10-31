import { isRateAdapter, rateReadError, readRateSource, type RateAdapterKey } from '@kora/core/rates';
import { brand } from '@/lib/brand';
import { requireAdmin } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

type Result = { source: string; ok: boolean; pair?: string; rate?: number; observedAt?: string; error?: string };

/**
 * "Consultar ahora" from the rates screen: fetches every enabled automatic source once and stores what it
 * reads through ingest_rate, as the signed-in admin. Scheduled syncs run in the rates-sync edge function.
 * A source that fails or returns an implausible value is reported, never replaced by a guess.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if ('error' in auth) return auth.error;
  const { sb } = auth;
  const { data: sources, error } = await sb.from('exchange_rate_sources').select('code, adapter, enabled').eq('enabled', true);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const results: Result[] = await Promise.all(
    (sources ?? [])
      .filter((s) => isRateAdapter(s.adapter))
      .map(async (s): Promise<Result> => {
        try {
          const obs = await readRateSource(s.adapter as RateAdapterKey, s.code, { userAgent: `KoraRates/1.0 (+https://${brand.webDomain})` });
          const { error: e } = await sb.rpc('ingest_rate', { p_source: s.code, p_pair: obs.pair, p_rate: obs.rate, p_observed_at: obs.observedAt, p_raw: (obs.raw ?? null) as never });
          if (e) throw Object.assign(new Error(e.message), { hint: e.hint });
          return { source: s.code, ok: true, pair: obs.pair, rate: obs.rate, observedAt: obs.observedAt };
        } catch (e) {
          return { source: s.code, ok: false, error: rateReadError(e) };
        }
      }),
  );
  return Response.json({ results });
}
