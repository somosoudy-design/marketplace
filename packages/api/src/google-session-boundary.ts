/** Prepared single-owner boundary, not installed in an application. No Auth/network work belongs here. */
export type MaybePromise<T> = T | PromiseLike<T>;
export interface GoogleSessionStorage {
  getItem(key: string): MaybePromise<string | null>;
  setItem(key: string, value: string): MaybePromise<void>;
  removeItem(key: string): MaybePromise<void>;
}
export interface GoogleSessionTicket { readonly stamp: string; readonly baseline: string | null }
export interface GoogleIntentStamp { read(): string | null; write(value: string): void }
export type GoogleSessionLock = <T>(work: () => Promise<T>) => Promise<T>;
// One owner per storage object/key in this module/process. Aliases and other realms remain a caller contract.
const owners = new WeakMap<GoogleSessionStorage, Set<string>>();
type BoundaryCode = 'guest_required' | 'boundary_changed' | 'rollback_pending';
export class GoogleSessionBoundaryError extends Error {
  readonly code: BoundaryCode;
  readonly cause: unknown;
  constructor(code: BoundaryCode, cause?: unknown) {
    super(code === 'guest_required'
      ? 'La cuenta cambió. Revisa tu sesión antes de continuar.'
      : code === 'rollback_pending'
        ? 'No pudimos recuperar la sesión del navegador. Intenta de nuevo.'
        : 'El acceso se canceló porque la sesión cambió.');
    this.name = 'GoogleSessionBoundaryError'; this.code = code; this.cause = cause;
  }
}

/**
 * Serializes all primary SDK storage access, including repair after a rejected promotion.
 * This proposal has ONE owner per primary storage/key/process. It does not implement
 * shared rollback quarantine, crash recovery, or asynchronous multi-tab ownership.
 * withLock serializes this owner's transactions; it does not make the local recovery
 * barrier visible in another realm. DO NOT install in the web primary client or
 * claim cross-tab/crash safety. That integration remains pending before activation.
 * Secondary SDK keys pass through. The stamp contains only a fresh opaque intent ID.
 */
export function createGoogleSessionBoundary(
  underlying: GoogleSessionStorage,
  key: string,
  intent: GoogleIntentStamp,
  newIntentId: () => string,
  withLock?: GoogleSessionLock,
) {
  const keys = owners.get(underlying) ?? new Set<string>();
  if (keys.has(key)) throw new Error('Primary storage already has a Google session boundary owner');
  keys.add(key); owners.set(underlying, keys);
  let tail: Promise<void> = Promise.resolve();
  let rejected: { candidate: string } | null = null;
  const listeners = new Set<() => void>();

  function invalidate(): void {
    const stamp = newIntentId();
    if (typeof stamp !== 'string' || !stamp || stamp === intent.read()) throw new Error('Invalid intent identifier');
    // This must happen in the caller's synchronous turn, before queue/lock/storage awaits.
    intent.write(stamp);
  }
  function stamp(): string {
    let value = intent.read();
    if (value === null) { invalidate(); value = intent.read(); }
    if (typeof value !== 'string' || !value) throw new Error('Intent storage unavailable');
    return value;
  }
  function isCurrent(ticket: GoogleSessionTicket): boolean {
    return typeof ticket.stamp === 'string' && !!ticket.stamp && intent.read() === ticket.stamp;
  }
  function primary<T>(work: () => Promise<T>): Promise<T> {
    const result = tail.then(() => withLock ? withLock(work) : work());
    // A failed operation cannot poison the queue. A rejected candidate has its own read barrier.
    tail = result.then(() => undefined, () => undefined);
    return result;
  }
  function notifyConfirmed(): void {
    for (const listener of [...listeners]) {
      // Observers cannot undo a confirmed storage commit or prevent other observers.
      try { listener(); } catch { /* No payload, tokens, or logging. */ }
    }
  }
  async function repairRejected(): Promise<void> {
    const pending = rejected;
    if (!pending) return;
    try {
      const value = await underlying.getItem(key);
      if (value !== pending.candidate) { if (rejected === pending) rejected = null; return; }
      // capture/commit only permit a null guest baseline. Never remove a different session.
      await underlying.removeItem(key);
      const remaining = await underlying.getItem(key);
      if (remaining === pending.candidate) throw new Error('Rejected candidate remains');
      if (rejected === pending) rejected = null;
    } catch (error) {
      // Retain the barrier: later reads retry cleanup or reject, and cannot return this candidate.
      throw new GoogleSessionBoundaryError('rollback_pending', error);
    }
  }

  const storage: GoogleSessionStorage = {
    getItem(requested) {
      if (requested !== key) return underlying.getItem(requested);
      return primary(async () => {
        await repairRejected();
        return await underlying.getItem(key);
      });
    },
    setItem(requested, value) {
      if (requested !== key) return underlying.setItem(requested, value);
      invalidate();
      return primary(async () => {
        // An explicit later SDK writer can supersede a failed promotion cleanup.
        await underlying.setItem(key, value);
        rejected = null;
      });
    },
    removeItem(requested) {
      if (requested !== key) return underlying.removeItem(requested);
      invalidate();
      return primary(async () => { await underlying.removeItem(key); rejected = null; });
    },
  };

  return {
    storage,
    invalidate,
    isCurrent,
    capture(): Promise<GoogleSessionTicket> {
      return primary(async () => {
        await repairRejected();
        const expected = stamp();
        const baseline = await underlying.getItem(key);
        if (intent.read() !== expected) throw new GoogleSessionBoundaryError('boundary_changed');
        if (baseline !== null) throw new GoogleSessionBoundaryError('guest_required');
        return Object.freeze({ stamp: expected, baseline });
      });
    },
    commit(ticket: GoogleSessionTicket, sessionJson: string, stillCurrent: () => boolean): Promise<boolean> {
      // Copy input now: a queued caller cannot mutate the ticket after scheduling its commit.
      const expected = { stamp: ticket.stamp, baseline: ticket.baseline };
      if (typeof sessionJson !== 'string' || !sessionJson) return Promise.reject(new Error('Invalid session payload'));
      const valid = () => {
        try { return expected.baseline === null && isCurrent(expected) && stillCurrent(); }
        catch { return false; }
      };
      return primary(async () => {
        if (!valid()) return false;
        await repairRejected();
        if (!valid()) return false;
        const baseline = await underlying.getItem(key);
        if (!valid() || baseline !== expected.baseline) return false;
        // Set before starting a possibly deferred/uncertain native write.
        rejected = { candidate: sessionJson };
        try { await underlying.setItem(key, sessionJson); }
        catch (error) {
          // A rejecting setItem may already have written. Inspect before any conditional cleanup.
          await repairRejected();
          throw error;
        }
        if (!valid()) { await repairRejected(); return false; }
        let saved: string | null;
        try { saved = await underlying.getItem(key); }
        catch (error) { await repairRejected(); throw error; }
        if (!valid() || saved !== sessionJson) { await repairRejected(); return false; }
        // Linearization point: no await remains before notification/return from this transaction.
        rejected = null;
        notifyConfirmed();
        return true;
      });
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
