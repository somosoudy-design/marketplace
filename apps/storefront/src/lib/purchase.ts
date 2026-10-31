export {
  confirmCheckout,
  recoverCheckout,
  UnconfirmedCheckoutError,
} from '../../../mobile/src/lib/checkout-confirmation';
export function safeExternal(url: string | null | undefined) {
  try {
    const parsed = new URL(url ?? '');
    return parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}
export function date(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium', timeZone: 'America/Caracas' }).format(
        new Date(value.length === 10 ? value + 'T12:00:00' : value),
      )
    : 'Por confirmar';
}
export function currency(value: number | string, code: string) {
  return (
    new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: code === 'USDT' ? 'USD' : code,
      maximumFractionDigits: 2,
    }).format(Number(value)) + (code === 'USDT' ? ' USDT' : '')
  );
}
