import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { admin, asUser, buy, createStoreWithProduct, createUser, expectHint, key, ledgerBalanced, pool, setRate } from '../../src/db';

afterAll(() => pool.end());

const quote = (u: string, order: string, method: string, obligations: string[] | null = null) =>
  asUser(u, async (sql) => (await sql(`select public.create_payment_quote($1, $2, $3::uuid[]) as q`, [order, method, obligations]))[0].q);
const submit = (u: string, quoteId: string, ref: string | null, idem = key('pay'), proof: string | null = null) =>
  asUser(u, async (sql) => (await sql(`select public.submit_payment($1, $2, $3, '{}'::jsonb, $4) as p`, [quoteId, ref, proof, idem]))[0].p);
const review = (a: string, paymentId: string, approve = true, received: number | null = null, reason: string | null = null) =>
  asUser(a, async (sql) => (await sql(`select public.review_payment($1, $2, $3, $4) as r`, [paymentId, approve, received, reason]))[0].r);
const order = async (id: string) => (await admin(`select * from public.orders where id = $1`, [id]))[0];
const obligations = (id: string) => admin(`select seq, kind, amount_usd, paid_usd, waived_usd, status from public.payment_obligations where order_id = $1 order by seq`, [id]);
let refSeq = Math.floor(Math.random() * 1e6);
const ref = () => String(10_000_000 + refSeq++);

describe('payments, quotes and installments', () => {
  let buyer: { id: string }, adminUser: { id: string };
  beforeAll(async () => {
    adminUser = await createUser('admin', { role: 'admin' });
  });
  beforeEach(async () => {
    buyer = await createUser('payer'); // fresh buyer per test: per-user rate limits are real
    await setRate('USD/VES', 100);
    await setRate('USD/USDT', 1.001);
  });

  it('brief example: 120 USD, 50% deposit paid in VES, balance stays in USD and is re-quoted at the new rate', async () => {
    const f = await createStoreWithProduct({ kind: 'platform', price: 120, stock: null, availability: 'on_order', origin: 'import' });
    const o = await buy(buyer.id, f.variantId, 1, { plan: 'deposit_50' });
    const [, ] = await obligations(o.order_id);
    const q1 = await quote(buyer.id, o.order_id, 'pago_movil');
    expect(q1).toMatchObject({ base_usd: 60, currency: 'VES', rate_applied: 100, amount_due: 6000 });
    const p1 = await submit(buyer.id, q1.id, ref());
    expect(p1.status).toBe('pending_verification');
    expect((await order(o.order_id)).paid_usd).toBe('0.00'); // nothing is paid until verified
    await review(adminUser.id, p1.id);
    const ob = await obligations(o.order_id);
    expect(ob.map((x: any) => [x.kind, x.amount_usd, x.paid_usd, x.status])).toEqual([
      ['down_payment', '60.00', '60.00', 'paid'], ['installment', '60.00', '0.00', 'pending']]);
    const after = await order(o.order_id);
    expect([after.paid_usd, after.payment_status]).toEqual(['60.00', 'partially_paid']);
    const [p] = await admin(`select currency, amount, rate_applied, usd_recognized, reference, status from public.payments where id = $1`, [p1.id]);
    expect(p).toMatchObject({ currency: 'VES', amount: '6000.00', rate_applied: '100.00000000', usd_recognized: '60.00', status: 'confirmed' });
    // import delivery advanced automatically to "Anticipo verificado"
    const [fu] = await admin(`select status from public.fulfillments where order_id = $1`, [o.order_id]);
    expect(fu.status).toBe('deposit_verified');
    // later the rate moved: the remaining 60 USD is quoted at the NEW rate (debt never frozen in VES)
    await setRate('USD/VES', 125);
    const q2 = await quote(buyer.id, o.order_id, 'pago_movil');
    expect(q2).toMatchObject({ base_usd: 60, rate_applied: 125, amount_due: 7500 });
    expect(await ledgerBalanced(o.order_id)).toBe(true);
  });

  it('rate change during checkout: an open quote keeps its rate until it expires', async () => {
    const f = await createStoreWithProduct({ kind: 'platform', price: 50, stock: 5 });
    const o = await buy(buyer.id, f.variantId, 1);
    const q = await quote(buyer.id, o.order_id, 'pago_movil');
    const due = q.amount_due;
    await setRate('USD/VES', 140);
    const p = await submit(buyer.id, q.id, ref());
    expect(Number(p.amount)).toBe(due);
    expect(Number(p.rate_applied)).toBe(100);
  });

  it('expired quote is refused and marked expired; buyer must re-quote', async () => {
    const f = await createStoreWithProduct({ kind: 'platform', price: 20, stock: 5 });
    const o = await buy(buyer.id, f.variantId, 1);
    const q = await quote(buyer.id, o.order_id, 'pago_movil');
    await admin(`update public.payment_quotes set expires_at = now() - interval '1 minute' where id = $1`, [q.id]);
    const r = await submit(buyer.id, q.id, ref());
    expect(r).toEqual({ error: 'quote_expired' });
    const [qq] = await admin(`select status from public.payment_quotes where id = $1`, [q.id]);
    expect(qq.status).toBe('expired');
    await expectHint(submit(buyer.id, q.id, ref()), 'quote_used');
  });

  it('stale rates are never used silently', async () => {
    const f = await createStoreWithProduct({ kind: 'platform', price: 20, stock: 5 });
    const o = await buy(buyer.id, f.variantId, 1);
    await admin(`update public.rate_policies set max_age_minutes = 5 where pair = 'USD/VES'`);
    await admin(`update public.exchange_rates set observed_at = now() - interval '1 hour' where pair = 'USD/VES'`);
    try {
      await expectHint(quote(buyer.id, o.order_id, 'pago_movil'), 'rate_unavailable');
      const [{ s }] = await admin(`select public.rate_status('USD/VES') as s`);
      expect(s.available).toBe(false);
      // USD methods keep working
      const qz = await quote(buyer.id, o.order_id, 'zelle');
      expect(qz).toMatchObject({ currency: 'USD', amount_due: 20 });
      // an admin manual rate (with note and validity) unblocks VES explicitly
      await asUser(adminUser.id, (sql) => sql(`select public.set_manual_rate('USD/VES', 101.5, 60, 'Fuentes caídas: tasa verificada manualmente')`));
      const qm = await quote(buyer.id, o.order_id, 'pago_movil');
      expect(qm).toMatchObject({ rate_source: 'manual', rate_applied: 101.5 });
    } finally {
      await admin(`update public.rate_policies set max_age_minutes = 4320, manual_rate = null, manual_valid_until = null where pair = 'USD/VES'`);
    }
  });

  it('duplicate payments: idempotent replays, duplicate references and double approval are blocked', async () => {
    const f = await createStoreWithProduct({ kind: 'platform', price: 30, stock: 5 });
    const o = await buy(buyer.id, f.variantId, 1);
    const q = await quote(buyer.id, o.order_id, 'pago_movil');
    const idem = key('pay');
    const r = ref();
    const [a, b] = await Promise.all([submit(buyer.id, q.id, r, idem), submit(buyer.id, q.id, r, idem)].map((p) => p.catch((e) => ({ hint: e.hint }))));
    const ids = [a, b].filter((x: any) => x.id).map((x: any) => x.id);
    expect(new Set(ids).size).toBe(1); // both resolve to the same payment (or one sees quote_used)
    const [{ n }] = await admin(`select count(*)::int n from public.payments where order_id = $1`, [o.order_id]);
    expect(n).toBe(1);
    // same bank reference on another order is refused
    const o2 = await buy(buyer.id, f.variantId, 1);
    const q2 = await quote(buyer.id, o2.order_id, 'pago_movil');
    await expectHint(submit(buyer.id, q2.id, `${r.slice(0, 4)}-${r.slice(4)}`), "duplicate_reference"); // normalization ignores separators
    // a second quote for an obligation under verification is refused
    await expectHint(quote(buyer.id, o.order_id, 'pago_movil'), 'payment_pending_verification');
    // approving twice (two admins at once) applies once
    const pay = ids[0];
    const results = await Promise.all([review(adminUser.id, pay), review(adminUser.id, pay)].map((p) => p.then(() => 'ok', (e) => e.hint)));
    expect(results.sort()).toEqual(['already_reviewed', 'ok']);
    expect((await order(o.order_id)).paid_usd).toBe('30.00');
    const [{ c }] = await admin(`select count(*)::int c from public.payment_allocations where payment_id = $1`, [pay]);
    expect(c).toBe(1);
    expect(await ledgerBalanced(o.order_id)).toBe(true);
  });

  it('pending verification does not unlock logistics; rejection keeps the debt', async () => {
    const s = await createUser('seller');
    const f = await createStoreWithProduct({ owner: s.id, price: 15, stock: 5 });
    const o = await buy(buyer.id, f.variantId, 1);
    const q = await quote(buyer.id, o.order_id, 'pago_movil');
    const p = await submit(buyer.id, q.id, ref());
    const [fu] = await admin(`select id from public.fulfillments where order_id = $1`, [o.order_id]);
    await expectHint(asUser(s.id, (sql) => sql(`select public.advance_fulfillment($1, 'confirmed')`, [fu.id])), 'payment_required');
    await expectHint(review(adminUser.id, p.id, false, null, null), 'reason_required');
    await review(adminUser.id, p.id, false, null, 'Referencia no encontrada en el banco');
    expect((await order(o.order_id)).payment_status).toBe('unpaid');
    const [n] = await admin(`select title from public.notifications where user_id = $1 and kind = 'payment_rejected' order by created_at desc limit 1`, [buyer.id]);
    expect(n.title).toMatch(/No pudimos confirmar/);
    // can pay again with a new quote
    const q2 = await quote(buyer.id, o.order_id, 'pago_movil');
    const p2 = await submit(buyer.id, q2.id, ref());
    await review(adminUser.id, p2.id);
    await asUser(s.id, (sql) => sql(`select public.advance_fulfillment($1, 'confirmed')`, [fu.id]));
  });

  it('installments paid with different methods (VES, USDT, Zelle) keep the balance in USD', async () => {
    const f = await createStoreWithProduct({ kind: 'platform', price: 100, stock: 5 });
    const o = await buy(buyer.id, f.variantId, 1, { plan: 'three_parts' });
    const plan = await obligations(o.order_id);
    expect(plan.map((x: any) => x.amount_usd)).toEqual(['33.33', '33.33', '33.34']);
    // cannot skip the earliest installment
    await expectHint(quote(buyer.id, o.order_id, 'zelle', [(await admin(`select id from public.payment_obligations where order_id = $1 and seq = 3`, [o.order_id]))[0].id]), 'obligations_order');
    const q1 = await quote(buyer.id, o.order_id, 'pago_movil');
    await review(adminUser.id, (await submit(buyer.id, q1.id, ref())).id);
    const q2 = await quote(buyer.id, o.order_id, 'usdt_trc20');
    expect(q2).toMatchObject({ currency: 'USDT', base_usd: 33.33, rate_applied: 1.001, amount_due: 33.36 });
    await review(adminUser.id, (await submit(buyer.id, q2.id, randomBytes(32).toString('hex'))).id);
    const q3 = await quote(buyer.id, o.order_id, 'zelle');
    await review(adminUser.id, (await submit(buyer.id, q3.id, 'ZL-' + ref(), key(), `${buyer.id}/x.png`)).id);
    const ord = await order(o.order_id);
    expect([ord.paid_usd, ord.payment_status]).toEqual(['100.00', 'paid']);
    await expectHint(quote(buyer.id, o.order_id, 'zelle'), 'nothing_due');
    expect(await ledgerBalanced(o.order_id)).toBe(true);
  });

  it('partial receipt is recognized proportionally and leaves a USD balance', async () => {
    const f = await createStoreWithProduct({ kind: 'platform', price: 40, stock: 5 });
    const o = await buy(buyer.id, f.variantId, 1);
    const q = await quote(buyer.id, o.order_id, 'pago_movil'); // 4000 VES
    const p = await submit(buyer.id, q.id, ref());
    await expectHint(review(adminUser.id, p.id, true, 3000, null), 'reason_required');
    const r = await review(adminUser.id, p.id, true, 3000, 'Llegó un monto menor');
    expect(r.usd_recognized).toBe(30);
    const ord = await order(o.order_id);
    expect([ord.paid_usd, ord.payment_status]).toEqual(['30.00', 'partially_paid']);
    const q2 = await quote(buyer.id, o.order_id, 'zelle');
    expect(q2.base_usd).toBe(10);
  });

  it('partial refund after delivery adjusts seller payable, commission and creates a buyer refund', async () => {
    const s = await createUser('seller');
    const f = await createStoreWithProduct({ owner: s.id, price: 10, stock: 10 });
    const o = await buy(buyer.id, f.variantId, 3);
    const q = await quote(buyer.id, o.order_id, 'zelle');
    await review(adminUser.id, (await submit(buyer.id, q.id, 'ZL-' + ref(), key(), `${buyer.id}/x.png`)).id);
    const [fu] = await admin(`select id, shipping_usd from public.fulfillments where order_id = $1`, [o.order_id]);
    for (const step of ['confirmed', 'preparing']) await asUser(s.id, (sql) => sql(`select public.advance_fulfillment($1, $2)`, [fu.id, step]));
    await asUser(s.id, (sql) => sql(`select public.advance_fulfillment($1, 'dispatched', null, 'GUIA-1')`, [fu.id]));
    await asUser(s.id, (sql) => sql(`select public.advance_fulfillment($1, 'delivered')`, [fu.id]));
    const balBefore = (await asUser(s.id, (sql) => sql(`select public.seller_balance($1) as b`, [f.storeId])))[0].b;
    // 30 items - 10% commission + shipping
    expect(balBefore.available_usd).toBeCloseTo(27 + Number(fu.shipping_usd), 2);
    const [item] = await admin(`select id from public.order_items where order_id = $1`, [o.order_id]);
    const rr = await asUser(adminUser.id, async (sql) => (await sql(`select public.refund_item($1, 1, 'Unidad defectuosa', true) as r`, [item.id]))[0].r);
    expect(rr).toMatchObject({ refunded_usd: 10, refund_due_usd: 10 });
    const ord = await order(o.order_id);
    expect(ord.payment_status).toBe('refund_due');
    const balAfter = (await asUser(s.id, (sql) => sql(`select public.seller_balance($1) as b`, [f.storeId])))[0].b;
    expect(balBefore.available_usd - balAfter.available_usd).toBeCloseTo(9, 2);
    await asUser(adminUser.id, (sql) => sql(`select public.record_refund_payout($1, 10, 'zelle', 'RF-1')`, [o.order_id]));
    expect((await order(o.order_id)).payment_status).toBe('paid');
    const [v] = await admin(`select stock from public.product_variants where id = $1`, [f.variantId]);
    expect(v.stock).toBe(8); // 10 - 3 + 1 restocked
    expect(await ledgerBalanced()).toBe(true);
  });

  it('seller payouts never exceed the available balance', async () => {
    const s = await createUser('seller');
    const f = await createStoreWithProduct({ owner: s.id, price: 20, stock: 10 });
    await expectHint(asUser(adminUser.id, (sql) => sql(`select public.create_payout($1, 1)`, [f.storeId])), 'insufficient_balance');
    await expectHint(asUser(s.id, (sql) => sql(`select public.create_payout($1, 1)`, [f.storeId])), 'admin_required');
  });

  it('automated provider events: signature required, idempotent, amount checked', async () => {
    await admin(`update public.payment_methods set enabled = true, integration_status = 'sandbox' where code = 'binance_pay'`);
    try {
      const f = await createStoreWithProduct({ kind: 'platform', price: 33, stock: 5 });
      const o = await buy(buyer.id, f.variantId, 1);
      const q = await quote(buyer.id, o.order_id, 'binance_pay');
      const p = await asUser(buyer.id, async (sql) => (await sql(`select public.start_provider_payment($1, $2) as p`, [q.id, key()]))[0].p);
      expect(p.status).toBe('processing');
      await admin(`select public.attach_provider_payment($1, $2)`, [p.id, p.number]);
      // a buyer cannot forge provider events
      await expectHint(asUser(buyer.id, (sql) => sql(`select public.record_provider_event('binance_pay','e','PAY',$1,'succeeded',1,'USDT',true,'{}')`, [p.number])).catch((e) => { throw Object.assign(e, { hint: e.code === '42501' ? 'forbidden' : e.hint }); }), 'forbidden');
      const evt = (id: string, valid: boolean, amount: number) => admin(`select public.record_provider_event('binance_pay', $1, 'PAY:PAY_SUCCESS', $2, 'succeeded', $3, 'USDT', $4, '{}') as r`, [id, p.number, amount, valid]);
      const e1 = key('E'), e2 = key('E');
      expect((await evt(e1, false, Number(q.amount_due)))[0].r.status).toBe('rejected_signature');
      expect((await order(o.order_id)).paid_usd).toBe('0.00');
      expect((await evt(e2, true, Number(q.amount_due)))[0].r.status).toBe('processed');
      expect((await evt(e2, true, Number(q.amount_due)))[0].r.status).toBe('duplicate');
      expect((await order(o.order_id)).payment_status).toBe('paid');
    } finally {
      await admin(`update public.payment_methods set enabled = false, integration_status = 'pending_credentials' where code = 'binance_pay'`);
    }
  });

  it('rate limiting protects payment submission', async () => {
    await admin(`insert into public.rate_limits (user_id, action, window_start, hits)
                 values ($1, 'submit_payment', to_timestamp(floor(extract(epoch from now()) / 3600) * 3600), 10)`, [buyer.id]);
    const f = await createStoreWithProduct({ kind: 'platform', price: 10, stock: 5 });
    const o = await buy(buyer.id, f.variantId, 1);
    const q = await quote(buyer.id, o.order_id, 'pago_movil');
    await expectHint(submit(buyer.id, q.id, ref()), 'rate_limited');
  });

  it('only admins can verify payments, refund or post adjustments', async () => {
    const f = await createStoreWithProduct({ kind: 'platform', price: 10, stock: 5 });
    const o = await buy(buyer.id, f.variantId, 1);
    const q = await quote(buyer.id, o.order_id, 'pago_movil');
    const p = await submit(buyer.id, q.id, ref());
    await expectHint(review(buyer.id, p.id), 'admin_required');
    const [item] = await admin(`select id from public.order_items where order_id = $1`, [o.order_id]);
    await expectHint(asUser(buyer.id, (sql) => sql(`select public.refund_item($1, 1, 'x')`, [item.id])), 'admin_required');
    await expectHint(asUser(buyer.id, (sql) => sql(`select public.post_adjustment($1, 100, 'x')`, [f.storeId])), 'admin_required');
    await expectHint(asUser(buyer.id, (sql) => sql(`select public.set_manual_rate('USD/VES', 1, 60, 'x')`)), 'admin_required');
    await expectHint(asUser(buyer.id, (sql) => sql(`select public.ingest_rate('demo', 'USD/VES', 1, now())`)), 'admin_required');
    // and cannot write financial tables directly
    await asUser(buyer.id, (sql) => sql(`update public.payments set status = 'confirmed' where id = $1`, [p.id])).then(
      () => { throw new Error('should fail'); }, (e) => expect(e.code).toBe('42501'));
    await asUser(buyer.id, (sql) => sql(`update public.orders set paid_usd = 999 where id = $1`, [o.order_id])).then(
      () => { throw new Error('should fail'); }, (e) => expect(e.code).toBe('42501'));
  });

  it('disabled providers cannot be quoted (no fake success)', async () => {
    const f = await createStoreWithProduct({ kind: 'platform', price: 10, stock: 5 });
    const o = await buy(buyer.id, f.variantId, 1);
    await expectHint(quote(buyer.id, o.order_id, 'paypal'), 'method_unavailable');
  });
});
