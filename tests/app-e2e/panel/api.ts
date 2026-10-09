import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Talks to the local stack the way the app does (GoTrue + PostgREST through the gateway) to set up data
// that would otherwise take a long trip through the phone UI. Only the public anon key is used.
const GATEWAY = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY ?? readFileSync(join(import.meta.dirname, '../../../.local/keys.env'), 'utf8').match(/^SUPABASE_ANON_KEY=(.+)$/m)![1]!.trim();

async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: { apikey: ANON, authorization: `Bearer ${init.token ?? ANON}`, 'content-type': 'application/json', prefer: 'return=representation', ...(init.headers ?? {}) },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${body}`);
  return (body ? JSON.parse(body) : null) as T;
}
const rpc = <T>(fn: string, args: Record<string, unknown>, token: string) => call<T>(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args), token });

/** A new buyer places an order for one in-stock product of the given store and reports a cash payment. */
export async function buyerPaysInCash(storeName: string) {
  const email = `panel-${Date.now().toString(36)}@example.com`;
  const auth = await call<{ access_token: string; user: { id: string } }>('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email, password: 'Kora-prueba-2026', data: { full_name: 'Comprador de prueba' } }) });
  const token = auth.access_token;
  const cards = await call<{ id: string }[]>(`/rest/v1/product_cards?select=id&store_name=eq.${encodeURIComponent(storeName)}&availability=eq.available&limit=10`);
  const [variant] = await call<{ id: string }[]>(`/rest/v1/product_variants?select=id&active=eq.true&stock=gt.1&product_id=in.(${cards.map((c) => c.id).join(',')})&limit=1`);
  if (!variant) throw new Error(`no in-stock product in ${storeName}`);
  const [address] = await call<{ id: string }[]>('/rest/v1/addresses', {
    method: 'POST', token,
    body: JSON.stringify({ user_id: auth.user.id, label: 'Casa', recipient: 'Comprador de prueba', phone: '0412-000-0000', region_code: 'A', city: 'Caracas', line1: 'Calle de prueba 1' }),
  });
  await rpc('cart_set_quantity', { p_variant_id: variant.id, p_quantity: 1 }, token);
  const order = await rpc<{ order_id: string; number: string }>('place_order', { p_address_id: address!.id, p_shipping: {}, p_plan_code: 'full', p_idempotency_key: `panel-${Date.now()}` }, token);
  const quote = await rpc<{ id: string }>('create_payment_quote', { p_order_id: order.order_id, p_method_code: 'efectivo_usd', p_obligation_ids: null }, token);
  await rpc('submit_payment', { p_quote_id: quote.id, p_reference: null, p_proof_path: null, p_payer: { name: 'Comprador de prueba' }, p_idempotency_key: `pay-${Date.now()}` }, token);
  return { orderNumber: order.number, email };
}
