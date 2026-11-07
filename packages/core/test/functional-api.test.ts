import { expect, it, vi } from 'vitest';
import { createApi } from '../../api/src/api';
import type { KoraClient } from '../../api/src/client';

it('a checkout change reaches the caller and never falls back to unchecked placement', async () => {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: { hint: 'checkout_changed', code: 'P0001' } });
  const api = createApi({ rpc } as unknown as KoraClient);
  await expect(
    api.checkout.placeOrderReviewed('address', {}, 'full', 'stable-intent', 'a'.repeat(64)),
  ).rejects.toMatchObject({ code: 'checkout_changed' });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith(
    'place_order_reviewed',
    expect.objectContaining({ p_idempotency_key: 'stable-intent' }),
  );
});
it('a lost response can retry the same cart intent without generating a replacement key', async () => {
  const rpc = vi
    .fn()
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce({ data: { variant_id: 'red', quantity: 2, replayed: true }, error: null });
  const api = createApi({ rpc } as unknown as KoraClient);
  await expect(api.cart.addWithIntent('red', 2, 'same-intent')).rejects.toMatchObject({ code: 'network' });
  await expect(api.cart.addWithIntent('red', 2, 'same-intent')).resolves.toMatchObject({ quantity: 2, replayed: true });
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
});
it('recovers the same favorite import without a legacy upsert or client-supplied buyer', async () => {
  const rpc = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce({ data: { accepted: 1, inserted: 1, product_ids: ['product'], replayed: true }, error: null });
  const api = createApi({ rpc } as unknown as KoraClient);
  await expect(api.account.mergeFavoritesWithIntent(['product'], 'same-favorite-intent')).rejects.toMatchObject({ code: 'network' });
  await expect(api.account.mergeFavoritesWithIntent(['product'], 'same-favorite-intent')).resolves.toMatchObject({ replayed: true });
  expect(rpc.mock.calls).toEqual([
    ['favorites_merge_intent', { p_product_ids: ['product'], p_idempotency_key: 'same-favorite-intent' }],
    ['favorites_merge_intent', { p_product_ids: ['product'], p_idempotency_key: 'same-favorite-intent' }],
  ]);
});
it('an unavailable metadata RPC fails explicitly; the API does not invent a condition or associate global photos', async () => {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'function missing' } });
  const api = createApi({ rpc } as unknown as KoraClient);
  await expect(api.catalog.productCommercial('product')).rejects.toMatchObject({ code: 'PGRST202' });
  expect(rpc).toHaveBeenCalledTimes(1);
});

it('a seller conflict never retries the legacy write or refreshes the revision automatically', async () => {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '40001', hint: 'seller_revision_conflict' } });
  const api = createApi({ rpc } as unknown as KoraClient);
  await expect(
    api.seller.saveProductReviewed('store', 'product', 'a'.repeat(64), 'same-intent', {
      variants: [{ id: 'variant', stock: 5 }],
    }),
  ).rejects.toMatchObject({ code: 'seller_revision_conflict' });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc.mock.calls[0]?.[0]).toBe('seller_save_product_reviewed');
});
it('seller response recovery preserves the exact draft, revision and intent', async () => {
  const rpc = vi
    .fn()
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce({ data: { product_id: 'product', revision: 'b'.repeat(64), replayed: true }, error: null });
  const api = createApi({ rpc } as unknown as KoraClient);
  const changes = { fields: { title: 'Nuevo nombre' } };
  await expect(
    api.seller.saveProductReviewed('store', 'product', 'a'.repeat(64), 'same-intent', changes),
  ).rejects.toMatchObject({ code: 'network' });
  await expect(
    api.seller.saveProductReviewed('store', 'product', 'a'.repeat(64), 'same-intent', changes),
  ).resolves.toMatchObject({ replayed: true });
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
});

it('invalid nonfinite seller stock never reaches the network or becomes JSON null', () => {
  const rpc = vi.fn();
  const api = createApi({ rpc } as unknown as KoraClient);
  expect(() =>
    api.seller.saveProductReviewed('store', 'product', 'a'.repeat(64), 'same-intent', {
      variants: [{ id: 'variant', stock: Infinity }],
    }),
  ).toThrow(expect.objectContaining({ code: 'invalid_input' }));
  expect(rpc).not.toHaveBeenCalled();
});
