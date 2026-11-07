import { canonicalIntentPayload } from '@kora/core';
import type { ShippingSelection } from '@kora/api';

export type CheckoutSelection = { address: string; shipping: ShippingSelection; plan: string };
export type CheckoutIntent = { version?: 2; buyerId: string; key: string; selection: CheckoutSelection; reviewToken?: string };
export interface CheckoutIntentStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const checkoutIntentKey = (buyerId: string) => `checkout-intent:${buyerId}`;
export const checkoutStorageUnavailable = '\u0000checkout-storage-unavailable';

/** Legacy intents may be looked up by key, never resent without their original review token. */
export function parseCheckoutIntent(raw: string | null, buyerId: string): CheckoutIntent | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as CheckoutIntent;
    if (!value || typeof value.key !== 'string' || value.key.length < 8 || value.key.length > 80 ||
      !value.selection || typeof value.selection.address !== 'string' || !UUID.test(value.selection.address) ||
      typeof value.selection.plan !== 'string' || !value.selection.plan.trim() ||
      !value.selection.shipping || Array.isArray(value.selection.shipping) || typeof value.selection.shipping !== 'object' ||
      Object.values(value.selection.shipping).some((method) => typeof method !== 'string' || !method.trim())) throw new TypeError('Invalid checkout intent');
    const legacy = value.version === undefined && value.reviewToken === undefined;
    if (!legacy && (value.version !== 2 || value.buyerId !== buyerId || typeof value.reviewToken !== 'string' || !/^[a-f0-9]{64}$/.test(value.reviewToken))) throw new TypeError('Invalid reviewed checkout intent');
    if (legacy && value.buyerId !== undefined && value.buyerId !== buyerId) throw new TypeError('Foreign checkout intent');
    return { ...(legacy ? {} : { version: 2 as const, reviewToken: value.reviewToken }), buyerId, key: value.key,
      selection: { address: value.selection.address, plan: value.selection.plan, shipping: { ...value.selection.shipping } } };
  } catch { throw new Error('No pudimos recuperar la compra guardada. Conservamos sus datos; revisa tus pedidos antes de continuar.'); }
}
const identity = (value: CheckoutIntent) => canonicalIntentPayload({ buyerId: value.buyerId, selection: value.selection, reviewToken: value.reviewToken ?? null });

export function persistCheckoutIntent(storage: CheckoutIntentStorage, candidate: CheckoutIntent): { intent: CheckoutIntent; fresh: boolean } {
  const checked = parseCheckoutIntent(JSON.stringify(candidate), candidate.buyerId);
  if (!checked?.reviewToken) throw new Error('Revisa nuevamente el pedido antes de confirmar.');
  const key = checkoutIntentKey(candidate.buyerId);
  const pending = parseCheckoutIntent(storage.getItem(key), candidate.buyerId);
  if (pending) {
    if (identity(pending) !== identity(checked)) throw new Error('Hay una compra pendiente de comprobar. Revisa su resultado antes de cambiarla.');
    return { intent: pending, fresh: false };
  }
  storage.setItem(key, JSON.stringify(checked));
  return { intent: checked, fresh: true };
}

/** Move an older tab's exact operation to durable storage before any new transmission. */
export function restoreCheckoutIntent(durable: CheckoutIntentStorage, legacy: CheckoutIntentStorage, buyerId: string): CheckoutIntent | null {
  const key=checkoutIntentKey(buyerId);
  const current=parseCheckoutIntent(durable.getItem(key),buyerId);
  const older=parseCheckoutIntent(legacy.getItem(key),buyerId);
  if(current&&older&&(current.key!==older.key||identity(current)!==identity(older)))throw new Error('Hay dos compras pendientes de comprobar. Conservamos ambas referencias; revisa tus pedidos antes de continuar.');
  if(!current&&older)durable.setItem(key,JSON.stringify(older));
  if(older)clearCheckoutIntent(legacy,older);
  return current??older;
}

/** An old callback cannot remove a newer attempt, even for the same buyer. */
export function clearCheckoutIntent(storage: CheckoutIntentStorage, expected: CheckoutIntent): boolean {
  const key = checkoutIntentKey(expected.buyerId), current = parseCheckoutIntent(storage.getItem(key), expected.buyerId);
  if (!current || current.key !== expected.key || identity(current) !== identity(expected)) return false;
  storage.removeItem(key);
  return true;
}
