import type { PlaceOrderResult } from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type OrderReference = { id: string; number: string };

export class UnconfirmedCheckoutError extends Error {
  constructor(cause?: unknown) {
    super('No pudimos recibir la confirmación de tu pedido.', { cause });
    this.name = 'UnconfirmedCheckoutError';
  }
}

/** A successful HTTP response alone must never route the buyer to /pay/undefined. */
export function confirmedCheckout(value: unknown): PlaceOrderResult | null {
  if (!value || typeof value !== 'object') return null;
  const result = value as Partial<PlaceOrderResult>;
  if (typeof result.order_id !== 'string' || !UUID.test(result.order_id) || typeof result.number !== 'string' || !result.number.trim()) return null;
  return { order_id: result.order_id, number: result.number, replayed: result.replayed === true };
}

export async function recoverCheckout(find: () => Promise<OrderReference | null>): Promise<PlaceOrderResult | null> {
  const order = await find();
  if (order == null) return null;
  const result = confirmedCheckout({ order_id: order.id, number: order.number, replayed: true });
  if (!result) throw new UnconfirmedCheckoutError();
  return result;
}

/** Only uncertain transport/server results need a lookup; a business rejection retains its existing recovery. */
export async function confirmCheckout(place: () => Promise<unknown>, find: () => Promise<OrderReference | null>): Promise<PlaceOrderResult> {
  try {
    const result = confirmedCheckout(await place());
    if (result) return result;
    throw new UnconfirmedCheckoutError();
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code && code !== 'network' && code !== 'unknown') throw error;
    try {
      const recovered = await recoverCheckout(find);
      if (recovered) return recovered;
    } catch {
      // A failed lookup cannot establish that the order was not created.
    }
    throw new UnconfirmedCheckoutError(error);
  }
}
