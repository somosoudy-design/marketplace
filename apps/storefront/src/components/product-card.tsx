import Link from 'next/link';
import type { ProductCard as Product } from '@kora/api';
import { presentAvailability } from '@kora/core';
import { ProductPhoto } from './photo';
import { Favorite } from './favorite';
import { money } from '@/lib/format';
import { catalogText, localExhibition } from '@/lib/photos';
export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const availability = presentAvailability(product.availability);
  return (
    <article className="product-card" data-testid="product-card">
      <Link href={`/p/${product.slug}`} className="product-link">
        <ProductPhoto
          id={product.id}
          path={product.image_path}
          demo={product.is_demo}
          title={product.title}
          priority={priority}
        />
        <div className="product-copy">
          <span className="product-brand">{product.brand_name || product.store_name}</span>
          <h3>{catalogText(product.title, product.is_demo)}</h3>
          <div className="product-price">
            <strong>{money(product.price_usd)}</strong>
            {!product.is_demo && product.compare_at_usd != null && product.compare_at_usd > product.price_usd && (
              <del>{money(product.compare_at_usd)}</del>
            )}
          </div>
          {product.availability !== 'available' && <span className="availability">{availability.label}</span>}
          {product.is_demo && !localExhibition && <span className="availability">Producto de muestra</span>}
        </div>
      </Link>
      <Favorite id={product.id} title={product.title} />
    </article>
  );
}
export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="product-grid">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < 6} />
      ))}
    </div>
  );
}
