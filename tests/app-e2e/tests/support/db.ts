// Fixtures for UI tests that need state the UI cannot reach quickly (a paid, delivered order).
// Everything goes through the same database functions the app and the panel call, against the
// local development stack only; accounts use example.com and are flagged as demo profiles.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

function databaseUrl() {
  const p = join(import.meta.dirname, '../../../../.local/keys.env');
  const env: Record<string, string> = {};
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]!] = m[2]!;
  }
  const url = process.env.DATABASE_URL ?? env.DATABASE_URL;
  if (!url || !/127\.0\.0\.1|localhost/.test(url)) throw new Error('UI fixtures only run against the local stack');
  return url;
}

const SELLER2 = '00000000-0000-4000-a000-000000000003'; // demo seller of Patitas & Co. (seed)
const ADMIN = '00000000-0000-4000-a000-000000000001';

type As = <T>(user: string, sql: string, params?: unknown[]) => Promise<T>;

/** Runs one statement as a signed-in user (RLS and auth.uid() apply) on an open connection. */
const asOn = (client: pg.Client): As => async <T>(user: string, sql: string, params: unknown[] = []) => {
  await client.query('begin');
  try {
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: user, role: 'authenticated' })]);
    await client.query('set local role authenticated');
    const r = await client.query(sql, params);
    await client.query('commit');
    return r.rows[0] as T;
  } catch (e) {
    await client.query('rollback');
    throw e;
  }
};

/** A confirmed demo buyer (example.com) with one main address, as GoTrue and the app expect it. */
async function insertBuyer(client: pg.Client, as: As, label: string) {
  const email = `${label}-${Date.now()}@example.com`;
  const password = 'Kora-prueba-2026';
  const { rows: [u] } = await client.query(
    // GoTrue expects empty strings, not nulls, in its token columns
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                             confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, reauthentication_token, phone_change, phone_change_token)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', $1, extensions.crypt($2, extensions.gen_salt('bf')), now(),
             '{"provider":"email","providers":["email"]}', '{"full_name":"Ana Prueba"}', now(), now(), '', '', '', '', '', '', '', '') returning id`,
    [email, password],
  );
  await client.query(
    `insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
     values (gen_random_uuid(), $1::text, $1::uuid, $2::jsonb, 'email', now(), now(), now())`,
    [u.id, JSON.stringify({ sub: u.id, email, email_verified: true })],
  );
  await client.query(`update public.profiles set is_demo = true where id = $1`, [u.id]);
  await as(u.id, `insert into public.addresses (user_id, label, recipient, phone, region_code, city, municipality, line1, is_default)
                  values (auth.uid(), 'Casa', 'Ana Prueba', '+58 412 555 0101', 'A', 'Caracas', 'Libertador', 'Av. Ejemplo, Edif. Demo, piso 2', true)`);
  return { id: u.id as string, email, password };
}

/** A signed-up buyer with one saved address and no orders. */
export async function newBuyer(label: string) {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    return await insertBuyer(client, asOn(client), label);
  } finally {
    await client.end();
  }
}

/** Places an order (one dog toy from Patitas & Co.) for the buyer through the same function as checkout. */
async function placeOrder(client: pg.Client, as: As, userId: string) {
  const variant = (await client.query(`select v.id from public.product_variants v join public.products p on p.id = v.product_id where p.slug = 'juguete-cuerda-perros' limit 1`)).rows[0].id;
  await as(userId, `select public.cart_set_quantity($1, 1)`, [variant]);
  const { r } = await as<{ r: { order_id: string; number: string } }>(
    userId,
    `select public.place_order((select id from public.addresses where user_id = auth.uid()), '{}'::jsonb, 'full', $1) as r`,
    [`ui-${Date.now()}`],
  );
  return { orderId: r.order_id, number: r.number };
}

/** A buyer with a placed order that has no payment yet (it can still be cancelled). */
export async function unpaidOrderFor(label: string) {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  const as = asOn(client);
  try {
    const buyer = await insertBuyer(client, as, label);
    return { userId: buyer.id, email: buyer.email, password: buyer.password, ...(await placeOrder(client, as, buyer.id)) };
  } finally {
    await client.end();
  }
}

/** A buyer whose order was paid (Zelle, approved by the admin) and delivered by the store. */
export async function deliveredOrderFor(label: string) {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  const as = asOn(client);
  try {
    const { id: uid, email, password } = await insertBuyer(client, as, label);
    const order = await placeOrder(client, as, uid);
    const quote = await as<{ q: { id: string } }>(uid, `select public.create_payment_quote($1, 'zelle') as q`, [order.orderId]);
    const pay = await as<{ p: { id: string } }>(
      uid,
      `select public.submit_payment($1, $2, $3, '{"name":"Ana Prueba"}', $4) as p`,
      [quote.q.id, `ZL-UI-${Date.now()}`, `${uid}/ui-comprobante.webp`, `ui-pay-${Date.now()}`],
    );
    await as(ADMIN, `select public.review_payment($1, true)`, [pay.p.id]);
    const fid = (await client.query(`select id from public.fulfillments where order_id = $1`, [order.orderId])).rows[0].id;
    for (const step of ['confirmed', 'preparing', 'dispatched', 'delivered']) {
      await as(SELLER2, `select public.advance_fulfillment($1, $2, null, $3)`, [fid, step, step === 'dispatched' ? 'ZOOM-UI-1' : null]);
    }
    return { userId: uid, email, password, orderId: order.orderId, number: order.number, fulfillmentId: fid as string };
  } finally {
    await client.end();
  }
}

/** One statement as a signed-in user, on its own connection. */
async function runAs<T = Record<string, unknown>>(userId: string, sql: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    return await asOn(client)<T>(userId, sql, params);
  } finally {
    await client.end();
  }
}

/** The buyer of a delivered order rates its item, through the same function the app calls. Returns the review id. */
export async function reviewAs(userId: string, orderId: string, rating: number, body: string) {
  const r = await runAs<{ id: string }>(
    userId,
    `select (public.submit_review((select id from public.order_items where order_id = $1 limit 1), $2, $3)) ->> 'id' as id`,
    [orderId, rating, body],
  );
  return r.id;
}

/** Recommendation events as the app records them: impressions of the first products of a slot and a click on one. */
export async function browseRecommendations(userId: string, slot: string, productSlugs: string[], clicked: string) {
  const ids = (await runAs<{ ids: string[] }>(userId, `select array_agg(id) as ids from public.products where slug = any ($1)`, [productSlugs])).ids;
  await runAs(userId, `select public.track_recommendation($1, 'impression', $2)`, [slot, ids]);
  await runAs(userId, `select public.track_recommendation($1, 'click', array[(select id from public.products where slug = $2)])`, [slot, clicked]);
}

/**
 * A push channel in trouble, as the dispatcher would leave it: one notice waiting for 15 minutes (the scheduled job is
 * not running) and one receipt where Expo refused our credentials. Returns a cleanup that removes all of it.
 */
export async function pushTrouble(label: string) {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    const user = await insertBuyer(client, asOn(client), label);
    const token = `ExponentPushToken[${label}-${Date.now()}]`;
    await client.query(`insert into public.push_tokens (token, user_id, platform) values ($1, $2, 'android')`, [token, user.id]);
    const n = await client.query(
      `insert into public.notifications (user_id, kind, title, body, push_status, created_at)
       values ($1, 'system', 'Prueba de canal', 'Aviso de prueba', 'pending', now() - interval '15 minutes'),
              ($1, 'system', 'Prueba de canal', 'Aviso de prueba', 'sent', now() - interval '20 minutes') returning id`,
      [user.id],
    );
    await client.query(
      `insert into public.push_tickets (ticket_id, notification_id, token, status, error, created_at, checked_at)
       values ($1, $2, $3, 'error', 'InvalidCredentials', now() - interval '20 minutes', now())`,
      [`tk-${label}-${Date.now()}`, n.rows[1].id, token],
    );
    return async () => {
      const c = new pg.Client({ connectionString: databaseUrl() });
      await c.connect();
      try {
        await c.query(`delete from public.notifications where user_id = $1`, [user.id]);
        await c.query(`delete from public.push_tokens where user_id = $1`, [user.id]);
      } finally {
        await c.end();
      }
    };
  } finally {
    await client.end();
  }
}
