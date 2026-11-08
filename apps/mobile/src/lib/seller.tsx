import type { Store } from '@kora/api';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { useAuth } from './auth';
import { api } from './supabase';

/** Navigation hints come from real server rows. RLS/RPC still authorize every subsequent read. */
export function useSellerAccess() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['seller-access', user?.id],
    queryFn: async () => {
      const [memberships, roles] = await Promise.all([api.account.stores(user!.id), api.account.roles(user!.id)]);
      return { stores: memberships.map((m) => m.stores).filter((s): s is Store => !!s).sort((a, b) => a.name.localeCompare(b.name)),
        isAdmin: roles.some(({ role }) => role === 'admin' || role === 'superadmin') };
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

const SellerContext = createContext<{
  access: ReturnType<typeof useSellerAccess>;
  store: Store | null;
  selectStore: (id: string) => void;
} | null>(null);

export function SellerProvider({ children }: { children: ReactNode }) {
  const access = useSellerAccess();
  const [selected, setSelected] = useState<string | null>(null);
  const stores = access.data?.stores ?? [];
  // No arbitrary URL/store id can select an unauthorized store. Errors fail closed, even with cached rows.
  const store = access.isError ? null : stores.find((s) => s.id === selected) ?? stores[0] ?? null;
  return <SellerContext.Provider value={{ access, store, selectStore: setSelected }}>{children}</SellerContext.Provider>;
}

export function useSeller() {
  const value = useContext(SellerContext);
  if (!value) throw new Error('SellerProvider missing');
  return value;
}
