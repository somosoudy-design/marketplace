import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { CatalogMetadata, ProductCard } from '@kora/api';
import { bannerTitle, presentAvailability, resolveProductSelection } from '@kora/core';
import { reviewedSelectionInput } from '@/lib/catalog-selection';
import { money } from '@/lib/format';
import { ProductPhoto } from './photo';

/** Server-rendered merchandise, with one selected variant supplying price, photograph and destination. */
export function ProductBanner({ products, metadata }: { products: ProductCard[]; metadata: Record<string, CatalogMetadata> }) {
  const candidates = products.flatMap(product => {
    const details = metadata[product.id];
    if (!details) return [];
    const input = reviewedSelectionInput(product, details);
    const selection = resolveProductSelection(input);
    const path = selection.cover?.path ?? (selection.mediaState === 'unclassified' ? details.general_images?.[0]?.path : null);
    if (!selection.variant || !selection.canBuy || selection.price_usd == null || !path) return [];
    return [{ product, selection, path, single: input.variants.filter(v => v.active).length === 1 }];
  });
  const chosen = candidates.find(candidate => candidate.single) ?? candidates[0];
  if (!chosen) return <section className="market-hero market-banner-empty" aria-label="Descubre Mayami"><div className="market-hero-copy"><span className="eyebrow">DESCUBRE MAYAMI</span><h1>Encuentra lo que va contigo</h1><Link prefetch={false} className="button" href="/buscar">Explorar catálogo <ArrowRight size={18} /></Link></div></section>;
  const { product, selection, path } = chosen;
  return <section className="market-hero market-product-hero" aria-label="Descubre Mayami" data-testid="storefront-product-banner">
    <Link prefetch={false} className="market-banner-link" href={`/p/${product.slug}?variant=${encodeURIComponent(selection.selectedVariantId!)}`} aria-label={`${product.title}, ${money(selection.price_usd!)}, ver producto`}>
      <div className="market-banner-media" aria-hidden="true">
        <div className="market-banner-stage"><span className="market-banner-floor" /><ProductPhoto id={product.id} path={path} demo={product.is_demo} variant={selection.selectedVariantId!} exact title="" priority /></div>
      </div>
      <div className="market-hero-copy">
        <span className="eyebrow">DESCUBRE MAYAMI</span>
        <h1 data-testid="banner-product-title">{bannerTitle(product.title)}</h1>
        {selection.mediaState === 'assigned' && !chosen.single && <span className="market-banner-option">{metadata[product.id]?.variants.find(v => v.variant_id === selection.selectedVariantId)?.title}</span>}
        <strong className="market-banner-price" data-testid="banner-product-price">{money(selection.price_usd!)}</strong>
        <p className="market-banner-availability">{presentAvailability(product.availability).label}</p>
        <span className="button">Ver producto <ArrowRight size={18} /></span>
      </div>
    </Link>
  </section>;
}
