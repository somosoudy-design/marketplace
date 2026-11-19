import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

// A screen can have many hearts. One store notification updates the shared query once.
const bridges = new WeakMap<QueryClient, Map<object, { readers: number; stop: () => void }>>();

/** Local disk reads work offline and surface failures instead of pretending the list is empty. */
export function useGuestState<T>(key: readonly string[], store: { read: () => Promise<T[]>; subscribe: (listener: (data: T[]) => void) => () => void }) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      try { return await store.read(); }
      catch (cause) { throw Object.assign(new Error('No pudimos leer tu selección guardada. Intenta de nuevo; conservamos sus datos.'), { code: 'local_storage', cause }); }
    },
    networkMode: 'always',
    retry: false,
    staleTime: Infinity,
    refetchOnReconnect: false,
  });
  useEffect(() => {
    let client = bridges.get(qc);
    if (!client) { client = new Map(); bridges.set(qc, client); }
    const registry = client;
    const active = registry.get(store);
    if (active) active.readers++;
    else registry.set(store, { readers: 1, stop: store.subscribe(data => qc.setQueryData(key, data)) });
    return () => {
      const entry = registry.get(store);
      if (entry && --entry.readers === 0) { entry.stop(); registry.delete(store); }
    };
  }, [store, qc, key]);
  return { ...query, data: query.data ?? [], ready: query.isSuccess, refresh: query.refetch };
}
