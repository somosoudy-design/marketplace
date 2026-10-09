// Runs the edge function handlers in-process against the local stack (pnpm test:functions).
// Third parties (Binance Pay, PayPal, Expo, rate sources) are replaced by fakes: these tests prove our side
// of each contract, not that the providers accept it. Nothing here touches a real provider or real money.
import { createHandler as binanceWebhook } from '../binance-pay-webhook/handler.ts';
import { createHandler as paymentsStart } from '../payments-start/handler.ts';
import { createHandler as paypalWebhook } from '../paypal-webhook/handler.ts';
import { createHandler as pushDispatch, EXPO_PUSH_URL, EXPO_RECEIPTS_URL } from '../push-dispatch/handler.ts';
import { createHandler as ratesSync } from '../rates-sync/handler.ts';
import { signBinancePayRequest } from '../_shared/core/payments.ts';
import type { Env } from '../_shared/env.ts';
import { BINANCE_PAY_API } from '../_shared/providers.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function assert(cond: unknown, msg = 'assertion failed'): asserts cond {
  if (!cond) throw new Error(msg);
}
function eq<T>(actual: T, expected: T, msg = '') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${msg} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// ---------- local stack helpers ----------
async function api<T>(path: string, init: RequestInit & { token?: string; key?: string } = {}): Promise<T> {
  const key = init.key ?? ANON;
  const res = await fetch(`${URL_}${path}`, {
    ...init,
    headers: { apikey: key, authorization: `Bearer ${init.token ?? key}`, 'content-type': 'application/json', prefer: 'return=representation', ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}
const rpc = <T>(fn: string, args: Record<string, unknown>, token?: string) =>
  api<T>(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args), ...(token ? { token } : { key: SERVICE }) });
const service = <T>(path: string, init: RequestInit = {}) => api<T>(path, { ...init, key: SERVICE });
const uid = () => crypto.randomUUID().slice(0, 8);

async function signUp() {
  const email = `fn-${uid()}@example.com`;
  const r = await api<{ access_token: string; user: { id: string } }>('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email, password: 'Kora-prueba-2026', data: { full_name: 'Prueba funciones' } }) });
  return { token: r.access_token, id: r.user.id };
}

/** A new buyer orders one in-stock platform product and asks for a quote with the given method. */
async function orderAndQuote(method: string) {
  const buyer = await signUp();
  const [variant] = await service<{ id: string }[]>(`/rest/v1/product_variants?select=id,products!inner(moderation_status,store_id,stores!inner(kind,status))&active=eq.true&stock=gt.2&products.moderation_status=eq.published&products.stores.kind=eq.platform&products.stores.status=eq.active&limit=1`);
  assert(variant, 'no in-stock platform product in the dev data');
  const [address] = await api<{ id: string }[]>('/rest/v1/addresses', {
    method: 'POST', token: buyer.token,
    body: JSON.stringify({ user_id: buyer.id, label: 'Casa', recipient: 'Prueba funciones', phone: '0412-000-0000', region_code: 'A', city: 'Caracas', line1: 'Calle de prueba 1' }),
  });
  await rpc('cart_set_quantity', { p_variant_id: variant.id, p_quantity: 1 }, buyer.token);
  const order = await rpc<{ order_id: string; number: string }>('place_order', { p_address_id: address!.id, p_shipping: {}, p_plan_code: 'full', p_idempotency_key: `fn-${uid()}` }, buyer.token);
  const quote = await rpc<{ id: string; amount_due: number; currency: string }>('create_payment_quote', { p_order_id: order.order_id, p_method_code: method, p_obligation_ids: null }, buyer.token);
  return { buyer, order, quote };
}

async function withMethod(code: string, fn: () => Promise<void>) {
  await service(`/rest/v1/payment_methods?code=eq.${code}`, { method: 'PATCH', body: JSON.stringify({ enabled: true, integration_status: 'sandbox' }) });
  try {
    await fn();
  } finally {
    await service(`/rest/v1/payment_methods?code=eq.${code}`, { method: 'PATCH', body: JSON.stringify({ enabled: false, integration_status: 'pending_credentials' }) });
  }
}

const orderStatus = async (id: string) => (await service<{ payment_status: string; paid_usd: string }[]>(`/rest/v1/orders?id=eq.${id}&select=payment_status,paid_usd`))[0]!;
const paymentRow = async (id: string) =>
  (await service<{ status: string; provider_payment_id: string | null; provider_checkout_url: string | null; rejection_reason: string | null }[]>(`/rest/v1/payments?id=eq.${id}&select=status,provider_payment_id,provider_checkout_url,rejection_reason`))[0]!;

const call = (h: (r: Request) => Promise<Response>, body: unknown, headers: Record<string, string> = {}) =>
  h(new Request('http://functions.local/', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));

const envWith = (extra: Record<string, string>): Env => (k) => extra[k] ?? (Deno.env.get(k) || undefined);
const noNetwork: typeof fetch = () => Promise.reject(new Error('network disabled in tests'));

// ---------- RSA helpers for Binance Pay webhooks ----------
const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
async function rsaKey() {
  const k = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const spki = b64(await crypto.subtle.exportKey('spki', k.publicKey));
  return { privateKey: k.privateKey, pem: `-----BEGIN PUBLIC KEY-----\n${spki.match(/.{1,64}/g)!.join('\n')}\n-----END PUBLIC KEY-----` };
}
async function binanceHeaders(privateKey: CryptoKey, body: string) {
  const timestamp = String(Date.now());
  const nonce = uid() + uid() + uid() + uid();
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(`${timestamp}\n${nonce}\n${body}\n`));
  return { 'BinancePay-Timestamp': timestamp, 'BinancePay-Nonce': nonce, 'BinancePay-Signature': b64(sig) };
}

// USD/USDT quotes need a fresh rate; the dev data uses the clearly labelled "demo" source.
await rpc('ingest_rate', { p_source: 'demo', p_pair: 'USD/USDT', p_rate: 1.001, p_observed_at: new Date().toISOString(), p_raw: { note: 'pruebas de funciones' } });

Deno.test('payments-start: without provider credentials nothing is created', async () => {
  await withMethod('binance_pay', async () => {
    const { buyer, quote } = await orderAndQuote('binance_pay');
    const res = await call(paymentsStart({ env: envWith({}), fetch: noNetwork }), { quoteId: quote.id, idempotencyKey: `k-${uid()}` }, { authorization: `Bearer ${buyer.token}` });
    eq(res.status, 503);
    eq((await res.json()).error, 'not_configured');
    eq(await service(`/rest/v1/payments?quote_id=eq.${quote.id}&select=id`), [], 'no payment row');
  });
});

Deno.test('payments-start: refuses visitors and manual methods', async () => {
  const anon = await call(paymentsStart({ env: envWith({}), fetch: noNetwork }), { quoteId: crypto.randomUUID(), idempotencyKey: 'k-12345678' });
  eq(anon.status, 401);
  const { buyer, quote } = await orderAndQuote('pago_movil');
  const res = await call(paymentsStart({ env: envWith({}), fetch: noNetwork }), { quoteId: quote.id, idempotencyKey: `k-${uid()}` }, { authorization: `Bearer ${buyer.token}` });
  eq(res.status, 400);
  eq((await res.json()).error, 'manual_method');
});

Deno.test('Binance Pay: start, retry, forged webhook refused, signed webhook credits once', async () => {
  const { privateKey, pem } = await rsaKey();
  const other = await rsaKey();
  const env = envWith({ BINANCE_PAY_API_KEY: 'test-api-key', BINANCE_PAY_SECRET_KEY: 'test-secret', BINANCE_PAY_PUBLIC_KEY: pem, PAYMENTS_RETURN_URL: 'kora://pay/result' });
  let providerCalls = 0;
  const fakeBinance: typeof fetch = async (input, init) => {
    const url = String(input);
    assert(url === `${BINANCE_PAY_API}/binancepay/openapi/v3/order`, `unexpected call ${url}`);
    providerCalls++;
    const h = new Headers(init!.headers);
    // our request is signed exactly as Binance documents it
    eq(h.get('BinancePay-Signature'), await signBinancePayRequest('test-secret', h.get('BinancePay-Timestamp')!, h.get('BinancePay-Nonce')!, String(init!.body)));
    eq(h.get('BinancePay-Certificate-SN'), 'test-api-key');
    const body = JSON.parse(String(init!.body));
    eq([body.currency, body.webhookUrl.endsWith('/functions/v1/binance-pay-webhook')], ['USDT', true]);
    return new Response(JSON.stringify({ status: 'SUCCESS', code: '000000', data: { prepayId: '1', checkoutUrl: 'https://pay.example.com/checkout/1', universalUrl: 'https://pay.example.com/u/1' } }));
  };

  await withMethod('binance_pay', async () => {
    const { buyer, order, quote } = await orderAndQuote('binance_pay');
    const start = paymentsStart({ env, fetch: fakeBinance });
    const idem = `k-${uid()}`;
    const r1 = await (await call(start, { quoteId: quote.id, idempotencyKey: idem }, { authorization: `Bearer ${buyer.token}` })).json();
    eq([r1.status, r1.checkout_url], ['processing', 'https://pay.example.com/u/1']);
    const r2 = await (await call(start, { quoteId: quote.id, idempotencyKey: idem }, { authorization: `Bearer ${buyer.token}` })).json();
    eq([r2.payment_id, r2.checkout_url, providerCalls], [r1.payment_id, r1.checkout_url, 1], 'retry returns the same checkout');
    const p = await paymentRow(r1.payment_id);
    eq(p.provider_payment_id, r1.number.replace(/[^A-Za-z0-9]/g, ''));
    eq((await orderStatus(order.order_id)).payment_status, 'unpaid', 'returning from checkout pays nothing');

    const event = JSON.stringify({ bizType: 'PAY', bizIdStr: `evt-${uid()}`, bizStatus: 'PAY_SUCCESS', data: JSON.stringify({ merchantTradeNo: p.provider_payment_id, totalFee: quote.amount_due, currency: 'USDT' }) });
    const hook = binanceWebhook({ env, fetch: noNetwork });
    const forged = await call(hook, event, await binanceHeaders(other.privateKey, event));
    eq(forged.status, 401);
    eq((await orderStatus(order.order_id)).payment_status, 'unpaid', 'forged event changes nothing');

    const ok = await call(hook, event, await binanceHeaders(privateKey, event));
    eq([ok.status, (await ok.json()).returnCode], [200, 'SUCCESS']);
    eq((await orderStatus(order.order_id)).payment_status, 'paid');
    eq((await paymentRow(r1.payment_id)).status, 'confirmed');
    const again = await call(hook, event, await binanceHeaders(privateKey, event));
    eq(again.status, 200, 'replays are acknowledged');
    const ledger = await service<{ paid_usd: string }[]>(`/rest/v1/orders?id=eq.${order.order_id}&select=paid_usd`);
    eq(ledger[0]!.paid_usd, (await orderStatus(order.order_id)).paid_usd);
  });
});

Deno.test('Binance Pay: a provider refusal fails the payment so the buyer can quote again', async () => {
  const { pem } = await rsaKey();
  const env = envWith({ BINANCE_PAY_API_KEY: 'k', BINANCE_PAY_SECRET_KEY: 's', BINANCE_PAY_PUBLIC_KEY: pem });
  const refuse: typeof fetch = () => Promise.resolve(new Response(JSON.stringify({ status: 'FAIL', code: '400002', errorMessage: 'Signature for this request is not valid.' }), { status: 400 }));
  await withMethod('binance_pay', async () => {
    const { buyer, quote } = await orderAndQuote('binance_pay');
    const res = await call(paymentsStart({ env, fetch: refuse }), { quoteId: quote.id, idempotencyKey: `k-${uid()}` }, { authorization: `Bearer ${buyer.token}` });
    eq(res.status, 502);
    const [row] = await service<{ status: string }[]>(`/rest/v1/payments?quote_id=eq.${quote.id}&select=status`);
    eq(row!.status, 'failed');
  });
});

Deno.test('PayPal: approval is captured, only the verified capture event credits the order', async () => {
  const env = envWith({ PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 'secret', PAYPAL_WEBHOOK_ID: 'WH-1', PAYPAL_ENV: 'sandbox' });
  const calls: string[] = [];
  let verifyAnswer = 'SUCCESS';
  const fakePaypal: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    assert(url.origin === 'https://api-m.sandbox.paypal.com', `unexpected host ${url.origin}`);
    calls.push(url.pathname);
    if (url.pathname === '/v1/oauth2/token') return new Response(JSON.stringify({ access_token: 'tok' }));
    if (url.pathname === '/v2/checkout/orders') {
      const b = JSON.parse(String(init!.body));
      eq([b.intent, b.purchase_units[0].amount.currency_code], ['CAPTURE', 'USD']);
      return new Response(JSON.stringify({ id: 'PP-ORDER-' + b.purchase_units[0].custom_id.slice(0, 8), links: [{ rel: 'payer-action', href: 'https://www.sandbox.paypal.com/checkoutnow?token=x' }] }), { status: 201 });
    }
    if (url.pathname === '/v1/notifications/verify-webhook-signature') {
      eq(JSON.parse(String(init!.body)).webhook_id, 'WH-1');
      return new Response(JSON.stringify({ verification_status: verifyAnswer }));
    }
    if (url.pathname.endsWith('/capture')) return new Response(JSON.stringify({ status: 'COMPLETED' }), { status: 201 });
    throw new Error(`unexpected ${url.pathname}`);
  };

  await withMethod('paypal', async () => {
    const { buyer, order, quote } = await orderAndQuote('paypal');
    const r = await (await call(paymentsStart({ env, fetch: fakePaypal }), { quoteId: quote.id, idempotencyKey: `k-${uid()}` }, { authorization: `Bearer ${buyer.token}` })).json();
    eq([r.status, r.checkout_url], ['processing', 'https://www.sandbox.paypal.com/checkoutnow?token=x']);
    const ppOrder = (await paymentRow(r.payment_id)).provider_payment_id!;
    const hook = paypalWebhook({ env, fetch: fakePaypal });

    const approved = { id: `WH-${uid()}`, event_type: 'CHECKOUT.ORDER.APPROVED', resource: { id: ppOrder } };
    eq((await call(hook, approved)).status, 200);
    assert(calls.includes(`/v2/checkout/orders/${ppOrder}/capture`), 'approved order is captured');
    eq((await orderStatus(order.order_id)).payment_status, 'unpaid', 'approval alone pays nothing');

    const completed = { id: `WH-${uid()}`, event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'CAP-1', amount: { value: String(quote.amount_due), currency_code: 'USD' }, supplementary_data: { related_ids: { order_id: ppOrder } } } };
    verifyAnswer = 'FAILURE';
    eq((await call(hook, completed)).status, 401, 'unverified event refused');
    eq((await orderStatus(order.order_id)).payment_status, 'unpaid');
    verifyAnswer = 'SUCCESS';
    eq((await call(hook, completed)).status, 200);
    eq((await orderStatus(order.order_id)).payment_status, 'paid');
  });
});

Deno.test('webhooks answer 503 while the provider is not configured', async () => {
  eq((await call(binanceWebhook({ env: envWith({}), fetch: noNetwork }), '{}')).status, 503);
  eq((await call(paypalWebhook({ env: envWith({}), fetch: noNetwork }), '{}')).status, 503);
});

Deno.test('rates-sync: only the service role; failed sources are reported and nothing is stored', async () => {
  const h = ratesSync({ env: envWith({}), fetch: noNetwork });
  eq((await call(h, {}, { authorization: `Bearer ${ANON}` })).status, 401);
  const before = await service<unknown[]>('/rest/v1/exchange_rates?select=id');
  const res = await call(h, {}, { authorization: `Bearer ${SERVICE}` });
  eq(res.status, 200);
  const { results } = await res.json() as { results: { source: string; ok: boolean; error: string }[] };
  assert(results.length >= 4, 'every enabled automatic source is tried');
  assert(results.every((r) => !r.ok && r.error.includes('network disabled')), JSON.stringify(results));
  eq((await service<unknown[]>('/rest/v1/exchange_rates?select=id')).length, before.length, 'no rate stored');
});

Deno.test('scheduled jobs start rates-sync with the Vault job token; a wrong token is refused', async () => {
  const token = Deno.env.get('KORA_TEST_JOB_TOKEN');
  assert(token, 'kora_job_token missing in the local Vault: run the migrations');
  const h = ratesSync({ env: envWith({}), fetch: noNetwork });
  eq((await call(h, {}, { 'x-kora-job-token': 'f'.repeat(64) })).status, 401);
  eq((await call(h, {}, { 'x-kora-job-token': token.slice(0, 31) })).status, 401);
  eq((await call(h, {}, { 'x-kora-job-token': token, authorization: `Bearer ${ANON}` })).status, 200);
});

Deno.test('rates-sync: a parsed value is stored through ingest_rate', async () => {
  const kraken = JSON.stringify({ error: [], result: { USDTZUSD: { c: ['0.99950000', '10'] } } });
  const onlyKraken: typeof fetch = (input) => String(input).includes('api.kraken.com') ? Promise.resolve(new Response(kraken)) : Promise.reject(new Error('offline'));
  const res = await call(ratesSync({ env: envWith({}), fetch: onlyKraken }), {}, { authorization: `Bearer ${SERVICE}` });
  const { results } = await res.json() as { results: { source: string; ok: boolean; rate: number }[] };
  const k = results.find((r) => r.source === 'kraken_usdt')!;
  eq([k.ok, k.rate], [true, 1.0005]);
  const [row] = await service<{ rate: number }[]>('/rest/v1/exchange_rates?source_code=eq.kraken_usdt&order=observed_at.desc&limit=1&select=rate');
  eq(Number(row!.rate), 1.0005);
  // test value removed again so the dev data keeps only demo/manual rates
  await service('/rest/v1/exchange_rates?source_code=eq.kraken_usdt', { method: 'DELETE' });
});

Deno.test('push-dispatch: sends once, drops dead devices, never runs for others', async () => {
  const h = pushDispatch;
  eq((await call(h({ env: envWith({}), fetch: noNetwork }), {}, { authorization: `Bearer ${ANON}` })).status, 401);
  const user = await signUp();
  const good = `ExponentPushToken[${uid()}${uid()}]`;
  await rpc('register_push_token', { p_token: good, p_platform: 'android' }, user.token);
  const id1 = await rpc<string>('notify', { p_user: user.id, p_kind: 'system', p_title: 'Prueba', p_body: 'Mensaje de prueba', p_data: {} });
  const sent: unknown[] = [];
  const expo: typeof fetch = async (input, init) => {
    eq(String(input), EXPO_PUSH_URL);
    const msgs = JSON.parse(String(init!.body)) as { to: string }[];
    sent.push(...msgs);
    return new Response(JSON.stringify({ data: msgs.map((m) => (m.to === good ? { status: 'ok', id: 'ticket-1' } : { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } })) }));
  };
  const r1 = await (await call(h({ env: envWith({}), fetch: expo }), { ids: [id1] }, { authorization: `Bearer ${SERVICE}` })).json();
  eq([r1.claimed, r1.sent], [1, 1]);
  const r2 = await (await call(h({ env: envWith({}), fetch: expo }), { ids: [id1] }, { authorization: `Bearer ${SERVICE}` })).json();
  eq([r2.claimed, sent.length], [0, 1], 'never sent twice');

  await service(`/rest/v1/push_tokens?token=eq.${encodeURIComponent(good)}`, { method: 'DELETE' });
  const dead = `ExponentPushToken[${uid()}${uid()}]`;
  await rpc('register_push_token', { p_token: dead, p_platform: 'ios' }, user.token);
  const id2 = await rpc<string>('notify', { p_user: user.id, p_kind: 'system', p_title: 'Prueba', p_body: 'Otra', p_data: {} });
  const r3 = await (await call(h({ env: envWith({}), fetch: expo }), { ids: [id2] }, { authorization: `Bearer ${SERVICE}` })).json();
  eq([r3.claimed, r3.failed], [1, 1]);
  eq(await service(`/rest/v1/push_tokens?token=eq.${encodeURIComponent(dead)}&select=token`), [], 'dead token removed');
});

Deno.test('push receipts: checked once due, dead devices removed, undelivered notices marked failed', async () => {
  const h = pushDispatch;
  const auth = { authorization: `Bearer ${SERVICE}` };
  const user = await signUp();
  const a = `ExponentPushToken[${uid()}${uid()}]`;
  const b = `ExponentPushToken[${uid()}${uid()}]`;
  await rpc('register_push_token', { p_token: a, p_platform: 'android' }, user.token);
  await rpc('register_push_token', { p_token: b, p_platform: 'ios' }, user.token);
  const tag = uid();
  const ticketFor = (to: string, n: number) => `tk-${tag}-${n}-${to === a ? 'a' : 'b'}`;
  let sends = 0;
  let receipts: Record<string, unknown> = {};
  const asked: string[][] = [];
  const expo: typeof fetch = async (input, init) => {
    const body = JSON.parse(String(init!.body));
    if (String(input) === EXPO_PUSH_URL) {
      sends++;
      return new Response(JSON.stringify({ data: (body as { to: string }[]).map((m) => ({ status: 'ok', id: ticketFor(m.to, sends) })) }));
    }
    eq(String(input), EXPO_RECEIPTS_URL);
    asked.push(body.ids);
    return new Response(JSON.stringify({ data: receipts }));
  };
  const run = async (ids: string[]) => (await call(h({ env: envWith({}), fetch: expo }), { ids }, auth)).json();
  const age = (id: string) => service(`/rest/v1/push_tickets?notification_id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ created_at: new Date(Date.now() - 20 * 60_000).toISOString() }) });

  // sent to both devices: two tickets stored, no receipt asked before it is due
  const n1 = await rpc<string>('notify', { p_user: user.id, p_kind: 'system', p_title: 'Prueba', p_body: 'Recibos', p_data: {} });
  const r1 = await run([n1]);
  eq([r1.sent, r1.receipts.checked], [1, 0]);
  const t1 = await service<{ ticket_id: string; status: string; token: string }[]>(`/rest/v1/push_tickets?notification_id=eq.${n1}&select=ticket_id,status,token&order=ticket_id`);
  eq(t1.map((t) => [t.status, t.token]), [['pending', a], ['pending', b]]);

  // 15 minutes later: one delivered, the other device no longer exists
  await age(n1);
  receipts = { [ticketFor(a, 1)]: { status: 'ok' }, [ticketFor(b, 1)]: { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } } };
  const r2 = await run([n1]);
  eq([r2.receipts.checked, r2.receipts.ok, r2.receipts.error, r2.receipts.devices_removed, r2.receipts.notifications_failed], [2, 1, 1, 1, 0]);
  eq(await service(`/rest/v1/push_tokens?token=eq.${encodeURIComponent(b)}&select=token`), [], 'dead device removed');
  const [s1] = await service<{ push_status: string }[]>(`/rest/v1/notifications?id=eq.${n1}&select=push_status`);
  eq(s1!.push_status, 'sent', 'delivered to one device is still sent');
  eq((await run([n1])).receipts.checked, 0, 'a settled ticket is never asked again');

  // the only device rejects the message: the notice is marked failed with the reason
  const n2 = await rpc<string>('notify', { p_user: user.id, p_kind: 'system', p_title: 'Prueba', p_body: 'Rechazo', p_data: {} });
  await run([n2]);
  await age(n2);
  receipts = { [ticketFor(a, 2)]: { status: 'error', message: 'too big', details: { error: 'MessageTooBig' } } };
  eq((await run([n2])).receipts.notifications_failed, 1);
  const [s2] = await service<{ push_status: string; push_error: string }[]>(`/rest/v1/notifications?id=eq.${n2}&select=push_status,push_error`);
  eq([s2!.push_status, s2!.push_error], ['failed', 'Sin entregar: MessageTooBig']);

  // a receipt Expo has not produced yet stays pending and is asked again only after 10 minutes
  const n3 = await rpc<string>('notify', { p_user: user.id, p_kind: 'system', p_title: 'Prueba', p_body: 'Pendiente', p_data: {} });
  await run([n3]);
  await age(n3);
  receipts = {};
  const r3 = await run([n3]);
  eq([r3.receipts.checked, r3.receipts.not_ready], [1, 1]);
  eq((await run([n3])).receipts.checked, 0, 'not asked again right away');
  const [t3] = await service<{ status: string }[]>(`/rest/v1/push_tickets?notification_id=eq.${n3}&select=status`);
  eq(t3!.status, 'pending');
  eq(asked.flat().length, 4, 'exactly the due tickets were asked about');

  // health for the admin dashboard; buyers cannot read it
  const health = await rpc<{ devices: number; rejected_24h: number }>('push_health', {});
  assert(health.devices >= 1 && health.rejected_24h >= 2, `health ${JSON.stringify(health)}`);
  const denied = await fetch(`${URL_}/rest/v1/rpc/push_health`, { method: 'POST', headers: { apikey: ANON, authorization: `Bearer ${user.token}`, 'content-type': 'application/json' }, body: '{}' });
  eq(denied.status, 403);
  await denied.body?.cancel();
});
