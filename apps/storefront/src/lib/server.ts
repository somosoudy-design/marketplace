import { cache } from 'react';
import { createApi, createKoraClient } from '@kora/api';
import { env, configured } from './env';
import { catalogMetadataMap } from './catalog-selection';
/** New anonymous client per server read. No browser credentials or private response cache. */
export function publicApi() {
  if (!configured) throw new Error('Falta configurar la conexión del sitio.');
  return createApi(
    createKoraClient({
      url: env.url,
      anonKey: env.anon,
      detectSessionInUrl: false,
      retryReads: false,
      storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    }),
  );
}

/** React resets this memoization for each server request. No session or persistent catalog cache. */
export const publicProduct = cache(async (slug: string) => {
  const api = publicApi();
  const id = await api.catalog.productIdBySlug(slug);
  return id ? api.catalog.productCommercial(id) : null;
});

/** Reviewed, anonymous SSR enrichment; failures propagate instead of hiding an absent RPC. */
export const publicCatalogMetadata = (ids: readonly string[]) => catalogMetadataMap(ids, publicApi().catalog.metadata);
