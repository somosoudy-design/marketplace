import AsyncStorage from '@react-native-async-storage/async-storage';
import { canonicalIntentPayload, createPersistentIntentStore } from '@kora/core';
import { intentKey } from './ids';
import { captureActorApi } from './actor-api';

// Persist before transmission; storage errors never fall back to transient keys.
export const operationIntents = createPersistentIntentStore(AsyncStorage, () => intentKey('cart'));

const cartAdds = new Map<string, { payload: string; promise: Promise<void> }>();
export function addAccountCart(actorId: string, variantId: string, quantity: number, productId: string, refresh: () => Promise<unknown>): Promise<void> {
  const slot = JSON.stringify([actorId, variantId]);
  const payloadJson = canonicalIntentPayload({ variantId, quantity });
  const existing = cartAdds.get(slot);
  if (existing) {
    if (existing.payload !== payloadJson) return Promise.reject(Object.assign(new Error('Espera a comprobar la operación anterior antes de cambiar la cantidad.'), { code: 'pending_intent' }));
    return existing.promise;
  }
  const run = (async () => {
    const bound = await captureActorApi(actorId);
    const scope = { actorId, operation: 'cart.add', slot: variantId };
    const pending = await operationIntents.read(scope);
    const intent = await operationIntents.prepare(scope, { variantId, quantity });
    const payload = JSON.parse(intent.payloadJson) as { variantId: string; quantity: number };
    await bound.assertCurrent();
    try {
      await bound.api.cart.addWithIntent(payload.variantId, payload.quantity, intent.key);
    } catch (error) {
      // Only a first fresh request can be released after an atomic rejection. A
      // previous unanswered request may still commit later, so retries keep the key.
      if (!pending && ['unavailable', 'sold_out', 'invalid_input', 'rate_limited'].includes((error as { code?: string }).code ?? '')) {
        await bound.assertCurrent();
        await operationIntents.complete(intent);
      }
      throw error;
    }
    await bound.assertCurrent();
    await refresh();
    await bound.assertCurrent();
    await operationIntents.complete(intent);
    void bound.api.catalog.track('add_to_cart', { productId });
  })();
  const promise = run.finally(() => { if (cartAdds.get(slot)?.promise === promise) cartAdds.delete(slot); });
  cartAdds.set(slot, { payload: payloadJson, promise });
  return promise;
}
