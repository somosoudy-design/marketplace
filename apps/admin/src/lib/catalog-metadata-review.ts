import type { CatalogMetadata, SellerProductReview } from '@kora/api';

/** Metadata controls must not silently accept a newer base behind the open form. */
export function catalogMetadataMatchesReview(review: SellerProductReview, metadata: CatalogMetadata) {
  const product = review.product;
  if (product.id !== metadata.product_id || product.updated_at !== metadata.updated_at || (product.condition ?? null) !== metadata.condition || product.product_variants.length !== metadata.variants.length) return false;
  if (metadata.variants.some((row) => product.product_variants.find((variant) => variant.id === row.variant_id)?.updated_at !== row.updated_at)) return false;
  const photos = new Map([...(metadata.general_images ?? []), ...metadata.variants.flatMap((variant) => variant.images)].map((photo) => [photo.id, photo]));
  return photos.size === product.product_images.length && product.product_images.every((photo) => { const current = photos.get(photo.id); return !!current && current.path === photo.path && current.alt === photo.alt && current.width === photo.width && current.height === photo.height; });
}
