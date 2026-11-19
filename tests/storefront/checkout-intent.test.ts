import { describe, expect, it } from 'vitest';
import { restoreCheckoutIntent, checkoutIntentKey, clearCheckoutIntent, parseCheckoutIntent, persistCheckoutIntent, type CheckoutIntent } from '../../apps/storefront/src/lib/checkout-intent';
const buyer = '11111111-1111-4111-8111-111111111111';
const address = '22222222-2222-4222-8222-222222222222';
const candidate = (key = 'order-key-1'): CheckoutIntent => ({ version: 2, buyerId: buyer, key, reviewToken: 'a'.repeat(64), selection: { address, shipping: { group: 'method-a' }, plan: 'full' } });
it('migrates the original legacy reference into durable storage without attaching a review token',()=>{
 const durable=fixture(),legacy=fixture();const input={key:'legacy-order-key',selection:candidate().selection};legacy.storage.setItem(checkoutIntentKey(buyer),JSON.stringify(input));
 const restored=restoreCheckoutIntent(durable.storage,legacy.storage,buyer);expect(restored).toMatchObject({...input,buyerId:buyer});expect(restored?.reviewToken).toBeUndefined();expect(legacy.values.size).toBe(0);expect(restoreCheckoutIntent(durable.storage,fixture().storage,buyer)).toEqual(restored);
});
it('keeps the legacy reference when durable storage cannot save it',()=>{
 const durable=fixture(),legacy=fixture();const raw=JSON.stringify(candidate());legacy.storage.setItem(checkoutIntentKey(buyer),raw);
 expect(()=>restoreCheckoutIntent({...durable.storage,setItem:()=>{throw new Error('disk full');}},legacy.storage,buyer)).toThrow('disk full');expect(legacy.storage.getItem(checkoutIntentKey(buyer))).toBe(raw);expect(durable.values.size).toBe(0);
});
it('preserves both references when an older tab and durable storage contain different operations',()=>{
 const durable=fixture(),legacy=fixture();const a=JSON.stringify(candidate('durable-order')),b=JSON.stringify(candidate('legacy-order'));durable.storage.setItem(checkoutIntentKey(buyer),a);legacy.storage.setItem(checkoutIntentKey(buyer),b);
 expect(()=>restoreCheckoutIntent(durable.storage,legacy.storage,buyer)).toThrow('dos compras');expect(durable.storage.getItem(checkoutIntentKey(buyer))).toBe(a);expect(legacy.storage.getItem(checkoutIntentKey(buyer))).toBe(b);
});
function fixture() {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  return { values, storage };
}
describe('reviewed checkout durable intent', () => {
  it('persists the actor, accepted review and exact selection before returning', () => {
    const f = fixture(), result = persistCheckoutIntent(f.storage, candidate());
    expect(result.fresh).toBe(true);
    expect(parseCheckoutIntent(f.values.get(checkoutIntentKey(buyer))!, buyer)).toEqual(candidate());
  });
  it('a repeated acquisition reuses the stored key rather than the proposed new random key', () => {
    const f = fixture(); persistCheckoutIntent(f.storage, candidate());
    const retry = persistCheckoutIntent(f.storage, candidate('different-key'));
    expect(retry.fresh).toBe(false); expect(retry.intent.key).toBe('order-key-1');
  });
  it('keeps uncertain data and rejects changing review, destination, plan or shipping', () => {
    const f = fixture(); persistCheckoutIntent(f.storage, candidate()); const raw = f.values.get(checkoutIntentKey(buyer));
    const changed: CheckoutIntent[] = [
      { ...candidate(), reviewToken: 'b'.repeat(64) },
      { ...candidate(), selection: { ...candidate().selection, address: '33333333-3333-4333-8333-333333333333' } },
      { ...candidate(), selection: { ...candidate().selection, plan: 'installments' } },
      { ...candidate(), selection: { ...candidate().selection, shipping: { group: 'method-b' } } },
    ];
    for (const value of changed) expect(() => persistCheckoutIntent(f.storage, value)).toThrow('pendiente');
    expect(f.values.get(checkoutIntentKey(buyer))).toBe(raw);
  });
  it('never treats a failed durable write as a fresh intent ready to send', () => {
    const f = fixture(); const storage = { ...f.storage, setItem: () => { throw new Error('quota'); } };
    expect(() => persistCheckoutIntent(storage, candidate())).toThrow('quota'); expect(f.values.size).toBe(0);
  });
  it('rejects malformed stored state and another buyer without deleting it', () => {
    for (const raw of ['{broken', JSON.stringify({ ...candidate(), buyerId: 'other-buyer' }), JSON.stringify({ ...candidate(), reviewToken: 'bad' }), JSON.stringify({ ...candidate(), selection: { ...candidate().selection, shipping: [] } })]) {
      const f = fixture(); f.values.set(checkoutIntentKey(buyer), raw);
      expect(() => persistCheckoutIntent(f.storage, candidate())).toThrow('recuperar'); expect(f.values.get(checkoutIntentKey(buyer))).toBe(raw);
    }
  });
  it('recovers legacy keys without inventing a review token and blocks upgrading an uncertain attempt', () => {
    const f = fixture(), legacy = { key: 'legacy-order-key', selection: candidate().selection };
    f.values.set(checkoutIntentKey(buyer), JSON.stringify(legacy));
    const restored = parseCheckoutIntent(f.values.get(checkoutIntentKey(buyer))!, buyer);
    expect(restored?.key).toBe(legacy.key); expect(restored?.reviewToken).toBeUndefined();
    expect(() => persistCheckoutIntent(f.storage, candidate())).toThrow('pendiente');
  });
  it('a late completion cannot erase a newer attempt or changed payload', () => {
    const f = fixture(); persistCheckoutIntent(f.storage, candidate());
    const next = { ...candidate('next-order-key'), reviewToken: 'b'.repeat(64) };
    f.values.set(checkoutIntentKey(buyer), JSON.stringify(next));
    expect(clearCheckoutIntent(f.storage, candidate())).toBe(false);
    expect(parseCheckoutIntent(f.values.get(checkoutIntentKey(buyer))!, buyer)).toEqual(next);
  });
  it('allows a fresh intent after the previous result is definitive', () => {
    const f = fixture(); persistCheckoutIntent(f.storage, candidate()); expect(clearCheckoutIntent(f.storage, candidate())).toBe(true);
    expect(persistCheckoutIntent(f.storage, candidate('next-order-key')).fresh).toBe(true);
  });
});
