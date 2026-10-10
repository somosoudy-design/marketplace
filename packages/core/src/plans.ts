import Decimal from 'decimal.js-light';
import { D, roundMoney, truncMoney, type MoneyValue } from './money';

export interface InstallmentPlan {
  code: string;
  name: string;
  down_payment_pct: number | string;
  installments: number;
  interval_days: number;
  surcharge_pct?: number | string;
}

export interface ScheduleItem {
  seq: number;
  kind: 'full' | 'down_payment' | 'installment';
  amount_usd: string;
  due_in_days: number;
}

/**
 * Mirrors public._plan_schedule() so the checkout can preview a plan instantly.
 * The server recomputes it on place_order; tests assert both agree.
 */
export function planSchedule(total: MoneyValue, plan: InstallmentPlan): ScheduleItem[] {
  const t = D(total);
  const pct = D(plan.down_payment_pct);
  if (pct.gte(100)) return [{ seq: 1, kind: 'full', amount_usd: t.toFixed(2), due_in_days: 0 }];
  const down = roundMoney(t.times(pct).div(100));
  const rest = t.minus(down);
  const out: ScheduleItem[] = [];
  if (down.gt(0)) out.push({ seq: 1, kind: 'down_payment', amount_usd: down.toFixed(2), due_in_days: 0 });
  const each = truncMoney(rest.div(plan.installments));
  for (let i = 1; i <= plan.installments; i++) {
    const amount = i === plan.installments ? rest.minus(each.times(plan.installments - 1)) : each;
    out.push({
      seq: out.length + 1,
      kind: 'installment',
      amount_usd: amount.toFixed(2),
      due_in_days: down.gt(0) ? plan.interval_days * i : plan.interval_days * (i - 1),
    });
  }
  return out;
}

/** Financing surcharge applied to the financed part (total minus down payment). */
export function planFinancing(total: MoneyValue, plan: InstallmentPlan): Decimal {
  const t = D(total);
  const down = roundMoney(t.times(plan.down_payment_pct).div(100));
  return roundMoney(t.minus(down).times(plan.surcharge_pct ?? 0).div(100));
}

export function describePlan(plan: InstallmentPlan, total: MoneyValue): string {
  const s = planSchedule(D(total).plus(planFinancing(total, plan)), plan);
  if (s.length === 1) return 'Un solo pago';
  const first = s[0]!;
  const inst = s.filter((x) => x.kind === 'installment');
  if (first.kind === 'down_payment') return `Hoy ${first.amount_usd} USD y ${inst.length === 1 ? 'el resto' : `${inst.length} cuotas`} después`;
  return `${inst.length} cuotas de ${inst[0]!.amount_usd} USD`;
}
