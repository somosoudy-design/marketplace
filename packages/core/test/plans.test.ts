import { describe, expect, it } from 'vitest';
import { describePlan, planSchedule, sumMoney } from '../src';

const full = { code: 'full', name: 'Pago completo', down_payment_pct: 100, installments: 0, interval_days: 30 };
const deposit = { code: 'deposit_50', name: 'Anticipo 50%', down_payment_pct: 50, installments: 1, interval_days: 30 };
const three = { code: 'three_parts', name: '3 cuotas', down_payment_pct: 0, installments: 3, interval_days: 15 };

describe('installment schedules', () => {
  it('full payment is a single obligation', () => {
    expect(planSchedule('120.00', full)).toEqual([{ seq: 1, kind: 'full', amount_usd: '120.00', due_in_days: 0 }]);
  });
  it('brief example: 120 USD with 50% deposit -> 60 now, 60 later (USD)', () => {
    const s = planSchedule('120', deposit);
    expect(s.map((x) => [x.kind, x.amount_usd, x.due_in_days])).toEqual([['down_payment', '60.00', 0], ['installment', '60.00', 30]]);
  });
  it('brief example: 3 cuotas de 28 USD', () => {
    expect(planSchedule('84', three).map((x) => x.amount_usd)).toEqual(['28.00', '28.00', '28.00']);
  });
  it('remainder cents go to the last installment and the sum is exact', () => {
    const s = planSchedule('100', three);
    expect(s.map((x) => x.amount_usd)).toEqual(['33.33', '33.33', '33.34']);
    expect(sumMoney(s.map((x) => x.amount_usd)).toFixed(2)).toBe('100.00');
    expect(s.map((x) => x.due_in_days)).toEqual([0, 15, 30]);
  });
  it('odd totals with deposit stay exact', () => {
    for (const t of ['0.03', '19.99', '157.77', '1000.01']) {
      expect(sumMoney(planSchedule(t, deposit).map((x) => x.amount_usd)).toFixed(2)).toBe(Number(t).toFixed(2));
      expect(sumMoney(planSchedule(t, three).map((x) => x.amount_usd)).toFixed(2)).toBe(Number(t).toFixed(2));
    }
  });
  it('describes plans in plain language', () => {
    expect(describePlan(three, '84')).toBe('3 cuotas de 28.00 USD');
    expect(describePlan(full, '84')).toBe('Un solo pago');
  });
});
