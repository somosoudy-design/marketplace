import { describe, expect, it } from 'vitest';
import { planFromSearch, withPlan, chooseOfferedPlan } from '@kora/core';
import { authHref } from '../../apps/storefront/src/lib/auth-return';
import { checkoutIntentKey, parseCheckoutIntent, persistCheckoutIntent, restoreCheckoutIntent, type CheckoutIntent } from '../../apps/storefront/src/lib/checkout-intent';

const buyerA = '11111111-1111-4111-8111-111111111111';
const buyerB = '22222222-2222-4222-8222-222222222222';
const address = '33333333-3333-4333-8333-333333333333';
const intent = (plan: string, buyerId = buyerA, key = 'web-plan-navigation-1'): CheckoutIntent => ({
  version: 2, buyerId, key, reviewToken: 'a'.repeat(64), selection: { address, shipping: { delivery: 'method-a' }, plan },
});
function memory() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
function returnedPlan(search: string) {
  const destination = withPlan('/checkout', planFromSearch(new URLSearchParams(search)));
  const login = new URL(authHref('/cuenta', destination), 'https://mayami.invalid');
  return planFromSearch(new URL(login.searchParams.get('volver')!, 'https://mayami.invalid').searchParams);
}

describe('payment preference versus an accepted checkout operation', () => {
  it.each([['three_parts', 'full'], ['full', 'three_parts']])('URL %s cannot replace a stored %s selection', (requested, accepted) => {
    const durable = memory(), legacy = memory(), pending = intent(accepted);
    persistCheckoutIntent(durable, pending);
    const raw = durable.getItem(checkoutIntentKey(buyerA));
    const preference = returnedPlan('plan=' + requested);
    expect(preference).toBe(requested);
    const restored = restoreCheckoutIntent(durable, legacy, buyerA);
    expect(restored).toEqual(pending);
    expect(() => persistCheckoutIntent(durable, { ...intent(preference!), key: 'replacement-key' })).toThrow('pendiente');
    expect(durable.getItem(checkoutIntentKey(buyerA))).toBe(raw);
  });
  it('reuses the same accepted operation/key after an authentication round trip', () => {
    const durable = memory(), pending = intent('three_parts');
    persistCheckoutIntent(durable, pending);
    const plan = returnedPlan('plan=three_parts');
    const offered = chooseOfferedPlan(plan, [{ code: 'full' }, { code: 'three_parts' }]);
    const retry = persistCheckoutIntent(durable, { ...pending, key: 'new-navigation-key', selection: { ...pending.selection, plan: offered.code! } });
    expect(retry).toEqual({ intent: pending, fresh: false });
  });
  it('migrates an exact legacy operation without adding a token or applying the new URL preference', () => {
    const durable = memory(), legacy = memory();
    const old = { key: 'legacy-plan-key', selection: intent('three_parts').selection };
    legacy.setItem(checkoutIntentKey(buyerA), JSON.stringify(old));
    expect(returnedPlan('plan=full')).toBe('full');
    const restored = restoreCheckoutIntent(durable, legacy, buyerA);
    expect(restored).toEqual({ ...old, buyerId: buyerA });
    expect(restored?.reviewToken).toBeUndefined();
    expect(legacy.getItem(checkoutIntentKey(buyerA))).toBeNull();
    expect(parseCheckoutIntent(durable.getItem(checkoutIntentKey(buyerA)), buyerA)).toEqual(restored);
  });
  it('keeps account operations separate while the public plan preference crosses accounts', () => {
    const durable = memory(), legacy = memory(), pendingA = intent('three_parts');
    persistCheckoutIntent(durable, pendingA);
    const rawA = durable.getItem(checkoutIntentKey(buyerA));
    const preference = returnedPlan('plan=three_parts');
    expect(restoreCheckoutIntent(durable, legacy, buyerB)).toBeNull();
    expect(() => parseCheckoutIntent(rawA, buyerB)).toThrow('recuperar');
    const offeredB = chooseOfferedPlan(preference, [{ code: 'full' }]);
    expect(offeredB.code).toBe('full'); expect(offeredB.notice).toBeTruthy();
    persistCheckoutIntent(durable, intent(offeredB.code!, buyerB, 'buyer-b-navigation-key'));
    expect(durable.getItem(checkoutIntentKey(buyerA))).toBe(rawA);
    expect(restoreCheckoutIntent(durable, legacy, buyerB)?.selection.plan).toBe('full');
  });
  it('does not turn an ambiguous URL into an accepted financing choice', () => {
    const durable = memory(), pending = intent('three_parts');
    persistCheckoutIntent(durable, pending);
    expect(returnedPlan('plan=full&plan=three_parts')).toBeUndefined();
    expect(restoreCheckoutIntent(durable, memory(), buyerA)).toEqual(pending);
  });
  it('keeps damaged recovery data even when navigation carries a valid plan', () => {
    const durable = memory(); durable.setItem(checkoutIntentKey(buyerA), '{damaged');
    expect(returnedPlan('plan=three_parts')).toBe('three_parts');
    expect(() => restoreCheckoutIntent(durable, memory(), buyerA)).toThrow('recuperar');
    expect(durable.getItem(checkoutIntentKey(buyerA))).toBe('{damaged');
  });
});
