// Additive fixtures on the LOCAL development stack. No resets or remote credentials. Optional paid fixtures use the normal buyer/admin RPCs, LOCAL only.
import pg from 'pg';
import { asOn, databaseUrl, newBuyer, placeOrder } from './db';

export async function adminFixture(label: string, opts: { purchase?: boolean } = {}) {
  const user = await newBuyer(label);
  const c = new pg.Client({ connectionString: databaseUrl() });
  await c.connect();
  try {
    await c.query(`insert into public.user_roles (user_id, role) values ($1, 'admin')`, [user.id]);
    return { ...user, order: opts.purchase ? await placeOrder(c, asOn(c), user.id) : undefined };
  }
  finally { await c.end(); }
}

export async function sellerFixture(label: string, opts: { admin?: boolean; empty?: boolean; multi?: boolean; paid?: boolean; home?: boolean; origin?: 'local' | 'import' } = {}) {
  const user = await newBuyer(label);
  const c = new pg.Client({ connectionString: databaseUrl() });
  await c.connect();
  try {
    if (opts.admin) await c.query(`insert into public.user_roles (user_id, role) values ($1, 'admin')`, [user.id]);
    const slug = `ven-${user.id.slice(0, 8)}`;
    const name = `Tienda A ${slug}`;
    const [{ id: storeId }] = (await c.query(`insert into public.stores (slug, name, status, is_demo, logo_path, contact_email, description, policies, kind)
      values ($1, $2, 'active', true, (select logo_path from public.stores where slug = 'casa-lumen'), $3, 'Tienda de pruebas VEN-01A', '{"returns":"Consulta las condiciones en el panel."}', $4) returning id`, [slug, name, user.email, opts.origin ? 'platform' : 'seller'])).rows;
    await c.query(`insert into public.store_members (store_id, user_id) values ($1, $2)`, [storeId, user.id]);
    let secondStoreId: string | undefined;
    if (opts.multi) {
      const [second] = (await c.query(`insert into public.stores (slug, name, status, is_demo) values ($1, $2, 'pending', true) returning id`, [`${slug}-b`, `Tienda B ${slug}`])).rows;
      secondStoreId = second.id;
      await c.query(`insert into public.store_members (store_id, user_id) values ($1, $2)`, [secondStoreId, user.id]);
    }
    let privateProductId: string | undefined;
    let orderNumber: string | undefined;
    let fulfillmentId: string | undefined;
    if (!opts.empty) {
      const products = (await c.query(`insert into public.products (store_id, category_id, slug, title, origin, availability, moderation_status, is_demo, weight_kg)
        select $1, (select id from public.categories where slug = 'hogar'), $2 || '-' || i, 'Producto VEN ' || lpad(i::text, 2, '0'), $3::public.product_origin, 'available',
          case when i = 2 then 'pending'::public.moderation_status else 'published'::public.moderation_status end, true, 0.5 from generate_series(1,32) i returning id, slug`, [storeId, slug, opts.origin ?? 'seller'])).rows;
      privateProductId = products.find((p) => p.slug.endsWith('-2')).id;
      await c.query(`insert into public.product_variants (product_id, title, price_usd, stock) select id, 'Única', 10, 40 from public.products where store_id = $1`, [storeId]);
      const buyer = await newBuyer(`${label}-order`);
      const as = asOn(c);
      // Choose a published variant explicitly; private catalogue rows stay private.
      const [{ id: variantId }] = (await c.query(`select v.id from public.product_variants v join public.products p on p.id = v.product_id where p.store_id = $1 and p.moderation_status = 'published' limit 1`, [storeId])).rows;
      await as(buyer.id, `select public.cart_set_quantity($1, $2)`, [variantId, opts.paid ? 3 : 1]);
      let shipping = {};
      if (opts.home) {
        const { preview } = await as<{ preview: { groups: { key: string; shipping_options: { kind: string; method_id: string }[] }[] } }>(buyer.id, `select public.checkout_preview((select id from public.addresses where user_id=auth.uid())) preview`);
        const group = preview.groups[0]!; const method = group.shipping_options.find((m) => m.kind === 'home_delivery');
        if (!method) throw new Error('No local home shipping fixture');
        shipping = { [group.key]: method.method_id };
      }
      const { r } = await as<{ r: { number: string; order_id: string } }>(buyer.id, `select public.place_order((select id from public.addresses where user_id = auth.uid()), $2::jsonb, 'full', $1) as r`, [`ven-${user.id}`, JSON.stringify(shipping)]);
      orderNumber = r.number;
      fulfillmentId = (await c.query('select id from public.fulfillments where order_id=$1', [r.order_id])).rows[0].id;
      if (opts.paid) {
        const { q } = await as<{q:{id:string}}>(buyer.id, "select public.create_payment_quote($1,'zelle') q", [r.order_id]);
        const { p } = await as<{p:{id:string}}>(buyer.id, "select public.submit_payment($1,$2,$3,'{}'::jsonb,$4) p", [q.id, `OPS-${user.id}`, `${buyer.id}/local-proof.webp`, `ops-pay-${user.id}`]);
        // Real seeded local admin permission. Seller UI never calls review_payment.
        await as('00000000-0000-4000-a000-000000000001', 'select public.review_payment($1,true)', [p.id]);
      }
    }
    return { ...user, storeId: storeId as string, name, secondStoreId, privateProductId, orderNumber, fulfillmentId };
  } finally { await c.end(); }
}
