import Decimal from 'decimal.js-light';

/**
 * Money helpers for DISPLAY and client-side previews only.
 * The database is the source of truth for every amount that is charged or recorded.
 */
export type Currency = 'USD' | 'VES' | 'USDT';
export type MoneyValue = string | number | Decimal;

Decimal.config({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export const D = (v: MoneyValue) => new Decimal(v);

const decimalsFor: Record<Currency, number> = { USD: 2, VES: 2, USDT: 2 };

/** Round half-up to the currency precision (mirrors PostgreSQL round(numeric, n)). */
export function roundMoney(v: MoneyValue, currency: Currency = 'USD'): Decimal {
  return D(v).toDecimalPlaces(decimalsFor[currency], Decimal.ROUND_HALF_UP);
}

/** Truncate toward zero (mirrors PostgreSQL trunc(numeric, n)). */
export function truncMoney(v: MoneyValue, places = 2): Decimal {
  return D(v).toDecimalPlaces(places, Decimal.ROUND_DOWN);
}

const groupThousands = (int: string, sep: string) => int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);

/**
 * es-VE style formatting without relying on Intl (Hermes ships a limited ICU on some Android builds).
 *  USD 1234.5  -> "$1.234,50"
 *  VES 1234.5  -> "Bs. 1.234,50"
 *  USDT 12     -> "12,00 USDT"
 */
export function formatMoney(value: MoneyValue | null | undefined, currency: Currency = 'USD', opts: { compact?: boolean } = {}): string {
  if (value === null || value === undefined || value === '') return '—';
  const v = roundMoney(value, currency);
  const neg = v.isNegative();
  const [int, frac = '00'] = v.abs().toFixed(decimalsFor[currency]).split('.');
  const body = opts.compact && frac === '00' ? groupThousands(int!, '.') : `${groupThousands(int!, '.')},${frac}`;
  const s = currency === 'USD' ? `$${body}` : currency === 'VES' ? `Bs. ${body}` : `${body} USDT`;
  return neg ? `−${s}` : s;
}

export const formatUSD = (v: MoneyValue | null | undefined, compact = false) => formatMoney(v, 'USD', { compact });
export const formatVES = (v: MoneyValue | null | undefined) => formatMoney(v, 'VES');

/** Converts a USD amount with a quoted rate, rounding the result like the server does. */
export function convertFromUSD(usd: MoneyValue, rate: MoneyValue, currency: Currency): Decimal {
  return roundMoney(D(usd).times(rate), currency);
}

export function sumMoney(values: MoneyValue[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(v), D(0));
}

export function formatRate(rate: MoneyValue, quote: Currency = 'VES'): string {
  const v = D(rate);
  const places = quote === 'USDT' ? 4 : 2;
  const [int, frac] = v.toFixed(places).split('.');
  return `${groupThousands(int!, '.')},${frac} ${quote === 'VES' ? 'Bs.' : quote} por USD`;
}
