import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { admin, asUser, createStoreWithProduct, createUser, expectHint, key, pool, DATABASE_URL } from '../../src/db';

const target = new URL(DATABASE_URL);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || !['55437', '54322'].includes(target.port)
    || !(target.pathname === '/kora_test' || /^\/mayami_(?:functional_)?guest_[a-zA-Z0-9_]+$/.test(target.pathname))) {
  throw new Error('An isolated local guest test clone or kora_test is required');
}
afterAll(() => pool.end());

type Receipt = { accepted: number; inserted: number; product_ids: string[]; replayed: boolean };
const merge = (actor: string | null, ids: string[], intent: string) =>
  asUser(actor, async sql => (await sql('select public.favorites_merge_intent($1::uuid[],$2) result', [ids, intent]))[0].result as Receipt);
const saved = (actor: string) => asUser(actor, sql => sql('select product_id::text,created_at from public.favorites where user_id=$1 order by product_id', [actor]));
const savedIds = async (actor: string) => (await saved(actor)).map(row => row.product_id as string);
const receipts = (actor: string) => admin('select idempotency_key,product_ids,result from favorites_private.merge_journal where buyer_id=$1 order by idempotency_key', [actor]);
const normalOn = (actor: string, product: string) => asUser(actor, sql => sql(
  'insert into public.favorites(user_id,product_id) values($1,$2) on conflict(user_id,product_id) do nothing', [actor, product],
));
const normalOff = (actor: string, product: string) => asUser(actor, sql => sql(
  'delete from public.favorites where user_id=$1 and product_id=$2', [actor, product],
));

describe('actor-bound guest favorites merge — isolated clone only', () => {
  it('unions into a nonempty account without replacing unrelated rows or timestamps', async () => {
    const buyer = await createUser('favorite-union');
    const existing = await createStoreWithProduct(), unrelated = await createStoreWithProduct(), guest = await createStoreWithProduct();
    await normalOn(buyer.id, existing.productId); await normalOn(buyer.id, unrelated.productId);
    const before = await saved(buyer.id);
    const result = await merge(buyer.id, [guest.productId, existing.productId, guest.productId], key('favorite-union'));
    expect(result).toEqual({ accepted: 2, inserted: 1, product_ids: [guest.productId, existing.productId].sort(), replayed: false });
    expect(await savedIds(buyer.id)).toEqual([guest.productId, existing.productId, unrelated.productId].sort());
    for (const row of before) expect((await saved(buyer.id)).find(next => next.product_id === row.product_id)?.created_at).toEqual(row.created_at);
  });

  it('normalizes duplicates, UUID case and order into the same bound receipt', async () => {
    const buyer = await createUser('favorite-normalized');
    const a = await createStoreWithProduct(), b = await createStoreWithProduct(), intent = key('favorite-normalized');
    const first = await merge(buyer.id, [b.productId, a.productId, a.productId], intent);
    const next = await merge(buyer.id, [a.productId.toUpperCase(), b.productId.toUpperCase()], intent);
    expect(next).toEqual({ ...first, replayed: true });
    expect(await receipts(buyer.id)).toHaveLength(1);
    expect(await savedIds(buyer.id)).toEqual([a.productId, b.productId].sort());
  });

  it('a lost response then normal off then replay never resurrects the removed favorite', async () => {
    const buyer = await createUser('favorite-lost-response');
    const a = await createStoreWithProduct(), b = await createStoreWithProduct(), intent = key('favorite-lost');
    const historical = await merge(buyer.id, [a.productId, b.productId], intent); // server commits; pretend caller never received it
    await normalOff(buyer.id, a.productId);
    expect(await merge(buyer.id, [b.productId, a.productId], intent)).toEqual({ ...historical, replayed: true });
    expect(await savedIds(buyer.id)).toEqual([b.productId]);
    // A further delayed original is also a replay, not a new union.
    expect((await merge(buyer.id, [a.productId, b.productId], intent)).replayed).toBe(true);
    expect(await savedIds(buyer.id)).toEqual([b.productId]);
    expect(await receipts(buyer.id)).toHaveLength(1);
  });

  it('concurrent identical requests produce one receipt and one mutation', async () => {
    const buyer = await createUser('favorite-concurrent');
    const p = await createStoreWithProduct(), intent = key('favorite-concurrent');
    const results = await Promise.all([merge(buyer.id, [p.productId], intent), merge(buyer.id, [p.productId], intent)]);
    expect(results.map(row => row.replayed).sort()).toEqual([false, true]);
    expect(await savedIds(buyer.id)).toEqual([p.productId]);
    expect(await receipts(buyer.id)).toHaveLength(1);
  });

  it('different concurrent batches preserve their union and use separate receipts', async () => {
    const buyer = await createUser('favorite-batches');
    const a = await createStoreWithProduct(), b = await createStoreWithProduct(), c = await createStoreWithProduct();
    const results = await Promise.all([
      merge(buyer.id, [a.productId, b.productId], key('favorite-batch-a')),
      merge(buyer.id, [b.productId, c.productId], key('favorite-batch-b')),
    ]);
    expect(results.every(row => !row.replayed)).toBe(true);
    expect(await savedIds(buyer.id)).toEqual([a.productId, b.productId, c.productId].sort());
    expect(await receipts(buyer.id)).toHaveLength(2);
  });

  it('binds the same key to a single normalized set and rejects changed IDs', async () => {
    const buyer = await createUser('favorite-binding');
    const a = await createStoreWithProduct(), b = await createStoreWithProduct(), intent = key('favorite-bound');
    await merge(buyer.id, [a.productId], intent);
    await expectHint(merge(buyer.id, [b.productId], intent), 'idempotency_conflict');
    expect(await savedIds(buyer.id)).toEqual([a.productId]); expect(await receipts(buyer.id)).toHaveLength(1);
  });

  it('isolates A and B with the same key and never returns or modifies another buyer rows', async () => {
    const a = await createUser('favorite-owner-a'), b = await createUser('favorite-owner-b');
    const pa = await createStoreWithProduct(), pb = await createStoreWithProduct(), intent = key('favorite-shared-key');
    const ra = await merge(a.id, [pa.productId], intent), rb = await merge(b.id, [pb.productId], intent);
    expect(ra.product_ids).toEqual([pa.productId]); expect(rb.product_ids).toEqual([pb.productId]);
    expect(await savedIds(a.id)).toEqual([pa.productId]); expect(await savedIds(b.id)).toEqual([pb.productId]);
    expect(await asUser(b.id, sql => sql('select * from public.favorites where user_id=$1', [a.id]))).toHaveLength(0);
    await expect(asUser(b.id, sql => sql('insert into public.favorites(user_id,product_id) values($1,$2)', [a.id, pb.productId]))).rejects.toMatchObject({ code: '42501' });
    expect(await receipts(a.id)).toHaveLength(1); expect(await receipts(b.id)).toHaveLength(1);
  });

  it('requires identity and keeps all journal access private', async () => {
    const buyer = await createUser('favorite-private'), p = await createStoreWithProduct();
    await merge(buyer.id, [p.productId], key('favorite-private'));
    await expect(merge(null, [p.productId], key('favorite-anon'))).rejects.toMatchObject({ code: '42501' });
    for (const actor of [buyer.id, null]) {
      await expect(asUser(actor, sql => sql('select * from favorites_private.merge_journal'))).rejects.toMatchObject({ code: '42501' });
      await expect(asUser(actor, sql => sql('delete from favorites_private.merge_journal'))).rejects.toMatchObject({ code: '42501' });
    }
    const [policy] = await admin("select relrowsecurity from pg_class where oid='favorites_private.merge_journal'::regclass");
    expect(policy.relrowsecurity).toBe(true);
    const [acl] = await admin("select has_function_privilege('anon','public.favorites_merge_intent(uuid[],text)','EXECUTE') anon, has_function_privilege('authenticated','public.favorites_merge_intent(uuid[],text)','EXECUTE') authenticated");
    expect(acl).toEqual({ anon: false, authenticated: true });
    const c = await pool.connect();
    try {
      await c.query('begin');
      await c.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ role: 'authenticated' })]);
      await c.query('set local role authenticated');
      await expect(c.query('select public.favorites_merge_intent($1::uuid[],$2)', [[p.productId], key('favorite-no-sub')]))
        .rejects.toMatchObject({ code: '28000', hint: 'auth_required' });
    } finally { await c.query('rollback').catch(() => undefined); c.release(); }
  });

  it('retains normal favorites semantics without exposing hidden product fields', async () => {
    const buyer = await createUser('favorite-existing-policy');
    const hidden = await createStoreWithProduct({ status: 'suspended' });
    const read = () => asUser(buyer.id, sql => sql('select * from public.products where id=$1', [hidden.productId]));
    expect(await read()).toHaveLength(0);
    // Existing favorites_own + FK permits a known product UUID; no product visibility grant follows.
    await normalOn(buyer.id, hidden.productId); await normalOff(buyer.id, hidden.productId);
    expect(await merge(buyer.id, [hidden.productId], key('favorite-known-id'))).toMatchObject({ product_ids: [hidden.productId], accepted: 1 });
    expect(await read()).toHaveLength(0);
  });

  it('rolls back the entire new operation on an invalid FK and leaves no partial receipt', async () => {
    const buyer = await createUser('favorite-atomic');
    const existing = await createStoreWithProduct(), valid = await createStoreWithProduct();
    await normalOn(buyer.id, existing.productId);
    await expect(merge(buyer.id, [valid.productId, randomUUID()], key('favorite-invalid-fk'))).rejects.toMatchObject({ code: '23503' });
    expect(await savedIds(buyer.id)).toEqual([existing.productId]); expect(await receipts(buyer.id)).toHaveLength(0);
  });

  it('bounds raw input, rejects empty/null/nested IDs and keys, and accepts 100 repeated valid IDs', async () => {
    const buyer = await createUser('favorite-input'), p = await createStoreWithProduct();
    const call = (ids: unknown, intent: string | null) => asUser(buyer.id, sql => sql('select public.favorites_merge_intent($1::uuid[],$2)', [ids, intent]));
    for (const ids of [null, [], [null], [[p.productId]], Array(101).fill(p.productId)]) await expectHint(call(ids, key('favorite-invalid')), 'invalid_input');
    for (const intent of [null, 'short', 'x'.repeat(81)]) await expectHint(call([p.productId], intent), 'idempotency_required');
    expect(await receipts(buyer.id)).toHaveLength(0);
    expect(await merge(buyer.id, Array(100).fill(p.productId), key('favorite-max'))).toMatchObject({ accepted: 1, inserted: 1 });
    expect(await savedIds(buyer.id)).toEqual([p.productId]);
  });

  it('recovers an existing receipt at quota while rejecting a new key', async () => {
    const buyer = await createUser('favorite-budget'), p = await createStoreWithProduct(), intent = key('favorite-budget');
    await merge(buyer.id, [p.productId], intent);
    const c = await pool.connect();
    try {
      await c.query('begin');
      await c.query(`insert into public.rate_limits(user_id,action,window_start,hits)
        values($1,'favorites_merge_intent',to_timestamp(floor(extract(epoch from now())/60)*60),120)
        on conflict(user_id,action,window_start) do update set hits=120`, [buyer.id]);
      await c.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: buyer.id, role: 'authenticated' })]);
      await c.query('set local role authenticated');
      expect((await c.query('select public.favorites_merge_intent($1::uuid[],$2) result', [[p.productId], intent])).rows[0].result.replayed).toBe(true);
      await c.query('savepoint new_key');
      await expect(c.query('select public.favorites_merge_intent($1::uuid[],$2)', [[p.productId], key('favorite-blocked')])).rejects.toMatchObject({ hint: 'rate_limited' });
      await c.query('rollback to savepoint new_key');
      await c.query('commit');
    } finally { await c.query('rollback').catch(() => undefined); c.release(); }
    expect(await receipts(buyer.id)).toHaveLength(1); expect(await savedIds(buyer.id)).toEqual([p.productId]);
  });
});
