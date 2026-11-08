// Test harness for the database layer: runs SQL as specific Supabase users with RLS enforced,
// exactly like PostgREST does (SET ROLE authenticated + request.jwt.claims).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

function loadEnv() {
  const p = join(import.meta.dirname, '../../../.local/keys.env');
  if (existsSync(p)) {
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2];
    }
  }
}
loadEnv();
// Suites run against `kora_test`, a fresh clone of the dev database (tools/local-stack/test-db.sh),
// so they never leave fixtures in the data the app shows.
export const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? (process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54322/postgres').replace(/\/postgres$/, '/kora_test');
pg.types.setTypeParser(1700, (v) => v); // numeric as string: never lose precision in assertions

export const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 12 });

export type Sql = (text: string, params?: unknown[]) => Promise<any[]>;

/** Runs fn in a transaction as the given user (RLS enforced). Commits unless fn throws. */
export async function asUser<T>(userId: string | null, fn: (sql: Sql) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(userId ? { sub: userId, role: 'authenticated' } : { role: 'anon' })]);
    await c.query(userId ? 'set local role authenticated' : 'set local role anon');
    const result = await fn(async (text, params) => (await c.query(text, params as any[])).rows);
    await c.query('commit');
    return result;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** Superuser access for fixtures and assertions. */
export async function admin(text: string, params?: unknown[]) {
  return (await pool.query(text, params as any[])).rows;
}

export async function createUser(label: string, opts: { role?: 'admin' | 'superadmin' } = {}) {
  const id = randomUUID();
  const email = `${label}-${id.slice(0, 8)}@example.com`;
  await admin(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, 'x', now(), '{}', $3, now(), now())`,
    [id, email, JSON.stringify({ full_name: `Test ${label}` })],
  );
  if (opts.role) await admin(`insert into public.user_roles (user_id, role) values ($1, $2)`, [id, opts.role]);
  return { id, email };
}

export interface Fixture {
  storeId: string;
  storeSlug: string;
  productId: string;
  variantId: string;
  categoryId: string;
}

/** Creates an isolated store + product + variant with known stock and price. */
export async function createStoreWithProduct(opts: {
  owner?: string; kind?: 'platform' | 'seller'; stock?: number | null; price?: number; availability?: string; origin?: string;
  category?: string; status?: 'active' | 'pending' | 'suspended';
} = {}): Promise<Fixture> {
  const suffix = randomUUID().slice(0, 8);
  const [store] = await admin(
    `insert into public.stores (slug, name, kind, status, accent) values ($1, $2, $3, $4, 'jade') returning id, slug`,
    [`t-${suffix}`, `Tienda test ${suffix}`, opts.kind ?? 'seller', opts.status ?? 'active'],
  );
  if (opts.owner) await admin(`insert into public.store_members (store_id, user_id) values ($1, $2)`, [store.id, opts.owner]);
  const [cat] = await admin(`select id from public.categories where slug = $1`, [opts.category ?? 'hogar']);
  const [product] = await admin(
    `insert into public.products (store_id, category_id, slug, title, origin, availability, moderation_status, weight_kg)
     values ($1, $2, $3, $4, $5, $6, 'published', 0.5) returning id`,
    [store.id, cat.id, `p-${suffix}`, `Producto test ${suffix}`, opts.origin ?? (opts.kind === 'platform' ? 'local' : 'seller'), opts.availability ?? 'available'],
  );
  const [variant] = await admin(
    `insert into public.product_variants (product_id, title, price_usd, stock) values ($1, 'Única', $2, $3) returning id`,
    [product.id, opts.price ?? 25, opts.stock === undefined ? 5 : opts.stock],
  );
  return { storeId: store.id, storeSlug: store.slug, productId: product.id, variantId: variant.id, categoryId: cat.id };
}

export async function createAddress(userId: string, region = 'A') {
  return asUser(userId, async (sql) => {
    const [a] = await sql(
      `insert into public.addresses (user_id, label, recipient, phone, region_code, city, line1, is_default)
       values (auth.uid(), 'Casa', 'Persona de Prueba', '0412-000-0000', $1, 'Caracas', 'Calle de prueba 123', true) returning id`,
      [region],
    );
    return a.id as string;
  });
}

export const key = (p = 'k') => `${p}-${randomUUID()}`;

export async function setRate(pair: string, rate: number, minutesAgo = 0, source = 'demo') {
  await admin(
    `insert into public.exchange_rates (source_code, pair, rate, observed_at, raw) values ($1, $2, $3, now() - make_interval(mins => $4), '{"test":true}')`,
    [source, pair, rate, minutesAgo],
  );
}

/** Expect a database error carrying a specific hint (raised with USING HINT). */
export async function expectHint(p: Promise<unknown>, hint: string) {
  try {
    await p;
  } catch (e: any) {
    if (e.hint === hint) return e;
    throw new Error(`expected hint ${hint}, got ${e.hint ?? '-'}: ${e.message}`);
  }
  throw new Error(`expected error with hint ${hint}, but call succeeded`);
}

export async function ledgerBalanced(orderId?: string) {
  const rows = await admin(
    `select coalesce(sum(amount_usd), 0)::text as total from public.ledger_entries ${orderId ? 'where order_id = $1' : ''}`,
    orderId ? [orderId] : [],
  );
  return rows[0].total === '0.00' || rows[0].total === '0';
}

/** Places an order for a single product line using the cheapest shipping option. */
export async function buy(userId: string, variantId: string, qty: number, opts: { plan?: string; addressId?: string; idem?: string } = {}) {
  const addressId = opts.addressId ?? (await createAddress(userId));
  return asUser(userId, async (sql) => {
    await sql(`select public.cart_set_quantity($1, $2)`, [variantId, qty]);
    const [r] = await sql(`select public.place_order($1, '{}'::jsonb, $2, $3) as r`, [addressId, opts.plan ?? 'full', opts.idem ?? key('order')]);
    return r.r as { order_id: string; number: string; replayed: boolean };
  });
}
