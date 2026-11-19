import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { planSchedule } from '@kora/core';
import { DATABASE_URL, admin, asUser, createAddress, createStoreWithProduct, createUser, expectHint, key, ledgerBalanced, pool } from '../../src/db';

const run = key('installments').replaceAll('-', '').slice(-16);
type Fixture = Awaited<ReturnType<typeof createStoreWithProduct>> & { methodId: string };
type Plan = Record<string, any>;
let plans: Plan[];
const cents = (n: unknown) => Math.round(Number(n) * 100);
const codes = (doc: any) => (doc.plans as any[]).map(p => p.code).sort();
const hasThree = (doc: any) => codes(doc).includes('three_parts');

beforeAll(async () => {
  // Keep the existing CI clone kora_test and the explicitly selected local release clone.
  // Reject a remote/dev/default database BEFORE connecting or creating any fixture.
  let target: URL;
  try { target = new URL(DATABASE_URL); } catch { throw new Error('Installment tests require a local test database URL.'); }
  const databaseName = decodeURIComponent(target.pathname.slice(1));
  if (!['postgres:', 'postgresql:'].includes(target.protocol) ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) ||
      !(databaseName === 'kora_test' ||
        (databaseName === 'mayami_installments_20261107' && !!process.env.TEST_DATABASE_URL))) {
    throw new Error('Installment tests may only use the local CI clone or the explicit isolated release clone.');
  }
  const [identity] = await admin('select current_database() db,host(inet_server_addr()) host,inet_server_port() port');
  expect(identity.db).toBe(databaseName);
  expect(['127.0.0.1', '::1']).toContain(identity.host);
  expect(identity.port).toBe(Number(target.port || 5432));
  const [schema] = await admin("select to_regprocedure('checkout_private.installment_plan_eligible(public.installment_plans,numeric,public.fulfillment_flow[],boolean)') is not null as ready");
  expect(schema.ready).toBe(true);
  plans = await admin('select * from public.installment_plans order by code');
});
afterAll(async () => {
  try {
    if (plans) expect(await admin('select * from public.installment_plans order by code')).toEqual(plans);
  } finally { await pool.end(); }
});

async function fixture(opts: Parameters<typeof createStoreWithProduct>[0] = {}, shipping = 0): Promise<Fixture> {
  const f = await createStoreWithProduct({ kind: 'platform', origin: 'local', availability: 'reservable', price: 39, stock: 6, ...opts });
  const code = key('inst-' + run);
  const [zone] = await admin("select id from public.shipping_zones where country_code='VE' and 'A'=any(region_codes) limit 1");
  expect(zone).toBeDefined();
  const [method] = await admin("insert into public.shipping_methods(code,name,kind) values($1,'Installments own test delivery','home_delivery') returning id", [code]);
  await admin("insert into public.shipping_rates(method_id,zone_id,store_id,flows,base_usd,min_days,max_days) values($1,$2,$3,array['local_stock','import_order','seller_shipping']::public.fulfillment_flow[],$4,0,1)", [method.id, zone.id, f.storeId, shipping]);
  return { ...f, methodId: method.id };
}
async function buyer() { return createUser('inst-' + run); }
async function setCart(user: string, entries: { fixture: Fixture; quantity?: number }[]) {
  // User is newly created by this suite; never touch another actor's cart.
  await asUser(user, async sql => {
    await sql('delete from public.cart_items where user_id=auth.uid()');
    for (const row of entries) await sql('select public.cart_set_quantity($1,$2)', [row.fixture.variantId, row.quantity ?? 1]);
  });
}
async function summary(user: string) {
  return (await asUser(user, sql => sql('select public.cart_summary_reviewed(null) as s')))[0].s;
}
async function detail(product: string, user: string | null = null) {
  return (await asUser(user, sql => sql('select public.product_detail_commercial($1) as d', [product])))[0].d;
}
async function reviewed(user: string, fixtures: Fixture[], plan = 'three_parts') {
  const address = await createAddress(user);
  const doc = (await asUser(user, sql => sql('select public.cart_summary_reviewed($1) as s', [address])))[0].s;
  const shipping: Record<string, string> = {};
  for (const group of doc.groups) shipping[group.key] = fixtures.find(f => f.storeId === group.store.id)!.methodId;
  const preview = (await asUser(user, sql => sql('select public.checkout_preview_reviewed($1,$2::jsonb,$3) as s', [address, JSON.stringify(shipping), plan])))[0].s;
  return { address, shipping, preview };
}
async function place(user: string, input: Awaited<ReturnType<typeof reviewed>>, idem = key('inst-order')) {
  const result = (await asUser(user, sql => sql('select public.place_order_reviewed($1,$2::jsonb,$3,$4,$5) as r', [input.address, JSON.stringify(input.shipping), input.preview.plan.code, idem, input.preview.review_token])))[0].r;
  return { ...result, idem };
}
function checkSchedule(doc: any, expected?: number[]) {
  expect(doc.schedule).toHaveLength(3);
  expect(doc.schedule.map((r: any) => r.seq)).toEqual([1, 2, 3]);
  expect(doc.schedule.map((r: any) => r.due_in_days)).toEqual([0, 15, 30]);
  expect(doc.schedule.every((r: any) => cents(r.amount_usd) > 0)).toBe(true);
  expect(doc.schedule.reduce((sum: number, r: any) => sum + cents(r.amount_usd), 0)).toBe(cents(doc.total_usd));
  if (expected) expect(doc.schedule.map((r: any) => cents(r.amount_usd))).toEqual(expected.map(cents));
  expect(doc.schedule.map((r: any) => cents(r.amount_usd))).toEqual(planSchedule(doc.total_usd, doc.plan).map(r => cents(r.amount_usd)));
}
async function orderFootprint(id: string) {
  return (await admin("select jsonb_build_object('order',(select to_jsonb(o) from public.orders o where id=$1),'obligations',(select jsonb_agg(to_jsonb(p) order by seq) from public.payment_obligations p where order_id=$1),'ledger',(select jsonb_agg(to_jsonb(l) order by id) from public.ledger_entries l where order_id=$1),'fulfillments',(select jsonb_agg(to_jsonb(f) order by seq) from public.fulfillments f where order_id=$1)) as f", [id]))[0].f;
}

describe('three total payments: local server, current public reader and RLS', () => {
  it('01 reservable local USD39 is eligible and creates exactly three USD13 obligations', async () => {
    const f = await fixture(), u = await buyer(); await setCart(u.id, [{ fixture: f }]);
    expect(hasThree(await summary(u.id))).toBe(true);
    const info = await detail(f.productId); expect(info.installment_options.find((o: any) => o.variant_id === f.variantId).plans.find((p: any) => p.code === 'three_parts').min_quantity).toBe(1);
    const r = await reviewed(u.id, [f]); checkSchedule(r.preview, [13, 13, 13]);
    const order = await place(u.id, r);
    const obligations = await admin("select seq,kind,amount_usd,(due_date-current_date)::int days from public.payment_obligations where order_id=$1 order by seq", [order.order_id]);
    expect(obligations.map(x => [x.seq, x.kind, cents(x.amount_usd), x.days])).toEqual([[1, 'installment', 1300, 0], [2, 'installment', 1300, 15], [3, 'installment', 1300, 30]]);
    expect(await ledgerBalanced(order.order_id)).toBe(true);
  });
  it('02 on_order/import USD39 keeps import flow and three payments', async () => {
    const f = await fixture({ origin: 'import', availability: 'on_order' }), u = await buyer(); await setCart(u.id, [{ fixture: f }]);
    const r = await reviewed(u.id, [f]); expect(r.preview.groups[0].flow).toBe('import_order'); checkSchedule(r.preview, [13, 13, 13]);
  });
  it('03 both deferred seller states are eligible without changing delivery flow', async () => {
    for (const availability of ['reservable', 'on_order']) {
      const f = await fixture({ kind: 'seller', origin: 'seller', availability }), u = await buyer(); await setCart(u.id, [{ fixture: f }]);
      const r = await reviewed(u.id, [f]); expect(r.preview.groups[0].flow).toBe('seller_shipping'); checkSchedule(r.preview, [13, 13, 13]);
    }
  });
  it('04 reservable plus on_order across flows has one three-part order schedule', async () => {
    const a = await fixture(), b = await fixture({ availability: 'on_order', origin: 'import', kind: 'seller' }), u = await buyer();
    await setCart(u.id, [{ fixture: a }, { fixture: b }]);
    const r = await reviewed(u.id, [a, b]); expect(r.preview.groups).toHaveLength(2); checkSchedule(r.preview, [26, 26, 26]);
    const order = await place(u.id, r);
    expect((await admin('select count(*)::int n from public.payment_obligations where order_id=$1', [order.order_id]))[0].n).toBe(3);
  });
  it('05 one qualifying line does not unlock a mixed USD40 cart', async () => {
    const a = await fixture(), b = await fixture({ availability: 'available', price: 1 }), u = await buyer(); await setCart(u.id, [{ fixture: a }, { fixture: b }]);
    expect(hasThree(await summary(u.id))).toBe(false);
    await expectHint(asUser(u.id, sql => sql("select public.checkout_preview_reviewed(null,'{}','three_parts')")), 'plan_invalid');
  });
  it('06 legacy rules still admit mixed local USD69 carts', async () => {
    const a = await fixture(), b = await fixture({ availability: 'available', price: 30 }), u = await buyer(); await setCart(u.id, [{ fixture: a }, { fixture: b }]);
    expect(hasThree(await summary(u.id))).toBe(true);
  });
  it('07 available USD39 is quantity-sensitive in both reader and checkout', async () => {
    const f = await fixture({ availability: 'available' }), u = await buyer(), d = await detail(f.productId);
    const option = d.installment_options.find((o: any) => o.variant_id === f.variantId);
    expect(option.plans.find((p: any) => p.code === 'three_parts').min_quantity).toBe(2);
    await setCart(u.id, [{ fixture: f }]); expect(hasThree(await summary(u.id))).toBe(false);
    await setCart(u.id, [{ fixture: f, quantity: 2 }]); expect(hasThree(await summary(u.id))).toBe(true);
  });
  it('08 seller available USD80 remains excluded by legacy flow', async () => {
    const f = await fixture({ kind: 'seller', origin: 'seller', availability: 'available', price: 80 }), u = await buyer(); await setCart(u.id, [{ fixture: f }]);
    expect(hasThree(await summary(u.id))).toBe(false);
    expect((await detail(f.productId)).installment_options[0].plans.map((p: any) => p.code)).not.toContain('three_parts');
  });
  it('09 in_transit USD39 gains no deferred-state exception', async () => {
    const f = await fixture({ availability: 'in_transit' }), u = await buyer(); await setCart(u.id, [{ fixture: f }]);
    expect(hasThree(await summary(u.id))).toBe(false);
  });
  it('10 invalid stock, availability, variant or store never supplies installment quotes', async () => {
    for (const change of ['stock', 'sold_out', 'unavailable', 'variant', 'store']) {
      const f = await fixture();
      if (change === 'stock') await admin('update public.product_variants set stock=0 where id=$1', [f.variantId]);
      if (change === 'sold_out' || change === 'unavailable') await admin('update public.products set availability=$2 where id=$1', [f.productId, change]);
      if (change === 'variant') await admin('update public.product_variants set active=false where id=$1', [f.variantId]);
      if (change === 'store') await admin("update public.stores set status='suspended' where id=$1", [f.storeId]);
      const d = await detail(f.productId);
      expect(d === null || d.installment_options.length === 0).toBe(true);
    }
    const good = await fixture(), bad = await fixture(), u = await buyer(); await setCart(u.id, [{ fixture: good }, { fixture: bad }]);
    await admin('update public.product_variants set stock=0 where id=$1', [bad.variantId]);
    const s = await summary(u.id); expect(s.issues).toBeGreaterThan(0); expect(hasThree(s)).toBe(false);
  });
  it('11 inactive, changed-count and interest records cannot use the exception', async () => {
    const base = plans.find(p => p.code === 'three_parts')!;
    for (const patch of [{ active: false }, { down_payment_pct: 50, installments: 2 }, { installments: 4 }, { surcharge_pct: 1 }]) {
      const [row] = await admin("select checkout_private.installment_plan_eligible(jsonb_populate_record(null::public.installment_plans,$1::jsonb),39,array['seller_shipping']::public.fulfillment_flow[],true) as ok", [JSON.stringify({ ...base, ...patch })]);
      expect(row.ok).toBe(false);
    }
  });
  it('12 cent rounding cannot create zero obligations and metadata states minimum quantity', async () => {
    const f = await fixture({ price: 0.01 }), u = await buyer(), d = await detail(f.productId);
    expect(d.installment_options[0].plans.find((p: any) => p.code === 'three_parts').min_quantity).toBe(3);
    await setCart(u.id, [{ fixture: f }]); expect(hasThree(await summary(u.id))).toBe(false);
    await setCart(u.id, [{ fixture: f, quantity: 3 }]); const r = await reviewed(u.id, [f]); checkSchedule(r.preview, [0.01, 0.01, 0.01]);
    await place(u.id, r);
  });
  it('13 actual shipping is included in the final three-part schedule', async () => {
    const f = await fixture({}, 5.50), u = await buyer(); await setCart(u.id, [{ fixture: f }]); const r = await reviewed(u.id, [f]);
    expect(cents(r.preview.items_usd)).toBe(3900); expect(cents(r.preview.shipping_usd)).toBe(550); checkSchedule(r.preview, [14.83, 14.83, 14.84]);
  });
  it('14 remainder cents stay exact for total USD100', async () => {
    const f = await fixture({ price: 100 }), u = await buyer(); await setCart(u.id, [{ fixture: f }]); checkSchedule((await reviewed(u.id, [f])).preview, [33.33, 33.33, 33.34]);
  });
  it('15 positive down payment counts separately: 50/2 is three, 50/3 is four', async () => {
    for (const installments of [2, 3]) {
      const config = { code: 'hypothesis_only', name: '', down_payment_pct: 50, installments, interval_days: 15, surcharge_pct: 0 };
      const [{ s }] = await admin('select public._plan_schedule(39,jsonb_populate_record(null::public.installment_plans,$1::jsonb)) as s', [JSON.stringify(config)]);
      expect(s).toHaveLength(installments + 1);
      expect(s[0].kind).toBe('down_payment');
      expect(s.map((x: any) => cents(x.amount_usd))).toEqual(planSchedule(39, config).map(x => cents(x.amount_usd)));
      expect(s.reduce((n: number, x: any) => n + cents(x.amount_usd), 0)).toBe(3900);
    }
  });
  it('16 detail ranges, private eligibility and real cart agree across price, states, flows and quantity', async () => {
    for (const availability of ['reservable', 'on_order', 'available']) for (const kind of ['platform', 'seller'] as const) {
      for (const price of [39, 49, 52]) {
        const f = await fixture({ availability, kind, origin: kind === 'seller' ? 'seller' : 'local', price, stock: 3 }), u = await buyer();
        const option = (await detail(f.productId)).installment_options.find((o: any) => o.variant_id === f.variantId);
        expect(option.basis).toBe('products_only_excludes_shipping'); expect(option.max_quantity).toBe(3);
        for (const quantity of [1, 2, 3]) {
          await setCart(u.id, [{ fixture: f, quantity }]); const s = await summary(u.id);
          const advertised = option.plans.filter((p: any) => quantity >= p.min_quantity && quantity <= p.max_quantity).map((p: any) => p.code).sort();
          expect(codes(s)).toEqual(advertised);
          const flow = kind === 'seller' ? 'seller_shipping' : 'local_stock';
          for (const plan of plans) {
            const [h] = await admin('select checkout_private.installment_plan_eligible(jsonb_populate_record(null::public.installment_plans,$1::jsonb),$2,array[$3::public.fulfillment_flow],$4) as ok', [JSON.stringify(plan), price * quantity, flow, ['reservable', 'on_order'].includes(availability)]);
            expect(codes(s).includes(plan.code)).toBe(h.ok);
          }
        }
      }
    }
  });
  it('17 anonymous and buyer public readers respect hidden catalog RLS', async () => {
    const f = await fixture(), u = await buyer();
    expect((await detail(f.productId)).id).toBe(f.productId);
    expect((await detail(f.productId, u.id)).installment_options).toEqual((await detail(f.productId)).installment_options);
    await admin("update public.products set moderation_status='pending' where id=$1", [f.productId]);
    expect(await detail(f.productId)).toBeNull(); expect(await detail(f.productId, u.id)).toBeNull();
  });
  it('18 private helper is denied to every API role and public reader remains invoker', async () => {
    const [r] = await admin("select p.prosecdef as definer,has_function_privilege('anon',p.oid,'EXECUTE') a,has_function_privilege('authenticated',p.oid,'EXECUTE') b from pg_proc p where p.oid='public.product_detail_commercial(uuid)'::regprocedure");
    expect(r).toEqual({ definer: false, a: true, b: true });
    const [h] = await admin("select has_function_privilege('anon',p.oid,'EXECUTE') a,has_function_privilege('authenticated',p.oid,'EXECUTE') b,has_function_privilege('service_role',p.oid,'EXECUTE') c from pg_proc p where p.oid='checkout_private.installment_plan_eligible(public.installment_plans,numeric,public.fulfillment_flow[],boolean)'::regprocedure");
    expect(h).toEqual({ a: false, b: false, c: false });
    const u = await buyer();
    for (const actor of [null, u.id]) await expect(asUser(actor, sql => sql("select checkout_private.installment_plan_eligible(null::public.installment_plans,39,'{local_stock}',true)"))).rejects.toMatchObject({ code: '42501' });
  });
  it('19 an existing local order history is untouched by later own catalog changes and another order', async () => {
    const f = await fixture(), u = await buyer(); await setCart(u.id, [{ fixture: f }]);
    const first = await place(u.id, await reviewed(u.id, [f])); const before = await orderFootprint(first.order_id);
    await admin("update public.products set availability='available' where id=$1", [f.productId]);
    await admin('update public.product_variants set price_usd=52 where id=$1', [f.variantId]);
    const other = await fixture(), u2 = await buyer(); await setCart(u2.id, [{ fixture: other }]); await place(u2.id, await reviewed(u2.id, [other]));
    expect(await orderFootprint(first.order_id)).toEqual(before);
  });
  it('20 replay returns the same old local order before new cart eligibility and preserves new cart', async () => {
    const f = await fixture(), u = await buyer(); await setCart(u.id, [{ fixture: f }]); const input = await reviewed(u.id, [f]); const old = await place(u.id, input);
    const next = await fixture({ availability: 'available', price: 1 }); await setCart(u.id, [{ fixture: next }]);
    const before = await orderFootprint(old.order_id), replay = await place(u.id, input, old.idem);
    expect(replay.order_id).toBe(old.order_id); expect(replay.replayed).toBe(true); expect(await orderFootprint(old.order_id)).toEqual(before);
    const cart = await asUser(u.id, sql => sql('select variant_id,quantity from public.cart_items where user_id=auth.uid()'));
    expect(cart).toEqual([{ variant_id: next.variantId, quantity: 1 }]);
  });
  it('21 concurrent identical confirmation creates one order and three obligations', async () => {
    const f = await fixture(), u = await buyer(); await setCart(u.id, [{ fixture: f }]); const input = await reviewed(u.id, [f]), idem = key('inst-race');
    const [a, b] = await Promise.all([place(u.id, input, idem), place(u.id, input, idem)]);
    expect(a.order_id).toBe(b.order_id); expect([a.replayed, b.replayed].sort()).toEqual([false, true]);
    expect((await admin('select count(*)::int n from public.payment_obligations where order_id=$1', [a.order_id]))[0].n).toBe(3);
    expect((await admin('select stock from public.product_variants where id=$1', [f.variantId]))[0].stock).toBe(5);
    expect(await ledgerBalanced(a.order_id)).toBe(true);
  });
  it('22 changed review cannot confirm a different price and fresh review produces exact three parts', async () => {
    const f = await fixture(), u = await buyer(); await setCart(u.id, [{ fixture: f }]); const input = await reviewed(u.id, [f]), idem = key('inst-stale');
    await admin('update public.product_variants set price_usd=42 where id=$1', [f.variantId]);
    await expectHint(place(u.id, input, idem), 'checkout_changed');
    expect((await admin('select count(*)::int n from public.orders where buyer_id=$1 and idempotency_key=$2', [u.id, idem]))[0].n).toBe(0);
    const fresh = await reviewed(u.id, [f]); checkSchedule(fresh.preview, [14, 14, 14]); await place(u.id, fresh, idem);
  });
});
