import { StoreIdentity } from './store-badge';
import Link from 'next/link';
import type { CatalogMetadata, ProductCard as Product } from '@kora/api';
import { productColorSummaries, publicStorePath, resolveProductSelection } from '@kora/core';
import { ProductPhoto } from './photo';
import { ColorDot } from './color-dot';
import { Favorite } from './favorite';
import { OfferStatus } from './offer';
import { CatalogPrice } from './catalog-price';
import { catalogText, catalogSample, localExhibition } from '@/lib/photos';
import { reviewedSelectionInput } from '@/lib/catalog-selection';

export function ProductCard({ product, metadata, priority = false }: { product: Product; metadata: CatalogMetadata; priority?: boolean }) {
  const input = reviewedSelectionInput(product, metadata);
  const selected = resolveProductSelection(input);
  const colors = productColorSummaries(input.variants);
  const href = (id?: string | null) => `/p/${product.slug}${id ? `?variant=${encodeURIComponent(id)}` : ''}`;
  const price = selected.price_usd;
  const general = selected.mediaState === 'unclassified';
  const path = !selected.variant ? null : selected.cover?.path ?? (general ? metadata.general_images?.[0]?.path ?? null : null);
  const title = catalogText(product.title, product.is_demo, product.id);
  const store = { id: product.store_id, name: product.store_name, kind: product.store_kind, status: product.store_status };
  return (
    <article className="product-card" data-testid="product-card">
      <div className="product-card-content">
        <div className="product-card-media">
          <ProductPhoto id={product.id} path={path} demo={product.is_demo} title={product.title} priority={priority} exact />
          <OfferStatus overlay availability={product.availability} stock={selected.variant?.stock} issue={selected.variant?.active ? undefined : 'unavailable'} />
        </div>
        <div className="product-copy">
          <h3><Link prefetch={false} href={href(selected.selectedVariantId)} className="product-link">{title}</Link></h3>
          <div className="product-brand">
            <StoreIdentity store={store} href={product.store_slug ? publicStorePath({ id: product.store_id, slug: product.store_slug }) : undefined} />
          </div>
          <div className="product-price">
            <CatalogPrice usd={price} compareAt={product.is_demo ? null : product.compare_at_usd} />
          </div>
          {selected.conditionLabel && <span className="availability" data-testid="product-condition">{selected.conditionLabel}</span>}
          {catalogSample(product.id, product.is_demo) && !localExhibition && <span className="availability">Producto de muestra</span>}
        </div>
      </div>
      {colors.length > 0 && <nav className="product-colors" aria-label={`Colores de ${product.title}`}>
        {colors.map(color => <Link prefetch={false} key={color.value} href={href(color.available_variant_ids[0] ?? color.variant_ids[0])} aria-label={`Color ${color.value}${color.available_variant_ids.length ? '' : ', agotado'}`}><ColorDot label={color.value} />{color.value}{!color.available_variant_ids.length && <span> · Agotado</span>}</Link>)}
      </nav>}
      <Favorite id={product.id} title={product.title} />
    </article>
  );
}

/** Metadata may omit a product that became hidden after the first catalogue read. */
export function ProductGrid({ products, metadata, eager = true }: { products: Product[]; metadata: Record<string, CatalogMetadata>; eager?: boolean }) {
  return <div className="product-grid">{products.map((p, i) => metadata[p.id] ? <ProductCard key={p.id} product={p} metadata={metadata[p.id]!} priority={eager && i < 6} /> : null)}</div>;
}
