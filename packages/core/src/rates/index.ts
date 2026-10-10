/**
 * Exchange-rate provider adapters. Pure parsing + validation so they run identically in
 * Deno (edge function `rates-sync`), Node (tests) and the admin panel.
 *
 * Each adapter returns a RateObservation or throws RateParseError. The database (ingest_rate)
 * applies a second sanity check against the previous value of the same source.
 */
export interface RateObservation {
  source: string;
  pair: 'USD/VES' | 'USDT/VES' | 'USD/USDT';
  rate: number;
  observedAt: string; // ISO
  raw?: unknown;
}

export class RateParseError extends Error {
  constructor(public source: string, message: string) { super(`[${source}] ${message}`); }
}

/** "36,12345678" | "36.12" | "1.234,56" -> number */
export function parseLocaleNumber(s: string): number {
  const t = s.trim().replace(/\s/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'));
  if (/^\d+(,\d+)?$/.test(t)) return Number(t.replace(',', '.'));
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  return Number.NaN;
}

function assertPlausible(source: string, rate: number, min: number, max: number) {
  if (!Number.isFinite(rate) || rate < min || rate > max) throw new RateParseError(source, `implausible rate ${rate}`);
}

// ---------- BCV (official publication on bcv.org.ve; no documented API) ----------
// The homepage renders: <div id="dolar"> ... <strong> 36,12345678 </strong> ... and a
// "Fecha Valor" <span ... content="2024-05-02T00:00:00-04:00">. If the markup changes the adapter
// fails loudly (never guesses) and the policy falls back / goes stale.
export function parseBcvHtml(html: string): RateObservation {
  const block = html.match(/id=["']dolar["'][\s\S]{0,1500}?<strong>\s*([\d.,]+)\s*<\/strong>/i);
  if (!block) throw new RateParseError('bcv_official', 'USD block not found');
  const rate = parseLocaleNumber(block[1]!);
  assertPlausible('bcv_official', rate, 1, 1_000_000);
  const date = html.match(/Fecha\s+Valor[\s\S]{0,400}?content=["']([^"']+)["']/i);
  const observedAt = date ? new Date(date[1]!).toISOString() : new Date().toISOString();
  return { source: 'bcv_official', pair: 'USD/VES', rate, observedAt, raw: { value: block[1], valueDate: date?.[1] ?? null } };
}

// ---------- DolarApi (third-party aggregator, ve.dolarapi.com/v1/dolares/oficial) ----------
export function parseDolarApi(json: unknown): RateObservation {
  const j = json as { promedio?: number; venta?: number | null; fechaActualizacion?: string; fuente?: string };
  const rate = Number(j?.promedio ?? j?.venta);
  assertPlausible('dolarapi_oficial', rate, 1, 1_000_000);
  if (j.fuente && j.fuente !== 'oficial') throw new RateParseError('dolarapi_oficial', `unexpected source ${j.fuente}`);
  return { source: 'dolarapi_oficial', pair: 'USD/VES', rate, observedAt: new Date(j.fechaActualizacion ?? Date.now()).toISOString(), raw: j };
}

// ---------- Binance P2P (market reference only, never "official") ----------
// POST https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search  {asset:"USDT", fiat:"VES", tradeType:"BUY", page:1, rows:20}
export const BINANCE_P2P_REQUEST = { asset: 'USDT', fiat: 'VES', tradeType: 'BUY', page: 1, rows: 20, payTypes: [], publisherType: null };
export function parseBinanceP2P(json: unknown, now = new Date()): RateObservation {
  const ads = (json as { data?: Array<{ adv?: { price?: string } }> })?.data ?? [];
  const prices = ads.map((a) => Number(a.adv?.price)).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (prices.length < 5) throw new RateParseError('binance_p2p', `not enough ads (${prices.length})`);
  // trimmed median: drop 20% on each side to avoid outlier ads
  const cut = Math.floor(prices.length * 0.2);
  const core = prices.slice(cut, prices.length - cut);
  const mid = Math.floor(core.length / 2);
  const median = core.length % 2 ? core[mid]! : (core[mid - 1]! + core[mid]!) / 2;
  assertPlausible('binance_p2p', median, 1, 1_000_000);
  return { source: 'binance_p2p', pair: 'USDT/VES', rate: Number(median.toFixed(4)), observedAt: now.toISOString(), raw: { sample: prices.length } };
}

// ---------- Kraken public ticker USDT/USD -> USD/USDT ----------
// GET https://api.kraken.com/0/public/Ticker?pair=USDTUSD
export function parseKrakenUsdt(json: unknown, now = new Date()): RateObservation {
  const j = json as { error?: string[]; result?: Record<string, { c?: [string, string] }> };
  if (j?.error?.length) throw new RateParseError('kraken_usdt', j.error.join(', '));
  const first = Object.values(j?.result ?? {})[0];
  const usdPerUsdt = Number(first?.c?.[0]);
  assertPlausible('kraken_usdt', usdPerUsdt, 0.8, 1.2);
  return { source: 'kraken_usdt', pair: 'USD/USDT', rate: Number((1 / usdPerUsdt).toFixed(6)), observedAt: now.toISOString(), raw: { usdPerUsdt } };
}

export const RATE_ADAPTERS = {
  bcv_html: { url: 'https://www.bcv.org.ve/', method: 'GET' as const, parse: (body: string) => parseBcvHtml(body), kind: 'text' as const },
  dolarapi: { url: 'https://ve.dolarapi.com/v1/dolares/oficial', method: 'GET' as const, parse: (body: string) => parseDolarApi(JSON.parse(body)), kind: 'json' as const },
  binance_p2p: { url: 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', method: 'POST' as const, body: BINANCE_P2P_REQUEST, parse: (body: string) => parseBinanceP2P(JSON.parse(body)), kind: 'json' as const },
  kraken_ticker: { url: 'https://api.kraken.com/0/public/Ticker?pair=USDTUSD', method: 'GET' as const, parse: (body: string) => parseKrakenUsdt(JSON.parse(body)), kind: 'json' as const },
} as const;
export type RateAdapterKey = keyof typeof RATE_ADAPTERS;

export const isRateAdapter = (k: string): k is RateAdapterKey => Object.prototype.hasOwnProperty.call(RATE_ADAPTERS, k);

/**
 * Fetches one source once and parses it. Used by the admin "Consultar ahora" button and by the
 * scheduled `rates-sync` edge function, so both read providers the same way. Throws on any failure:
 * callers report it and never substitute a value.
 */
export async function readRateSource(
  adapter: RateAdapterKey, sourceCode: string,
  opts: { fetch?: typeof fetch; timeoutMs?: number; userAgent?: string } = {},
): Promise<RateObservation> {
  const a = RATE_ADAPTERS[adapter];
  const res = await (opts.fetch ?? fetch)(a.url, {
    method: a.method,
    headers: { accept: a.kind === 'json' ? 'application/json' : 'text/html', 'content-type': 'application/json', 'user-agent': opts.userAgent ?? 'KoraRates/1.0' },
    body: 'body' in a ? JSON.stringify(a.body) : undefined,
    signal: AbortSignal.timeout(opts.timeoutMs ?? 12_000),
  });
  if (!res.ok) throw new RateParseError(sourceCode, `HTTP ${res.status}`);
  const obs = a.parse(await res.text());
  if (obs.source !== sourceCode) throw new RateParseError(sourceCode, `adapter returned ${obs.source}`);
  return obs;
}

/** Spanish, operator-facing description of a failed read. */
export function rateReadError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  if (e.name === 'TimeoutError') return 'Tiempo de espera agotado';
  if ((e as { hint?: string }).hint === 'rate_anomaly') return 'Variación mayor al 25% respecto al último valor: revísala y cárgala manualmente.';
  return e.cause instanceof Error ? `${e.message}: ${e.cause.message}` : e.message;
}
