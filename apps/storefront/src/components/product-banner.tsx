import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { CatalogMetadata, ProductCard } from '@kora/api';
import { bannerTitle, presentAvailability, resolveProductSelection, variantDisplayTitle } from '@kora/core';
import { reviewedSelectionInput } from '@/lib/catalog-selection';
import { money } from '@/lib/format';
import { ProductPhoto } from './photo';
import './product-spotlight.css';

/** Server-rendered merchandise, with one selected variant supplying price, photograph and destination. */
export function selectBannerProduct(products: ProductCard[], metadata: Record<string, CatalogMetadata>, previousCategory?: string | null) {
  const candidates = products.flatMap(product => {
    const details = metadata[product.id];
    if (!details) return [];
    const input = reviewedSelectionInput(product, details);
    const selection = resolveProductSelection(input);
    const path = selection.cover?.path ?? (selection.mediaState === 'unclassified' ? details.general_images?.[0]?.path : null);
    if (!selection.variant || !selection.canBuy || selection.price_usd == null || !path) return [];
    const selectedMetadata = details.variants.find(v => v.variant_id === selection.selectedVariantId);
    const option = variantDisplayTitle(selectedMetadata?.title, selectedMetadata?.options);
    return [{ product, selection, path, option, single: input.variants.filter(v => v.active).length === 1 }];
  });
  const singles = candidates.filter(candidate => candidate.single);
  const eligible = singles.length ? singles : candidates;
  return eligible.find(({ product }) => product.category_slug !== previousCategory) ?? eligible[0];
}
type Spotlight = NonNullable<ReturnType<typeof selectBannerProduct>>;

export function ProductBanner({ chosen }: { chosen: Spotlight }) {
  const { product, selection, path, option, single } = chosen;
  const variant = selection.selectedVariantId!;
  const availability = presentAvailability(product.availability).label;
  const price = money(selection.price_usd!);
  return (
    <article className="feed-highlight" data-testid="storefront-product-banner">
      <Link prefetch={false} className="feed-highlight-link"
        href={`/p/${product.slug}?variant=${encodeURIComponent(variant)}`}>
        <div className="feed-highlight-photo" aria-hidden="true">
          <ProductPhoto id={product.id} path={path} demo={product.is_demo} variant={variant} exact title="" />
        </div>
        <div className="feed-highlight-name">
          <h2 data-testid="banner-product-title" title={product.title}>{bannerTitle(product.title)}</h2>
          {option && <span className="feed-highlight-option">{option}</span>}
          {!single && selection.mediaState === 'unclassified' && <small>Foto general</small>}
        </div>
        <div className="feed-highlight-details">
          <strong data-testid="banner-product-price">{price}</strong>
          <span>{availability}</span>
        </div>
        <span className="feed-highlight-action"><span>Ver producto</span><ArrowRight size={18} aria-hidden="true" /></span>
      </Link>
    </article>
  );
}
