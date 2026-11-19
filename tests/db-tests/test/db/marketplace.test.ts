import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, asUser, buy, createStoreWithProduct, createUser, expectHint, key, ledgerBalanced, pool, setRate } from '../../src/db';

afterAll(() => pool.end());

async function paidOrder(buyerId: string, adminId: string, variantId: string, qty = 1) {
  const o = await buy(buyerId, variantId, qty);
  const q = await asUser(buyerId, async (sql) => (await sql(`select public.create_payment_quote($1, 'zelle') as q`, [o.order_id]))[0].q);
  const p = await asUser(buyerId, async (sql) => (await sql(`select public.submit_payment($1, $2, $3, '{}', $4) as p`, [q.id, key('ZL'), `${buyerId}/p.png`, key()]))[0].p);
  await asUser(adminId, (sql) => sql(`select public.review_payment($1, true)`, [p.id]));
  return o;
}

describe('multi-vendor isolation (RLS + functions)', () => {
  let sellerA: { id: string }, sellerB: { id: string }, buyer: { id: string }, adminU: { id: string };
  let storeA: Awaited<ReturnType<typeof createStoreWithProduct>>, storeB: Awaited<ReturnType<typeof createStoreWithProduct>>;
  beforeAll(async () => {
    [sellerA, sellerB, buyer, adminU] = await Promise.all([createUser('sa'), createUser('sb'), createUser('buyer'), createUser('adm', { role: 'admin' })]);
    storeA = await createStoreWithProduct({ owner: sellerA.id, price: 10, stock: 10 });
    storeB = await createStoreWithProduct({ owner: sellerB.id, price: 10, stock: 10 });
  });

  it('a seller cannot edit another store, its products, prices or stock', async () => {
    await asUser(sellerA.id, async (sql) => {
      expect(await sql(`update public.products set title = 'hackeado' where id = $1 returning id`, [storeB.productId])).toHaveLength(0);
      expect(await sql(`update public.product_variants set price_usd = 1, stock = 999 where id = $1 returning id`, [storeB.variantId])).toHaveLength(0);
      expect(await sql(`update public.stores set name = 'x' where id = $1 returning id`, [storeB.storeId])).toHaveLength(0);
      await expect(sql(`insert into public.products (store_id, category_id, slug, title) values ($1, $2, $3, 'intruso')`, [storeB.storeId, storeB.categoryId, key('s')])).rejects.toMatchObject({ code: '42501' });
    });
    const [p] = await admin(`select title from public.products where id = $1`, [storeB.productId]);
    expect(p.title).not.toBe('hackeado');
  });

  it("a seller only sees its own deliveries, never orders or other sellers' data", async () => {
    const both = await createUser('both');
    const addrOrder = await (async () => {
      await asUser(both.id, (sql) => sql(`select public.cart_set_quantity($1, 1)`, [storeA.variantId]));
      return buy(both.id, storeB.variantId, 1);
    })();
    await asUser(sellerA.id, async (sql) => {
      const fs = await sql(`select store_id from public.fulfillments where order_id = $1`, [addrOrder.order_id]);
      expect(fs.map((f: any) => f.store_id)).toEqual([storeA.storeId]);
      expect(await sql(`select id from public.orders where id = $1`, [addrOrder.order_id])).toHaveLength(0);
      const items = await sql(`select store_id from public.order_items where order_id = $1`, [addrOrder.order_id]);
      expect(items.every((i: any) => i.store_id === storeA.storeId)).toBe(true);
      expect(await sql(`select id from public.payments where order_id = $1`, [addrOrder.order_id])).toHaveLength(0);
      expect(await sql(`select id from public.ledger_entries`)).toHaveLength(0);
      expect(await sql(`select id from public.addresses where user_id = $1`, [both.id])).toHaveLength(0);
    });
    const [fb] = await admin(`select id from public.fulfillments where order_id = $1 and store_id = $2`, [addrOrder.order_id, storeB.storeId]);
    await expectHint(asUser(sellerA.id, (sql) => sql(`select public.seller_balance($1)`, [storeB.storeId])), 'store_access_denied');
    await expectHint(asUser(sellerA.id, (sql) => sql(`select public.seller_dashboard($1)`, [storeB.storeId])), 'store_access_denied');
    await asUser(sellerA.id, (sql) => sql(`select public.advance_fulfillment($1, 'confirmed')`, [fb.id])).then(
      () => { throw new Error('should fail'); }, (e) => expect(e.code).toBe('P0002'));
  });

  it('sellers cannot self-publish restricted products nor touch moderation fields', async () => {
    const [dental] = await admin(`select id from public.categories where slug = 'equipamiento'`);
    const [low] = await admin(`select id from public.categories where slug = 'hogar'`);
    const res = await asUser(sellerA.id, async (sql) => {
      const [r] = await sql(`insert into public.products (store_id, category_id, slug, title, moderation_status, is_demo, popularity) values ($1, $2, $3, 'Equipo regulado', 'published', true, 99) returning id, moderation_status, is_demo, popularity`, [storeA.storeId, dental.id, key('reg')]);
      const [l] = await sql(`insert into public.products (store_id, category_id, slug, title) values ($1, $2, $3, 'Cojín decorativo') returning id, moderation_status`, [storeA.storeId, low.id, key('low')]);
      return { r, l };
    });
    expect(res.r).toMatchObject({ moderation_status: 'pending', is_demo: false, popularity: '0.0000' });
    expect(res.l.moderation_status).toBe('published'); // low-risk auto-publication
    // the pending product is invisible to buyers
    await asUser(buyer.id, async (sql) => expect(await sql(`select id from public.products where id = $1`, [res.r.id])).toHaveLength(0));
    await asUser(null, async (sql) => expect(await sql(`select id from public.products where id = $1`, [res.r.id])).toHaveLength(0));
    // admin approves; then a seller edit of the description sends it back to review
    await asUser(adminU.id, (sql) => sql(`select public.moderate_product($1, 'published', null)`, [res.r.id]));
    await asUser(sellerA.id, (sql) => sql(`update public.products set description = 'Nueva descripción' where id = $1`, [res.r.id]));
    const [after] = await admin(`select moderation_status from public.products where id = $1`, [res.r.id]);
    expect(after.moderation_status).toBe('pending');
    // suspension requires a note and can only be lifted by an admin
    await expectHint(asUser(adminU.id, (sql) => sql(`select public.moderate_product($1, 'suspended', null)`, [res.l.id])), 'note_required');
    await asUser(adminU.id, (sql) => sql(`select public.moderate_product($1, 'suspended', 'Infracción de normas')`, [res.l.id]));
    await asUser(sellerA.id, (sql) => sql(`update public.products set title = 'Cojín editado' where id = $1`, [res.l.id]));
    const [l2] = await admin(`select moderation_status from public.products where id = $1`, [res.l.id]);
    expect(l2.moderation_status).toBe('suspended');
    const events = await admin(`select to_status from public.moderation_events where product_id = $1 order by id`, [res.r.id]);
    expect(events.map((e: any) => e.to_status)).toEqual(['pending', 'published', 'pending']);
  });

  it('suspended stores disappear from the catalog', async () => {
    const s = await createStoreWithProduct({ owner: sellerB.id, price: 9, stock: 3, status: 'suspended' });
    await asUser(buyer.id, async (sql) => {
      expect(await sql(`select id from public.products where id = $1`, [s.productId])).toHaveLength(0);
      expect(await sql(`select id from public.search_products(null, null, $1)`, [s.storeSlug])).toHaveLength(0);
    });
    // sellers cannot reactivate themselves
    await asUser(sellerB.id, (sql) => sql(`update public.stores set status = 'active' where id = $1`, [s.storeId]));
    const [st] = await admin(`select status from public.stores where id = $1`, [s.storeId]);
    expect(st.status).toBe('suspended');
  });

  it('buyers only see their own orders, payments and addresses', async () => {
    const other = await createUser('other');
    const o = await buy(buyer.id, storeA.variantId, 1);
    await asUser(other.id, async (sql) => {
      expect(await sql(`select id from public.orders where id = $1`, [o.order_id])).toHaveLength(0);
      expect(await sql(`select id from public.fulfillments where order_id = $1`, [o.order_id])).toHaveLength(0);
      expect(await sql(`select id from public.payment_obligations where order_id = $1`, [o.order_id])).toHaveLength(0);
      await expectHint(sql(`select public.create_payment_quote($1, 'zelle')`, [o.order_id]).catch((e) => { throw Object.assign(e, { hint: e.code }); }), 'P0002');
    });
    await expect(asUser(null, (sql) => sql(`select id from public.orders`))).rejects.toMatchObject({ code: '42501' });
    await expect(asUser(null, (sql) => sql(`select id from public.payments`))).rejects.toMatchObject({ code: '42501' });
  });
});

describe('logistics', () => {
  let buyer: { id: string }, adminU: { id: string }, seller: { id: string };
  beforeAll(async () => {
    [buyer, adminU, seller] = await Promise.all([createUser('lb'), createUser('la', { role: 'admin' }), createUser('ls')]);
    await setRate('USD/VES', 100);
  });

  it('import orders follow the 10-step flow; cargo batches update every order but respect payment gates', async () => {
    const f = await createStoreWithProduct({ kind: 'platform', price: 50, stock: null, availability: 'on_order', origin: 'import' });
    const paidBuyer = await createUser('pb');
    const o1 = await buy(paidBuyer.id, f.variantId, 1, { plan: 'deposit_50' });
    const q = await asUser(paidBuyer.id, async (sql) => (await sql(`select public.create_payment_quote($1, 'zelle') as q`, [o1.order_id]))[0].q);
    const p = await asUser(paidBuyer.id, async (sql) => (await sql(`select public.submit_payment($1, $2, $3, '{}', $4) as p`, [q.id, key('ZL'), `${paidBuyer.id}/p.png`, key()]))[0].p);
    await asUser(adminU.id, (sql) => sql(`select public.review_payment($1, true)`, [p.id]));
    const unpaidBuyer = await createUser('ub');
    const o2 = await buy(unpaidBuyer.id, f.variantId, 1, { plan: 'deposit_50' });
    const fids = (await admin(`select id from public.fulfillments where order_id = any($1)`, [[o1.order_id, o2.order_id]])).map((r: any) => r.id);
    const r = await asUser(adminU.id, async (sql) => {
      const [b] = await sql(`insert into public.cargo_batches (code, step_code) values ($1, 'purchased') returning id`, [key('LOTE')]);
      await sql(`select public.assign_to_batch($1, $2)`, [b.id, fids]);
      let last: any;
      for (const step of ['purchased', 'to_locker', 'at_locker', 'international_transit']) {
        [last] = await sql(`select public.update_cargo_batch($1, $2) as r`, [b.id, step]);
      }
      return last.r;
    });
    expect(r.updated).toBe(1);
    expect(r.skipped).toHaveLength(1);
    expect(r.skipped[0].reason).toBe('payment_required');
    const [s1] = await admin(`select status from public.fulfillments where order_id = $1`, [o1.order_id]);
    const [s2] = await admin(`select status from public.fulfillments where order_id = $1`, [o2.order_id]);
    expect([s1.status, s2.status]).toEqual(['international_transit', 'confirmed']);
    // delivery requires the full balance
    const [fu] = await admin(`select id from public.fulfillments where order_id = $1`, [o1.order_id]);
    await asUser(adminU.id, (sql) => sql(`select public.advance_fulfillment($1, 'customs')`, [fu.id]));
    await asUser(adminU.id, (sql) => sql(`select public.advance_fulfillment($1, 'available_in_ve')`, [fu.id]));
    await expectHint(asUser(adminU.id, (sql) => sql(`select public.advance_fulfillment($1, 'out_for_delivery')`, [fu.id])), 'payment_required');
    // states only move forward
    await expectHint(asUser(adminU.id, (sql) => sql(`select public.advance_fulfillment($1, 'purchased')`, [fu.id])), 'invalid_transition');
    const events = await admin(`select step_code, source from public.fulfillment_events where fulfillment_id = $1 order by id`, [fu.id]);
    expect(events.map((e: any) => e.step_code)).toEqual(['confirmed', 'deposit_verified', 'purchased', 'to_locker', 'at_locker', 'international_transit', 'customs', 'available_in_ve']);
    const notes = await admin(`select count(*)::int n from public.notifications where user_id = $1 and kind = 'fulfillment_update'`, [paidBuyer.id]);
    expect(notes[0].n).toBeGreaterThanOrEqual(5);
  });

  it('seller flow: platform-only steps are refused, dispatch needs tracking, delivery settles the ledger', async () => {
    const f = await createStoreWithProduct({ owner: seller.id, price: 20, stock: 5 });
    const o = await paidOrder(buyer.id, adminU.id, f.variantId, 1);
    const [fu] = await admin(`select id from public.fulfillments where order_id = $1`, [o.order_id]);
    await asUser(seller.id, (sql) => sql(`select public.advance_fulfillment($1, 'confirmed')`, [fu.id]));
    await asUser(seller.id, (sql) => sql(`select public.advance_fulfillment($1, 'preparing')`, [fu.id]));
    await expectHint(asUser(seller.id, (sql) => sql(`select public.advance_fulfillment($1, 'cancelled')`, [fu.id])).catch((e) => { throw Object.assign(e, { hint: e.code === '42501' ? 'forbidden' : e.hint }); }), 'forbidden');
    const [{ kind }] = await admin(`select shipping_kind as kind from public.fulfillments where id = $1`, [fu.id]);
    if (kind === 'home_delivery') await expectHint(asUser(seller.id, (sql) => sql(`select public.advance_fulfillment($1, 'dispatched')`, [fu.id])), 'tracking_required');
    await asUser(seller.id, (sql) => sql(`select public.advance_fulfillment($1, 'dispatched', 'Salió hoy', 'GUIA-123', 'Zoom')`, [fu.id]));
    await asUser(seller.id, (sql) => sql(`select public.advance_fulfillment($1, 'delivered')`, [fu.id]));
    const [ff] = await admin(`select settled, tracking_number, delivered_at from public.fulfillments where id = $1`, [fu.id]);
    expect(ff.settled).toBe(true);
    expect(ff.tracking_number).toBe('GUIA-123');
    const [ord] = await admin(`select status from public.orders where id = $1`, [o.order_id]);
    expect(ord.status).toBe('completed');
    expect(await ledgerBalanced()).toBe(true);
  });

  it('cancelling an unpaid order restocks and clears the debt; buyers cannot cancel paid orders', async () => {
    const f = await createStoreWithProduct({ kind: 'platform', price: 10, stock: 4 });
    const o = await buy(buyer.id, f.variantId, 3);
    expect((await admin(`select stock from public.product_variants where id = $1`, [f.variantId]))[0].stock).toBe(1);
    await asUser(buyer.id, (sql) => sql(`select public.cancel_order($1, 'Me equivoqué')`, [o.order_id]));
    expect((await admin(`select stock from public.product_variants where id = $1`, [f.variantId]))[0].stock).toBe(4);
    const [ord] = await admin(`select status, total_usd, payment_status from public.orders where id = $1`, [o.order_id]);
    expect(ord).toMatchObject({ status: 'cancelled', total_usd: '0.00' });
    const paid = await paidOrder(buyer.id, adminU.id, f.variantId, 1);
    await expectHint(asUser(buyer.id, (sql) => sql(`select public.cancel_order($1, 'x')`, [paid.order_id])), 'cancel_requires_support');
    expect(await ledgerBalanced(o.order_id)).toBe(true);
  });

  it('claims: buyer opens, seller answers, buyer escalates, admin resolves', async () => {
    const f = await createStoreWithProduct({ owner: seller.id, price: 20, stock: 5 });
    const o = await paidOrder(buyer.id, adminU.id, f.variantId, 1);
    const [fu] = await admin(`select id from public.fulfillments where order_id = $1`, [o.order_id]);
    const claimId = await asUser(buyer.id, async (sql) => (await sql(`select public.open_claim($1, 'damaged', 'La caja llegó rota y el producto no enciende.') as id`, [fu.id]))[0].id);
    await expectHint(asUser(buyer.id, (sql) => sql(`select public.escalate_claim($1)`, [claimId])), 'too_early');
    await asUser(seller.id, (sql) => sql(`select public.post_claim_message($1, 'Lo sentimos, ¿puedes enviar una foto?')`, [claimId]));
    await asUser(buyer.id, (sql) => sql(`select public.escalate_claim($1)`, [claimId]));
    const stranger = await createUser('str');
    await asUser(stranger.id, async (sql) => expect(await sql(`select id from public.claims where id = $1`, [claimId])).toHaveLength(0));
    await asUser(adminU.id, (sql) => sql(`select public.resolve_claim($1, 'resolved', 'Reembolso parcial aprobado')`, [claimId]));
    await expectHint(asUser(buyer.id, (sql) => sql(`select public.post_claim_message($1, 'gracias')`, [claimId])), 'claim_closed');
    // the escalation is part of the conversation the store and the buyer read
    const msgs = await admin(`select author_role, body from public.claim_messages where claim_id = $1 order by id`, [claimId]);
    expect(msgs.map((m: any) => m.author_role)).toEqual(['buyer', 'seller', 'buyer']);
    expect(msgs[2].body).toBe('Pedí que el equipo de la plataforma revise este reclamo.');
  });
});

describe('discovery', () => {
  it('search, filters, sorting and pagination', async () => {
    const page1 = await asUser(null, (sql) => sql(`select slug, price_usd from public.search_products(null, 'tecnologia', null, null, null, null, 'price_asc', 5, 0)`));
    const page2 = await asUser(null, (sql) => sql(`select slug, price_usd from public.search_products(null, 'tecnologia', null, null, null, null, 'price_asc', 5, 5)`));
    expect(page1).toHaveLength(5);
    expect(new Set([...page1, ...page2].map((r: any) => r.slug)).size).toBe(page1.length + page2.length);
    const prices = page1.map((r: any) => Number(r.price_usd));
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
    const q = await asUser(null, (sql) => sql(`select slug from public.search_products('cargador ugreen')`));
    expect(q.length).toBeGreaterThan(0);
    expect(q.every((r: any) => r.slug.includes('ugreen'))).toBe(true);
    const accents = await asUser(null, (sql) => sql(`select slug from public.search_products('lampara')`));
    expect(accents.map((r: any) => r.slug)).toContain('lampara-mesa-lino');
    const avail = await asUser(null, (sql) => sql(`select distinct availability from public.search_products(null, null, null, array['on_order']::availability[])`));
    expect(avail.map((r: any) => r.availability)).toEqual(['on_order']);
  });

  it('recommendations: diverse, respect opt-out, exclude purchased', async () => {
    const u = await createUser('rec');
    const recs = await asUser(u.id, (sql) => sql(`select category_id, store_id from public.recommended_products(20)`));
    const perCat = recs.reduce((m: Record<string, number>, r: any) => ({ ...m, [r.category_id]: (m[r.category_id] ?? 0) + 1 }), {});
    expect(Math.max(...Object.values(perCat) as number[])).toBeLessThanOrEqual(4);
    const [beauty] = await admin(`select id from public.categories where slug = 'labios'`);
    const prods = await admin(`select id from public.products where category_id = $1 limit 2`, [beauty.id]);
    for (const p of prods) await asUser(u.id, (sql) => sql(`select public.track_event('favorite', $1)`, [p.id]));
    const top = await asUser(u.id, (sql) => sql(`select category_id from public.recommended_products(4)`));
    expect(top.some((r: any) => r.category_id === beauty.id)).toBe(true);
    await admin(`update public.profiles set personalization_enabled = false where id = $1`, [u.id]);
    await asUser(u.id, (sql) => sql(`select public.track_event('view', $1)`, [prods[0].id]));
    const [{ n }] = await admin(`select count(*)::int n from public.user_events where user_id = $1 and kind = 'view'`, [u.id]);
    expect(n).toBe(0);
  });

  it('home feed returns everything needed for first paint in one call', async () => {
    const [{ f }] = await asUser(null, (sql) => sql(`select public.home_feed() as f`));
    expect(f.categories.length).toBeGreaterThan(4);
    expect(f.collections.length).toBeGreaterThan(3);
    expect(f.recommended.length).toBeGreaterThan(8);
    expect(f.stores.every((s: any) => s.slug !== 'nova-gadgets')).toBe(true); // pending store hidden
  });

  it('product detail works for visitors and signed-in buyers', async () => {
    const [{ id }] = await admin(`select id from public.products where slug = 'ugreen-nexode-65w'`);
    const [{ d: anon }] = await asUser(null, (sql) => sql(`select public.product_detail($1) as d`, [id]));
    expect(anon.title).toContain('UGREEN');
    expect(anon.is_favorite).toBe(false);
    expect(anon.variants.length).toBeGreaterThan(0);
    expect(anon.images.length).toBeGreaterThan(0);
    const u = await createUser('pd');
    await asUser(u.id, (sql) => sql(`insert into public.favorites (user_id, product_id) values ($1, $2)`, [u.id, id]));
    const [{ d }] = await asUser(u.id, (sql) => sql(`select public.product_detail($1) as d`, [id]));
    expect(d.is_favorite).toBe(true);
    // unpublished products are invisible through the same function
    const [{ id: pendingId }] = await admin(`select id from public.products where moderation_status = 'pending' limit 1`);
    const [{ d: hidden }] = await asUser(null, (sql) => sql(`select public.product_detail($1) as d`, [pendingId]));
    expect(hidden).toBeNull();
  });
});
