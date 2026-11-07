import { describe, expect, it } from 'vitest';
import { canonicalIntentPayload, createPersistentIntentStore, intentStorageKey, IntentStorageError, PendingIntentError, type IntentStorage } from '../src/persistent-intent';

const scope = { actorId: 'buyer-a', operation: 'cart.add', slot: 'variant-a' };
function setup() {
  const values = new Map<string, string>(); let sequence = 0;
  const storage: IntentStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); } };
  const make = () => createPersistentIntentStore(storage, () => `intent-${++sequence}`, () => 123);
  return { values, storage, make, store: make() };
}

describe('persistent intent identity', () => {
  it('recovers the same key and exact payload across navigation/process reconstruction', async () => {
    const s = setup(), first = await s.store.prepare(scope, { variant: 'a', quantity: 2 });
    expect(await s.make().prepare(scope, { quantity: 2, variant: 'a' })).toEqual(first);
  });
  it('serializes simultaneous acquisition before storage settles', async () => {
    const s = setup();
    const [a, b] = await Promise.all([s.store.prepare(scope, { quantity: 2 }), s.store.prepare(scope, { quantity: 2 })]);
    expect(a.key).toBe(b.key); expect(s.values.size).toBe(1);
  });
  it('does not reuse an intent for another actor, operation or resource', async () => {
    const s = setup(), keys = [];
    for (const next of [scope, { ...scope, actorId: 'buyer-b' }, { ...scope, operation: 'cart.merge' }, { ...scope, slot: 'variant-b' }]) keys.push((await s.store.prepare(next, {})).key);
    expect(new Set(keys).size).toBe(4);
  });
  it('blocks a changed payload while the previous result is uncertain and keeps the original', async () => {
    const s = setup(), first = await s.store.prepare(scope, { quantity: 2 });
    await expect(s.store.prepare(scope, { quantity: 3 })).rejects.toBeInstanceOf(PendingIntentError);
    expect(await s.store.read(scope)).toEqual(first);
  });
  it('allows a deliberate repeated action only after definitive completion', async () => {
    const s = setup(), first = await s.store.prepare(scope, {});
    expect(await s.store.complete(first)).toBe(true);
    expect((await s.store.prepare(scope, {})).key).not.toBe(first.key);
  });
  it('a late completion cannot erase a newer operation or another buyer', async () => {
    const s = setup(), old = await s.store.prepare(scope, {});
    await s.store.complete(old);
    const next = await s.store.prepare(scope, {}), other = await s.store.prepare({ ...scope, actorId: 'buyer-b' }, {});
    expect(await s.store.complete(old)).toBe(false);
    expect(await s.store.read(scope)).toEqual(next);
    expect(await s.store.read({ ...scope, actorId: 'buyer-b' })).toEqual(other);
  });
  it('does not send callers a transient identity when durable persistence fails', async () => {
    const s = setup(), failure = new Error('quota');
    const store = createPersistentIntentStore({ ...s.storage, setItem: () => { throw failure; } }, () => 'intent-1');
    await expect(store.prepare(scope, {})).rejects.toBe(failure);
    expect(await s.store.read(scope)).toBeNull();
  });
  it('keeps pending data when durable completion fails', async () => {
    const s = setup(), first = await s.store.prepare(scope, {});
    const failure = new Error('offline storage');
    const store = createPersistentIntentStore({ ...s.storage, removeItem: () => { throw failure; } }, () => 'unused-key');
    await expect(store.complete(first)).rejects.toBe(failure);
    expect(await s.store.read(scope)).toEqual(first);
  });
  it('rejects malformed storage instead of silently inventing a new key', async () => {
    const s = setup(); s.values.set(intentStorageKey(scope), '{bad');
    await expect(s.store.prepare(scope, {})).rejects.toBeInstanceOf(IntentStorageError);
    expect(s.values.get(intentStorageKey(scope))).toBe('{bad');
  });
  it('does not expire a pending intent by elapsed time', async () => {
    const s = setup(), first = await s.store.prepare(scope, {});
    const later = createPersistentIntentStore(s.storage, () => 'new-key-1', () => 9999999999999);
    expect(await later.prepare(scope, {})).toEqual(first);
  });
  it('rejects lossy or ambiguous JSON before persisting', async () => {
    const s = setup(), circular: Record<string, unknown> = {}; circular.self = circular;
    for (const payload of [NaN, Infinity, undefined, { quantity: undefined }, new Date(), circular, new Array(2)]) await expect(s.store.prepare(scope, payload)).rejects.toBeInstanceOf(TypeError);
    expect(s.values.size).toBe(0);
  });
  it('preserves arrays, null, false and zeros and handles repeated non-cyclic objects', () => {
    const shared = { b: 2, a: 1 };
    expect(canonicalIntentPayload({ z: [shared, shared, null, false, 0], a: '' })).toBe('{"a":"","z":[{"a":1,"b":2},{"a":1,"b":2},null,false,0]}');
  });
});
