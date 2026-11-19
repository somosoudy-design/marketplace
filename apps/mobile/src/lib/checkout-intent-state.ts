import { createPersistentIntentStore, IntentStorageError, type IntentStorage, type PersistentIntent } from '@kora/core';
import type { ShippingSelection } from '@kora/api';

export type CheckoutOrderSelection = { addressId: string; shipping: ShippingSelection; plan: string };
export type CheckoutOrderPayload = CheckoutOrderSelection & { reviewToken: string };
export type StoredCheckoutAttempt = { identity: PersistentIntent; payload: CheckoutOrderPayload };
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const scope = (actorId: string) => ({ actorId, operation: 'checkout.order', slot: 'active' });
function checkedPayload(value: unknown): CheckoutOrderPayload {
  const p = value as CheckoutOrderPayload;
  if (!p || typeof p !== 'object' || typeof p.addressId !== 'string' || !UUID.test(p.addressId) ||
    typeof p.plan !== 'string' || !p.plan.trim() || typeof p.reviewToken !== 'string' || !/^[a-f0-9]{64}$/.test(p.reviewToken) ||
    !p.shipping || typeof p.shipping !== 'object' || Array.isArray(p.shipping) ||
    Object.values(p.shipping).some((method) => typeof method !== 'string' || !method.trim())) throw new IntentStorageError('No pudimos recuperar los datos de la compra pendiente. Conservamos su referencia.');
  return { addressId: p.addressId, plan: p.plan, shipping: { ...p.shipping }, reviewToken: p.reviewToken };
}
const attempt = (identity: PersistentIntent): StoredCheckoutAttempt => ({ identity, payload: checkedPayload(JSON.parse(identity.payloadJson)) });

/** No display snapshot or JWT is persisted: only IDs, selected plan, review token and operation key. */
export function createCheckoutIntents(storage: IntentStorage, newKey: () => string) {
  const identities = createPersistentIntentStore(storage, newKey);
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(run: () => Promise<T>) => { const next = queue.catch(() => undefined).then(run); queue = next; return next; };
  return {
    load: (actorId: string) => serial(async () => {
      const identity = await identities.read(scope(actorId));
      return identity ? attempt(identity) : null;
    }),
    prepare: (actorId: string, payload: CheckoutOrderPayload) => serial(async () => {
      const selected = checkedPayload(payload), owner = scope(actorId);
      const pending = await identities.read(owner);
      const identity = await identities.prepare(owner, selected);
      return { stored: attempt(identity), fresh: pending === null };
    }),
    complete: (accepted: StoredCheckoutAttempt) => serial(() => identities.complete(accepted.identity)),
  };
}
