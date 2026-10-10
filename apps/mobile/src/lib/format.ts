export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
export function shortDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const hh = d.getHours();
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${((hh + 11) % 12) + 1}:${mm} ${hh < 12 ? 'a. m.' : 'p. m.'}`;
}
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export const SOURCE_LABEL: Record<string, string> = {
  bcv_official: 'BCV',
  dolarapi_oficial: 'BCV (vía DolarApi)',
  binance_p2p: 'Binance P2P (referencial)',
  kraken_usdt: 'Kraken',
  manual: 'Tasa fijada por administración',
  demo: 'Tasa de demostración',
};

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'brand';
export const paymentTone = (s: string): StatusTone => (s === 'paid' ? 'success' : s === 'partially_paid' ? 'warning' : s === 'unpaid' ? 'danger' : 'info');
export const paymentRecordTone = (s: string): StatusTone => (s === 'confirmed' ? 'success' : s === 'rejected' || s === 'failed' ? 'danger' : s === 'refunded' ? 'muted' : 'info');

/** 4.5 -> "4,5" (one decimal, Spanish separator). */
export function formatRating(v: number | string | null | undefined): string {
  return Number(v ?? 0).toFixed(1).replace('.', ',');
}

/** "Desde oct 2026" for how long a store has been selling. */
export function monthYear(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
