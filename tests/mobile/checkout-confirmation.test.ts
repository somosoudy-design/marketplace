import { describe, expect, it, vi } from 'vitest';
import { confirmCheckout, confirmedCheckout, recoverCheckout, UnconfirmedCheckoutError } from '../../apps/mobile/src/lib/checkout-confirmation';

const id = '8ad1592d-4621-4c38-8f73-1b5be2d19733';
const reference = { id, number: 'P-12345' };
const created = { order_id: id, number: reference.number, replayed: false };

describe('checkout confirmation survives an interrupted response without inventing another order', () => {
  it('uses a valid server confirmation directly and performs no lookup', async () => {
    const find = vi.fn();
    expect(await confirmCheckout(async () => created, find)).toEqual(created);
    expect(find).not.toHaveBeenCalled();
  });

  it('recovers a committed order after a network error without calling place again', async () => {
    const place = vi.fn().mockRejectedValue({ code: 'network' });
    const find = vi.fn().mockResolvedValue(reference);
    expect(await confirmCheckout(place, find)).toEqual({ ...created, replayed: true });
    expect(place).toHaveBeenCalledTimes(1);
    expect(find).toHaveBeenCalledTimes(1);
  });

  it.each([null, {}, { order_id: null }, { order_id: 'undefined', number: 'P-123' }, { order_id: id, number: '' }])('does not navigate from an incomplete success: %j', async (value) => {
    expect(confirmedCheckout(value)).toBeNull();
    expect(await confirmCheckout(async () => value, async () => reference)).toEqual({ ...created, replayed: true });
  });

  it('does not hide or reinterpret a definite business rejection', async () => {
    const rejection = { code: 'shipping_invalid' };
    const find = vi.fn();
    await expect(confirmCheckout(async () => { throw rejection; }, find)).rejects.toBe(rejection);
    expect(find).not.toHaveBeenCalled();
  });

  it.each([async () => null, async () => { throw new Error('lookup offline'); }])('keeps the result uncertain when the lookup cannot establish success', async (find) => {
    const place = vi.fn().mockRejectedValue({ code: 'network' });
    await expect(confirmCheckout(place, find)).rejects.toBeInstanceOf(UnconfirmedCheckoutError);
    expect(place).toHaveBeenCalledTimes(1);
  });

  it('a manual check reads only and never claims success for an invalid reference', async () => {
    expect(await recoverCheckout(async () => null)).toBeNull();
    await expect(recoverCheckout(async () => ({ id: 'not-an-id', number: 'P-123' }))).rejects.toBeInstanceOf(UnconfirmedCheckoutError);
  });
});
