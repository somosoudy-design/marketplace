// Server-side calls to the automated payment providers. Secrets come from the function environment only.
// Nothing here has been run against the real providers: there are no merchant accounts yet. The request
// shapes follow the providers' public API documentation and are exercised in tests against fakes.
import { binancePayCreateOrderBody, PAYPAL_BASE, paypalCreateOrderBody, paypalVerifyBody, signBinancePayRequest } from './core/payments.ts';
import type { Env } from './env.ts';

export interface StartedPayment {
  id: string;
  number: string;
  order_id: string;
  amount: number | string;
  currency: string;
  method_code: string;
  status: string;
  provider_payment_id: string | null;
  provider_checkout_url: string | null;
  replayed: boolean;
}

export interface ProviderOrder {
  providerPaymentId: string;
  checkoutUrl: string | null;
}

export interface PaymentProvider {
  code: 'binance_pay' | 'paypal';
  /** True only when every secret the provider needs is present. */
  configured(env: Env): boolean;
  createOrder(p: StartedPayment, ctx: { env: Env; fetch: typeof fetch; orderNumber: string }): Promise<ProviderOrder>;
}

export class ProviderError extends Error {}

const returnUrls = (env: Env, paymentId: string) => {
  const base = env('PAYMENTS_RETURN_URL') ?? 'kora://pay/result';
  const sep = base.includes('?') ? '&' : '?';
  return { returnUrl: `${base}${sep}payment=${paymentId}&result=return`, cancelUrl: `${base}${sep}payment=${paymentId}&result=cancel` };
};

export const functionsUrl = (env: Env) => env('PUBLIC_FUNCTIONS_URL') ?? `${env('SUPABASE_URL')}/functions/v1`;

const randomNonce = () => {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => abc[b % abc.length]).join('');
};

// ---------- Binance Pay ----------
export const BINANCE_PAY_API = 'https://bpay.binanceapi.com';

export const binancePay: PaymentProvider = {
  code: 'binance_pay',
  configured: (env) => Boolean(env('BINANCE_PAY_API_KEY') && env('BINANCE_PAY_SECRET_KEY') && env('BINANCE_PAY_PUBLIC_KEY')),
  async createOrder(p, { env, fetch, orderNumber }) {
    const { returnUrl, cancelUrl } = returnUrls(env, p.id);
    const body = binancePayCreateOrderBody({
      merchantTradeNo: p.number, amountUsdt: Number(p.amount).toFixed(2), description: `Pedido ${orderNumber}`,
      returnUrl, cancelUrl, webhookUrl: `${functionsUrl(env)}/binance-pay-webhook`,
    });
    const raw = JSON.stringify(body);
    const timestamp = String(Date.now());
    const nonce = randomNonce();
    const res = await fetch(`${BINANCE_PAY_API}/binancepay/openapi/v3/order`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'BinancePay-Timestamp': timestamp,
        'BinancePay-Nonce': nonce,
        'BinancePay-Certificate-SN': env('BINANCE_PAY_API_KEY')!,
        'BinancePay-Signature': await signBinancePayRequest(env('BINANCE_PAY_SECRET_KEY')!, timestamp, nonce, raw),
      },
      body: raw,
      signal: AbortSignal.timeout(15_000),
    });
    const j = (await res.json().catch(() => null)) as { status?: string; code?: string; errorMessage?: string; data?: { checkoutUrl?: string; universalUrl?: string } } | null;
    if (!res.ok || j?.status !== 'SUCCESS' || !j.data) throw new ProviderError(`Binance Pay: ${j?.code ?? res.status} ${j?.errorMessage ?? ''}`.trim());
    return { providerPaymentId: body.merchantTradeNo, checkoutUrl: j.data.universalUrl ?? j.data.checkoutUrl ?? null };
  },
};

// ---------- PayPal ----------
const paypalBase = (env: Env) => (env('PAYPAL_ENV') === 'live' ? PAYPAL_BASE.live : PAYPAL_BASE.sandbox);

export async function paypalToken(env: Env, fetchFn: typeof fetch): Promise<string> {
  const res = await fetchFn(`${paypalBase(env)}/v1/oauth2/token`, {
    method: 'POST',
    headers: { authorization: `Basic ${btoa(`${env('PAYPAL_CLIENT_ID')}:${env('PAYPAL_CLIENT_SECRET')}`)}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15_000),
  });
  const j = (await res.json().catch(() => null)) as { access_token?: string } | null;
  if (!res.ok || !j?.access_token) throw new ProviderError(`PayPal OAuth: HTTP ${res.status}`);
  return j.access_token;
}

export const paypal: PaymentProvider = {
  code: 'paypal',
  configured: (env) => Boolean(env('PAYPAL_CLIENT_ID') && env('PAYPAL_CLIENT_SECRET') && env('PAYPAL_WEBHOOK_ID')),
  async createOrder(p, { env, fetch, orderNumber }) {
    const token = await paypalToken(env, fetch);
    const { returnUrl, cancelUrl } = returnUrls(env, p.id);
    const res = await fetch(`${paypalBase(env)}/v2/checkout/orders`, {
      method: 'POST',
      // the payment id makes the request idempotent: a retry returns the same PayPal order
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'PayPal-Request-Id': p.id },
      body: JSON.stringify(paypalCreateOrderBody({ paymentId: p.id, amountUsd: Number(p.amount).toFixed(2), description: `Pedido ${orderNumber}`, returnUrl, cancelUrl })),
      signal: AbortSignal.timeout(15_000),
    });
    const j = (await res.json().catch(() => null)) as { id?: string; links?: { rel: string; href: string }[]; message?: string } | null;
    if (!res.ok || !j?.id) throw new ProviderError(`PayPal: HTTP ${res.status} ${j?.message ?? ''}`.trim());
    return { providerPaymentId: j.id, checkoutUrl: j.links?.find((l) => l.rel === 'payer-action' || l.rel === 'approve')?.href ?? null };
  },
};

/** PayPal verifies the transmission itself; an event is trusted only when it answers SUCCESS. */
export async function paypalVerifyWebhook(env: Env, fetchFn: typeof fetch, token: string, headers: Headers, event: unknown): Promise<boolean> {
  const h: Record<string, string> = {};
  headers.forEach((v, k) => (h[k.toLowerCase()] = v));
  const res = await fetchFn(`${paypalBase(env)}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(paypalVerifyBody(h, env('PAYPAL_WEBHOOK_ID')!, event)),
    signal: AbortSignal.timeout(15_000),
  });
  const j = (await res.json().catch(() => null)) as { verification_status?: string } | null;
  return res.ok && j?.verification_status === 'SUCCESS';
}

/** Captures an approved order. Idempotent: a repeated capture of the same order is not an error. */
export async function paypalCapture(env: Env, fetchFn: typeof fetch, token: string, orderId: string): Promise<void> {
  const res = await fetchFn(`${paypalBase(env)}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'PayPal-Request-Id': `capture-${orderId}` },
    body: '{}',
    signal: AbortSignal.timeout(15_000),
  });
  if (res.ok) return;
  const j = (await res.json().catch(() => null)) as { details?: { issue?: string }[] } | null;
  if (res.status === 422 && j?.details?.some((d) => d.issue === 'ORDER_ALREADY_CAPTURED')) return;
  throw new ProviderError(`PayPal capture: HTTP ${res.status}`);
}

export const PROVIDERS: Record<string, PaymentProvider> = { binance_pay: binancePay, paypal };
