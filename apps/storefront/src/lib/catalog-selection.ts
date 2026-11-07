import type { CatalogMetadata, ProductDetail } from '@kora/api';
import type { ProductSelectionInput, SelectionImage } from '@kora/core';

/** Build one coherent selection solely from the explicit metadata response. */
export function reviewedSelectionInput(product: Pick<ProductDetail, 'availability'> & Partial<Pick<ProductDetail, 'max_per_order' | 'images'>>, metadata: CatalogMetadata): ProductSelectionInput {
  const images = new Map<string, SelectionImage>();
  for (const image of product.images ?? []) if (image.id) images.set(image.id, image);
  for (const variant of metadata.variants) for (const image of variant.images) images.set(image.id, image);
  return {
    availability: product.availability,
    // Cards use this only to select their preview. Their quantity/purchase is decided in the detail/checkout.
    max_per_order: product.max_per_order ?? 1,
    condition: metadata.condition,
    variants: metadata.variants.map(v => ({ ...v, id: v.variant_id })),
    images: [...(product.images ?? []).filter(image => !image.id), ...images.values()],
    variant_image_links: metadata.variants.flatMap(v => v.images.map(image => ({ variant_id: v.variant_id, image_id: image.id, sort: image.sort }))),
  };
}

/** Enrich an already selected batch; this is never a global filter or a pagination substitute. */
export async function catalogMetadataMap(ids: readonly string[], read: (ids: string[]) => Promise<CatalogMetadata[]>) {
  const unique = [...new Set(ids)];
  const rows: CatalogMetadata[] = [];
  for (let start = 0; start < unique.length; start += 100) rows.push(...await read(unique.slice(start, start + 100)));
  return Object.fromEntries(rows.map(row => [row.product_id, row]));
}
