/** Durable operation identity; storage and random key generation are supplied by each platform. */
export interface IntentStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}
export interface IntentScope { actorId: string; operation: string; slot: string }
export interface PersistentIntent extends IntentScope {
  version: 1;
  key: string;
  payloadJson: string;
  createdAt: number;
}
export class PendingIntentError extends Error {
  readonly code = 'pending_intent';
  constructor(readonly pending: PersistentIntent) {
    super('Hay una operación pendiente de confirmar. Comprueba su resultado antes de cambiarla.');
    this.name = 'PendingIntentError';
  }
}
export class IntentStorageError extends Error {
  readonly code = 'intent_storage';
  constructor(message = 'No pudimos recuperar la operación guardada. Conserva la pantalla y vuelve a intentarlo.') {
    super(message);
    this.name = 'IntentStorageError';
  }
}

/** Sorted JSON with no lossy coercion (NaN, undefined, bigint, dates or sparse arrays). */
export function canonicalIntentPayload(value: unknown): string {
  const seen = new Set<object>();
  const visit = (item: unknown): string => {
    if (item === null) return 'null';
    if (typeof item === 'string' || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item);
    if (!item || typeof item !== 'object' || seen.has(item)) throw new TypeError('Invalid intent JSON');
    seen.add(item);
    try {
      if (Array.isArray(item)) {
        for (let n = 0; n < item.length; n++) if (!(n in item)) throw new TypeError('Sparse intent array');
        return '[' + item.map(visit).join(',') + ']';
      }
      if (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) throw new TypeError('Invalid intent object');
      const record = item as Record<string, unknown>;
      return '{' + Object.keys(record).sort().map((key) => JSON.stringify(key) + ':' + visit(record[key])).join(',') + '}';
    } finally { seen.delete(item); }
  };
  return visit(value);
}

export function intentStorageKey(scope: IntentScope): string {
  const parts = [scope.actorId, scope.operation, scope.slot];
  if (parts.some((value) => typeof value !== 'string' || !value.trim())) throw new TypeError('Intent scope required');
  return 'mayami.intent.v1:' + parts.map(encodeURIComponent).join(':');
}

function decode(raw: string, scope: IntentScope): PersistentIntent {
  try {
    const item = JSON.parse(raw) as PersistentIntent;
    if (!item || item.version !== 1 || item.actorId !== scope.actorId || item.operation !== scope.operation || item.slot !== scope.slot ||
      typeof item.key !== 'string' || item.key.length < 8 || item.key.length > 80 || typeof item.payloadJson !== 'string' ||
      typeof item.createdAt !== 'number' || !Number.isFinite(item.createdAt) || item.createdAt < 0 ||
      canonicalIntentPayload(JSON.parse(item.payloadJson)) !== item.payloadJson) throw new TypeError('Invalid stored intent');
    return Object.freeze(item);
  } catch { throw new IntentStorageError(); }
}

/**
 * One shared instance per platform storage. An unresolved payload cannot be silently replaced.
 * No expiry: a slow response can commit later. A retry must keep its original key and exact payload.
 * This is operation persistence, not authorization: bind the request token to actorId in the adapter.
 */
export function createPersistentIntentStore(storage: IntentStorage, newKey: () => string, now = Date.now) {
  const queues = new Map<string, Promise<unknown>>();
  async function locked<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = queues.get(key) ?? Promise.resolve();
    const job = previous.catch(() => undefined).then(fn);
    queues.set(key, job);
    try { return await job; }
    finally { if (queues.get(key) === job) queues.delete(key); }
  }
  const read = async (scope: IntentScope) => {
    const raw = await storage.getItem(intentStorageKey(scope));
    return raw === null ? null : decode(raw, scope);
  };
  return {
    read(scope: IntentScope) {
      return locked(intentStorageKey(scope), () => read(scope));
    },
    async prepare(scope: IntentScope, payload: unknown): Promise<PersistentIntent> {
      const storageKey = intentStorageKey(scope), payloadJson = canonicalIntentPayload(payload);
      return locked(storageKey, async () => {
        const pending = await read(scope);
        if (pending) {
          if (pending.payloadJson !== payloadJson) throw new PendingIntentError(pending);
          return pending;
        }
        const key = newKey(), createdAt = now();
        if (typeof key !== 'string' || key.length < 8 || key.length > 80 || !Number.isFinite(createdAt) || createdAt < 0) throw new TypeError('Invalid intent identity');
        const item: PersistentIntent = Object.freeze({ ...scope, version: 1, key, payloadJson, createdAt });
        await storage.setItem(storageKey, JSON.stringify(item));
        return item;
      });
    },
    /** Call only after a definitive server result, never after timeout, offline or an inconclusive lookup. */
    complete(intent: PersistentIntent): Promise<boolean> {
      const storageKey = intentStorageKey(intent);
      return locked(storageKey, async () => {
        const current = await read(intent);
        if (!current || current.key !== intent.key || current.payloadJson !== intent.payloadJson) return false;
        await storage.removeItem(storageKey);
        return true;
      });
    },
  };
}
