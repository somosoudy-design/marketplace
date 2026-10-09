import { afterAll, describe, expect, it } from 'vitest';
import { admin, asUser, createStoreWithProduct, createUser, expectHint, pool } from '../../src/db';

afterAll(() => pool.end());

describe('catalog authoring', () => {
  it('generates a unique slug per store when the seller leaves it empty', async () => {
    const seller = await createUser('slug-seller');
    const f = await createStoreWithProduct({ owner: seller.id });
    const insert = () =>
      asUser(seller.id, (sql) =>
        sql(
          `insert into public.products (store_id, category_id, title) values ($1, $2, 'Cámara Instantánea Ñandú 2') returning slug`,
          [f.storeId, f.categoryId],
        ),
      );
    const [[a], [b]] = [await insert(), await insert()];
    expect(a.slug).toBe('camara-instantanea-nandu-2');
    expect(b.slug).toBe('camara-instantanea-nandu-2-2');
  });

  it('publishes a reviewed import as a pending product, only with confirmed image rights, once', async () => {
    const adm = await createUser('imp-admin', { role: 'admin' });
    const seller = await createUser('imp-seller');
    const f = await createStoreWithProduct({ kind: 'platform' });
    const [imp] = await admin(
      `insert into public.url_imports (url, provider, status, extracted) values ('https://www.ugreen.com/products/x', 'ugreen', 'extracted', '{}') returning id`,
    );
    const product = {
      store_id: f.storeId, category_id: f.categoryId, title: 'Cargador Nexode 65W', description: 'Texto propio',
      base_price_usd: '39.90', availability: 'on_order',
    };
    const image = { path: `${f.storeId}/imports/${imp.id}/0.jpg`, alt: 'Cargador', rights_confirmed: true };
    const call = (uid: string, images: unknown[], p: Record<string, unknown> = product) =>
      asUser(uid, (sql) =>
        sql(`select public.publish_import($1, $2::jsonb, '[]'::jsonb, $3::jsonb) as id`, [imp.id, JSON.stringify(p), JSON.stringify(images)]),
      );

    await expect(call(seller.id, [image])).rejects.toMatchObject({ code: '42501' });
    await expectHint(call(adm.id, [{ ...image, rights_confirmed: false }]), 'image_rights_required');
    await expectHint(call(adm.id, [{ ...image, path: 'otra-tienda/x.jpg' }]), 'invalid_state');
    await expectHint(call(adm.id, [image], { ...product, base_price_usd: '39.999' }), 'invalid_amount');

    const [{ id }] = await call(adm.id, [image]);
    const [p] = await admin(
      `select moderation_status, origin, source_provider, slug, base_price_usd::text as price from public.products where id = $1`,
      [id],
    );
    expect(p).toEqual({ moderation_status: 'pending', origin: 'import', source_provider: 'ugreen', slug: 'cargador-nexode-65w', price: '39.90' });
    expect(await admin(`select title, price_usd::text as price from public.product_variants where product_id = $1`, [id])).toEqual([
      { title: 'Única', price: '39.90' },
    ]);
    expect(await admin(`select path from public.product_images where product_id = $1`, [id])).toEqual([{ path: image.path }]);
    const [u] = await admin(`select status, product_id from public.url_imports where id = $1`, [imp.id]);
    expect(u).toEqual({ status: 'published', product_id: id });
    const [audit] = await admin(`select actor_id, data from public.audit_log where action = 'publish_import' and entity_id = $1`, [id]);
    expect(audit.actor_id).toBe(adm.id);

    await expectHint(call(adm.id, [image]), 'already_processed');
  });
});
