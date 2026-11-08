import { createApi, createKoraClient, type CatalogMetadata } from '@kora/api';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './auth';
import { env } from './env';
import { qk } from './query';
import { apiForActor } from './supabase';

// This is an explicit consumer of the reviewed schema. Do not publish before SQL02 is active.
// Public metadata never adopts a signed-in token that arrived after a card's request started.
const publicCatalog = () => createApi(createKoraClient({ url: env.supabaseUrl, anonKey: env.supabaseAnonKey, accessToken: env.supabaseAnonKey, retryReads: false })).catalog;
const catalogFor = async (actorId: string | null) => actorId ? (await apiForActor(actorId)).api.catalog : publicCatalog();
type Waiter = { resolve: (metadata: CatalogMetadata | null) => void; reject: (error: unknown) => void };
const pending = new Map<string, Map<string, Waiter[]>>();
let scheduled = false;
function requestMetadata(actorId: string | null, productId: string): Promise<CatalogMetadata | null> {
  return new Promise((resolve, reject) => {
    const actor = actorId ?? ''; const batch = pending.get(actor) ?? new Map<string, Waiter[]>();
    batch.set(productId, [...(batch.get(productId) ?? []), { resolve, reject }]); pending.set(actor, batch);
    if (!scheduled) { scheduled = true; setTimeout(() => { void flushMetadata(); }, 0); }
  });
}
async function flushMetadata() {
  scheduled = false; const batches = [...pending.entries()]; pending.clear();
  await Promise.all(batches.map(async ([actor, waiters]) => {
    try {
      const catalog = await catalogFor(actor || null); const ids = [...waiters.keys()];
      for (let offset = 0; offset < ids.length; offset += 100) {
        const chunk = ids.slice(offset, offset + 100); const rows = await catalog.metadata(chunk);
        const byId = new Map(rows.map(row => [row.product_id, row]));
        for (const id of chunk) for (const waiter of waiters.get(id) ?? []) waiter.resolve(byId.get(id) ?? null);
      }
    } catch (error) { for (const list of waiters.values()) for (const waiter of list) waiter.reject(error); }
  }));
}
export function useCardMetadata(productId: string) {
  const { user } = useAuth(); const actorId = user?.id ?? null;
  return useQuery({ queryKey: ['catalog-metadata', actorId, productId], queryFn: () => requestMetadata(actorId, productId), staleTime: 30_000 });
}
export function useCommercialProduct(id: string | undefined) {
  const { user } = useAuth(); const actorId = user?.id ?? null;
  return useQuery({ queryKey: [...qk.product(id ?? ''), 'commercial', actorId], enabled: !!id, queryFn: async () => (await catalogFor(actorId)).productCommercial(id!) });
}
