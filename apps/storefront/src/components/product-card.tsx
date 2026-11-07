import Link from 'next/link';
import type { CatalogMetadata, ProductCard as Product } from '@kora/api';
import { presentAvailability, productColorSummaries, resolveProductSelection } from '@kora/core';
import { ProductPhoto } from './photo';
import { Favorite } from './favorite';
import { money } from '@/lib/format';
import { catalogText, catalogSample, localExhibition } from '@/lib/photos';
import { reviewedSelectionInput } from '@/lib/catalog-selection';

export function ProductCard({ product, metadata, priority = false }: { product: Product; metadata: CatalogMetadata; priority?: boolean }) {
  const availability = presentAvailability(product.availability);
  const input = reviewedSelectionInput(product, metadata);
  const selected = resolveProductSelection(input);
  const colors = productColorSummaries(input.variants);
  const href = (id?: string | null) => `/p/${product.slug}${id ? `?variant=${encodeURIComponent(id)}` : ''}`;
  const price = selected.price_usd;
  const general = selected.mediaState === 'unclassified';
  const path = !selected.variant ? null : selected.cover?.path ?? (general ? metadata.general_images?.[0]?.path ?? null : null);
  return (
    <article className="product-card" data-testid="product-card">
      <Link prefetch={false} href={href(selected.selectedVariantId)} className="product-link">
        <ProductPhoto id={product.id} path={path} demo={product.is_demo} title={product.title} priority={priority} exact />
        <div className="product-copy">
          <span className="product-brand">{product.brand_name || product.store_name}</span>
          <h3>{catalogText(product.title, product.is_demo, product.id)}</h3>
          <div className="product-price">
            <strong>{price == null ? 'Precio no disponible' : money(price)}</strong>
            {!product.is_demo && price != null && product.compare_at_usd != null && product.compare_at_usd > price && <del>{money(product.compare_at_usd)}</del>}
          </div>
          {selected.conditionLabel && <span className="availability" data-testid="product-condition">{selected.conditionLabel}</span>}
          {selected.variant?.stock != null && selected.variant.stock <= 0 ? <span className="availability">Esta opción está agotada</span> : product.availability !== 'available' && <span className="availability">{availability.label}</span>}
          {general && path && <span className="availability">Imagen general del producto</span>}
          {catalogSample(product.id, product.is_demo) && !localExhibition && <span className="availability">Producto de muestra</span>}
        </div>
      </Link>
      {colors.length > 0 && <nav className="product-colors" aria-label={`Colores de ${product.title}`}>
        {colors.map(color => <Link prefetch={false} key={color.value} href={href(color.available_variant_ids[0] ?? color.variant_ids[0])} aria-label={`${color.value}${color.available_variant_ids.length ? '' : ', agotado'}`}>{color.value}{!color.available_variant_ids.length && <span> · Agotado</span>}</Link>)}
      </nav>}
      <Favorite id={product.id} title={product.title} />
    </article>
  );
}

/** Metadata may omit a product that became hidden after the first catalogue read. */
export function ProductGrid({ products, metadata }: { products: Product[]; metadata: Record<string, CatalogMetadata> }) {
  return <div className="product-grid">{products.map((p, i) => metadata[p.id] ? <ProductCard key={p.id} product={p} metadata={metadata[p.id]!} priority={i < 6} /> : null)}</div>;
}
