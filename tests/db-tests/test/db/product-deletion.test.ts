import { afterAll, expect, it } from 'vitest';
import { admin, asUser, createStoreWithProduct, createUser, expectHint, pool } from '../../src/db';

afterAll(() => pool.end());
const version = async (id: string) => (await admin('select updated_at::text as version from public.products where id=$1', [id]))[0]?.version;
const suspend = async (id: string) => { await admin("update public.products set moderation_status='suspended',moderation_note='Retirada de catálogo' where id=$1", [id]); return version(id); };
const erase = (actor: string | null, id: string, updated: string | null) => asUser(actor, sql => sql('select public.admin_delete_suspended_product($1,$2) as result', [id, updated]));

it('deletes one suspended product and preserves its audit snapshot and unrelated catalogue', async () => {
  const manager = await createUser('delete-admin', { role: 'admin' });
  const f = await createStoreWithProduct(); const other = await createStoreWithProduct();
  await admin('insert into public.product_images(product_id,path,sort) values($1,$2,0)', [f.productId, `${f.storeId}/${f.productId}/original.webp`]);
  const stamp = await suspend(f.productId);
  const [before] = await admin('select to_jsonb(p) as product from public.products p where id=$1', [other.productId]);
  expect((await erase(manager.id, f.productId, stamp))[0].result).toEqual({ product_id: f.productId, deleted: true });
  expect(await admin('select id from public.products where id=$1', [f.productId])).toEqual([]);
  expect(await admin('select id from public.product_variants where product_id=$1', [f.productId])).toEqual([]);
  expect(await admin('select id from public.product_images where product_id=$1', [f.productId])).toEqual([]);
  const [audit] = await admin("select actor_id,data from public.audit_log where entity='product' and entity_id=$1 and action='delete_suspended'", [f.productId]);
  expect(audit.actor_id).toBe(manager.id);
  expect(audit.data.product).toMatchObject({ id: f.productId, moderation_status: 'suspended' });
  expect(audit.data.variants[0].id).toBe(f.variantId);
  expect(audit.data.images[0].path).toBe(`${f.storeId}/${f.productId}/original.webp`);
  expect(audit.data.storage_objects_deleted).toBe(false);
  expect((await admin('select to_jsonb(p) as product from public.products p where id=$1', [other.productId]))[0]).toEqual(before);
  await expectHint(erase(manager.id, f.productId, stamp), 'product_not_found');
  expect((await admin("select count(*)::int n from public.audit_log where action='delete_suspended' and entity_id=$1", [f.productId]))[0].n).toBe(1);
});

it('refuses guests, buyers and both owning and foreign sellers; keeps direct DELETE revoked', async () => {
  const owner = await createUser('delete-owner'); const buyer = await createUser('delete-buyer'); const foreign = await createUser('delete-foreign');
  const f = await createStoreWithProduct({ owner: owner.id }); const stamp = await suspend(f.productId);
  for (const actor of [null, owner.id, buyer.id, foreign.id]) {
    await expect(erase(actor, f.productId, stamp)).rejects.toMatchObject({ code: '42501' });
  }
  const manager = await createUser('delete-direct-admin', { role: 'admin' });
  await expect(asUser(manager.id, sql => sql('delete from public.products where id=$1', [f.productId]))).rejects.toMatchObject({ code: '42501' });
  const [privileges] = await admin("select has_function_privilege('anon','public.admin_delete_suspended_product(uuid,timestamptz)','execute') a, has_function_privilege('service_role','public.admin_delete_suspended_product(uuid,timestamptz)','execute') s");
  expect(privileges).toEqual({ a: false, s: false });
  expect((await admin('select id from public.products where id=$1', [f.productId]))[0].id).toBe(f.productId);
});

it('requires suspended state and the current version, never deleting a newly edited product', async () => {
  const manager = await createUser('delete-state-admin', { role: 'admin' }); const f = await createStoreWithProduct();
  await expectHint(erase(manager.id, f.productId, await version(f.productId)), 'product_not_suspended');
  const stamp = await suspend(f.productId);
  await expectHint(erase(manager.id, f.productId, null), 'updated_at_required');
  await admin("update public.products set title='Cambió después de abrir la ficha' where id=$1", [f.productId]);
  await expectHint(erase(manager.id, f.productId, stamp), 'product_changed');
  expect((await admin('select title from public.products where id=$1', [f.productId]))[0].title).toBe('Cambió después de abrir la ficha');
});

it('preserves carts instead of cascading their lines away', async () => {
  const manager = await createUser('delete-cart-admin', { role: 'admin' }); const buyer = await createUser('delete-cart-buyer'); const f = await createStoreWithProduct();
  await asUser(buyer.id, sql => sql('select public.cart_set_quantity($1,2)', [f.variantId]));
  const stamp = await suspend(f.productId);
  await expectHint(erase(manager.id, f.productId, stamp), 'product_in_carts');
  expect((await admin('select quantity from public.cart_items where user_id=$1 and variant_id=$2', [buyer.id, f.variantId]))[0].quantity).toBe(2);
  expect(await version(f.productId)).toBe(stamp);
});

it('preserves products and complete order snapshots when an order references them', async () => {
  const manager = await createUser('delete-history-admin', { role: 'admin' });
  const [item] = await admin('select product_id from public.order_items order by id limit 1');
  expect(item).toBeDefined();
  const [before] = await admin('select jsonb_agg(to_jsonb(i) order by id) data from public.order_items i where product_id=$1', [item.product_id]);
  const stamp = await suspend(item.product_id);
  await expectHint(erase(manager.id, item.product_id, stamp), 'product_has_orders');
  expect((await admin('select jsonb_agg(to_jsonb(i) order by id) data from public.order_items i where product_id=$1', [item.product_id]))[0]).toEqual(before);
  expect(await version(item.product_id)).toBe(stamp);
});

for (const entity of ['products', 'product_variants', 'product_images']) {
  it(`returns retryable busy when ${entity} is being edited, without waiting on checkout locks`, async () => {
    const manager = await createUser('delete-lock-admin', { role: 'admin' }); const f = await createStoreWithProduct(); const stamp = await suspend(f.productId);
    let lockedId = entity === 'products' ? f.productId : f.variantId;
    if (entity === 'product_images') {
      const [image] = await admin('insert into public.product_images(product_id,path,sort) values($1,$2,0) returning id', [f.productId, `${f.storeId}/${f.productId}/locked.webp`]);
      lockedId = image.id;
    }
    const lock = await pool.connect();
    try {
      await lock.query('begin');
      await lock.query(`select id from public.${entity} where id=$1 for update`, [lockedId]);
      await expectHint(erase(manager.id, f.productId, stamp), 'product_busy');
    } finally { await lock.query('rollback'); lock.release(); }
    expect(await version(f.productId)).toBe(stamp);
  });
}

it('rolls back the audit and deletion when an additional restrictive reference refuses removal', async () => {
  const manager = await createUser('delete-late-admin', { role: 'admin' }); const f = await createStoreWithProduct(); const stamp = await suspend(f.productId);
  await admin('create table public.local_delete_guard(product_id uuid references public.products(id))');
  try {
    await admin('insert into public.local_delete_guard values($1)', [f.productId]);
    await expect(erase(manager.id, f.productId, stamp)).rejects.toMatchObject({ code: '23503' });
    expect(await version(f.productId)).toBe(stamp);
    expect((await admin("select count(*)::int n from public.audit_log where action='delete_suspended' and entity_id=$1", [f.productId]))[0].n).toBe(0);
  } finally { await admin('drop table public.local_delete_guard'); }
});

for (const table of ['product_costs', 'variant_costs']) {
  it(`refuses deletion while ${table} is being edited, preserving cost data and avoiding lock inversion`, async () => {
    const manager = await createUser('delete-cost-admin', { role: 'admin' }); const f = await createStoreWithProduct();
    const column = table === 'product_costs' ? 'product_id' : 'variant_id';
    const id = table === 'product_costs' ? f.productId : f.variantId;
    await admin(table === 'variant_costs' ? 'insert into public.variant_costs(variant_id,cost_usd) values($1,10)' : 'insert into public.product_costs(product_id) values($1)', [id]);
    const stamp = await suspend(f.productId);
    const lock = await pool.connect();
    try {
      await lock.query('begin');
      await lock.query(`select * from public.${table} where ${column}=$1 for update`, [id]);
      await expectHint(erase(manager.id, f.productId, stamp), 'product_busy');
    } finally { await lock.query('rollback'); lock.release(); }
    expect(await version(f.productId)).toBe(stamp);
    expect((await admin(`select count(*)::int n from public.${table} where ${column}=$1`, [id]))[0].n).toBe(1);
  });
}
