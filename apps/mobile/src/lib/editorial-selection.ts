import type { CatalogMetadata, ProductCard } from '@kora/api';
import { presentAvailability, resolveProductSelection } from '@kora/core';
import { reviewedGeneralProductImages } from './selection-media';

/** One explicit preview selection supplies hero price, image and destination together. */
export function reviewedEditorialPreview(product: ProductCard, metadata: CatalogMetadata | null | undefined) {
  const variants = metadata?.variants.map(variant => ({ ...variant, id: variant.variant_id })) ?? [];
  const images = metadata?.variants.flatMap(variant => variant.images) ?? [];
  const selection = resolveProductSelection({ availability: product.availability, max_per_order: 1, condition: metadata?.condition,
    variants, images, variant_image_links: metadata?.variants.flatMap(variant => variant.images.map(image => ({ variant_id: variant.variant_id, image_id: image.id, sort: image.sort }))) ?? [] });
  const variant = selection.variant;
  const price = variant && Number.isFinite(variant.price_usd) && variant.price_usd > 0 ? variant.price_usd : null;
  const general = selection.mediaState === 'unclassified';
  const generalImages = reviewedGeneralProductImages(metadata ?? {}, images);
  const imagePath = !variant ? null : selection.cover?.path ?? (general ? generalImages[0]?.path ?? null : null);
  return { variantId: price == null ? undefined : variant?.id, variantTitle: variant ? metadata?.variants.find(row => row.variant_id === variant.id)?.title ?? null : null,
    price, imagePath, generalImage: general && !!imagePath, multipleVariants: variants.length > 1,
    availability: presentAvailability(!variant || price == null ? 'unavailable' : variant.stock != null && variant.stock <= 0 ? 'sold_out' : product.availability) };
}
