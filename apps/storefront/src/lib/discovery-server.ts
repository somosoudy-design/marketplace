import 'server-only';
import { publicApi, publicCatalogMetadata } from './server';
import { DISCOVERY_BATCH, DISCOVERY_WINDOW, discoveryWindow } from './discovery';
export async function readDiscovery(seed: string, offset: number, savedWindow?: string[]) {
  const api = publicApi();
  const within = offset % DISCOVERY_WINDOW;
  // Only identifiers cross requests, never cached prices, stock or visibility.
  // A window is read once per visit; changes in ranking cannot reshuffle its next pages.
  const windowIds = savedWindow ?? discoveryWindow(await api.catalog.search({sort:'popular',limit:DISCOVERY_WINDOW,offset}),seed).map(p=>p.id);
  const selectedIds = windowIds.slice(within,within + DISCOVERY_BATCH);
  const rows = selectedIds.length ? await api.catalog.cardsByIds(selectedIds) : [];
  const products = rows.filter(p=>p.moderation_status==='published' && p.store_status==='active');
  const metadata = await publicCatalogMetadata(products.map(p=>p.id));
  return {products:products.filter(p=>metadata[p.id]),metadata,windowIds,next:offset + DISCOVERY_BATCH,hasMore:within + DISCOVERY_BATCH < windowIds.length || windowIds.length===DISCOVERY_WINDOW};
}
