import { RATE_ADAPTERS, type RateAdapterKey } from '@kora/core/rates';
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
      .filter((s) => s.adapter in RATE_ADAPTERS)
      .map(async (s): Promise<Result> => {
        const a = RATE_ADAPTERS[s.adapter as RateAdapterKey];
        try {
          const res = await fetch(a.url, {
            method: a.method,
            headers: { accept: a.kind === 'json' ? 'application/json' : 'text/html', 'content-type': 'application/json', 'user-agent': 'KoraRates/1.0 (+https://kora.example.com)' },
            body: 'body' in a ? JSON.stringify(a.body) : undefined,
            signal: AbortSignal.timeout(12_000),
            cache: 'no-store',
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const obs = a.parse(await res.text());
          if (obs.source !== s.code) throw new Error(`adapter returned ${obs.source}`);
          const { error: e } = await sb.rpc('ingest_rate', { p_source: s.code, p_pair: obs.pair, p_rate: obs.rate, p_observed_at: obs.observedAt, p_raw: (obs.raw ?? null) as never });
          if (e) throw new Error(e.hint === 'rate_anomaly' ? 'Variación mayor al 25% respecto al último valor: revísala y cárgala manualmente.' : e.message);
          return { source: s.code, ok: true, pair: obs.pair, rate: obs.rate, observedAt: obs.observedAt };
        } catch (e) {
          const msg = e instanceof Error ? (e.name === 'TimeoutError' ? 'Tiempo de espera agotado' : e.cause instanceof Error ? `${e.message}: ${e.cause.message}` : e.message) : String(e);
          return { source: s.code, ok: false, error: msg };
        }
      }),
  );
  return Response.json({ results });
}
