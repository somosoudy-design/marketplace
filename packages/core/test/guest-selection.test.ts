import { expect, it } from 'vitest';
import { canonicalIntentPayload } from '../src/persistent-intent';
import { createGuestCart, type GuestLine, type GuestMergeReservation } from '../src/guest-cart';
import { createGuestFavorites } from '../src/guest-favorites';
const line = (id: string, quantity = 1): GuestLine => ({ variant_id: id, product_id: `product-${id}`, quantity, title: id, variant_title: id, image_path: `${id}.png`, price_usd: 12, availability: 'available' });
function memory() {
  const values = new Map<string, string>();
  return { values, storage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } } };
}
it('keeps variants and quantities through restart, edits and removal', async () => {
  const { storage } = memory(), cart = createGuestCart(storage);
  await cart.add(line('black', 2)); await cart.add(line('white')); await cart.add(line('black'));
  const reopened = createGuestCart(storage);
  expect(await reopened.read()).toEqual([line('black', 3), line('white')]);
  await reopened.setQuantity('white', 4); await reopened.setQuantity('black', 0);
  expect(await createGuestCart(storage).read()).toEqual([line('white', 4)]);
});
it('reserves new guest lines for B while keeping A private, across restarts and acknowledgements', async () => {
  const { storage } = memory(), cart = createGuestCart(storage);
  await cart.add(line('a')); const a = (await cart.reserveMerge('A', () => 'intent-account-a'))!;
  await cart.add(line('b', 3)); const b = (await cart.reserveMerge('B', () => 'intent-account-b'))!;
  const reopened = createGuestCart(storage);
  expect(await reopened.read()).toEqual([]);
  expect((await reopened.pendingMerge('A'))?.lines).toEqual([line('a')]);
  expect((await reopened.pendingMerge('B'))?.lines).toEqual([line('b', 3)]);
  await reopened.add(line('new'));
  expect(await reopened.completeMerge({ ...a, actorId: 'B' })).toBe(false);
  expect(await reopened.completeMerge(b)).toBe(true);
  expect(await reopened.pendingMerge('A')).toEqual(a);
  expect(await reopened.read()).toEqual([line('new')]);
});
it('binds all lines before batching, so another actor cannot claim the remainder of a large cart', async () => {
  const { storage } = memory(), cart = createGuestCart(storage); let key = 0;
  for (let i = 0; i < 53; i++) await cart.add(line(String(i)));
  const first = (await cart.reserveMerge('A', () => `merge-key-${++key}`))!;
  expect(first.lines).toHaveLength(50);
  expect(await cart.reserveMerge('B', () => 'merge-key-b')).toBeNull();
  await cart.completeMerge(first);
  const second = await createGuestCart(storage).pendingMerge('A');
  expect(second?.lines.map(row => row.variant_id)).toEqual(['50', '51', '52']);
  expect(second?.key).not.toBe(first.key);
});
it('recovers each write-ahead crash window without losing lines or changing a reserved intent', async () => {
  for (const failAt of [1, 2, 3]) {
    const { storage } = memory(); let writes = 0, failure = false;
    const guarded = { ...storage, setItem: (key: string, value: string) => { if (failure && ++writes === failAt) throw new Error('disk'); storage.setItem(key, value); } };
    const cart = createGuestCart(guarded); await cart.add(line('a')); failure = true;
    await expect(cart.reserveMerge('A', () => 'stable-reserved-key')).rejects.toThrow('disk'); failure = false;
    const restarted = createGuestCart(guarded), pending = await restarted.pendingMerge('A');
    if (failAt === 1) { expect(pending).toBeNull(); expect(await restarted.read()).toEqual([line('a')]); }
    else { expect(pending?.key).toBe('stable-reserved-key'); expect(pending?.lines).toEqual([line('a')]); expect(await restarted.read()).toEqual([]); }
  }
});
it('upgrades legacy ready/staging reservations before exposing or claiming new guest lines', async () => {
  for (const stage of ['staging', 'ready'] as const) {
    const { storage, values } = memory(); const prior = [line('a')], fresh = [line('b')];
    const legacy: GuestMergeReservation = { version: 1, operation: 'cart.merge', actorId: 'A', key: 'legacy-operation-key', stage, lines: prior,
      sourceJson: JSON.stringify(prior), payloadJson: canonicalIntentPayload([{ variant_id: 'a', quantity: 1 }]) };
    values.set('mayami.guest-merge-reservation.v1', JSON.stringify(legacy));
    values.set('kora.guest-cart.v1', JSON.stringify(stage === 'staging' ? prior : fresh));
    const upgraded = createGuestCart(storage);
    expect((await upgraded.pendingMerge('A'))?.key).toBe(legacy.key);
    expect(await upgraded.pendingMerge('B')).toBeNull();
    expect(await upgraded.read()).toEqual(stage === 'staging' ? [] : fresh);
    expect(values.has('mayami.guest-merge-reservation.v1')).toBe(false);
  }
});
it('coordinates separate instances before reading and detaching a shared browser cart', async () => {
  const { storage } = memory(); let queue: Promise<unknown> = Promise.resolve();
  const lock = <T>(work: () => Promise<T>) => { const run = queue.then(work); queue = run.catch(() => undefined); return run; };
  const a = createGuestCart(storage, lock), b = createGuestCart(storage, lock);
  await Promise.all([a.add(line('same')), b.add(line('same'))]);
  expect(await a.read()).toEqual([line('same', 2)]);
  const claims = await Promise.all([a.reserveMerge('A', () => 'account-a-key'), b.reserveMerge('B', () => 'account-b-key')]);
  expect(claims.filter(Boolean)).toHaveLength(1);
});
it('rejects a cancelled-batch replacement key already held by another batch without corrupting the journal', async () => {
  const { storage } = memory(), cart = createGuestCart(storage); let key = 0;
  for (let i = 0; i < 51; i++) await cart.add(line(String(i)));
  const first = (await cart.reserveMerge('A', () => `reserved-key-${++key}`))!;
  await expect(cart.replaceCancelledMerge(first, ['0'], () => 'reserved-key-2', { state: 'cancelled', operation: 'merge' })).rejects.toThrow();
  expect((await createGuestCart(storage).pendingMerge('A'))?.key).toBe('reserved-key-1');
});
it('persists guest favorites without duplicates and keeps actor reservations separate from new guest choices', async () => {
  const { storage } = memory(), favorites = createGuestFavorites(storage);
  await favorites.set('p1', true); await favorites.set('p2', true); await favorites.set('p1', true);
  expect((await createGuestFavorites(storage).read()).map(row => row.product_id)).toEqual(['p2', 'p1']);
  await favorites.set('p2', false);
  const a = (await favorites.reserveMerge('A', () => 'favorites-a-key'))!;
  await favorites.set('p3', true); const b = (await favorites.reserveMerge('B', () => 'favorites-b-key'))!;
  expect(a.productIds).toEqual(['p1']); expect(b.productIds).toEqual(['p3']);
  await favorites.set('p4', true);
  const reopened = createGuestFavorites(storage);
  expect(await reopened.completeMerge({ ...a, actorId: 'B' })).toBe(false);
  expect(await reopened.completeMerge(b)).toBe(true);
  expect((await reopened.pendingMerge('A'))?.key).toBe(a.key);
  expect((await reopened.read()).map(row => row.product_id)).toEqual(['p4']);
});
it('never detaches favorites before the durable reservation is saved, and binds every batch to its actor', async () => {
  const { storage } = memory(); let fail = false;
  const guarded = { ...storage, setItem: (key: string, value: string) => { if (fail) throw new Error('disk'); storage.setItem(key, value); } };
  const favorites = createGuestFavorites(guarded); let key = 0;
  for (let i = 0; i < 52; i++) await favorites.set(`p${i}`, true);
  fail = true; await expect(favorites.reserveMerge('A', () => `failed-save-key-${++key}`)).rejects.toThrow('disk'); fail = false;
  expect(await favorites.read()).toHaveLength(52);
  const first = (await favorites.reserveMerge('A', () => `favorites-key-${++key}`))!;
  expect(first.productIds).toHaveLength(50);
  expect(await favorites.reserveMerge('B', () => 'other-actor-key')).toBeNull();
  await favorites.completeMerge(first);
  expect((await createGuestFavorites(storage).pendingMerge('A'))?.productIds).toHaveLength(2);
});
it('preserves corrupt storage without replacing it by an empty selection', async () => {
  const { storage, values } = memory(); values.set('mayami.guest-favorites.v1', '{corrupt');
  await expect(createGuestFavorites(storage).read()).rejects.toThrow();
  await expect(createGuestFavorites(storage).set('new', true)).rejects.toThrow();
  expect(values.get('mayami.guest-favorites.v1')).toBe('{corrupt');
});
it('rejects invalid guest edits without corrupting the saved selection or turning it into a removal', async () => {
  const { storage } = memory(), cart = createGuestCart(storage);
  await cart.add(line('kept'));
  for (const quantity of [-1, 0.5, 101, NaN]) await expect(cart.setQuantity('kept', quantity)).rejects.toThrow();
  await expect(cart.add({ ...line('invalid'), price_usd: NaN })).rejects.toThrow();
  expect(await createGuestCart(storage).read()).toEqual([line('kept')]);
});
