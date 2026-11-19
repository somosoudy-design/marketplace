import type { CatalogMetadata, ProductCard } from '@kora/api';
import { catalogMetadataMap } from './catalog-selection';
export async function favoriteProductsForIds(ids: string[], catalog: { cardsByIds: (ids: string[]) => Promise<ProductCard[]>; metadata: (ids: string[]) => Promise<CatalogMetadata[]> }) {
  const unique = [...new Set(ids)], rows: ProductCard[] = [];
  for (let start = 0; start < unique.length; start += 50) rows.push(...await catalog.cardsByIds(unique.slice(start, start + 50)));
  const order = new Map(unique.map((id, index) => [id, index]));
  const products = [...new Map(rows.map(row => [row.id, row])).values()].sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  return { products, metadata: await catalogMetadataMap(products.map(p => p.id), catalog.metadata) };
}
