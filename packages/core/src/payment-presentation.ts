import { D } from './money';
import { planFinancing, planSchedule, type InstallmentPlan } from './plans';

export interface QuantityPaymentOption extends InstallmentPlan { min_quantity: number; max_quantity: number }
export function offeredAtQuantity<T extends QuantityPaymentOption>(options: readonly T[] | undefined, quantity: number): T[] {
  if (!Number.isSafeInteger(quantity) || quantity < 1) return [];
  return (options ?? []).filter(p => Number.isSafeInteger(p.min_quantity) && Number.isSafeInteger(p.max_quantity) &&
    p.min_quantity >= 1 && p.max_quantity >= p.min_quantity && quantity >= p.min_quantity && quantity <= p.max_quantity);
}
/** Product-only estimate from the current server offer/price. Checkout remains authoritative. */
export function productBasePreview(price: number | string, quantity: number, option: QuantityPaymentOption) {
  if (!offeredAtQuantity([option], quantity).length) return null;
  try {
    const unit = D(price);
    if (!unit.gt(0) || !Number.isSafeInteger(option.installments) || option.installments < 0 ||
        !Number.isSafeInteger(option.interval_days) || option.interval_days < 0 ||
        D(option.down_payment_pct).lt(0) || D(option.down_payment_pct).gt(100) ||
        (D(option.down_payment_pct).lt(100) && option.installments < 1)) return null;
    const items = unit.times(quantity), financing = planFinancing(items, option), total = items.plus(financing);
    const schedule = planSchedule(total, option);
    if (schedule.some(row => !D(row.amount_usd).gt(0))) return null;
    return { scope: 'product_without_shipping' as const, items_usd: items.toFixed(2), financing_usd: financing.toFixed(2),
      total_usd: total.toFixed(2), schedule,
      label: 'Previsualización del producto, sin envío. El total final se confirma al continuar.' };
  } catch { return null; }
}

type DisplayPayment = { seq: number; kind: string; amount_usd: number | string; due_in_days: number };
export function presentServerSchedule<T extends DisplayPayment>(schedule: readonly T[]) {
  const total = schedule.length, today = schedule.filter(row => row.due_in_days === 0), later = schedule.filter(row => row.due_in_days > 0);
  return {
    title: total > 1 ? `${total} pagos en total` : total === 1 ? 'Pago completo' : 'Plan de pago',
    distribution: total > 1 && today.length === 1 && later.length === total - 1
      ? `Un pago hoy y ${later.length} ${later.length === 1 ? 'pago posterior' : 'pagos posteriores'}.` : undefined,
    singlePaymentDueToday: today.length === 1 ? today[0]! : null,
    requiresServerDueNowTotal: today.length > 1,
    rows: schedule.map((item, index) => ({ item, label: total > 1 ? `Pago ${index + 1} de ${total}` : 'Pago completo',
      due: item.due_in_days === 0 ? 'Hoy' : `En ${item.due_in_days} días` })),
  };
}
export function paymentPlanTitle(plan: InstallmentPlan) {
  if (plan.code !== 'three_parts') return plan.name;
  const count = D(plan.down_payment_pct).gte(100) ? 1 : plan.installments + (D(plan.down_payment_pct).gt(0) ? 1 : 0);
  return count > 1 ? `${count} pagos en total` : plan.name;
}
export function paymentPlanDescription(plan: InstallmentPlan & { description?: string | null }) {
  if (plan.code !== 'three_parts') return plan.description ?? undefined;
  const count = plan.installments + (D(plan.down_payment_pct).gt(0) ? 1 : 0);
  return count > 1 ? `Primer pago hoy y ${count - 1} después, cada ${plan.interval_days} días.` : plan.description ?? undefined;
}

const planSyntax = /^[A-Za-z0-9_-]{1,64}$/;
export function safePlanCode(value: unknown): string | undefined { return typeof value === 'string' && planSyntax.test(value) ? value : undefined; }
export function planFromSearch(params: URLSearchParams): string | undefined {
  const values = params.getAll('plan'); return values.length === 1 ? safePlanCode(values[0]) : undefined;
}
export function withPlan(path: string, preference?: string): string {
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(path)) throw new Error('Invalid route');
  const url = new URL(path, 'https://mayami.invalid');
  if (url.origin !== 'https://mayami.invalid' || url.hash) throw new Error('Invalid route');
  url.searchParams.delete('plan'); const code = safePlanCode(preference); if (code) url.searchParams.set('plan', code);
  return url.pathname + url.search;
}
export function chooseOfferedPlan(preference: unknown, offered: readonly { code: string }[]) {
  const code = safePlanCode(preference);
  if (code && offered.some(p => p.code === code)) return { code, notice: undefined };
  return { code: offered.find(p => p.code === 'full')?.code,
    notice: code ? 'El plan solicitado no está disponible para este carrito. Revisa las opciones de pago.' : undefined };
}
