'use client';
import { useQuery } from '@tanstack/react-query';
import { useAccount } from '@/lib/providers';
import { browser } from '@/lib/browser';
import { ProductGrid } from '@/components/product-card';
import { Empty } from '@/components/states';
export default function Favorites() {
  const { session, ready } = useAccount();
  const products = useQuery({
    queryKey: ['favorites', session?.user.id, 'products'],
    queryFn: () => browser().api.account.favoriteProducts(),
    enabled: !!session,
  });
  if (!ready || (!!session && products.isPending))
    return (
      <section className="state" role="status">
        Cargando favoritos…
      </section>
    );
  if (!session)
    return (
      <Empty
        title="Guarda tus próximos hallazgos"
        text="Inicia sesión para ver tus favoritos en la web y en la aplicación."
        href="/cuenta?volver=/favoritos"
        action="Iniciar sesión"
      />
    );
  if (products.isError)
    return (
      <section className="state" role="alert">
        <h1>No pudimos cargar tus favoritos</h1>
        <button className="button" onClick={() => products.refetch()}>
          Volver a intentar
        </button>
      </section>
    );
  return (
    <div className="wrap account-page">
      <div className="section-heading">
        <h1>Mis favoritos</h1>
        <span className="muted">{products.data?.length ?? 0} productos</span>
      </div>
      {products.data?.length ? (
        <ProductGrid products={products.data} />
      ) : (
        <Empty
          title="Tus favoritos empiezan aquí"
          text="Toca el corazón de un producto para guardarlo y encontrarlo después."
        />
      )}
    </div>
  );
}
