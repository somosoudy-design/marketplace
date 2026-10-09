'use client';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './auth';
import { db, run } from './kora';

export interface StoreRow {
  id: string; slug: string; name: string; tagline: string | null; description: string | null; logo_path: string | null; cover_path: string | null;
  accent: string | null; kind: 'platform' | 'seller'; status: 'pending' | 'active' | 'suspended'; shipping_info: string | null;
  policies: Record<string, string> | null; contact_email: string | null; rating_avg: number | null; rating_count: number | null; is_demo: boolean;
}

const KEY = 'kora.panel.store';
const Ctx = createContext<{ store: StoreRow | null; stores: StoreRow[]; setStoreId: (id: string) => void; loading: boolean } | null>(null);

/** The store a seller is working on. Membership comes from the token; the database re-checks it on every call. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const { storeIds } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['my-stores', storeIds],
    queryFn: () => run<StoreRow[]>(db('stores').select('*').in('id', storeIds).order('name')),
    enabled: storeIds.length > 0,
  });
  useEffect(() => {
    try { setSelected(localStorage.getItem(KEY)); } catch { /* storage unavailable */ }
  }, []);
  const stores = q.data ?? [];
  const store = stores.find((s) => s.id === selected) ?? stores[0] ?? null;
  const setStoreId = (id: string) => {
    setSelected(id);
    try { localStorage.setItem(KEY, id); } catch { /* storage unavailable */ }
  };
  return <Ctx.Provider value={{ store, stores, setStoreId, loading: q.isPending && storeIds.length > 0 }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore must be used inside StoreProvider');
  return c;
}
