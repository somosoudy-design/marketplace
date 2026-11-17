import type { GoogleAttempt, GoogleTicket } from './google-auth';
import type { GoogleSessionLock } from './google-session-boundary';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** All final web storage changes are synchronous inside one named cross-tab lock.
 * No provisional Google candidate is ever placed in the primary session key.
 * Shared records contain only opaque intent IDs and consumed nonce expiry, never tokens/verifiers.
 */
export function createWebGoogleSessionBoundary(store: Store, key: string, lock: GoogleSessionLock, newId: () => string) {
  const stampKey = key + '.google-intent.v1', claimsKey = key + '.google-claims.v1';
  let tail: Promise<unknown> = Promise.resolve(), pending = 0;
  const listeners = new Set<() => void>();
  const serial = <T>(work: () => T): Promise<T> => {
    const result = tail.then(() => lock(async () => work()));
    tail = result.catch(() => undefined); return result;
  };
  const bump = () => {
    const id = newId();
    if (!id || id === store.getItem(stampKey)) throw new Error('Invalid auth intent');
    store.setItem(stampKey, id);
  };
  const isCurrent = (ticket: GoogleTicket) => {
    try { return pending === 0 && ticket.baseline === null && store.getItem(stampKey) === ticket.stamp; }
    catch { return false; }
  };
  const invalidate = (expected?: GoogleTicket) => {
    pending++;
    const change = serial(() => {
      if (expected && store.getItem(stampKey) !== expected.stamp) return;
      bump();
    });
    // Capture/storage operations wait on the queue. A failed invalidation poisons this boundary closed.
    void change.then(() => { pending--; }, () => undefined);
  };
  const storage = {
    getItem: (name: string) => serial(() => store.getItem(name)),
    setItem(name: string, value: string) {
      if (name === key) pending++;
      return serial(() => { if (name === key) bump(); store.setItem(name, value); })
        .then(() => { if (name === key) pending--; });
    },
    removeItem(name: string) {
      if (name === key) pending++;
      return serial(() => { if (name === key) bump(); store.removeItem(name); })
        .then(() => { if (name === key) pending--; });
    },
  };
  return {
    storage, invalidate, isCurrent,
    capture: () => serial(() => {
      if (pending) throw new Error('Auth storage unavailable');
      if (!store.getItem(stampKey)) bump();
      if (store.getItem(key) !== null) throw new Error('La cuenta cambió. Revisa tu sesión.');
      return { stamp: store.getItem(stampKey)!, baseline: null };
    }),
    claimAttempt: (attempt: GoogleAttempt) => serial(() => {
      if (!isCurrent(attempt.ticket) || store.getItem(key) !== null) return false;
      const raw = store.getItem(claimsKey);
      const values: unknown = raw === null ? [] : JSON.parse(raw);
      if (!Array.isArray(values) || values.some(v => !v || typeof v.id !== 'string' || typeof v.expiresAt !== 'number')) throw new Error('Invalid auth claims');
      const claims = (values as { id: string; expiresAt: number }[]).filter(v => v.expiresAt > Date.now());
      if (claims.some(v => v.id === attempt.id) || claims.length >= 128) return false;
      claims.push({ id: attempt.id, expiresAt: attempt.expiresAt });
      store.setItem(claimsKey, JSON.stringify(claims)); return true;
    }),
    commit: (ticket: GoogleTicket, session: string, current: () => boolean) => serial(() => {
      if (!isCurrent(ticket) || !current() || store.getItem(key) !== null) return false;
      // Web Storage setItem is atomic and synchronous. No await or provisional write follows this guard.
      store.setItem(key, session);
      return true;
    }).then(accepted => {
      if (accepted) for (const listener of listeners) { try { listener(); } catch { /* Observers do not undo commits. */ } }
      return accepted;
    }),
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
