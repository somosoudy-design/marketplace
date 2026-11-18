import Link from 'next/link';
import { ArrowUpRight, Cable, Cross, Headphones, House, Laptop, PawPrint, ShoppingBag, Sparkles, type LucideIcon } from 'lucide-react';
import { StoreAvatar } from '@/components/store-avatar';
import { publicApi } from '@/lib/server';
import { productSharePath } from '@/lib/product-link';
import { HomeCampaigns } from '@/components/home-campaigns';
import { ProductPhoto } from '@/components/photo';
import { Failure } from '@/components/states';
import { readDiscovery } from '@/lib/discovery-server';
import { DiscoveryFeed } from '@/components/discovery-feed';
import { categoryNavigationMask } from '@/lib/category-navigation-art';
const categoryIcons = new Map<string, LucideIcon>([
  ['tecnologia', Laptop], ['audio', Headphones], ['belleza', Sparkles], ['odontologia', Cross],
  ['hogar', House], ['mascotas', PawPrint], ['accesorios', Cable],
]);

const featuredTabletId = 'b1b4a794-c740-47e9-ae57-1c1e3089b80d';

export const dynamic = 'force-dynamic';
export default async function Home() {
  let home;
  let tablet;
  try {
    const catalog = publicApi().catalog;
    [home, tablet] = await Promise.all([
      catalog.home(),
      catalog.cardsByIds([featuredTabletId]).then(([product]) => product).catch(() => undefined),
    ]);
  } catch {
    return <Failure />;
  }
  const seed = crypto.randomUUID();
  let discovery;
  try {
    discovery = await readDiscovery(seed, 0);
  } catch {
    return <Failure message="No pudimos cargar los productos." />;
  }
  const products = discovery.products;
  const tabletHref = tablet?.moderation_status === 'published' && tablet.store_status === 'active'
    ? productSharePath(tablet.slug, undefined, tablet.id)
    : undefined;
  return (
    <>
      <div className="wrap market-home">
        <HomeCampaigns categories={home.categories} tabletHref={tabletHref} />
        <div className="home-categories">
          <nav className="market-category-feature" aria-label="Categorías">
            {home.categories.map((c) => {
              const CategoryIcon = categoryIcons.get(c.slug) ?? ShoppingBag;
              const product = products.find((p) => p.image_path && p.category_id === c.id);
              const photoPath =
                product?.image_path ?? (c.image_path && !c.image_path.startsWith('demo/') ? c.image_path : null);
              return (
                <Link
                  prefetch={false}
                  key={c.id}
                  className="market-category-tile"
                  href={`/buscar?category=${encodeURIComponent(c.slug)}`}
                >
                  <div className="market-category-art" aria-hidden="true">
                    {photoPath ? (
                      <ProductPhoto
                        id={product?.id ?? c.id}
                        path={photoPath}
                        demo={product?.is_demo ?? false}
                        exact
                        title=""
                        alphaMask={categoryNavigationMask(c.slug, photoPath)}
                      />
                    ) : (
                      <CategoryIcon className="market-category-icon" size={36} aria-hidden="true" />
                    )}
                  </div>
                  <h2>{c.name}</h2>
                </Link>
              );
            })}
          </nav>
        </div>
        <DiscoveryFeed key={seed} initial={discovery} seed={seed} />
        {home.stores.length > 0 && (
          <section className="catalog-section">
            <div className="section-heading">
              <h2>Descubre nuestras tiendas</h2>
            </div>
            <div className="store-list">
              {home.stores.slice(0, 6).map((s) => (
                <Link prefetch={false} key={s.id} href={`/buscar?store=${s.slug}`}>
                  <StoreAvatar id={s.id} name={s.name} path={s.logo_path} />
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
