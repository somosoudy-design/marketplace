import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, asUser, buy, createStoreWithProduct, createUser, expectHint, pool, type Fixture } from '../../src/db';

afterAll(() => pool.end());

async function deliver(sellerId: string, orderId: string) {
  const [fu] = await admin(`select id from public.fulfillments where order_id = $1`, [orderId]);
  // payment is verified elsewhere; here the delivery itself is what matters
  await admin(`update public.orders set payment_status = 'paid', paid_usd = total_usd where id = $1`, [orderId]);
  for (const step of ['confirmed', 'preparing']) await asUser(sellerId, (sql) => sql(`select public.advance_fulfillment($1, $2)`, [fu.id, step]));
  await asUser(sellerId, (sql) => sql(`select public.advance_fulfillment($1, 'dispatched', null, 'GUIA-R')`, [fu.id]));
  await asUser(sellerId, (sql) => sql(`select public.advance_fulfillment($1, 'delivered')`, [fu.id]));
}

const itemOf = async (orderId: string) => (await admin(`select id from public.order_items where order_id = $1`, [orderId]))[0].id as string;
const submit = (u: string, item: string, rating: number, body: string | null = null) =>
  asUser(u, async (sql) => (await sql(`select public.submit_review($1, $2, $3) as r`, [item, rating, body]))[0].r);

describe('verified reviews', () => {
  let seller: { id: string }, buyer: { id: string }, other: { id: string }, mod: { id: string }, f: Fixture;
  beforeAll(async () => {
    seller = await createUser('rv-seller');
    buyer = await createUser('rv-buyer');
    other = await createUser('rv-other');
    mod = await createUser('rv-admin', { role: 'admin' });
    f = await createStoreWithProduct({ owner: seller.id, price: 15, stock: 20 });
  });

  it('only the buyer of a delivered item can review it, once per item, editable', async () => {
    const o = await buy(buyer.id, f.variantId, 1);
    const item = await itemOf(o.order_id);
    await expectHint(submit(buyer.id, item, 5), 'not_reviewable'); // not delivered yet
    await deliver(seller.id, o.order_id);
    await expectHint(submit(other.id, item, 1, 'No lo compré'), 'not_found');
    await expectHint(submit(buyer.id, item, 6), 'invalid_input');
    await expectHint(submit(buyer.id, item, 4, 'x'.repeat(1001)), 'invalid_input');

    const r1 = await submit(buyer.id, item, 4, '  Buena calidad  ');
    expect(r1).toMatchObject({ rating: 4, body: 'Buena calidad', status: 'published' });
    const r2 = await submit(buyer.id, item, 5, 'Mejor de lo esperado');
    expect(r2.id).toBe(r1.id); // edit, not a second review
    const [p] = await admin(`select rating_avg, rating_count from public.products where id = $1`, [f.productId]);
    expect(p).toEqual({ rating_avg: '5.00', rating_count: 1 });

    // nobody writes the table directly
    await expect(asUser(buyer.id, (sql) => sql(`update public.reviews set rating = 1 where id = $1`, [r1.id]))).rejects.toMatchObject({ code: '42501' });
    await expect(
      asUser(buyer.id, (sql) => sql(`insert into public.reviews (order_item_id, product_id, store_id, user_id, rating) values ($1, $2, $3, $4, 5)`, [item, f.productId, f.storeId, buyer.id])),
    ).rejects.toMatchObject({ code: '42501' });

    // editable for 60 days after publishing
    await admin(`update public.reviews set created_at = now() - interval '61 days' where id = $1`, [r1.id]);
    await expectHint(submit(buyer.id, item, 1, 'Cambio de opinión tardío'), 'review_locked');
    await admin(`update public.reviews set created_at = now() where id = $1`, [r1.id]);
  });

  it('the summary aggregates published reviews and moderation hides them with a reason', async () => {
    const o = await buy(other.id, f.variantId, 1);
    await deliver(seller.id, o.order_id);
    const r = await submit(other.id, await itemOf(o.order_id), 2, 'Llegó con la caja rota');

    const summary = async () => (await asUser(null, (sql) => sql(`select public.product_reviews($1) as r`, [f.productId])))[0].r;
    let s = await summary();
    expect(s.summary).toMatchObject({ count: 2, avg: 3.5, distribution: { '5': 1, '2': 1 } });
    expect(s.items[0].author).toBe('Test R.'); // "Test rv-other" → first name and initial only
    expect(s.items.every((i: any) => i.mine === false)).toBe(true);

    await expectHint(asUser(mod.id, (sql) => sql(`select public.moderate_review($1, true, '  ')`, [r.id])), 'invalid_input');
    await expect(asUser(seller.id, (sql) => sql(`select public.moderate_review($1, true, 'spam')`, [r.id]))).rejects.toMatchObject({ code: '42501' });
    await asUser(mod.id, (sql) => sql(`select public.moderate_review($1, true, 'Datos personales en el texto')`, [r.id]));
    s = await summary();
    expect(s.summary).toMatchObject({ count: 1, avg: 5 });
    const [p] = await admin(`select rating_avg, rating_count from public.products where id = $1`, [f.productId]);
    expect(p).toEqual({ rating_avg: '5.00', rating_count: 1 });

    // the author still sees their hidden review (with the reason); the public does not
    const mine = await asUser(other.id, (sql) => sql(`select status, hidden_reason from public.reviews where id = $1`, [r.id]));
    expect(mine).toEqual([{ status: 'hidden', hidden_reason: 'Datos personales en el texto' }]);
    expect(await asUser(null, (sql) => sql(`select id from public.reviews where id = $1`, [r.id]))).toEqual([]);
    const [log] = await admin(`select action from public.audit_log where entity_id = $1 order by created_at desc limit 1`, [r.id]);
    expect(log.action).toBe('review.hide');
  });

  it('the store replies once per review and the author is notified', async () => {
    const [r] = await admin(`select id, user_id from public.reviews where product_id = $1 and status = 'published'`, [f.productId]);
    await expect(asUser(other.id, (sql) => sql(`select public.reply_review($1, 'Gracias')`, [r.id]))).rejects.toMatchObject({ code: '42501' });
    await expectHint(asUser(seller.id, (sql) => sql(`select public.reply_review($1, '   ')`, [r.id])), 'invalid_input');
    await asUser(seller.id, (sql) => sql(`select public.reply_review($1, 'Gracias por tu compra')`, [r.id]));
    const [n] = await admin(`select title, data from public.notifications where user_id = $1 order by created_at desc limit 1`, [r.user_id]);
    expect(n).toMatchObject({ title: 'La tienda respondió tu opinión', data: { review_id: r.id } });
    const profile = await asUser(null, async (sql) => (await sql(`select public.store_profile($1) as p`, [f.storeSlug]))[0].p);
    expect(profile).toMatchObject({ rating_count: 1, product_count: 1 });
    expect(profile.reviews[0]).toMatchObject({ rating: 5, body: 'Mejor de lo esperado' });
  });

  it('ratings are derived: a seller cannot write their own score', async () => {
    await asUser(seller.id, (sql) => sql(`update public.products set rating_avg = 5, rating_count = 999 where id = $1`, [f.productId]));
    await asUser(seller.id, (sql) => sql(`update public.stores set rating_avg = 5, rating_count = 999, tagline = 'Nueva' where id = $1`, [f.storeId]));
    const [p] = await admin(`select rating_avg, rating_count from public.products where id = $1`, [f.productId]);
    const [s] = await admin(`select rating_avg, rating_count, tagline from public.stores where id = $1`, [f.storeId]);
    expect(p).toEqual({ rating_avg: '5.00', rating_count: 1 });
    expect(s).toEqual({ rating_avg: '5.00', rating_count: 1, tagline: 'Nueva' });
    const fresh = await createStoreWithProduct({ owner: seller.id });
    expect((await admin(`select rating_count from public.products where id = $1`, [fresh.productId]))[0].rating_count).toBe(0);
  });

  it('a suspended store has no public profile', async () => {
    const s = await createStoreWithProduct({ status: 'suspended' });
    expect((await asUser(null, (sql) => sql(`select public.store_profile($1) as p`, [s.storeSlug])))[0].p).toBeNull();
  });
});

describe('installment reminders', () => {
  it('reminds before the due date and once overdue, one notice per stage, never for demo orders', async () => {
    const buyer = await createUser('ir-buyer');
    const demo = await createUser('ir-demo');
    await admin(`update public.profiles set is_demo = true where id = $1`, [demo.id]);
    const f = await createStoreWithProduct({ kind: 'platform', price: 90, stock: 10 });
    const o = await buy(buyer.id, f.variantId, 1, { plan: 'three_parts' });
    const d = await buy(demo.id, f.variantId, 1, { plan: 'three_parts' });
    expect((await admin(`select is_demo from public.orders where id = $1`, [d.order_id]))[0].is_demo).toBe(true);

    for (const id of [o.order_id, d.order_id]) {
      await admin(`update public.payment_obligations set due_date = current_date + 2 where order_id = $1 and seq = 2`, [id]);
      await admin(`update public.payment_obligations set due_date = current_date - 1 where order_id = $1 and seq = 3`, [id]);
    }
    const notices = async (u: string) =>
      admin(`select title, body, data from public.notifications where user_id = $1 and kind = 'installment_due' order by title`, [u]);

    await admin(`select public.remind_installments()`);
    const first = await notices(buyer.id);
    expect(first.map((n: any) => n.title)).toEqual(['Tienes una cuota vencida', 'Tu próxima cuota vence pronto']);
    expect(first[0].body).toContain('La cuota 3 de 3');
    expect(first[0].body).toContain('$30,00');
    expect(first[1].data.order_id).toBe(o.order_id);
    expect(await notices(demo.id)).toEqual([]);

    await admin(`select public.remind_installments()`);
    expect(await notices(buyer.id)).toHaveLength(2); // no repeats

    // the upcoming one becomes overdue: exactly one more notice
    await admin(`update public.payment_obligations set due_date = current_date - 1 where order_id = $1 and seq = 2`, [o.order_id]);
    await admin(`select public.remind_installments()`);
    expect((await notices(buyer.id)).filter((n: any) => n.title === 'Tienes una cuota vencida')).toHaveLength(2);

    await expect(asUser(buyer.id, (sql) => sql(`select public.remind_installments()`))).rejects.toMatchObject({ code: '42501' });
  });
});

describe('recommendation measurement', () => {
  it('records impressions once per hour and clicks always, honoring the personalization switch', async () => {
    const u = await createUser('rec-user');
    const f = await createStoreWithProduct();
    const track = (slot: string, kind: string, ids: string[]) =>
      asUser(u.id, (sql) => sql(`select public.track_recommendation($1, $2, $3::uuid[])`, [slot, kind, ids]));
    const count = async (kind: string) =>
      Number((await admin(`select count(*) n from public.rec_events where user_id = $1 and kind = $2`, [u.id, kind]))[0].n);

    await track('home_for_you', 'impression', [f.productId]);
    await track('home_for_you', 'impression', [f.productId]);
    await track('home_for_you', 'click', [f.productId]);
    await track('home_for_you', 'click', [f.productId]);
    expect([await count('impression'), await count('click')]).toEqual([1, 2]);

    await expectHint(track('Bad Slot!', 'impression', [f.productId]), 'invalid_input');
    await expectHint(track('home_for_you', 'view', [f.productId]), 'invalid_input');

    // visitors are not tracked
    await asUser(null, (sql) => sql(`select public.track_recommendation('home_for_you', 'click', $1::uuid[])`, [[f.productId]]));

    await admin(`update public.profiles set personalization_enabled = false where id = $1`, [u.id]);
    await track('home_for_you', 'click', [f.productId]);
    expect(await count('click')).toBe(2);

    await asUser(u.id, (sql) => sql(`select public.clear_my_activity()`));
    expect(await count('impression')).toBe(0);
  });

  it('metrics attribute add-to-cart and purchases to the slot that was clicked', async () => {
    const u = await createUser('rec-buyer');
    const mod = await createUser('rec-admin', { role: 'admin' });
    const f = await createStoreWithProduct({ price: 12, stock: 10 });
    const slot = `test:${f.productId.slice(0, 8)}`;
    await asUser(u.id, (sql) => sql(`select public.track_recommendation($1, 'impression', $2::uuid[])`, [slot, [f.productId]]));
    await asUser(u.id, (sql) => sql(`select public.track_recommendation($1, 'click', $2::uuid[])`, [slot, [f.productId]]));
    await asUser(u.id, (sql) => sql(`select public.track_event('add_to_cart', $1)`, [f.productId]));
    await buy(u.id, f.variantId, 1);

    await expect(asUser(u.id, (sql) => sql(`select public.recommendation_metrics(7)`))).rejects.toMatchObject({ code: '42501' });
    const m = await asUser(mod.id, async (sql) => (await sql(`select public.recommendation_metrics(7) as m`))[0].m);
    expect(m.slots.find((s: any) => s.slot === slot)).toMatchObject({ impressions: 1, clicks: 1, ctr_pct: 100, users: 1, added_to_cart: 1, purchased: 1 });
    expect(m.ranking).toHaveProperty('popularity');
  });

  it('old behavioral data is pruned by the retention job only', async () => {
    const u = await createUser('rec-old');
    const f = await createStoreWithProduct();
    await admin(`insert into public.rec_events (user_id, slot, kind, product_id, created_at) values ($1, 'home_for_you', 'click', $2, now() - interval '400 days')`, [u.id, f.productId]);
    await admin(`insert into public.user_events (user_id, kind, product_id, created_at) values ($1, 'view', $2, now() - interval '400 days')`, [u.id, f.productId]);
    await expect(asUser(u.id, (sql) => sql(`select public.prune_activity()`))).rejects.toMatchObject({ code: '42501' });
    await admin(`select public.prune_activity()`);
    const [r] = await admin(
      `select (select count(*) from public.rec_events where user_id = $1)::int a, (select count(*) from public.user_events where user_id = $1)::int b`,
      [u.id],
    );
    expect(r).toEqual({ a: 0, b: 0 });
  });
});

describe('notifications', () => {
  it('anything about demo data is a test notice and is never queued for push', async () => {
    const demo = await createUser('nt-demo');
    await admin(`update public.profiles set is_demo = true where id = $1`, [demo.id]);
    await admin(`insert into public.push_tokens (user_id, token, platform) values ($1, $2, 'ios')`, [demo.id, `ExponentPushToken[${demo.id.slice(0, 12)}]`]);
    const f = await createStoreWithProduct({ price: 10, stock: 5 });
    await buy(demo.id, f.variantId, 1);
    const rows = await admin(`select is_test, push_status from public.notifications where user_id = $1`, [demo.id]);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r: any) => r.is_test && r.push_status === 'skipped')).toBe(true);
  });

  it('claim notices link to the delivery, and store-team copies say who they are for', async () => {
    const seller = await createUser('nt-seller');
    const buyer = await createUser('nt-buyer');
    const f = await createStoreWithProduct({ owner: seller.id, price: 10, stock: 5 });
    const o = await buy(buyer.id, f.variantId, 1);
    await deliver(seller.id, o.order_id);
    const [fu] = await admin(`select id from public.fulfillments where order_id = $1`, [o.order_id]);
    const claimId = await asUser(buyer.id, async (sql) => (await sql(`select public.open_claim($1, 'damaged', 'La caja llegó rota y el producto también') as id`, [fu.id]))[0].id);

    const [toStore] = await admin(`select data from public.notifications where user_id = $1 and kind = 'claim_update' order by created_at desc limit 1`, [seller.id]);
    expect(toStore.data).toMatchObject({ claim_id: claimId, order_id: o.order_id, fulfillment_id: fu.id, audience: 'store', store_id: f.storeId });

    await asUser(seller.id, (sql) => sql(`select public.post_claim_message($1, 'Te enviamos un reemplazo mañana')`, [claimId]));
    const [toBuyer] = await admin(`select data from public.notifications where user_id = $1 and kind = 'claim_update' order by created_at desc limit 1`, [buyer.id]);
    expect(toBuyer.data).toMatchObject({ claim_id: claimId, order_id: o.order_id, fulfillment_id: fu.id });
    expect(toBuyer.data.audience).toBeUndefined();

    // the store answered, so the buyer may escalate at once; the store hears about it
    await asUser(buyer.id, (sql) => sql(`select public.escalate_claim($1)`, [claimId]));
    const [c] = await admin(`select status from public.claims where id = $1`, [claimId]);
    expect(c.status).toBe('escalated');
    const [last] = await admin(`select title from public.notifications where user_id = $1 order by created_at desc limit 1`, [seller.id]);
    expect(last.title).toMatch(/escalado$/);
    const msgs = await asUser(buyer.id, (sql) => sql(`select author_role, body from public.claim_messages where claim_id = $1 order by created_at`, [claimId]));
    expect(msgs.map((m: any) => m.author_role)).toEqual(['buyer', 'seller', 'buyer']);
  });

  it('a buyer cannot escalate before the store had its chance to answer', async () => {
    const seller = await createUser('nt-seller2');
    const buyer = await createUser('nt-buyer2');
    const f = await createStoreWithProduct({ owner: seller.id, price: 10, stock: 5 });
    const o = await buy(buyer.id, f.variantId, 1);
    await deliver(seller.id, o.order_id);
    const [fu] = await admin(`select id from public.fulfillments where order_id = $1`, [o.order_id]);
    const claimId = await asUser(buyer.id, async (sql) => (await sql(`select public.open_claim($1, 'not_as_described', 'El color no coincide con la foto') as id`, [fu.id]))[0].id);
    await expectHint(asUser(buyer.id, (sql) => sql(`select public.escalate_claim($1)`, [claimId])), 'too_early');
    await expect(
      asUser(buyer.id, (sql) => sql(`select public.open_claim($1, 'other', 'Segundo reclamo para la misma entrega')`, [fu.id])),
    ).rejects.toMatchObject({ code: '23505' }); // one open claim per delivery
  });
});
