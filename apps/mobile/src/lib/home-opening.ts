import type { CollectionBlock, HomeFeed, ProductCard } from '@kora/api';
import { presentAvailability } from '@kora/core';

export type HomeOpening =
  | { kind: 'product'; product: ProductCard }
  | { kind: 'collection'; collection: CollectionBlock; product: ProductCard };

/** Choose live merchandise, without certifying its photograph or inventing a collection membership. */
export function selectHomeOpening(home: HomeFeed | undefined, recent: readonly ProductCard[] = []): HomeOpening | undefined {
  if (!home) return undefined;
  const liveUpload = (p: ProductCard) => p.moderation_status === 'published' && p.store_status === 'active' &&
    p.is_demo === false && !!p.image_path && !p.image_path.startsWith('demo/') &&
    Number.isFinite(p.price_usd) && p.price_usd > 0 &&
    presentAvailability(p.availability).purchasable && !(p.availability === 'available' && p.stock_total === 0);
  const product = [...recent, ...home.recommended, ...home.collections.flatMap((c) => c.products)].find(liveUpload);
  if (product) return { kind: 'product', product };

  // A failed/empty recent query still leaves every existing editorial collection usable.
  for (const collection of home.collections) {
    if (collection.layout !== 'feature') continue;
    const sample = collection.products.find((p) => p.image_path && p.availability !== 'unavailable' &&
      p.moderation_status === 'published' && p.store_status === 'active');
    if (sample) return { kind: 'collection', collection, product: sample };
  }
  return undefined;
}
