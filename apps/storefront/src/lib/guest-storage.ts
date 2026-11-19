'use client';
import { createGuestCart, createGuestFavorites, type IntentStorage } from '@kora/core';

function storageError() { return new Error('No pudimos guardar tus productos en este navegador. Revisa el almacenamiento e inténtalo de nuevo.'); }
const storage: IntentStorage = {
  getItem(key) { try { return window.localStorage.getItem(key); } catch { throw storageError(); } },
  setItem(key, value) { try { window.localStorage.setItem(key, value); } catch { throw storageError(); } },
  removeItem(key) { try { window.localStorage.removeItem(key); } catch { throw storageError(); } },
};
export async function guestLock<T>(name: string, work: () => Promise<T>): Promise<T> {
  if (typeof window === 'undefined' || !window.navigator.locks) throw new Error('Este navegador no puede coordinar el guardado de tus productos. Usa un navegador actualizado.');
  return window.navigator.locks.request(`mayami.guest.${name}`, work);
}
// Creating these pure stores does not touch window. All reads happen after mounting or an explicit action.
export const guestCart = createGuestCart(storage, work => guestLock('cart.storage', work));
export const guestFavorites = createGuestFavorites(storage, work => guestLock('favorites.storage', work));
export const guestCartKeys = new Set(['kora.guest-cart.v1', 'mayami.guest-merge-reservation.v1', 'mayami.guest-merge-reservations.v2']);
export const guestFavoriteKeys = new Set(['mayami.guest-favorites.v1']);
