// End-to-end through the public API surface (GoTrue + PostgREST + storage via the gateway), using the same
// @kora/api client the app uses. Requires the local stack: `pnpm stack:start`.
import { createClient } from '@supabase/supabase-js';
import { ApiError, createApi, createKoraClient, newIdempotencyKey, type Api } from '@kora/api';
import { D as money } from '@kora/core';
import { beforeAll, describe, expect, it } from 'vitest';
import '../../src/db'; // loads .local/keys.env into process.env

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
// 1x1 transparent PNG, standing in for a payment screenshot
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), (c) => c.charCodeAt(0));

function newApi(): Api {
  return createApi(createKoraClient({ url: URL, anonKey: ANON }));
}

async function signUp(api: Api, label: string) {
  const email = `e2e-${label}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.com`;
  const { data, error } = await api.client.auth.signUp({ email, password: 'E2e-test-1234', options: { data: { full_name: `E2E ${label}` } } });
  if (error) throw error;
  expect(data.session).toBeTruthy(); // local stack auto-confirms email
  return data.user!;
}

describe('purchase flow through the public API', () => {
  const visitor = newApi();
  const buyerApi = newApi();
  const adminApi = newApi();
  let buyerId = '';
  let productId = '';
  let variantId = '';
  let addressId = '';
  let orderId = '';
  let totalUsd = '0';

  beforeAll(async () => {
    const rate = await visitor.catalog.rate('USD/VES');
    if (!rate.available) {
      // The seeded demo rate is older than the policy allows: record a fresh development rate as the rates job would.
      const service = createClient(URL, SERVICE, { auth: { persistSession: false } });
      const { error } = await service.rpc('ingest_rate', { p_source: 'demo', p_pair: 'USD/VES', p_rate: 100, p_observed_at: new Date().toISOString(), p_raw: { e2e: true } });
      if (error) throw error;
    }
  });

  it('visitors browse the catalog without an account', async () => {
    const home = await visitor.catalog.home();
    expect(home.collections.length).toBeGreaterThan(3);
    const results = await visitor.catalog.search({ query: 'ugreen', sort: 'price_desc', availability: ['available'] });
    expect(results.length).toBeGreaterThan(0);
    productId = results[0]!.id;
    const detail = await visitor.catalog.product(productId);
    expect(detail?.variants.length).toBeGreaterThan(0);
    expect(detail?.is_favorite).toBe(false);
    variantId = detail!.variants.find((v) => (v.stock ?? 1) > 0)!.id;
    // visitors cannot write
    await expect(visitor.cart.add(variantId, 1)).rejects.toMatchObject({ code: 'auth_required' });
  });

  it('a new buyer signs up, saves an address and fills the cart', async () => {
    const user = await signUp(buyerApi, 'buyer');
    buyerId = user.id;
    const profile = await buyerApi.account.profile(buyerId);
    expect(profile?.full_name).toBe('E2E buyer');
    const regions = await buyerApi.account.regions();
    const address = await buyerApi.account.saveAddress({
      user_id: buyerId, label: 'Casa', recipient: 'E2E Buyer', phone: '+58 412 000 0099', region_code: regions[0]!.code,
      city: 'Caracas', municipality: 'Chacao', line1: 'Calle de prueba, edificio de prueba', reference: 'Prueba automatizada',
    });
    expect(address.is_default).toBe(true);
    addressId = address.id;
    await buyerApi.cart.add(variantId, 2);
    await buyerApi.account.setFavorite(buyerId, productId, true);
    expect((await buyerApi.catalog.product(productId))?.is_favorite).toBe(true);
    const summary = await buyerApi.cart.summary(addressId);
    expect(summary.line_count).toBe(1);
    expect(summary.groups[0]!.shipping_options.length).toBeGreaterThan(0);
  });

  it('checkout totals come from the server and a double tap creates one order', async () => {
    const preview = await buyerApi.checkout.preview(addressId, {}, 'full');
    expect(preview.can_place).toBe(true);
    const shipping = Object.fromEntries(preview.groups.map((g) => [g.key, g.selected_shipping!.method_id]));
    const key = newIdempotencyKey('order');
    const [a, b] = await Promise.all([
      buyerApi.checkout.placeOrder(addressId, shipping, 'full', key),
      buyerApi.checkout.placeOrder(addressId, shipping, 'full', key),
    ]);
    expect(a.order_id).toBe(b.order_id);
    expect([a.replayed, b.replayed].sort()).toEqual([false, true]);
    orderId = a.order_id;
    const order = await buyerApi.orders.detail(orderId);
    expect(order?.payment_status).toBe('unpaid');
    expect(money(order!.total_usd).toFixed(2)).toBe(money(preview.total_usd).toFixed(2));
    totalUsd = money(order!.total_usd).toFixed(2);
    expect((await buyerApi.cart.summary()).line_count).toBe(0);
  });

  it('pays in bolívares with a server quote, proof upload and an idempotent submission', async () => {
    const quote = await buyerApi.payments.quote(orderId, 'pago_movil');
    expect(quote.currency).toBe('VES');
    const expected = money(quote.base_usd).plus(quote.fee_usd).times(quote.rate_applied).toDecimalPlaces(2);
    expect(money(quote.amount_due).toFixed(2)).toBe(expected.toFixed(2));
    expect(money(quote.base_usd).toFixed(2)).toBe(totalUsd);
    expect(new Date(quote.expires_at).getTime()).toBeGreaterThan(Date.now());

    const proofPath = await buyerApi.payments.uploadProof(buyerId, PNG, 'image/png', 'png');
    expect(proofPath.startsWith(`${buyerId}/`)).toBe(true);
    // another user's folder is refused by storage
    await expect(buyerApi.payments.uploadProof('00000000-0000-4000-a000-000000000004', PNG, 'image/png', 'png')).rejects.toBeInstanceOf(ApiError);

    const idem = newIdempotencyKey('pay');
    const reference = String(Date.now()).slice(-10);
    const first = await buyerApi.payments.submit({ quoteId: quote.id, reference, proofPath, payer: { bank: 'Banco de prueba' }, idempotencyKey: idem });
    const again = await buyerApi.payments.submit({ quoteId: quote.id, reference, proofPath, idempotencyKey: idem });
    if (first.error || again.error) throw new Error('unexpected submit error');
    expect(again.id).toBe(first.id);
    expect(again.replayed).toBe(true);
    expect(first.status).toBe('pending_verification');
    // pressing "ya pagué" does not pay the order
    const order = await buyerApi.orders.detail(orderId);
    expect(order?.payment_status).toBe('unpaid');
    expect(money(order!.paid_usd).toFixed(2)).toBe('0.00');
  });

  it('another buyer cannot see the order, and the buyer cannot verify their own payment', async () => {
    const other = newApi();
    await signUp(other, 'other');
    expect(await other.orders.detail(orderId)).toBeNull();
    const [payment] = (await buyerApi.orders.detail(orderId))!.payments;
    await expect(buyerApi.admin.reviewPayment(payment!.id, true)).rejects.toMatchObject({ code: 'admin_required' });
  });

  it('an admin verifies the payment and the buyer is notified', async () => {
    const { data, error } = await adminApi.client.auth.signInWithPassword({ email: 'admin@example.com', password: 'Demo-1234' });
    if (error) throw error;
    const claims = JSON.parse(atob(data.session!.access_token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')));
    expect(claims.app_metadata.roles).toContain('superadmin');
    const pending = await adminApi.admin.pendingPayments();
    const mine = pending.find((p) => p.order_id === orderId);
    expect(mine).toBeTruthy();
    const res = await adminApi.admin.reviewPayment(mine!.id, true);
    expect(res.status).toBe('confirmed');
    const order = await buyerApi.orders.detail(orderId);
    expect(order?.payment_status).toBe('paid');
    expect(money(order!.paid_usd).toFixed(2)).toBe(totalUsd);
    const notes = await buyerApi.account.notifications();
    expect(notes.map((n) => n.kind)).toEqual(expect.arrayContaining(['order_placed', 'payment_received', 'payment_confirmed']));
    expect(notes.every((n) => n.is_test === false)).toBe(true);
    await expect(adminApi.admin.reviewPayment(mine!.id, true)).rejects.toMatchObject({ code: 'already_reviewed' });
  });

  it('connection failures surface as a friendly network error', async () => {
    const offline = createApi(createKoraClient({ url: URL, anonKey: ANON, fetch: () => Promise.reject(new TypeError('Network request failed')) }));
    await expect(offline.catalog.home()).rejects.toMatchObject({ code: 'network' });
  });

  it('the app client refuses a service role key', () => {
    expect(() => createKoraClient({ url: URL, anonKey: SERVICE })).toThrow(/service role/);
  });
});
