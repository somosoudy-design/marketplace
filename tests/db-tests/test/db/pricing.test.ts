import { D, divisasFactor, priceFromCost } from '@kora/core';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { admin, asUser, buy, createStoreWithProduct, createUser, expectHint, key, ledgerBalanced, pool, setRate } from '../../src/db';

// Commercial price engine (migration 20261009233000, docs/PRECIOS.md). Rates of 2026-10-09 in the test project:
// BCV 875,65 Bs/$, Binance P2P 1.014,93 Bs/USDT, Kraken 1,0009 USDT/$.
const BCV = 875.65;
const P2P = 1014.93;
const USD_USDT = 1.0009;

const snapshot = async (by: string) => asUser(by, async (sql) => (await sql(`select public.take_pricing_snapshot('prueba') as s`))[0].s);
const quote = (u: string, order: string, method: string) =>
  asUser(u, async (sql) => (await sql(`select public.create_payment_quote($1, $2, null) as q`, [order, method]))[0].q);
const today = async () => (await admin(`select public.pricing_today() as t`))[0].t;
const rule = async () => (await admin(`select value from public.app_settings where key = 'pricing.import'`))[0].value;
let refSeq = Math.floor(Math.random() * 1e6);

async function todayRates(p2p = P2P) {
  await setRate('USD/VES', BCV);
  await setRate('USDT/VES', p2p);
  await setRate('USD/USDT', USD_USDT);
}

afterAll(() => pool.end());

describe('price engine: the day\'s gap, costs and divisas quotes', () => {
  let adm: { id: string };
  beforeEach(async () => {
    adm = await createUser('price-admin', { role: 'admin' });
    await todayRates();
  });
  // a snapshot in force changes every Zelle/USDT quote of the database: the other suites must not see one
  afterEach(async () => {
    await admin(`update public.pricing_snapshots set taken_at = now() - interval '2 hours', valid_until = now() - interval '1 hour' where valid_until > now()`);
  });

  it('takes the gap from the rates in force, only for admins, and refuses stale or doubtful rates', async () => {
    const buyer = await createUser('price-buyer');
    await expectHint(snapshot(buyer.id), 'admin_required');

    const s = await snapshot(adm.id);
    expect([Number(s.bcv_rate), Number(s.usdt_ves_rate), Number(s.usd_usdt_rate)]).toEqual([BCV, P2P, USD_USDT]);
    expect(Number(s.gap_pct)).toBeCloseTo((P2P / BCV - 1) * 100, 3);
    expect(new Date(s.valid_until).getTime() - new Date(s.taken_at).getTime()).toBe(30 * 3600_000);

    // the app sees the gap and the factor of each enabled divisas method; nothing about costs
    const t = await today();
    expect(t.available).toBe(true);
    const zelle = t.methods.find((m: any) => m.code === 'zelle');
    expect(Number(zelle.factor)).toBeCloseTo(Number(divisasFactor({ bcv: BCV, usdt_ves: P2P, usd_usdt: USD_USDT }, 'USD')), 8);
    expect(t.methods.map((m: any) => m.code)).not.toContain('pago_movil');

    // a P2P reading more than 150 % above the official rate never becomes a price
    await setRate('USDT/VES', BCV * 2.6);
    await expectHint(snapshot(adm.id), 'rate_anomaly');
    // no fresh P2P rate: no snapshot (the policy keeps P2P for 120 minutes)
    await admin(`delete from public.exchange_rates where pair = 'USDT/VES' and observed_at > now() - interval '3 hours'`);
    await setRate('USDT/VES', P2P, 300);
    await expectHint(snapshot(adm.id), 'rate_unavailable');
    // the hourly job reports instead of failing, and keeps a recent snapshot
    expect((await admin(`select public.ensure_pricing_snapshot() as r`))[0].r).toBe('vigente');
  });

  it('the database and the shared core compute the same prices', async () => {
    const s = await snapshot(adm.id);
    const r = await rule();
    for (const [cost, weight, freight, logistics, margin] of [[40, 0.5, null, null, null], [3.5, 0, null, 0, 10], [199.99, 2.4, 15, 3, 25], [1250, 8, null, null, 0]] as const) {
      const [{ b }] = await admin(
        `select public._price_from_cost($1, $2, $3, $4, $5, $6::jsonb, s) as b from public.pricing_snapshots s where s.id = $7`,
        [cost, weight, freight, logistics, margin, r, s.id],
      );
      const core = priceFromCost({ cost_usd: cost, weight_kg: weight, freight_usd: freight, logistics_usd: logistics, margin_pct: margin }, r, { bcv: BCV, usdt_ves: P2P, usd_usdt: USD_USDT });
      for (const [k, v] of Object.entries(core)) expect([k, Number(b[k])]).toEqual([k, Number(v)]);
    }
  });

  it('a store sets the cost of its product and its price follows the cost and the gap; buyers never see costs', async () => {
    const owner = await createUser('price-owner');
    const other = await createUser('price-other');
    const f = await createStoreWithProduct({ owner: owner.id, price: 10 });
    await admin(`update public.app_settings set value = '{"markup_pct":30,"per_kg_usd":12,"fixed_usd":2.5,"round_to":0.99,"configured":true}' where key = 'pricing.import'`);
    try {
      await snapshot(adm.id);
      const set = (by: string) => asUser(by, async (sql) =>
        (await sql(`select public.set_product_costs($1, $2::jsonb, $3::jsonb) as p`,
          [f.productId, JSON.stringify({ source: 'amazon', source_url: 'https://www.amazon.com/dp/B0PRUEBA' }), JSON.stringify([{ variant_id: f.variantId, cost_usd: 40 }])]))[0].p);
      await expectHint(set(other.id), 'store_access_denied');

      const p = await set(owner.id);
      // 40 + 0,5 kg × 12 + 2,50 = 48,50; +30 % = 63,05; × (1 + gap) = 73,08 -> $73,99 BCV; Zelle/USDT $63,84
      expect(p.variants[0].breakdown).toMatchObject({ landed_usd: 48.5, target_divisas_usd: 63.05, price_usd: 73.99, price_divisas_usd: 63.84 });
      const [v] = await admin(`select price_usd from public.product_variants where id = $1`, [f.variantId]);
      expect(v.price_usd).toBe('73.99');

      // costs are invisible to anyone outside the store, and cannot be written directly
      expect(await asUser(other.id, (sql) => sql(`select * from public.variant_costs where variant_id = $1`, [f.variantId]))).toHaveLength(0);
      expect(await asUser(owner.id, (sql) => sql(`select cost_usd from public.variant_costs where variant_id = $1`, [f.variantId]))).toEqual([{ cost_usd: '40.00' }]);
      await expect(asUser(owner.id, (sql) => sql(`update public.variant_costs set cost_usd = 1 where variant_id = $1`, [f.variantId]))).rejects.toMatchObject({ code: '42501' });

      // the next day's gap reprices it; a product priced by hand is left alone
      await admin(`update public.product_costs set auto_price = false where product_id = $1`, [f.productId]);
      await setRate('USDT/VES', 1100);
      await snapshot(adm.id);
      expect((await admin(`select price_usd from public.product_variants where id = $1`, [f.variantId]))[0].price_usd).toBe('73.99');
      await admin(`update public.product_costs set auto_price = true where product_id = $1`, [f.productId]);
      await snapshot(adm.id);
      // 63,05 × 1100 / 875,65 = 79,20 -> $79,99
      expect((await admin(`select price_usd from public.product_variants where id = $1`, [f.variantId]))[0].price_usd).toBe('79.99');
    } finally {
      await admin(`update public.app_settings set value = '{"markup_pct":30,"per_kg_usd":0,"fixed_usd":0,"round_to":0.99,"configured":false}' where key = 'pricing.import'`);
    }
  });

  it('Zelle and USDT pay the main price through the gap once; verification credits the whole order', async () => {
    const buyer = await createUser('price-payer');
    const f = await createStoreWithProduct({ kind: 'platform', price: 73.99, stock: 5 });
    const s = await snapshot(adm.id);
    const o = await buy(buyer.id, f.variantId, 1);
    const [{ total_usd }] = await admin(`select total_usd from public.orders where id = $1`, [o.order_id]);

    const pm = await quote(buyer.id, o.order_id, 'pago_movil');
    expect([pm.price_basis, Number(pm.amount_due)]).toEqual(['bcv', Number(D(total_usd).times(BCV).toDecimalPlaces(2))]);

    const usdt = await quote(buyer.id, o.order_id, 'usdt_trc20');
    const zelle = await quote(buyer.id, o.order_id, 'zelle');
    const snap = { bcv: BCV, usdt_ves: P2P, usd_usdt: USD_USDT };
    expect([usdt.price_basis, usdt.pricing_snapshot_id, Number(usdt.amount_due)])
      .toEqual(['divisas', s.id, Number(D(total_usd).times(divisasFactor(snap, 'USDT').toDecimalPlaces(8)).toDecimalPlaces(2))]);
    expect(Number(zelle.amount_due)).toBe(Number(D(total_usd).times(divisasFactor(snap, 'USD').toDecimalPlaces(8)).toDecimalPlaces(2)));
    // not twice: the bolívares of Pago Móvil buy, on P2P, the same USDT the USDT quote asks for
    expect(Math.abs(Number(pm.amount_due) / P2P - Number(usdt.amount_due))).toBeLessThanOrEqual(0.01);
    // the quote says which gap it used and never outlives it
    expect(zelle.divisas).toMatchObject({ gap_pct: Number(s.gap_pct) });
    expect(new Date(zelle.expires_at) <= new Date(s.valid_until)).toBe(true);

    // paying the Zelle amount settles the order's dollars at the BCV rate in full
    const [{ p }] = await asUser(buyer.id, (sql) =>
      sql(`select public.submit_payment($1, $2, $3, '{}'::jsonb, $4) as p`, [zelle.id, String(20_000_000 + refSeq++), `${buyer.id}/comprobante.png`, key('pay')]));
    await asUser(adm.id, (sql) => sql(`select public.review_payment($1, true, null, null)`, [p.id]));
    const [ord] = await admin(`select paid_usd, payment_status from public.orders where id = $1`, [o.order_id]);
    expect([ord.paid_usd, ord.payment_status]).toEqual([total_usd, 'paid']);
    const [pay] = await admin(`select amount, usd_recognized from public.payments where id = $1`, [p.id]);
    expect([Number(pay.amount), pay.usd_recognized]).toEqual([Number(zelle.amount_due), total_usd]);
    expect(await ledgerBalanced(o.order_id)).toBe(true);
  });

  it('without a snapshot in force, or with divisas prices off, Zelle pays the main price: no old gap is used', async () => {
    const buyer = await createUser('price-nosnap');
    const f = await createStoreWithProduct({ kind: 'platform', price: 50, stock: 5 });
    const o = await buy(buyer.id, f.variantId, 1);
    const [{ total_usd }] = await admin(`select total_usd from public.orders where id = $1`, [o.order_id]);

    await snapshot(adm.id);
    await admin(`update public.pricing_snapshots set taken_at = now() - interval '31 hours', valid_until = now() - interval '1 hour'`);
    const expired = await quote(buyer.id, o.order_id, 'zelle');
    expect([expired.price_basis, expired.pricing_snapshot_id, Number(expired.amount_due)]).toEqual(['bcv', null, Number(total_usd)]);
    expect((await today()).available).toBe(false);

    await snapshot(adm.id);
    await admin(`update public.app_settings set value = jsonb_set(value, '{divisas_prices}', 'false') where key = 'pricing.gap'`);
    try {
      expect((await quote(buyer.id, o.order_id, 'zelle')).price_basis).toBe('bcv');
      expect(await today()).toMatchObject({ available: false, reason: 'disabled' });
    } finally {
      await admin(`update public.app_settings set value = jsonb_set(value, '{divisas_prices}', 'true') where key = 'pricing.gap'`);
    }
  });

  it('the gap settings are validated like the other parameters', async () => {
    const set = (v: string) => asUser(adm.id, (sql) => sql(`update public.app_settings set value = $1::jsonb where key = 'pricing.gap'`, [v]));
    await expectHint(set('{"divisas_prices": "si", "refresh_hours": 24, "valid_hours": 30, "max_gap_pct": 150}'), 'invalid_setting');
    await expectHint(set('{"divisas_prices": true, "refresh_hours": 24, "valid_hours": 20, "max_gap_pct": 150}'), 'invalid_setting');
    await expectHint(set('{"divisas_prices": true, "refresh_hours": 24, "valid_hours": 30, "max_gap_pct": 150, "extra": 1}'), 'invalid_setting');
    await expectHint(asUser(adm.id, (sql) => sql(`delete from public.app_settings where key = 'pricing.gap'`)), 'invalid_setting');
  });
});
