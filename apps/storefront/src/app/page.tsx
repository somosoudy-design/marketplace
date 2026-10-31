import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { publicApi } from '@/lib/server';
import { ProductGrid } from '@/components/product-card';
import { ProductPhoto } from '@/components/photo';
import { Failure } from '@/components/states';
import { money } from '@/lib/format';
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
    ...new Map([...home.collections.flatMap((c) => c.products), ...home.recommended].map((p) => [p.id, p])).values(),
  ];
  const lead = products.find((p) => p.availability === 'available') ?? products[0];
  return (
    <>
      <section className="editorial">
        <div className="wrap editorial-inner">
          <div className="editorial-copy">
            <span className="eyebrow">ENCUENTRA TU PRÓXIMO FAVORITO</span>
            <h1>
              Buenos hallazgos.
              <br />
              Todos los días.
            </h1>
            <p>
              Tecnología, belleza y mucho más.
              <br />
              Explora las tiendas y encuentra lo tuyo.
            </p>
            <Link className="button inverse" href="/buscar">
              Explorar el catálogo <ArrowRight size={18} />
            </Link>
          </div>
          {lead && (
            <Link href={`/p/${lead.slug}`} className="editorial-product">
              <ProductPhoto id={lead.id} path={lead.image_path} demo={lead.is_demo} title={lead.title} priority />
              <div>
                <span>{lead.brand_name || lead.category_name}</span>
                <h2>{catalogText(lead.title, lead.is_demo)}</h2>
                <strong>{money(lead.price_usd)}</strong>
                <ArrowUpRight size={22} />
              </div>
            </Link>
          )}
        </div>
      </section>
      <div className="wrap">
        <nav className="category-strip" aria-label="Categorías">
          {home.categories.map((c, i) => (
            <Link key={c.id} href={`/buscar?category=${c.slug}`}>
              <span className="category-number">{String(i + 1).padStart(2, '0')}</span>
              <span>{c.name}</span>
              <ArrowUpRight size={16} />
            </Link>
          ))}
        </nav>
        <section className="catalog-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">EXPLORA EL CATÁLOGO</span>
              <h2>Encuentra lo que va contigo</h2>
            </div>
            <Link href="/buscar">
              Ver todo <ArrowRight size={17} />
            </Link>
          </div>
          <ProductGrid products={products.slice(0, 12)} />
        </section>
        {home.collections
          .filter((c) => c.products.length > 0)
          .slice(0, 3)
          .map((c) => (
            <section className="catalog-section" key={c.id}>
              <div className="section-heading">
                <div>
                  <h2>{catalogText(c.title, true)}</h2>
                  {c.subtitle && <p>{catalogText(c.subtitle, true)}</p>}
                </div>
                <Link href={`/buscar?collection=${encodeURIComponent(c.slug)}`}>
                  Ver colección <ArrowRight size={17} />
                </Link>
              </div>
              <ProductGrid products={c.products.slice(0, 6)} />
            </section>
          ))}
        {home.stores.length > 0 && (
          <section className="catalog-section">
            <div className="section-heading">
              <h2>Descubre nuestras tiendas</h2>
            </div>
            <div className="store-list">
              {home.stores.slice(0, 6).map((s) => (
                <Link key={s.id} href={`/buscar?store=${s.slug}`}>
                  <span className="store-initial">{s.name.slice(0, 1)}</span>
                  <div>
                    <h3>{s.name}</h3>
                    {s.tagline && <p>{s.tagline}</p>}
                  </div>
                  <ArrowUpRight size={20} />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
