import type { Tone } from '@/components/ui';

const TZ = 'America/Caracas';
export function dateTime(v: string | null | undefined) {
  if (!v) return '—';
  return new Intl.DateTimeFormat('es-VE', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(v));
}
export function date(v: string | null | undefined) {
  if (!v) return '—';
  return new Intl.DateTimeFormat('es-VE', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(v.length === 10 ? `${v}T12:00:00` : v));
}
export function ago(v: string | null | undefined) {
  if (!v) return '—';
  const m = Math.round((Date.now() - new Date(v).getTime()) / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}
export function money(v: string | number | null | undefined, currency: string) {
  if (v == null) return '—';
  const n = Number(v);
  if (currency === 'VES') return `Bs. ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (currency === 'USDT') return `${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} USDT`;
  return `$${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const moderationTone: Record<string, Tone> = { pending: 'warning', published: 'success', in_review: 'info', rejected: 'danger', suspended: 'danger' };
export const paymentTone: Record<string, Tone> = { pending_verification: 'warning', processing: 'info', confirmed: 'success', rejected: 'danger', refunded: 'neutral', failed: 'danger' };
export const orderPayTone: Record<string, Tone> = { unpaid: 'warning', partially_paid: 'info', paid: 'success', refund_due: 'danger', refunded: 'neutral' };
export const claimTone: Record<string, Tone> = { open: 'warning', seller_responded: 'info', escalated: 'danger', resolved: 'success', rejected: 'neutral' };
export const storeTone: Record<string, Tone> = { pending: 'warning', active: 'success', suspended: 'danger' };
export const integrationTone: Record<string, Tone> = { live: 'success', sandbox: 'info', pending_credentials: 'warning', disabled: 'neutral' };

export const RATE_SOURCE_LABEL: Record<string, string> = {
  bcv_official: 'BCV (oficial)',
  dolarapi_oficial: 'BCV vía DolarApi',
  binance_p2p: 'Binance P2P (referencial)',
  kraken_usdt: 'Kraken USDT/USD',
  manual: 'Manual (administración)',
  demo: 'Demostración (no real)',
};
