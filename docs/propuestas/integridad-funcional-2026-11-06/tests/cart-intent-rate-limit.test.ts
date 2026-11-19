import { afterAll, describe, expect, it } from 'vitest';
// Proposed destination: tests/db-tests/test/db/cart-intent-rate-limit.test.ts
import { admin, asUser, createStoreWithProduct, createUser, key, pool } from '../../src/db';
const target = new URL(process.env.TEST_DATABASE_URL ?? 'invalid:');
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || !target.pathname.startsWith('/mayami_functional_')) {
  throw new Error('An explicit isolated local mayami_functional_* clone is required');
}
afterAll(() => pool.end());

describe('cart cancellation budget preserves terminal recovery — isolated clone only', () => {
  it('blocks a new tombstone at quota, but existing completed/cancelled intents remain recoverable', async () => {
    const buyer = await createUser('cancel-budget');
    const product = await createStoreWithProduct({ stock: 10 });
    const completed = key('budget-completed'), cancelled = key('budget-cancelled'), blocked = key('budget-blocked');
    const payload = JSON.stringify({ variant_id: product.variantId, quantity: 1 });
    await asUser(buyer.id, sql => sql('select public.cart_add_intent($1,1,$2)', [product.variantId, completed]));
    await asUser(buyer.id, sql => sql('select public.cart_cancel_intent($1,$2::jsonb,$3)', ['add', payload, cancelled]));

    // Seed and exercise in one transaction: now() fixes the window even across a wall-clock minute boundary.
    const c = await pool.connect();
    try {
      await c.query('begin');
      await c.query(`insert into public.rate_limits(user_id,action,window_start,hits)
        values($1,'cart_cancel_intent',to_timestamp(floor(extract(epoch from now())/60)*60),120)
        on conflict(user_id,action,window_start) do update set hits=120`, [buyer.id]);
      await c.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: buyer.id, role: 'authenticated' })]);
      await c.query('set local role authenticated');
      await c.query('savepoint new_key');
      await expect(c.query('select public.cart_cancel_intent($1,$2::jsonb,$3)', ['add', payload, blocked]))
        .rejects.toMatchObject({ hint: 'rate_limited' });
      await c.query('rollback to savepoint new_key');

      const oldCompleted = await c.query('select public.cart_cancel_intent($1,$2::jsonb,$3) result', ['add', payload, completed]);
      expect(oldCompleted.rows[0].result).toMatchObject({ state: 'completed', replayed: true, result: { quantity: 1 } });
      const oldCancelled = await c.query('select public.cart_cancel_intent($1,$2::jsonb,$3) result', ['add', payload, cancelled]);
      expect(oldCancelled.rows[0].result).toMatchObject({ state: 'cancelled', replayed: true });
      expect((await c.query('select public.cart_add_intent($1,1,$2) result', [product.variantId, completed])).rows[0].result)
        .toMatchObject({ quantity: 1, replayed: true });
      await c.query('savepoint cancelled_original');
      await expect(c.query('select public.cart_add_intent($1,1,$2)', [product.variantId, cancelled]))
        .rejects.toMatchObject({ hint: 'cart_intent_cancelled' });
      await c.query('rollback to savepoint cancelled_original');

      await c.query('reset role');
      const journal = await c.query('select idempotency_key,state from checkout_private.cart_intent_journal where buyer_id=$1 order by idempotency_key', [buyer.id]);
      expect(journal.rows).toHaveLength(2);
      expect(journal.rows.some(row => row.idempotency_key === blocked)).toBe(false);
      expect((await c.query("select hits from public.rate_limits where user_id=$1 and action='cart_cancel_intent' and window_start=to_timestamp(floor(extract(epoch from now())/60)*60)", [buyer.id])).rows[0].hits).toBe(120);
      await c.query('commit');
    } finally {
      await c.query('rollback').catch(() => undefined);
      c.release();
    }
    expect((await admin('select quantity from public.cart_items where user_id=$1 and variant_id=$2', [buyer.id, product.variantId]))[0].quantity).toBe(1);
  });
});
