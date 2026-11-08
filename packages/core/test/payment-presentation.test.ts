import { describe, expect, it } from 'vitest';
import { chooseOfferedPlan, offeredAtQuantity, paymentPlanDescription, paymentPlanTitle, planFromSearch,
  planSchedule, presentServerSchedule, productBasePreview, safePlanCode, sumMoney, withPlan } from '../src';
const three = { code: 'three_parts', name: '3 cuotas', down_payment_pct: 0, installments: 3, interval_days: 15, surcharge_pct: 0, min_quantity: 1, max_quantity: 2 };
describe('server payment offers and presentation', () => {
  it('previews the real USD39 offer as three total payments, with the first today', () => {
    const preview = productBasePreview('39', 1, three)!;
    expect(preview.schedule.map(p => [p.amount_usd, p.due_in_days])).toEqual([['13.00', 0], ['13.00', 15], ['13.00', 30]]);
    expect(preview.scope).toBe('product_without_shipping'); expect(preview.label).toContain('sin envío');
    expect(paymentPlanTitle(three)).toBe('3 pagos en total'); expect(paymentPlanDescription(three)).not.toContain('iguales');
  });
  it('requires a current server offer and quantity range; never fabricates eligibility', () => {
    expect(offeredAtQuantity(undefined, 1)).toEqual([]); expect(offeredAtQuantity([three], 3)).toEqual([]);
    expect(productBasePreview('39', 3, three)).toBeNull(); expect(productBasePreview('39', 1.5, three)).toBeNull();
    expect(productBasePreview('bad', 1, three)).toBeNull(); expect(productBasePreview('0.01', 1, three)).toBeNull();
  });
  it('keeps price, quantity, financing and remainder cents aligned with the existing schedule contract', () => {
    for (const total of ['39.01', '47', '99.99']) {
      const preview = productBasePreview(total, 2, three)!;
      expect(preview.schedule).toEqual(planSchedule(preview.total_usd, three));
      expect(sumMoney(preview.schedule.map(p => p.amount_usd)).toFixed(2)).toBe(preview.total_usd);
      expect(presentServerSchedule(preview.schedule).rows.map(p => p.item.amount_usd)).toEqual(preview.schedule.map(p => p.amount_usd));
    }
  });
  it('counts an initial payment plus future payments without changing installments semantics', () => {
    const initialAndTwo = { ...three, down_payment_pct: 50, installments: 2 };
    expect(planSchedule('100', initialAndTwo)).toHaveLength(3);
    expect(presentServerSchedule(planSchedule('100', initialAndTwo)).title).toBe('3 pagos en total');
    const initialAndThree = { ...three, down_payment_pct: 50 };
    expect(planSchedule('100', initialAndThree)).toHaveLength(4); expect(paymentPlanTitle(initialAndThree)).toBe('4 pagos en total');
  });
  it('labels exact returned rows including the unequal final remainder and keeps other plan names', () => {
    const rows = planSchedule('100', three), display = presentServerSchedule(rows);
    expect(display.distribution).toBe('Un pago hoy y 2 pagos posteriores.');
    expect(display.rows.map(row => [row.label, row.due, row.item.amount_usd])).toEqual([
      ['Pago 1 de 3', 'Hoy', '33.33'], ['Pago 2 de 3', 'En 15 días', '33.33'], ['Pago 3 de 3', 'En 30 días', '33.34'],
    ]);
    expect(paymentPlanTitle({ ...three, code: 'deposit_50', name: 'Anticipo 50%', installments: 1, down_payment_pct: 50 })).toBe('Anticipo 50%');
  });
  it('does not fake a today total when multiple returned obligations are due today', () => {
    const rows = planSchedule('39', { ...three, interval_days: 0 });
    const display = presentServerSchedule(rows); expect(display.singlePaymentDueToday).toBeNull(); expect(display.requiresServerDueNowTotal).toBe(true);
  });
  it('preserves only valid plan intent in internal URLs', () => {
    expect(withPlan('/checkout', 'three_parts')).toBe('/checkout?plan=three_parts');
    expect(withPlan('/checkout?variant=v&plan=old', 'full')).toBe('/checkout?variant=v&plan=full');
    expect(planFromSearch(new URLSearchParams('plan=full&plan=three_parts'))).toBeUndefined();
    expect(safePlanCode(['three_parts'])).toBeUndefined(); expect(safePlanCode('https://evil.invalid')).toBeUndefined();
    expect(() => withPlan('//evil.invalid', 'full')).toThrow(); expect(() => withPlan('/\\evil.invalid', 'full')).toThrow();
  });
  it('chooses only an offered plan and never silently substitutes another financed plan', () => {
    expect(chooseOfferedPlan('three_parts', [{ code: 'full' }, { code: 'three_parts' }])).toEqual({ code: 'three_parts', notice: undefined });
    expect(chooseOfferedPlan('three_parts', [{ code: 'full' }])).toMatchObject({ code: 'full', notice: expect.any(String) });
    expect(chooseOfferedPlan('three_parts', [{ code: 'deposit_50' }]).code).toBeUndefined();
  });
});
