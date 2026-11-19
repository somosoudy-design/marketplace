import { afterAll, describe, expect, it } from 'vitest';
import { admin, asUser, createStoreWithProduct, createUser, pool } from '../../src/db';

afterAll(() => pool.end());

describe('VEN-01A server authorization (existing policies)', () => {
  it('buyer and guest cannot read private products or seller summaries and deliveries', async () => {
    const seller = await createUser('ven-owner');
    const buyer = await createUser('ven-buyer');
    const f = await createStoreWithProduct({ owner: seller.id });
    await admin(`update public.products set moderation_status = 'pending' where id = $1`, [f.productId]);
    for (const user of [buyer.id, null]) {
      expect(await asUser(user, (sql) => sql('select id from public.products where id = $1', [f.productId]))).toEqual([]);
      await expect(asUser(user, (sql) => sql('select public.seller_dashboard($1)', [f.storeId]))).rejects.toMatchObject({ code: '42501' });
      await expect(asUser(user, (sql) => sql('select public.seller_fulfillments($1)', [f.storeId]))).rejects.toMatchObject({ code: '42501' });
    }
  });

  it('sellers see their membership and private catalogue, but cannot read or update another store', async () => {
    const seller = await createUser('ven-mine');
    const other = await createUser('ven-other');
    const a = await createStoreWithProduct({ owner: seller.id });
    const b = await createStoreWithProduct({ owner: other.id });
    await admin(`update public.products set moderation_status = 'pending' where id in ($1, $2)`, [a.productId, b.productId]);
    const rows = await asUser(seller.id, (sql) => sql('select id from public.products where id in ($1, $2)', [a.productId, b.productId]));
    expect(rows.map((r) => r.id)).toEqual([a.productId]);
    const members = await asUser(seller.id, (sql) => sql('select store_id from public.store_members where user_id = auth.uid()'));
    expect(members.map((r) => r.store_id)).toEqual([a.storeId]);
    await expect(asUser(seller.id, (sql) => sql('select public.seller_dashboard($1)', [b.storeId]))).rejects.toMatchObject({ code: '42501' });
    await expect(asUser(seller.id, (sql) => sql('select public.seller_fulfillments($1)', [b.storeId]))).rejects.toMatchObject({ code: '42501' });
    expect(await asUser(seller.id, (sql) => sql("update public.products set title = 'Intrusión' where id = $1 returning id", [b.productId]))).toEqual([]);
    expect(await asUser(seller.id, (sql) => sql("update public.stores set name = 'Intrusión' where id = $1 returning id", [b.storeId]))).toEqual([]);
  });

  it('admin retains actual access; membership and buyer profile coexist with multiple roles', async () => {
    const user = await createUser('ven-multi', { role: 'admin' });
    const f = await createStoreWithProduct({ owner: user.id });
    const other = await createStoreWithProduct();
    expect(await asUser(user.id, (sql) => sql('select role from public.user_roles where user_id = auth.uid()'))).toEqual([{ role: 'admin' }]);
    const [{ seller_dashboard: d }] = await asUser(user.id, (sql) => sql('select public.seller_dashboard($1)', [other.storeId]));
    expect(d.products.published).toBe(1);
    expect(await asUser(user.id, (sql) => sql('select id from public.profiles where id = auth.uid()'))).toEqual([{ id: user.id }]);
    expect(await asUser(user.id, (sql) => sql('select store_id from public.store_members where user_id = auth.uid()'))).toEqual([{ store_id: f.storeId }]);
  });

  it('client-editable user metadata cannot grant seller or admin access', async () => {
    const buyer = await createUser('ven-tamper');
    const f = await createStoreWithProduct();
    await admin(`update auth.users set raw_user_meta_data = $2 where id = $1`, [buyer.id, { roles: ['admin'], stores: [f.storeId] }]);
    const [{ is_admin }] = await asUser(buyer.id, (sql) => sql('select public.is_admin()'));
    expect(is_admin).toBe(false);
    await expect(asUser(buyer.id, (sql) => sql('select public.seller_dashboard($1)', [f.storeId]))).rejects.toMatchObject({ code: '42501' });
  });
});
