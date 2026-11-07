import Link from 'next/link';
import { ArrowRight, ArrowUpRight, ShoppingBag } from 'lucide-react';
import { publicApi, publicCatalogMetadata } from '@/lib/server';
import { ProductGrid } from '@/components/product-card';
import { ProductBanner } from '@/components/product-banner';
import { ProductPhoto } from '@/components/photo';
import { Failure } from '@/components/states';
import { catalogText } from '@/lib/photos';
export const dynamic = 'force-dynamic';
export default async function Home() {
  let home;
  try {
    home = await publicApi().catalog.home();
  } catch {
    return <Failure />;
  }
  const products = [
    ...new Map([...home.recommended, ...home.collections.flatMap((c) => c.products)].map((p) => [p.id, p])).values(),
  ];
  const featured = products.slice(0, 6);
  const seen = new Set(featured.map((p) => p.id));
  const collections = home.collections
    .filter((c) => c.products.length > 0)
    .slice(0, 3)
    .map((c) => {
      const unique = c.products.filter((p) => !seen.has(p.id)).slice(0, 6);
      unique.forEach((p) => seen.add(p.id));
      return { ...c, unique };
    });
  let metadata;
  try { metadata = await publicCatalogMetadata([...featured, ...collections.flatMap(c => c.unique)].map(p => p.id)); } catch { return <Failure message="No pudimos cargar las opciones del catálogo." />; }
  return (
    <>
      <div className="wrap market-home">
        <section className="market-discovery" aria-label="Descubre Mayami">
          <ProductBanner products={products} metadata={metadata} />
          <nav className="market-category-feature" aria-label="Categorías">
            {home.categories.map((c) => {
              const product = products.find(p => p.image_path && p.category_id === c.id);
              const photoPath = product?.image_path ?? (c.image_path && !c.image_path.startsWith('demo/') ? c.image_path : null);
              return (
                <Link prefetch={false} key={c.id} className="market-category-tile" href={`/buscar?category=${c.slug}`}>
                  <div>
                    <h2>{c.name}</h2>
                    <span>
                      Ver productos <ArrowRight size={16} />
                    </span>
                  </div>
                  {photoPath ? (
                    <ProductPhoto id={product?.id ?? c.id} path={photoPath} demo={product?.is_demo ?? false} exact title="" />
                  ) : (
                    <ShoppingBag className="market-category-icon" size={36} aria-hidden="true" />
                  )}
                </Link>
              );
            })}
          </nav>
        </section>
        <nav className="market-category-nav" aria-label="Más categorías">
          {home.categories.slice(4).map((c) => (
            <Link prefetch={false} key={c.id} href={`/buscar?category=${c.slug}`}>
              {c.name}
              <ArrowUpRight size={15} />
            </Link>
          ))}
        </nav>
        <section className="catalog-section market-featured">
          <div className="section-heading">
            <div>
              <span className="eyebrow">SELECCIÓN MAYAMI</span>
              <h2>Productos destacados</h2>
            </div>
            <Link prefetch={false} href="/buscar">
              Ver todo <ArrowRight size={17} />
            </Link>
          </div>
          <ProductGrid products={featured} metadata={metadata} />
        </section>
        <div className="market-collections">
          {collections.map((c) => (
            <section
              className={`catalog-section market-collection${c.unique.length > 3 ? ' market-collection-wide' : ''}`}
              key={c.id}
            >
              <div className="section-heading">
                <div>
                  <h2>{catalogText(c.title, true)}</h2>
                  {c.subtitle && <p>{catalogText(c.subtitle, true)}</p>}
                </div>
                <Link prefetch={false} href={`/buscar?collection=${encodeURIComponent(c.slug)}`}>
                  Ver colección <ArrowRight size={17} />
                </Link>
              </div>
              {c.unique.length > 0 && <ProductGrid products={c.unique} metadata={metadata} />}
            </section>
          ))}
        </div>
        {home.stores.length > 0 && (
          <section className="catalog-section">
            <div className="section-heading">
              <h2>Descubre nuestras tiendas</h2>
            </div>
            <div className="store-list">
              {home.stores.slice(0, 6).map((s) => (
                <Link prefetch={false} key={s.id} href={`/buscar?store=${s.slug}`}>
                  <span className="store-initial">{s.name.slice(0, 1)}</span>
                  <div>
                    <h3>{s.name}</h3>
                    {s.tagline && <p>{s.tagline}</p>}
                  </div>
                  <ArrowUpRight size={16} />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
