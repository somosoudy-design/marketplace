// POST /functions/v1/binance-pay-webhook  (called by Binance Pay; verify_jwt = false)
// Trusts an event only after checking its RSA signature with the Binance Pay platform public key
// (BINANCE_PAY_PUBLIC_KEY, from Binance's certificate API). Unsigned or forged events are refused and
// never touch the payment.
import { normalizeBinancePayEvent, verifyBinancePayWebhook } from '../_shared/core/payments.ts';
import { defaultDeps, type Deps } from '../_shared/env.ts';
import { json } from '../_shared/http.ts';
import { rest } from '../_shared/rest.ts';

const answer = (ok: boolean, message: string | null, status = ok ? 200 : 400) =>
  json({ returnCode: ok ? 'SUCCESS' : 'FAIL', returnMessage: message }, status);

export function createHandler(deps: Deps = defaultDeps()) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return answer(false, 'method not allowed', 405);
    const publicKey = deps.env('BINANCE_PAY_PUBLIC_KEY');
    if (!publicKey) return answer(false, 'not configured', 503);
    const raw = await req.text();
    const headers = {
      timestamp: req.headers.get('binancepay-timestamp') ?? '',
      nonce: req.headers.get('binancepay-nonce') ?? '',
      signature: req.headers.get('binancepay-signature') ?? '',
    };
    if (!headers.timestamp || !headers.nonce || !headers.signature) return answer(false, 'missing signature headers');
    if (!(await verifyBinancePayWebhook(publicKey, headers, raw))) {
      console.warn('binance-pay-webhook: invalid signature');
      return answer(false, 'invalid signature', 401);
    }
    let event, payload;
    try {
      event = normalizeBinancePayEvent(raw);
      payload = JSON.parse(raw);
    } catch {
      return answer(false, 'invalid body');
    }
    if (!event.eventId) return answer(false, 'missing bizId');
    try {
      const r = await rest(deps.env).rpc<{ status: string }>('record_provider_event', {
        p_provider: 'binance_pay', p_event_id: event.eventId, p_event_type: event.eventType, p_provider_payment_id: event.providerPaymentId,
        p_outcome: event.outcome, p_amount: event.amount, p_currency: event.currency, p_signature_valid: true, p_payload: payload,
      });
      if (r.status !== 'processed' && r.status !== 'duplicate') console.warn('binance-pay-webhook', event.eventId, r.status);
      return answer(true, null);
    } catch (e) {
      console.error('binance-pay-webhook', e);
      return answer(false, 'temporary error', 500); // Binance retries
    }
  };
}
