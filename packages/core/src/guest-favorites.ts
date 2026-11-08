import { canonicalIntentPayload, type IntentStorage } from './persistent-intent';

export interface GuestFavorite { product_id: string; created_at: string }
export interface GuestFavoriteMerge {
  version: 1; operation: 'favorites.merge'; actorId: string; key: string;
  productIds: string[]; payloadJson: string;
}
interface SavedFavorites { version: 1; entries: GuestFavorite[]; pending: GuestFavoriteMerge[] }
const KEY = 'mayami.guest-favorites.v1';
const validIds = (ids: unknown): ids is string[] => Array.isArray(ids) && ids.every(id => typeof id === 'string' && id.length > 0) && new Set(ids).size === ids.length;
const payload = (ids: string[]) => canonicalIntentPayload([...ids].sort());

/** One atomic document detaches public guest choices into private, actor-bound merge batches. */
export function createGuestFavorites(storage: IntentStorage, coordinate?: <T>(work: () => Promise<T>) => Promise<T>) {
  const listeners = new Set<(entries: GuestFavorite[]) => void>();
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(work: () => Promise<T>) => {
    const run = queue.catch(() => undefined).then(() => coordinate ? coordinate(work) : work());
    queue = run; return run;
  };
  const notify = (entries: GuestFavorite[]) => listeners.forEach(listener => listener(entries.map(entry => ({ ...entry }))));
  async function read(): Promise<SavedFavorites> {
    const raw = await storage.getItem(KEY);
    if (!raw) return { version: 1, entries: [], pending: [] };
    const doc = JSON.parse(raw) as SavedFavorites;
    if (doc?.version !== 1 || !Array.isArray(doc.entries) || !Array.isArray(doc.pending) ||
        !doc.entries.every(entry => typeof entry?.product_id === 'string' && entry.product_id && typeof entry.created_at === 'string') ||
        !validIds(doc.entries.map(entry => entry.product_id)) ||
        !doc.pending.every(item => item?.version === 1 && item.operation === 'favorites.merge' && typeof item.actorId === 'string' && item.actorId &&
          typeof item.key === 'string' && item.key.length >= 8 && item.key.length <= 80 && validIds(item.productIds) && item.productIds.length > 0 &&
          item.payloadJson === payload(item.productIds)) ||
        new Set(doc.pending.map(item => JSON.stringify([item.actorId, item.key]))).size !== doc.pending.length)
      throw new Error('No pudimos recuperar tus favoritos. Conservamos sus datos en este dispositivo.');
    return doc;
  }
  async function save(doc: SavedFavorites) { await storage.setItem(KEY, JSON.stringify(doc)); }
  return {
    read: () => serial(async () => (await read()).entries),
    refresh: () => serial(async () => { const entries = (await read()).entries; notify(entries); return entries; }),
    subscribe(listener: (entries: GuestFavorite[]) => void) { listeners.add(listener); return () => void listeners.delete(listener); },
    set: (productId: string, on: boolean) => serial(async () => {
      if (!productId) throw new Error('Elige un producto para continuar.');
      const doc = await read();
      if (on && !doc.entries.some(entry => entry.product_id === productId)) doc.entries.unshift({ product_id: productId, created_at: new Date().toISOString() });
      if (!on) doc.entries = doc.entries.filter(entry => entry.product_id !== productId);
      await save(doc); notify(doc.entries);
    }),
    pendingMerge: (actorId: string) => serial(async () => (await read()).pending.find(item => item.actorId === actorId) ?? null),
    reserveMerge: (actorId: string, newKey: () => string) => serial(async (): Promise<GuestFavoriteMerge | null> => {
      if (!actorId) throw new Error('Inicia sesión para continuar.');
      const doc = await read(), prior = doc.pending.find(item => item.actorId === actorId);
      if (prior) return prior;
      if (!doc.entries.length) return null;
      const ids = doc.entries.map(entry => entry.product_id), batches: GuestFavoriteMerge[] = [];
      for (let i = 0; i < ids.length; i += 50) {
        const key = newKey();
        if (key.length < 8 || key.length > 80 || [...doc.pending, ...batches].some(item => item.actorId === actorId && item.key === key))
          throw new Error('No pudimos preparar tus favoritos. Conservamos sus datos.');
        const productIds = ids.slice(i, i + 50);
        batches.push({ version: 1, operation: 'favorites.merge', actorId, key, productIds, payloadJson: payload(productIds) });
      }
      await save({ version: 1, entries: [], pending: [...doc.pending, ...batches] });
      notify([]); return batches[0]!;
    }),
    completeMerge: (expected: GuestFavoriteMerge) => serial(async () => {
      const doc = await read(), current = doc.pending.find(item => item.actorId === expected.actorId && item.key === expected.key);
      if (!current || current.payloadJson !== expected.payloadJson) return false;
      await save({ ...doc, pending: doc.pending.filter(item => item !== current) });
      return true;
    }),
  };
}
