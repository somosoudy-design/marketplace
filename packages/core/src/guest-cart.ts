import { canonicalIntentPayload, type IntentStorage } from './persistent-intent';
import type { ProductCondition } from './product-selection';

export interface GuestLine {
  product_condition?: ProductCondition|null;
  variant_id: string; product_id: string; quantity: number; title: string;
  variant_title: string | null; image_path: string | null; price_usd: number; availability: string;
}
export interface GuestMergeReservation {
  version: 1; operation: 'cart.merge'; actorId: string; key: string;
  stage: 'staging' | 'ready'; lines: GuestLine[]; sourceJson: string; payloadJson: string;
}
const KEY = 'kora.guest-cart.v1';
const LEGACY_RESERVED = 'mayami.guest-merge-reservation.v1';
const RESERVED = 'mayami.guest-merge-reservations.v2';
const mergePayload = (lines: GuestLine[]) => lines.map(({ variant_id, quantity }) => ({ variant_id, quantity }));
function validLines(value: unknown): value is GuestLine[] {
  return Array.isArray(value) && value.every((line) => line && typeof line === 'object' && typeof line.variant_id === 'string' && line.variant_id &&
    typeof line.product_id === 'string' && line.product_id && Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 100 &&
    typeof line.title === 'string' && typeof line.availability === 'string' &&
    typeof line.price_usd === 'number' && Number.isFinite(line.price_usd) && line.price_usd >= 0 &&
    (line.image_path === null || typeof line.image_path === 'string') && (line.variant_title === null || typeof line.variant_title === 'string'));
}
function reservation(raw: string): GuestMergeReservation {
  const r = JSON.parse(raw) as GuestMergeReservation;
  if (!r || r.version !== 1 || r.operation !== 'cart.merge' || typeof r.actorId !== 'string' || !r.actorId || typeof r.key !== 'string' || r.key.length < 8 || r.key.length > 80 ||
      !['staging', 'ready'].includes(r.stage) || !validLines(r.lines) || !r.lines.length || typeof r.sourceJson !== 'string' ||
      r.payloadJson !== canonicalIntentPayload(mergePayload(r.lines))) throw new Error('No pudimos recuperar el carrito pendiente. Conservamos sus datos.');
  return r;
}

/** Injected storage lets the integrator test crash/retry behavior without native modules. */
export function createGuestCart(storage: IntentStorage, coordinate?: <T>(work: () => Promise<T>) => Promise<T>) {
  const listeners = new Set<(lines: GuestLine[]) => void>();
  let queue: Promise<unknown> = Promise.resolve();
  async function serial<T>(fn: () => Promise<T>) {
    const next = queue.catch(() => undefined).then(() => coordinate ? coordinate(fn) : fn()); queue = next; return next;
  }
  const notify = (lines: GuestLine[]) => listeners.forEach((listener) => listener(lines.map((line) => ({ ...line }))));
  async function saveReservations(items: GuestMergeReservation[]) {
    await storage.setItem(RESERVED, JSON.stringify({ version: 2, reservations: items }));
  }
  async function savedReservations(): Promise<GuestMergeReservation[]> {
    const raw = await storage.getItem(RESERVED);
    const parsed = raw ? JSON.parse(raw) : { version: 2, reservations: [] };
    if (parsed?.version !== 2 || !Array.isArray(parsed.reservations)) throw new Error('No pudimos recuperar el carrito pendiente. Conservamos sus datos.');
    const items: GuestMergeReservation[] = parsed.reservations.map((item: unknown) => reservation(JSON.stringify(item)));
    const keys = items.map(item => JSON.stringify([item.actorId, item.key]));
    if (new Set(keys).size !== keys.length) throw new Error('El carrito pendiente contiene operaciones incompatibles. Conservamos sus datos.');
    const legacyRaw = await storage.getItem(LEGACY_RESERVED);
    if (legacyRaw) {
      const legacy = reservation(legacyRaw);
      const existing = items.find(item => item.actorId === legacy.actorId && item.key === legacy.key);
      if (existing && existing.payloadJson !== legacy.payloadJson) throw new Error('El carrito pendiente cambió. Conservamos ambas copias.');
      if (!existing) items.unshift(legacy);
      // Copy first: a crash or failed cleanup can only replay the same actor/key, never create a new merge.
      await saveReservations(items);
      await storage.removeItem(LEGACY_RESERVED);
    }
    const staging = items.filter(item => item.stage === 'staging');
    if (staging.length) {
      const source = staging[0]!.sourceJson;
      const plain = await storage.getItem(KEY) ?? '[]';
      if (staging.some(item => item.sourceJson !== source) || (plain !== source && plain !== '[]'))
        throw new Error('El carrito local cambió durante una recuperación. Conservamos ambas copias.');
      if (plain !== '[]') await storage.setItem(KEY, '[]');
      staging.forEach(item => { item.stage = 'ready'; });
      await saveReservations(items);
      notify([]);
    }
    return items;
  }
  async function lines() {
    await savedReservations();
    const parsed: unknown = JSON.parse(await storage.getItem(KEY) ?? '[]');
    if (!validLines(parsed)) throw new Error('No pudimos recuperar el carrito guardado. Conservamos sus datos.');
    return parsed;
  }
  async function write(next: GuestLine[]) {
    await storage.setItem(KEY, JSON.stringify(next));
    notify(next);
  }
  return {
    read: () => serial(lines),
    pendingMerge: (actorId: string) => serial(async () => {
      const pending = (await savedReservations()).find(item => item.actorId === actorId);
      return pending ? { ...pending, lines: pending.lines.map(line => ({ ...line })) } : null;
    }),
    replaceCancelledMerge: (expected: GuestMergeReservation, remainingIds: string[], newKey: () => string, confirmation: { state: string; operation: string }) => serial(async () => {
      if (confirmation.state !== 'cancelled' || confirmation.operation !== 'merge') throw new Error('Falta confirmar la cancelación anterior.');
      const all = await savedReservations();
      const current = all.find(item => item.actorId === expected.actorId && item.key === expected.key);
      if (!current || current.payloadJson !== expected.payloadJson) throw new Error('El carrito pendiente cambió. Actualiza antes de continuar.');
      if (new Set(remainingIds).size !== remainingIds.length || remainingIds.some(id => !current.lines.some(line => line.variant_id === id))) throw new Error('Revisa los productos pendientes.');
      const remaining = current.lines.filter(line => remainingIds.includes(line.variant_id));
      if (!remaining.length) { await saveReservations(all.filter(item => item !== current)); return null; }
      const key = newKey();
      if (key.length < 8 || key.length > 80 || all.some(item => item.actorId === current.actorId && item.key === key))
        throw new Error('No pudimos preparar la operación nueva.');
      const replacement: GuestMergeReservation = { ...current, key, stage: 'ready', lines: remaining, payloadJson: canonicalIntentPayload(mergePayload(remaining)) };
      // One atomic storage entry replaces the confirmed-cancelled operation; new guest lines stay separate.
      await saveReservations(all.map(item => item === current ? replacement : item));
      return replacement;
    }),
    subscribe(listener: (lines: GuestLine[]) => void) { listeners.add(listener); return () => void listeners.delete(listener); },
    add: (line: GuestLine) => serial(async () => {
      if (!validLines([line])) throw new Error('Revisa el producto y la cantidad antes de guardarlo.');
      const current = await lines(), index = current.findIndex((item) => item.variant_id === line.variant_id);
      if (index >= 0) current[index] = { ...current[index]!, quantity: Math.min(current[index]!.quantity + line.quantity, 20) };
      else current.push({ ...line });
      await write(current);
    }),
    setQuantity: (variantId: string, quantity: number) => serial(async () => {
      if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100) throw new Error('Revisa la cantidad antes de continuar.');
      await write((await lines()).map((line) => line.variant_id === variantId ? { ...line, quantity } : line).filter((line) => line.quantity > 0));
    }),
    mergeLines: () => serial(async () => mergePayload(await lines())),
    clear: () => serial(async () => { await lines(); await write([]); }),
    reserveMerge: (actorId: string, newKey: () => string) => serial(async (): Promise<GuestMergeReservation | null> => {
      if (!actorId) throw new Error('Inicia sesión para continuar.');
      const all = await savedReservations();
      const pending = all.find(item => item.actorId === actorId);
      if (pending) return pending;
      const current = await lines();
      if (!current.length) return null;
      const sourceJson = await storage.getItem(KEY) ?? '[]';
      const batches: GuestMergeReservation[] = [];
      for (let i = 0; i < current.length; i += 50) {
        const key = newKey();
        if (key.length < 8 || key.length > 80 || [...all, ...batches].some(item => item.actorId === actorId && item.key === key))
          throw new Error('No pudimos preparar la operación.');
        const batch = current.slice(i, i + 50);
        batches.push({ version: 1, operation: 'cart.merge', actorId, key, stage: 'staging', lines: batch,
          sourceJson, payloadJson: canonicalIntentPayload(mergePayload(batch)) });
      }
      // Bind every existing line to this actor before detaching it; later actors claim only new guest lines.
      await saveReservations([...all, ...batches]);
      await storage.setItem(KEY, '[]');
      batches.forEach(item => { item.stage = 'ready'; });
      await saveReservations([...all, ...batches]);
      notify([]);
      return batches[0]!;
    }),
    completeMerge: (expected: GuestMergeReservation) => serial(async () => {
      const all = await savedReservations();
      const current = all.find(item => item.actorId === expected.actorId && item.key === expected.key);
      if (!current || current.payloadJson !== expected.payloadJson) return false;
      await saveReservations(all.filter(item => item !== current));
      // Other accounts' reservations and new guest lines remain separate.
      return true;
    }),
    refresh: () => serial(async () => { const next = await lines(); notify(next); return next; }),

  };
}
