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

export async function deliveredOrderFor(label: string) {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  const as = async <T>(user: string, sql: string, params: unknown[] = []) => {
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
  try {
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
    const variant = (await client.query(`select v.id from public.product_variants v join public.products p on p.id = v.product_id where p.slug = 'juguete-cuerda-perros' limit 1`)).rows[0].id;
    await as(u.id, `select public.cart_set_quantity($1, 1)`, [variant]);
    const order = await as<{ r: { order_id: string; number: string } }>(
      u.id,
      `select public.place_order((select id from public.addresses where user_id = auth.uid()), '{}'::jsonb, 'full', $1) as r`,
      [`ui-${Date.now()}`],
    );
    const quote = await as<{ q: { id: string } }>(u.id, `select public.create_payment_quote($1, 'zelle') as q`, [order.r.order_id]);
    const pay = await as<{ p: { id: string } }>(
      u.id,
      `select public.submit_payment($1, $2, $3, '{"name":"Ana Prueba"}', $4) as p`,
      [quote.q.id, `ZL-UI-${Date.now()}`, `${u.id}/ui-comprobante.webp`, `ui-pay-${Date.now()}`],
    );
    await as(ADMIN, `select public.review_payment($1, true)`, [pay.p.id]);
    const fid = (await client.query(`select id from public.fulfillments where order_id = $1`, [order.r.order_id])).rows[0].id;
    for (const step of ['confirmed', 'preparing', 'dispatched', 'delivered']) {
      await as(SELLER2, `select public.advance_fulfillment($1, $2, null, $3)`, [fid, step, step === 'dispatched' ? 'ZOOM-UI-1' : null]);
    }
    return { email, password, orderId: order.r.order_id, number: order.r.number, fulfillmentId: fid as string };
  } finally {
    await client.end();
  }
}
