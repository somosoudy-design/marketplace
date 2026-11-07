import { canonicalIntentPayload, type IntentStorage, type ProductCondition } from '@kora/core';

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
const RESERVED = 'mayami.guest-merge-reservation.v1';
const mergePayload = (lines: GuestLine[]) => lines.map(({ variant_id, quantity }) => ({ variant_id, quantity }));
function validLines(value: unknown): value is GuestLine[] {
  return Array.isArray(value) && value.every((line) => line && typeof line === 'object' && typeof line.variant_id === 'string' &&
    typeof line.product_id === 'string' && Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 100);
}
function reservation(raw: string): GuestMergeReservation {
  const r = JSON.parse(raw) as GuestMergeReservation;
  if (!r || r.version !== 1 || r.operation !== 'cart.merge' || !r.actorId || typeof r.key !== 'string' || r.key.length < 8 || r.key.length > 80 ||
      !['staging', 'ready'].includes(r.stage) || !validLines(r.lines) || !r.lines.length || typeof r.sourceJson !== 'string' ||
      r.payloadJson !== canonicalIntentPayload(mergePayload(r.lines))) throw new Error('No pudimos recuperar el carrito pendiente. Conservamos sus datos.');
  return r;
}

/** Injected storage lets the integrator test crash/retry behavior without native modules. */
export function createGuestCart(storage: IntentStorage) {
  const listeners = new Set<(lines: GuestLine[]) => void>();
  let queue: Promise<unknown> = Promise.resolve();
  async function serial<T>(fn: () => Promise<T>) {
    const next = queue.catch(() => undefined).then(fn); queue = next; return next;
  }
  const notify = (lines: GuestLine[]) => listeners.forEach((listener) => listener(lines.map((line) => ({ ...line }))));
  async function savedReservation() {
    const raw = await storage.getItem(RESERVED);
    if (!raw) return null;
    const r = reservation(raw);
    if (r.stage === 'staging') {
      // Write-ahead record was durable before the old array was cleared. No request
      // can be sent until ready; recover either crash window before exposing lines.
      const plain = await storage.getItem(KEY) ?? '[]';
      if (plain !== r.sourceJson && plain !== '[]') throw new Error('El carrito local cambió durante una recuperación. Conservamos ambas copias.');
      if (plain !== '[]') await storage.setItem(KEY, '[]');
      r.stage = 'ready';
      await storage.setItem(RESERVED, JSON.stringify(r));
      notify([]);
    }
    return r;
  }
  async function lines() {
    await savedReservation();
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
      const pending = await savedReservation();
      return pending?.actorId === actorId ? { ...pending, lines: pending.lines.map(line => ({ ...line })) } : null;
    }),
    replaceCancelledMerge: (expected: GuestMergeReservation, remainingIds: string[], newKey: () => string, confirmation: { state: string; operation: string }) => serial(async () => {
      if (confirmation.state !== 'cancelled' || confirmation.operation !== 'merge') throw new Error('Falta confirmar la cancelación anterior.');
      const current = await savedReservation();
      if (!current || current.actorId !== expected.actorId || current.key !== expected.key || current.payloadJson !== expected.payloadJson) throw new Error('El carrito pendiente cambió. Actualiza antes de continuar.');
      if (new Set(remainingIds).size !== remainingIds.length || remainingIds.some(id => !current.lines.some(line => line.variant_id === id))) throw new Error('Revisa los productos pendientes.');
      const remaining = current.lines.filter(line => remainingIds.includes(line.variant_id));
      if (!remaining.length) { await storage.removeItem(RESERVED); return null; }
      const key = newKey();
      if (key.length < 8 || key.length > 80 || key === current.key) throw new Error('No pudimos preparar la operación nueva.');
      const replacement: GuestMergeReservation = { ...current, key, stage: 'ready', lines: remaining, payloadJson: canonicalIntentPayload(mergePayload(remaining)) };
      // One atomic storage entry replaces the confirmed-cancelled operation; new guest lines stay separate.
      await storage.setItem(RESERVED, JSON.stringify(replacement));
      return replacement;
    }),
    subscribe(listener: (lines: GuestLine[]) => void) { listeners.add(listener); return () => void listeners.delete(listener); },
    add: (line: GuestLine) => serial(async () => {
      const current = await lines(), index = current.findIndex((item) => item.variant_id === line.variant_id);
      if (index >= 0) current[index] = { ...current[index]!, quantity: Math.min(current[index]!.quantity + line.quantity, 20) };
      else current.push({ ...line });
      await write(current);
    }),
    setQuantity: (variantId: string, quantity: number) => serial(async () => {
      await write((await lines()).map((line) => line.variant_id === variantId ? { ...line, quantity } : line).filter((line) => line.quantity > 0));
    }),
    mergeLines: () => serial(async () => mergePayload(await lines())),
    clear: () => serial(async () => { await lines(); await write([]); }),
    reserveMerge: (actorId: string, newKey: () => string) => serial(async (): Promise<GuestMergeReservation | null> => {
      if (!actorId) throw new Error('Inicia sesión para continuar.');
      const pending = await savedReservation();
      if (pending) {
        if (pending.actorId !== actorId) throw Object.assign(new Error('Hay un carrito pendiente de otra cuenta en este dispositivo. Conservamos tus productos nuevos.'), { code: 'foreign_guest_merge' });
        return pending;
      }
      const current = await lines();
      if (!current.length) return null;
      const key = newKey();
      if (key.length < 8 || key.length > 80) throw new Error('No pudimos preparar la operación.');
      const r: GuestMergeReservation = { version: 1, operation: 'cart.merge', actorId, key, stage: 'staging', lines: current,
        sourceJson: await storage.getItem(KEY) ?? '[]', payloadJson: canonicalIntentPayload(mergePayload(current)) };
      await storage.setItem(RESERVED, JSON.stringify(r));
      await storage.setItem(KEY, '[]');
      r.stage = 'ready';
      await storage.setItem(RESERVED, JSON.stringify(r));
      notify([]);
      return r;
    }),
    completeMerge: (expected: GuestMergeReservation) => serial(async () => {
      const current = await savedReservation();
      if (!current || current.actorId !== expected.actorId || current.key !== expected.key || current.payloadJson !== expected.payloadJson) return false;
      await storage.removeItem(RESERVED);
      // New guest lines are a different operation and are never cleared here.
      return true;
    }),
  };
}
