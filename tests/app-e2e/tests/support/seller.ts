// Additive fixtures on the LOCAL development stack. No resets, payments or remote credentials.
import pg from 'pg';
import { asOn, databaseUrl, newBuyer } from './db';

export async function adminFixture(label: string) {
  const user = await newBuyer(label);
  const c = new pg.Client({ connectionString: databaseUrl() });
  await c.connect();
  try { await c.query(`insert into public.user_roles (user_id, role) values ($1, 'admin')`, [user.id]); }
  finally { await c.end(); }
  return user;
}

export async function sellerFixture(label: string, opts: { admin?: boolean; empty?: boolean; multi?: boolean } = {}) {
  const user = await newBuyer(label);
  const c = new pg.Client({ connectionString: databaseUrl() });
  await c.connect();
  try {
    if (opts.admin) await c.query(`insert into public.user_roles (user_id, role) values ($1, 'admin')`, [user.id]);
    const slug = `ven-${user.id.slice(0, 8)}`;
    const name = `Tienda A ${slug}`;
    const [{ id: storeId }] = (await c.query(`insert into public.stores (slug, name, status, is_demo, logo_path, contact_email, description, policies)
      values ($1, $2, 'active', true, (select logo_path from public.stores where slug = 'casa-lumen'), $3, 'Tienda de pruebas VEN-01A', '{"returns":"Consulta las condiciones en el panel."}') returning id`, [slug, name, user.email])).rows;
    await c.query(`insert into public.store_members (store_id, user_id) values ($1, $2)`, [storeId, user.id]);
    let secondStoreId: string | undefined;
    if (opts.multi) {
      const [second] = (await c.query(`insert into public.stores (slug, name, status, is_demo) values ($1, $2, 'pending', true) returning id`, [`${slug}-b`, `Tienda B ${slug}`])).rows;
      secondStoreId = second.id;
      await c.query(`insert into public.store_members (store_id, user_id) values ($1, $2)`, [secondStoreId, user.id]);
    }
    let privateProductId: string | undefined;
    let orderNumber: string | undefined;
    if (!opts.empty) {
      const products = (await c.query(`insert into public.products (store_id, category_id, slug, title, origin, availability, moderation_status, is_demo, weight_kg)
        select $1, (select id from public.categories where slug = 'hogar'), $2 || '-' || i, 'Producto VEN ' || lpad(i::text, 2, '0'), 'seller', 'available',
          case when i = 2 then 'pending'::public.moderation_status else 'published'::public.moderation_status end, true, 0.5 from generate_series(1,32) i returning id, slug`, [storeId, slug])).rows;
      privateProductId = products.find((p) => p.slug.endsWith('-2')).id;
      await c.query(`insert into public.product_variants (product_id, title, price_usd, stock) select id, 'Única', 10, 40 from public.products where store_id = $1`, [storeId]);
      const buyer = await newBuyer(`${label}-order`);
      const as = asOn(c);
      // Choose a published variant explicitly; private catalogue rows stay private.
      const [{ id: variantId }] = (await c.query(`select v.id from public.product_variants v join public.products p on p.id = v.product_id where p.store_id = $1 and p.moderation_status = 'published' limit 1`, [storeId])).rows;
      await as(buyer.id, `select public.cart_set_quantity($1, 1)`, [variantId]);
      const { r } = await as<{ r: { number: string } }>(buyer.id, `select public.place_order((select id from public.addresses where user_id = auth.uid()), '{}'::jsonb, 'full', $1) as r`, [`ven-${user.id}`]);
      orderNumber = r.number;
    }
    return { ...user, storeId: storeId as string, name, secondStoreId, privateProductId, orderNumber };
  } finally { await c.end(); }
}
