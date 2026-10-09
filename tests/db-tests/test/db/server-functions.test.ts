import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, asUser, buy, createStoreWithProduct, createUser, key, pool, setRate } from '../../src/db';

afterAll(() => pool.end());

const forbidden = async (p: Promise<unknown>) => {
  await expect(p).rejects.toMatchObject({ code: '42501' });
};

describe('edge function plumbing', () => {
  let buyer: { id: string };
  beforeAll(async () => {
    buyer = await createUser('edge');
    await setRate('USD/USDT', 1.001);
  });

  async function startBinance() {
    const f = await createStoreWithProduct({ kind: 'platform', price: 21, stock: 5 });
    const o = await buy(buyer.id, f.variantId, 1);
    const q = await asUser(buyer.id, async (sql) => (await sql(`select public.create_payment_quote($1, 'binance_pay', null) as q`, [o.order_id]))[0].q);
    const p = await asUser(buyer.id, async (sql) => (await sql(`select public.start_provider_payment($1, $2) as p`, [q.id, key()]))[0].p);
    return { o, q, p };
  }

  it('a forged event cannot take the id of the genuine one; the checkout link is kept for retries', async () => {
    await admin(`update public.payment_methods set enabled = true, integration_status = 'sandbox' where code = 'binance_pay'`);
    try {
      const { o, q, p } = await startBinance();
      await admin(`select public.attach_provider_payment($1, $2, $3)`, [p.id, p.number, 'https://pay.example.com/checkout/1']);
      const [stored] = await admin(`select provider_checkout_url from public.payments where id = $1`, [p.id]);
      expect(stored.provider_checkout_url).toBe('https://pay.example.com/checkout/1');

      const evt = (valid: boolean) => admin(
        `select public.record_provider_event('binance_pay', $1, 'PAY:PAY_SUCCESS', $2, 'succeeded', $3, 'USDT', $4, '{}') as r`,
        ['shared-event-id-' + p.number, p.number, Number(q.amount_due), valid]);
      expect((await evt(false))[0].r.status).toBe('rejected_signature');
      expect((await evt(true))[0].r.status).toBe('processed');
      const [ord] = await admin(`select payment_status from public.orders where id = $1`, [o.order_id]);
      expect(ord.payment_status).toBe('paid');
      const events = await admin(`select signature_valid, provider_event_id like 'unsigned:%' as synthetic from public.payment_events where payload = '{}' and event_type = 'PAY:PAY_SUCCESS' and (provider_event_id = $1 or provider_event_id like $2)`,
        ['shared-event-id-' + p.number, `unsigned:shared-event-id-${p.number}:%`]);
      expect(events.map((e: any) => [e.signature_valid, e.synthetic]).sort()).toEqual([[false, true], [true, false]]);
    } finally {
      await admin(`update public.payment_methods set enabled = false, integration_status = 'pending_credentials' where code = 'binance_pay'`);
    }
  });

  it('a provider that refuses the order fails the payment cleanly; only the service role can do it', async () => {
    await admin(`update public.payment_methods set enabled = true, integration_status = 'sandbox' where code = 'binance_pay'`);
    try {
      const { p } = await startBinance();
      await forbidden(asUser(buyer.id, (sql) => sql(`select public.fail_provider_start($1, 'x')`, [p.id])));
      await forbidden(asUser(buyer.id, (sql) => sql(`select public.attach_provider_payment($1, 'x', null)`, [p.id])));
      await admin(`select public.fail_provider_start($1, 'Credenciales inválidas')`, [p.id]);
      const [row] = await admin(`select status, rejection_reason, usd_recognized from public.payments where id = $1`, [p.id]);
      expect(row).toMatchObject({ status: 'failed', rejection_reason: 'Credenciales inválidas', usd_recognized: null });
    } finally {
      await admin(`update public.payment_methods set enabled = false, integration_status = 'pending_credentials' where code = 'binance_pay'`);
    }
  });

  it('a buyer can abandon an online attempt; a late confirmation goes to manual review, never lost', async () => {
    await admin(`update public.payment_methods set enabled = true, integration_status = 'sandbox' where code = 'binance_pay'`);
    try {
      const { o, q, p } = await startBinance();
      await admin(`select public.attach_provider_payment($1, $2, null)`, [p.id, p.number]);
      const other = await createUser('edge-other');
      await expect(asUser(other.id, (sql) => sql(`select public.cancel_provider_payment($1)`, [p.id]))).rejects.toMatchObject({ hint: 'invalid_state' });
      await asUser(buyer.id, (sql) => sql(`select public.cancel_provider_payment($1)`, [p.id]));
      expect((await admin(`select status from public.payments where id = $1`, [p.id]))[0].status).toBe('failed');
      const [{ r }] = await admin(`select public.record_provider_event('binance_pay', $1, 'PAY:PAY_SUCCESS', $2, 'succeeded', $3, 'USDT', true, '{}') as r`,
        [key('late'), p.number, Number(q.amount_due)]);
      expect(r.status).toBe('needs_review');
      const [row] = await admin(`select status, amount_received from public.payments where id = $1`, [p.id]);
      expect(row.status).toBe('pending_verification');
      expect((await admin(`select payment_status from public.orders where id = $1`, [o.order_id]))[0].payment_status).toBe('unpaid');
    } finally {
      await admin(`update public.payment_methods set enabled = false, integration_status = 'pending_credentials' where code = 'binance_pay'`);
    }
  });

  it('an online attempt nobody confirms stops blocking the order', async () => {
    await admin(`update public.payment_methods set enabled = true, integration_status = 'sandbox' where code = 'binance_pay'`);
    try {
      const { p } = await startBinance();
      await admin(`update public.payments set created_at = now() - interval '4 hours' where id = $1`, [p.id]);
      await admin(`select public.expire_unpaid_orders()`);
      const [row] = await admin(`select status, rejection_reason from public.payments where id = $1`, [p.id]);
      expect(row).toMatchObject({ status: 'failed', rejection_reason: 'Sin confirmación del proveedor a tiempo' });
    } finally {
      await admin(`update public.payment_methods set enabled = false, integration_status = 'pending_credentials' where code = 'binance_pay'`);
    }
  });

  it('push batches are claimed once, test notifications are never pushed and dead tokens are removed', async () => {
    const u = await createUser('push');
    const token = `ExponentPushToken[${key('t')}]`;
    await asUser(u.id, (sql) => sql(`select public.register_push_token($1, 'android')`, [token]));
    const [{ id: real }] = await admin(`select public.notify($1, 'system', 'Hola', 'Mensaje', '{}') as id`, [u.id]);
    const [{ id: test }] = await admin(`insert into public.notifications (user_id, kind, title, body, is_test) values ($1, 'system', 'Demo', 'Demo', true) returning id`, [u.id]);
    const [{ id: old }] = await admin(`insert into public.notifications (user_id, kind, title, body, created_at) values ($1, 'system', 'Vieja', 'Vieja', now() - interval '2 days') returning id`, [u.id]);
    const ids = [real, test, old];

    await forbidden(asUser(u.id, (sql) => sql(`select public.claim_push_batch(10, null)`)));
    const [{ b: batch }] = await admin(`select public.claim_push_batch(10, $1::uuid[]) as b`, [ids]);
    expect(batch.map((n: any) => n.id)).toEqual([real]);
    expect(batch[0].tokens).toEqual([token]);
    const [{ b: again }] = await admin(`select public.claim_push_batch(10, $1::uuid[]) as b`, [ids]);
    expect(again).toEqual([]); // already claimed by the first dispatcher

    await admin(`select public.complete_push($1::jsonb, $2::text[])`, [JSON.stringify([{ id: real, status: 'failed', error: 'DeviceNotRegistered' }]), [token]]);
    const rows = await admin(`select id, push_status from public.notifications where id = any ($1::uuid[])`, [ids]);
    expect(Object.fromEntries(rows.map((r: any) => [r.id, r.push_status]))).toEqual({ [real]: 'failed', [test]: 'skipped', [old]: 'skipped' });
    expect(await admin(`select 1 from public.push_tokens where token = $1`, [token])).toHaveLength(0);
  });

  it('a transient push error is retried, at most three times', async () => {
    const u = await createUser('push-retry');
    await asUser(u.id, (sql) => sql(`select public.register_push_token($1, 'ios')`, [`ExponentPushToken[${key('r')}]`]));
    const [{ id }] = await admin(`select public.notify($1, 'system', 'Hola', 'Mensaje', '{}') as id`, [u.id]);
    for (const expected of ['pending', 'pending', 'failed']) {
      const [{ b }] = await admin(`select public.claim_push_batch(10, $1::uuid[]) as b`, [[id]]);
      expect(b).toHaveLength(1);
      await admin(`select public.complete_push($1::jsonb)`, [JSON.stringify([{ id, status: 'retry', error: 'HTTP 503' }])]);
      const [n] = await admin(`select push_status from public.notifications where id = $1`, [id]);
      expect(n.push_status).toBe(expected);
    }
  });

  it('edge functions are only invoked by the service role', async () => {
    await forbidden(asUser(buyer.id, (sql) => sql(`select public.invoke_edge_function('rates-sync', '{}')`)));
  });
});
