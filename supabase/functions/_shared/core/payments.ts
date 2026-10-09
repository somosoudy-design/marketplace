// GENERATED from packages/core/src/payments/index.ts by tools/sync-edge-shared.mjs. Do not edit; run `pnpm edge:sync`.
/**
 * Automated payment provider adapters (Binance Pay, PayPal).
 * Pure functions using WebCrypto so they run in Supabase Edge Functions (Deno) and Node 20+.
 * Secrets are only ever read server-side from environment variables.
 */
export type ProviderOutcome = 'succeeded' | 'failed' | 'cancelled' | 'expired' | 'pending' | 'ignored';
export interface NormalizedProviderEvent {
  provider: 'binance_pay' | 'paypal';
  eventId: string;
  eventType: string;
  providerPaymentId: string | null;
  outcome: ProviderOutcome;
  amount: number | null;
  currency: string | null;
}

const enc = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;
const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
function pemToDer(pem: string): ArrayBuffer {
  const body = pem.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s/g, '');
  const bytes = b64ToBytes(body);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

// ---------------- Binance Pay ----------------
// Request signing: HMAC-SHA512(secret, timestamp + "\n" + nonce + "\n" + body + "\n"), uppercase hex.
export async function signBinancePayRequest(secretKey: string, timestamp: string, nonce: string, body: string): Promise<string> {
  const key = await subtle().importKey('raw', enc.encode(secretKey), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const sig = await subtle().sign('HMAC', key, enc.encode(`${timestamp}\n${nonce}\n${body}\n`));
  return toHex(sig).toUpperCase();
}

/** Webhook verification: RSA-SHA256 over the same payload with the Binance platform public key (from the certificates API). */
export async function verifyBinancePayWebhook(publicKeyPem: string, headers: { timestamp: string; nonce: string; signature: string }, body: string): Promise<boolean> {
  try {
    const key = await subtle().importKey('spki', pemToDer(publicKeyPem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    return await subtle().verify('RSASSA-PKCS1-v1_5', key, b64ToBytes(headers.signature), enc.encode(`${headers.timestamp}\n${headers.nonce}\n${body}\n`));
  } catch {
    return false;
  }
}

export function normalizeBinancePayEvent(body: string): NormalizedProviderEvent {
  const j = JSON.parse(body) as { bizType?: string; bizId?: string | number; bizIdStr?: string; bizStatus?: string; data?: string };
  const data = j.data ? (JSON.parse(j.data) as { merchantTradeNo?: string; totalFee?: number | string; currency?: string }) : {};
  const outcome: ProviderOutcome =
    j.bizType !== 'PAY' ? 'ignored' : j.bizStatus === 'PAY_SUCCESS' ? 'succeeded' : j.bizStatus === 'PAY_CLOSED' ? 'expired' : 'pending';
  return {
    provider: 'binance_pay', eventId: String(j.bizIdStr ?? j.bizId ?? ''), eventType: `${j.bizType}:${j.bizStatus}`,
    providerPaymentId: data.merchantTradeNo ?? null, outcome,
    amount: data.totalFee !== undefined ? Number(data.totalFee) : null, currency: data.currency ?? null,
  };
}

export function binancePayCreateOrderBody(p: { merchantTradeNo: string; amountUsdt: string; description: string; returnUrl: string; cancelUrl: string; webhookUrl: string }) {
  return {
    env: { terminalType: 'APP' },
    merchantTradeNo: p.merchantTradeNo.replace(/[^A-Za-z0-9]/g, '').slice(0, 32),
    orderAmount: p.amountUsdt, currency: 'USDT',
    goods: { goodsType: '02', goodsCategory: 'Z000', referenceGoodsId: p.merchantTradeNo, goodsName: p.description.slice(0, 256) },
    returnUrl: p.returnUrl, cancelUrl: p.cancelUrl, webhookUrl: p.webhookUrl,
  };
}

// ---------------- PayPal ----------------
export const PAYPAL_BASE = { sandbox: 'https://api-m.sandbox.paypal.com', live: 'https://api-m.paypal.com' } as const;

/** Body for POST /v1/notifications/verify-webhook-signature (PayPal verifies; we never trust unsigned events). */
export function paypalVerifyBody(headers: Record<string, string | undefined>, webhookId: string, event: unknown) {
  const h = (k: string) => headers[k] ?? headers[k.toLowerCase()] ?? '';
  return {
    auth_algo: h('paypal-auth-algo'), cert_url: h('paypal-cert-url'), transmission_id: h('paypal-transmission-id'),
    transmission_sig: h('paypal-transmission-sig'), transmission_time: h('paypal-transmission-time'),
    webhook_id: webhookId, webhook_event: event,
  };
}

export function normalizePaypalEvent(event: unknown): NormalizedProviderEvent {
  const e = event as { id?: string; event_type?: string; resource?: { id?: string; custom_id?: string; amount?: { value?: string; currency_code?: string }; supplementary_data?: { related_ids?: { order_id?: string } } } };
  const t = e.event_type ?? '';
  const outcome: ProviderOutcome =
    t === 'PAYMENT.CAPTURE.COMPLETED' ? 'succeeded' :
    t === 'PAYMENT.CAPTURE.DENIED' || t === 'PAYMENT.CAPTURE.DECLINED' ? 'failed' :
    t === 'CHECKOUT.ORDER.VOIDED' ? 'cancelled' : 'ignored';
  return {
    provider: 'paypal', eventId: e.id ?? '', eventType: t,
    providerPaymentId: e.resource?.supplementary_data?.related_ids?.order_id ?? e.resource?.id ?? null,
    outcome, amount: e.resource?.amount?.value ? Number(e.resource.amount.value) : null, currency: e.resource?.amount?.currency_code ?? null,
  };
}

export function paypalCreateOrderBody(p: { paymentId: string; amountUsd: string; description: string; returnUrl: string; cancelUrl: string }) {
  return {
    intent: 'CAPTURE',
    purchase_units: [{ custom_id: p.paymentId, description: p.description.slice(0, 127), amount: { currency_code: 'USD', value: p.amountUsd } }],
    payment_source: { paypal: { experience_context: { return_url: p.returnUrl, cancel_url: p.cancelUrl, user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING' } } },
  };
}
