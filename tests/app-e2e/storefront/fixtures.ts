// Isolated local fixtures for order/payment UI tests.
// LOCAL fixtures only. Never replenish a shared seed SKU to make UI tests pass.
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { asOn, databaseUrl, newBuyer } from '../tests/support/db';

export async function testUnpaidOrder(label: string) {
  const connectionString = databaseUrl();
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(connectionString).hostname)) {
    throw new Error('Storefront fixtures require an exact loopback database host.');
  }
  const buyer = await newBuyer(`${label}-${randomUUID().slice(0, 8)}`);
  const db = new pg.Client({ connectionString });
  await db.connect();
  const productId = randomUUID();
  const variantId = randomUUID();
  const intent = `storefront-fixture-${randomUUID()}`;
  let fixtureCreated = false;
  try {
    await db.query('begin');
    try {
      // Copy facts/prices from the known local demonstration template, regardless of its remaining stock.
      // A brand-new product and variant own these two fixture units; the template is never updated.
      const {
        rows: [source],
      } = await db.query<{ id: string; variant_id: string }>(
        `select p.id, v.id as variant_id
           from public.products p
           join public.stores s on s.id = p.store_id
           join public.categories c on c.id = p.category_id
           join public.product_variants v on v.product_id = p.id and v.active
          where p.slug = 'juguete-cuerda-perros' and p.is_demo and s.is_demo and s.status = 'active'
            and not c.requires_review and c.risk_level = 'low'
          order by v.sort, v.id limit 1`,
      );
      if (!source) throw new Error('Missing safe local seed template for the isolated storefront order.');
      await db.query(
        `insert into public.products
          (id, store_id, category_id, brand_id, slug, title, subtitle, description, highlights, option_names,
           origin, availability, moderation_status, weight_kg, max_per_order, is_demo, published_at)
         select $1, store_id, category_id, brand_id, $2, title, subtitle, description, highlights, option_names,
                origin, 'available', 'published', weight_kg, least(max_per_order, 2), true, published_at
           from public.products where id = $3`,
        [productId, `sf-fixture-${productId}`, source.id],
      );
      await db.query(
        `insert into public.product_variants (id, product_id, sku, title, options, price_usd, stock, active, sort)
         select $1, $2, $3, title, options, price_usd, 2, true, sort from public.product_variants where id = $4`,
        [variantId, productId, `SFTEST-${variantId}`, source.variant_id],
      );
      await db.query(
        `insert into public.product_images (product_id, path, alt, sort, width, height, is_demo_asset)
         select $1, path, alt, sort, width, height, true from public.product_images where product_id = $2`,
        [productId, source.id],
      );
      await db.query('commit');
      fixtureCreated = true;
    } catch (error) {
      await db.query('rollback');
      throw error;
    }
    const as = asOn(db);
    await as(buyer.id, 'select public.cart_set_quantity($1, 1)', [variantId]);
    const { result } = await as<{ result: { order_id: string; number: string } }>(
      buyer.id,
      `select public.place_order(
        (select id from public.addresses where user_id = auth.uid() and is_default),
        '{}'::jsonb, 'full', $1
      ) as result`,
      [intent],
    );
    return {
      userId: buyer.id,
      email: buyer.email,
      password: buyer.password,
      orderId: result.order_id,
      number: result.number,
      productId,
      variantId,
    };
  } finally {
    // Hide only this test's disposable product from public catalog exploration. Order snapshots stay valid.
    // No delete/cancel/payment operation; verification test history is retained for diagnosis.
    try {
      if (fixtureCreated)
        await db.query(
          `update public.products set moderation_status = 'suspended',
          moderation_note = 'Fixture local aislada de compra; conservar el pedido para diagnóstico'
         where id = $1 and is_demo`,
          [productId],
        );
    } finally {
      await db.end();
    }
  }
}

const cartFixtureIds = new Set<string>();
export async function cleanupCartFixtures() {
  for (const id of cartFixtureIds) await hideCartProduct(id);
  cartFixtureIds.clear();
}
type BuyerFixture = Awaited<ReturnType<typeof newBuyer>>;
/** Own copy of a safe seed product for a buyer's UI test. Root can move to storefront/fixtures.ts. */
export async function testCartProduct(
  label: string,
  options: { buyer?: BuyerFixture; sourceSlug?: string; addToCart?: boolean } = {},
) {
  const connectionString = databaseUrl();
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(connectionString).hostname))
    throw new Error('Cart fixtures require an exact loopback database host.');
  const buyer = options.buyer ?? (await newBuyer(`${label}-${randomUUID().slice(0, 8)}`));
  const db = new pg.Client({ connectionString });
  await db.connect();
  const productId = randomUUID(),
    variantId = randomUUID(),
    slug = `sf-cart-${productId}`;
  try {
    await db.query('begin');
    try {
      const {
        rows: [source],
      } = await db.query(
        `select p.id, v.id as variant_id
           from public.products p join public.stores s on s.id = p.store_id
           join public.categories c on c.id = p.category_id
           join public.product_variants v on v.product_id = p.id and v.active
          where p.slug = $1 and p.is_demo and s.is_demo and s.status = 'active'
            and not c.requires_review and c.risk_level = 'low'
          order by v.sort, v.id limit 1`,
        [options.sourceSlug ?? 'ugreen-cable-usb-c-100w'],
      );
      if (!source) throw new Error('Missing safe local seed template for isolated cart.');
      await db.query(
        `insert into public.products
          (id, store_id, category_id, brand_id, slug, title, subtitle, description, highlights, option_names,
           origin, availability, moderation_status, weight_kg, max_per_order, is_demo, published_at)
         select $1, store_id, category_id, brand_id, $2, title, subtitle, description, highlights, option_names,
                origin, 'available', 'published', weight_kg, least(max_per_order, 2), true, published_at
           from public.products where id = $3`,
        [productId, slug, source.id],
      );
      await db.query(
        `insert into public.product_variants (id, product_id, sku, title, options, price_usd, stock, active, sort)
         select $1, $2, $3, title, options, price_usd, 2, true, sort from public.product_variants where id = $4`,
        [variantId, productId, `SFTEST-${variantId}`, source.variant_id],
      );
      await db.query(
        `insert into public.product_images (product_id, path, alt, sort, width, height, is_demo_asset)
         select $1, path, alt, sort, width, height, true from public.product_images where product_id = $2`,
        [productId, source.id],
      );
      await db.query('commit');
    } catch (error) {
      await db.query('rollback');
      throw error;
    }
    if (options.addToCart) await asOn(db)(buyer.id, 'select public.cart_set_quantity($1, 1)', [variantId]);
    cartFixtureIds.add(productId);
    return { ...buyer, productId, variantId, slug };
  } finally {
    await db.end();
  }
}
export async function hideCartProduct(productId: string) {
  const connectionString = databaseUrl();
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(connectionString).hostname))
    throw new Error('Cart fixtures require an exact loopback database host.');
  const db = new pg.Client({ connectionString });
  await db.connect();
  try {
    await db.query(
      `update public.products set moderation_status = 'suspended',
    moderation_note = 'Fixture local aislada de carrito; conservar historial para diagnóstico'
    where id = $1 and is_demo and slug like 'sf-cart-%'`,
      [productId],
    );
  } finally {
    await db.end();
  }
}
