import type { Api } from './api';

export class UgcActorChangedError extends Error {
  readonly code = 'actor_changed';
  constructor() { super('La cuenta cambió. Vuelve a abrir esta opción.'); }
}

/** Invalidates an old A operation even after an A → B → A round trip. */
export function createUgcEpoch(initial: string | null) {
  let owner = initial, epoch = 0;
  return {
    update(next: string | null) { if (owner !== next) { owner = next; epoch++; } },
    capture() { const expected = epoch; return () => expected === epoch; },
  };
}
/** Updated by auth events, so batched React renders cannot miss A → B → A. */
export function createUgcOwnerStore() {
  let value: { actor: string | null | undefined; revision: number } = { actor: undefined, revision: 0 };
  const listeners = new Set<() => void>();
  return {
    snapshot: () => value,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    update(actor: string | null) {
      if (value.actor === actor) return;
      value = { actor, revision: value.revision + 1 };
      // Do not cause SDK work while a Supabase auth callback still owns its lock.
      setTimeout(() => listeners.forEach(listener => listener()), 0);
    },
  };
}
export async function runUgcActor<T>(actor: string | null, current: () => boolean,
  capture: (id: string) => Promise<{ api: Api; assertCurrent: () => Promise<void> }>,
  operation: (api: Api, check: () => Promise<void>) => Promise<T>): Promise<T> {
  if (!actor || !current()) throw new UgcActorChangedError();
  const bound = await capture(actor);
  const check = async () => { if (!current()) throw new UgcActorChangedError(); await bound.assertCurrent(); if (!current()) throw new UgcActorChangedError(); };
  await check(); const result = await operation(bound.api, check); await check(); return result;
}

type Notice = { kind?: unknown; title?: unknown; body?: unknown; data?: unknown };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function isUgcNotice(value: unknown): value is Notice {
  const n = value as Notice | null;
  return !!n && n.kind === 'system' && !!n.data && typeof n.data === 'object' && 'review_id' in n.data;
}
/** Old queued UGC excerpts may arrive after an upgrade. Keep transactional banners unchanged. */
export function allowUgcForeground(content: { body?: string | null; data?: Record<string, unknown> }) {
  const data = content.data ?? {};
  return !isUgcNotice({ kind: data.kind, data }) || content.body === 'Consulta la respuesta desde la ficha del producto.';
}
/** Strip UGC excerpts only. Payment/claim notices and all their fields keep their identity. */
export function sanitizeUgcNoticeData<T>(value: T): T {
  if (isUgcNotice(value)) {
    const data = value.data as Record<string, unknown>;
    const safe: Record<string, string> = {};
    for (const key of ['review_id', 'product_id']) if (typeof data[key] === 'string' && uuid.test(data[key])) safe[key] = data[key];
    return { ...value, title: 'La tienda respondió tu opinión', body: 'Consulta la respuesta desde la ficha del producto.', data: safe } as T;
  }
  if (Array.isArray(value)) return value.map(sanitizeUgcNoticeData) as T;
  if (value && typeof value === 'object') {
    // React Query infinite pages and NotificationPage.items. Do not traverse arbitrary financial data.
    const object = value as Record<string, unknown>;
    for (const key of ['pages', 'items']) if (Array.isArray(object[key])) return { ...object, [key]: sanitizeUgcNoticeData(object[key]) } as T;
  }
  return value;
}

type CachedQuery = { queryKey: readonly unknown[]; state: { data?: unknown } };
/** Surgical upgrade: forget old UGC views, preserve other private/offline data, sanitize only review notices. */
export function migrateUgcQueries<T extends CachedQuery>(queries: T[]): T[] {
  return queries.filter(q => !['reviews', 'store', 'ugc-state'].includes(String(q.queryKey[0])))
    .map(q => q.queryKey[0] === 'notifications' ? { ...q, state: { ...q.state, data: sanitizeUgcNoticeData(q.state.data) } } : q);
}
