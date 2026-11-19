'use client';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { selectedStore } from './panel-navigation';
import { useAuth } from './auth';
import { db, run } from './kora';

export interface StoreRow {
  id: string; slug: string; name: string; tagline: string | null; description: string | null; logo_path: string | null; cover_path: string | null;
  accent: string | null; kind: 'platform' | 'seller'; status: 'pending' | 'active' | 'suspended'; shipping_info: string | null;
  policies: Record<string, string> | null; contact_email: string | null; rating_avg: number | null; rating_count: number | null; is_demo: boolean;
}

const memory = new Map<string, string>();
const changed = 'mayami-panel-store-change';
function subscribe(listener: () => void) {
  window.addEventListener(changed, listener);
  return () => window.removeEventListener(changed, listener);
}
function preferredStore(userId: string | null) {
  if (!userId) return null;
  if (memory.has(userId)) return memory.get(userId)!;
  try { return localStorage.getItem('kora.panel.store:' + userId) ?? localStorage.getItem('kora.panel.store'); }
  catch { return null; }
}
function rememberStore(userId: string, id: string) {
  memory.set(userId, id);
  try { localStorage.setItem('kora.panel.store:' + userId, id); } catch { /* session-only fallback */ }
  window.dispatchEvent(new Event(changed));
}
const Ctx = createContext<{ store: StoreRow | null; stores: StoreRow[]; setStoreId: (id: string) => void; loading: boolean; error: unknown; retry: () => void } | null>(null);

/** The store a seller is working on. Membership comes from the current account; the database re-checks it on every call. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const { userId, storeIds } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const requested = path === '/vendedor/tienda' ? params.get('id') : null;
  const selected = useSyncExternalStore(subscribe, () => preferredStore(userId), () => null);
  const q = useQuery({
    queryKey: ['my-stores', userId, storeIds],
    queryFn: () => run<StoreRow[]>(db('stores').select('*').in('id', storeIds).order('name')),
    enabled: storeIds.length > 0,
  });
  const stores = q.isError ? [] : q.data ?? [];
  const store = selectedStore(stores, requested, selected);
  useEffect(() => {
    if (userId && requested && store && selected !== store.id) rememberStore(userId, store.id);
  }, [userId, requested, store, selected]);
  const setStoreId = (id: string) => {
    if (!userId || !stores.some(row => row.id === id)) return;
    rememberStore(userId, id);
    if (requested !== null) router.replace('/vendedor/tienda?id=' + encodeURIComponent(id));
  };
  return <Ctx.Provider value={{ store, stores, setStoreId, loading: q.isPending && storeIds.length > 0, error: q.error, retry: () => { void q.refetch(); } }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore must be used inside StoreProvider');
  return c;
}
