import { afterAll, expect, it } from 'vitest';
import { admin, asUser, createStoreWithProduct, createUser, pool } from '../../src/db';
afterAll(() => pool.end());
it('store owner persists permitted profile fields, but cannot approve or change identity and ratings', async () => {
  const owner = await createUser('store-writer'); const f = await createStoreWithProduct({ owner: owner.id });
  const [before] = await admin('select * from public.stores where id = $1', [f.storeId]);
  const [row] = await asUser(owner.id, (sql) => sql(`update public.stores set name='Nuevo perfil', description='Descripción', contact_email='perfil@example.com', shipping_info='MRW', policies='{"returns":"Siete días"}', tagline='Frase', accent='plum', status='suspended', kind='platform', slug='intrusion', rating_avg=5, rating_count=10, is_demo=false where id=$1 returning *`, [f.storeId]));
  expect(row).toMatchObject({ name: 'Nuevo perfil', description: 'Descripción', contact_email: 'perfil@example.com', shipping_info: 'MRW', policies: { returns: 'Siete días' }, tagline: 'Frase', accent: 'plum', status: before.status, kind: before.kind, slug: before.slug, rating_avg: before.rating_avg, rating_count: before.rating_count, is_demo: before.is_demo });
  expect((await admin('select name from public.stores where id=$1', [f.storeId]))[0].name).toBe('Nuevo perfil');
});
it('foreign seller, buyer and guest cannot write a store or insert storage objects in its folder', async () => {
  const owner = await createUser('store-storage-owner'); const foreign = await createUser('store-storage-foreign'); const f = await createStoreWithProduct({ owner: owner.id });
  for (const user of [foreign.id, null]) {
    const update = () => asUser(user, (sql) => sql("update public.stores set name='Ajena' where id=$1 returning id", [f.storeId]));
    if (user) expect(await update()).toEqual([]);
    else await expect(update()).rejects.toMatchObject({ code: '42501' });
    await expect(asUser(user, (sql) => sql("insert into storage.objects(bucket_id,name) values ('stores',$1)", [`${f.storeId}/foreign-${user}.png`]))).rejects.toMatchObject({ code: '42501' });
  }
  await asUser(owner.id, (sql) => sql("insert into storage.objects(bucket_id,name) values ('stores',$1)", [`${f.storeId}/own.png`]));
});
