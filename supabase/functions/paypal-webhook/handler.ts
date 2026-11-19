// POST /functions/v1/paypal-webhook  (called by PayPal; verify_jwt = false)
// Every event is verified by PayPal's verify-webhook-signature API before it is used. An approved order is
// captured here; the payment is credited only by the signed PAYMENT.CAPTURE.COMPLETED event that follows.
import { normalizePaypalEvent } from '../_shared/core/payments.ts';
import { defaultDeps, type Deps } from '../_shared/env.ts';
import { fail, json } from '../_shared/http.ts';
import { paypal, paypalCapture, paypalToken, paypalVerifyWebhook } from '../_shared/providers.ts';
import { rest } from '../_shared/rest.ts';

export function createHandler(deps: Deps = defaultDeps()) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'POST only');
    if (!paypal.configured(deps.env)) return fail(503, 'not_configured', 'PayPal is not configured');
    let event: { id?: string; event_type?: string; resource?: { id?: string } };
    try {
      event = JSON.parse(await req.text());
    } catch {
      return fail(400, 'invalid_body', 'invalid JSON');
    }
    try {
      const token = await paypalToken(deps.env, deps.fetch);
      if (!(await paypalVerifyWebhook(deps.env, deps.fetch, token, req.headers, event))) {
        console.warn('paypal-webhook: verification failed', event.id);
        return fail(401, 'invalid_signature', 'verification failed');
      }
      if (event.event_type === 'CHECKOUT.ORDER.APPROVED' && event.resource?.id) {
        await paypalCapture(deps.env, deps.fetch, token, event.resource.id);
      }
      const n = normalizePaypalEvent(event);
      if (!n.eventId) return fail(400, 'invalid_body', 'missing id');
      const r = await rest(deps.env).rpc<{ status: string }>('record_provider_event', {
        p_provider: 'paypal', p_event_id: n.eventId, p_event_type: n.eventType, p_provider_payment_id: n.providerPaymentId,
        p_outcome: n.outcome, p_amount: n.amount, p_currency: n.currency, p_signature_valid: true, p_payload: event,
      });
      return json({ status: r.status });
    } catch (e) {
      console.error('paypal-webhook', e);
      return fail(500, 'temporary_error', 'retry later'); // PayPal retries
    }
  };
}
