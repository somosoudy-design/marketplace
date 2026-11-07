import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, asUser, buy, createAddress, createStoreWithProduct, createUser, expectHint, key, ledgerBalanced, pool } from '../../src/db';
import { planSchedule } from '@kora/core';

afterAll(() => pool.end());

describe('checkout & inventory', () => {
  let buyer: { id: string };
  beforeAll(async () => { buyer = await createUser('buyer'); });

  it('prices come from the database, never from the client', async () => {
    const f = await createStoreWithProduct({ price: 25, stock: 10 });
    const addr = await createAddress(buyer.id);
    await asUser(buyer.id, async (sql) => {
      // the cart has no price column: the client can only say "which variant, how many"
      await sql(`select public.cart_set_quantity($1, 2)`, [f.variantId]);
      const [{ s }] = await sql(`select public.checkout_preview($1, '{}', 'full') as s`, [addr]);
      expect(s.items_usd).toBe(50);
      await sql(`delete from public.cart_items`);
    });
    // direct update as a buyer affects zero rows (RLS), price unchanged
    await asUser(buyer.id, (sql) => sql(`update public.product_variants set price_usd = 0.01 where id = $1 returning id`, [f.variantId])).then((rows) => expect(rows).toHaveLength(0));
    const [v] = await admin(`select price_usd from public.product_variants where id = $1`, [f.variantId]);
    expect(v.price_usd).toBe('25.00');
  });

  it('double tap on "Comprar" creates exactly one order (idempotency + advisory lock)', async () => {
    const f = await createStoreWithProduct({ price: 10, stock: 5 });
    const addr = await createAddress(buyer.id);
    await asUser(buyer.id, (sql) => sql(`select public.cart_set_quantity($1, 1)`, [f.variantId]));
    const k = key('double');
    const place = () => asUser(buyer.id, async (sql) => (await sql(`select public.place_order($1, '{}', 'full', $2) as r`, [addr, k]))[0].r);
    const [a, b] = await Promise.all([place(), place()]);
    expect(a.order_id).toBe(b.order_id);
    expect([a.replayed, b.replayed].sort()).toEqual([false, true]);
    const [{ n }] = await admin(`select count(*)::int n from public.orders where idempotency_key = $1`, [k]);
    expect(n).toBe(1);
    const [s] = await admin(`select stock from public.product_variants where id = $1`, [f.variantId]);
    expect(s.stock).toBe(4);
  });

  it('a retried request after a lost response returns the same order (connection failure)', async () => {
    const f = await createStoreWithProduct({ price: 10, stock: 5 });
    const k = key('retry');
    const first = await buy(buyer.id, f.variantId, 1, { idem: k });
    const again = await asUser(buyer.id, async (sql) => (await sql(`select public.place_order(null, '{}', 'full', $1) as r`, [k]))[0].r);
    expect(again).toMatchObject({ order_id: first.order_id, replayed: true });
  });

  it('two buyers racing for the last unit: exactly one wins, stock never negative', async () => {
    const f = await createStoreWithProduct({ price: 30, stock: 1 });
    const b1 = await createUser('racer1'); const b2 = await createUser('racer2');
    const [a1, a2] = [await createAddress(b1.id), await createAddress(b2.id)];
    await asUser(b1.id, (sql) => sql(`select public.cart_set_quantity($1, 1)`, [f.variantId]));
    await asUser(b2.id, (sql) => sql(`select public.cart_set_quantity($1, 1)`, [f.variantId]));
    const attempt = (u: string, a: string) =>
      asUser(u, (sql) => sql(`select public.place_order($1, '{}', 'full', $2) as r`, [a, key('race')])).then(() => 'ok', (e) => e.hint);
    const results = await Promise.all([attempt(b1.id, a1), attempt(b2.id, a2)]);
    expect(results.sort()).toEqual(['cart_has_issues', 'ok']);
    const [v] = await admin(`select stock from public.product_variants where id = $1`, [f.variantId]);
    expect(v.stock).toBe(0);
    const [p] = await admin(`select availability from public.products where id = $1`, [f.productId]);
    expect(p.availability).toBe('sold_out');
  });

  it('product sold out during checkout blocks the order with a clear reason', async () => {
    const f = await createStoreWithProduct({ price: 12, stock: 3 });
    const addr = await createAddress(buyer.id);
    await asUser(buyer.id, (sql) => sql(`select public.cart_set_quantity($1, 2)`, [f.variantId]));
    await admin(`update public.product_variants set stock = 1 where id = $1`, [f.variantId]);
    const e = await expectHint(asUser(buyer.id, (sql) => sql(`select public.place_order($1, '{}', 'full', $2)`, [addr, key()])), 'cart_has_issues');
    expect(e.detail).toContain('insufficient_stock');
    const [{ s }] = await asUser(buyer.id, (sql) => sql(`select public.cart_summary($1) as s`, [addr]));
    const line = s.groups.flatMap((g: any) => g.lines).find((l: any) => l.variant_id === f.variantId);
    expect(line).toMatchObject({ issue: 'insufficient_stock', max_quantity: 1 });
    await asUser(buyer.id, (sql) => sql(`delete from public.cart_items where variant_id = $1`, [f.variantId]));
  });

  it('multi-seller cart: one delivery per seller/modality with its own shipping, no fake grouping', async () => {
    const s1 = await createStoreWithProduct({ price: 20, stock: 5 });
    const s2 = await createStoreWithProduct({ price: 15, stock: 5 });
    const own = await createStoreWithProduct({ price: 40, stock: null, kind: 'platform', availability: 'on_order', origin: 'import' });
    const addr = await createAddress(buyer.id, 'K'); // Lara (occidente)
    const res = await asUser(buyer.id, async (sql) => {
      for (const v of [s1.variantId, s2.variantId, own.variantId]) await sql(`select public.cart_set_quantity($1, 1)`, [v]);
      // deposit plans don't apply to external sellers: the server only offers 'full' for this cart
      const [{ s: plans }] = await sql(`select public.cart_summary($1) as s`, [addr]);
      expect(plans.plans.map((p: any) => p.code)).toEqual(['full']);
      const [{ s }] = await sql(`select public.checkout_preview($1, '{}', 'full') as s`, [addr]);
      expect(s.groups).toHaveLength(3);
      expect(s.groups.map((g: any) => g.flow).sort()).toEqual(['import_order', 'seller_shipping', 'seller_shipping']);
      expect(s.groups.every((g: any) => g.selected_shipping && g.shipping_options.length > 0)).toBe(true);
      const shipping = s.groups.reduce((acc: number, g: any) => acc + Number(g.selected_shipping.cost_usd), 0);
      expect(Number(s.shipping_usd)).toBeCloseTo(shipping, 2);
      expect(s.schedule.map((x: any) => x.amount_usd)).toEqual(planSchedule(s.total_usd, { code: 'full', name: '', down_payment_pct: 100, installments: 0, interval_days: 30 }).map((x) => Number(x.amount_usd)));
      const [{ r }] = await sql(`select public.place_order($1, '{}', 'full', $2) as r`, [addr, key()]);
      return r;
    });
    const fs = await admin(`select store_id, flow, shipping_usd, eta_min_date, eta_max_date from public.fulfillments where order_id = $1 order by seq`, [res.order_id]);
    expect(fs).toHaveLength(3);
    expect(new Set(fs.map((f: any) => f.store_id)).size).toBe(3);
    const obligations = await admin(`select kind, amount_usd from public.payment_obligations where order_id = $1 order by seq`, [res.order_id]);
    const [o] = await admin(`select total_usd from public.orders where id = $1`, [res.order_id]);
    expect(obligations.reduce((a: number, x: any) => a + Number(x.amount_usd), 0).toFixed(2)).toBe(o.total_usd);
    expect(await ledgerBalanced(res.order_id)).toBe(true);
  });

  it('installment plans not allowed for seller deliveries are refused server-side', async () => {
    const s1 = await createStoreWithProduct({ price: 80, stock: 5 });
    const addr = await createAddress(buyer.id);
    await asUser(buyer.id, async (sql) => {
      await sql(`delete from public.cart_items`);
      await sql(`select public.cart_set_quantity($1, 1)`, [s1.variantId]);
    });
    await expectHint(asUser(buyer.id, (sql) => sql(`select public.place_order($1, '{}', 'three_parts', $2)`, [addr, key()])), 'plan_invalid');
    await asUser(buyer.id, (sql) => sql(`delete from public.cart_items`));
  });

  it('shipping method must be one offered for that delivery', async () => {
    const s1 = await createStoreWithProduct({ price: 10, stock: 5 });
    const addr = await createAddress(buyer.id);
    await asUser(buyer.id, (sql) => sql(`select public.cart_set_quantity($1, 1)`, [s1.variantId]));
    const [{ s }] = await asUser(buyer.id, (sql) => sql(`select public.cart_summary($1) as s`, [addr]));
    const bogus = { [s.groups[0].key]: '00000000-0000-0000-0000-000000000000' };
    await expectHint(asUser(buyer.id, (sql) => sql(`select public.place_order($1, $2, 'full', $3)`, [addr, JSON.stringify(bogus), key()])), 'shipping_invalid');
    const garbage = { [s.groups[0].key]: 'not-a-method' };
    await expectHint(asUser(buyer.id, (sql) => sql(`select public.checkout_preview($1, $2, 'full')`, [addr, JSON.stringify(garbage)])), 'shipping_invalid');
    // the method code is accepted as well as its id
    const byCode = { [s.groups[0].key]: s.groups[0].shipping_options[0].code };
    const [{ p }] = await asUser(buyer.id, (sql) => sql(`select public.checkout_preview($1, $2, 'full') as p`, [addr, JSON.stringify(byCode)]));
    expect(p.groups[0].selected_shipping.code).toBe(s.groups[0].shipping_options[0].code);
    await asUser(buyer.id, (sql) => sql(`delete from public.cart_items`));
  });
});

describe('saved addresses', () => {
  it('deleting the main address promotes the most recently added one', async () => {
    const u = await createUser('addr-main');
    const first = await createAddress(u.id);
    const second = await createAddress(u.id);
    const third = await createAddress(u.id); // each new one is created as main, so make the first one main again
    await asUser(u.id, (sql) => sql(`update public.addresses set is_default = true where id = $1`, [first]));
    const main = async () => (await admin(`select id from public.addresses where user_id = $1 and is_default`, [u.id])).map((r: any) => r.id);
    expect(await main()).toEqual([first]);

    await asUser(u.id, (sql) => sql(`delete from public.addresses where id = $1`, [first]));
    expect(await main()).toEqual([third]);
    await asUser(u.id, (sql) => sql(`delete from public.addresses where id = $1`, [second])); // not the main one: nothing moves
    expect(await main()).toEqual([third]);
    await asUser(u.id, (sql) => sql(`delete from public.addresses where id = $1`, [third]));
    expect(await main()).toEqual([]);
  });
});
