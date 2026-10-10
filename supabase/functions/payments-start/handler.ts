// POST /functions/v1/payments-start  { quoteId, idempotencyKey }  (Authorization: the buyer's session)
// Starts an online payment (Binance Pay / PayPal) for a server-made quote and returns where to pay.
// The payment stays "processing" until the provider's signed webhook confirms it: returning from the
// checkout page never marks anything as paid.
import { defaultDeps, type Deps } from '../_shared/env.ts';
import { bearer, cors, fail, json, readJson } from '../_shared/http.ts';
import { PROVIDERS, ProviderError, type StartedPayment } from '../_shared/providers.ts';
import { rest, RestError } from '../_shared/rest.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HINTS: Record<string, [number, string]> = {
  quote_expired: [409, 'La cotización venció. Vuelve a cotizar para ver el monto actualizado.'],
  method_unavailable: [409, 'Este método de pago no está disponible en este momento.'],
};

export function createHandler(deps: Deps = defaultDeps()) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Usa POST.');
    const user = bearer(req);
    if (!user) return fail(401, 'unauthorized', 'Inicia sesión para pagar.');
    const body = await readJson<{ quoteId?: string; idempotencyKey?: string }>(req);
    const quoteId = body?.quoteId ?? '';
    const idem = body?.idempotencyKey ?? '';
    if (!UUID.test(quoteId) || idem.length < 8 || idem.length > 120) return fail(400, 'invalid_request', 'Solicitud incompleta.');

    const db = rest(deps.env);
    try {
      const [quote] = await db.get<{ method_code: string; order_id: string }[]>(`payment_quotes?id=eq.${quoteId}&select=method_code,order_id`, { as: user });
      if (!quote) return fail(404, 'not_found', 'No encontramos esa cotización.');
      const provider = PROVIDERS[quote.method_code];
      if (!provider) return fail(400, 'manual_method', 'Este método se paga con referencia y comprobante, no en línea.');
      // Without credentials nothing is created: no payment row, no fake checkout.
      if (!provider.configured(deps.env)) return fail(503, 'not_configured', 'Este método de pago aún no está habilitado.');

      const p = await db.rpc<StartedPayment>('start_provider_payment', { p_quote_id: quoteId, p_idempotency_key: idem }, { as: user });
      if (p.status !== 'processing' || p.provider_payment_id) {
        return json({ payment_id: p.id, number: p.number, status: p.status, checkout_url: p.provider_checkout_url });
      }
      const [order] = await db.get<{ number: string }[]>(`orders?id=eq.${p.order_id}&select=number`, { as: user });
      let created;
      try {
        created = await provider.createOrder(p, { env: deps.env, fetch: deps.fetch, orderNumber: order?.number ?? p.number });
      } catch (e) {
        console.error('payments-start provider error', provider.code, e instanceof Error ? e.message : e);
        await db.rpc('fail_provider_start', { p_payment_id: p.id, p_reason: e instanceof ProviderError ? e.message : 'provider unreachable' });
        return fail(502, 'provider_error', 'El proveedor no pudo iniciar el pago. Intenta de nuevo o elige otro método.');
      }
      await db.rpc('attach_provider_payment', { p_payment_id: p.id, p_provider_payment_id: created.providerPaymentId, p_checkout_url: created.checkoutUrl });
      return json({ payment_id: p.id, number: p.number, status: 'processing', checkout_url: created.checkoutUrl });
    } catch (e) {
      if (e instanceof RestError) {
        const known = e.hint ? HINTS[e.hint] : undefined;
        if (known) return fail(known[0], e.hint!, known[1]);
        if (e.status === 401 || e.code === 'PGRST301') return fail(401, 'unauthorized', 'Tu sesión venció. Inicia sesión de nuevo.');
        if (e.code === 'P0002') return fail(404, 'not_found', 'No encontramos esa cotización.');
      }
      console.error('payments-start', e);
      return fail(500, 'internal', 'No pudimos iniciar el pago. Intenta de nuevo.');
    }
  };
}
