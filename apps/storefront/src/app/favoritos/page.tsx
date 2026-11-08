'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAccount } from '@/lib/providers';
import { browser } from '@/lib/browser';
import { ProductGrid } from '@/components/product-card';
import { catalogMetadataMap } from '@/lib/catalog-selection';
import { Empty } from '@/components/states';
import { useGuestFavoritesState } from '@/lib/guest-hooks';
import { guestFavorites } from '@/lib/guest-storage';
import { captureBuyerApi } from '@/lib/actor-api';
import { FavoritesSyncNotice } from '@/components/guest-sync';
import { favoriteProductsForIds } from '@/lib/guest-favorite-cards';
import { guestError } from '@/lib/guest-errors';
function GuestFavorites() {
  const guest = useGuestFavoritesState();
  const remove = useMutation({ networkMode: 'always', mutationFn: async (id: string) => { try { await guestFavorites.set(id, false); } catch (error) { throw guestError(error); } } });
  const ids = guest.data.map(entry => entry.product_id);
  const saved = useQuery({ queryKey: ['guest-favorite-products', ids], enabled: guest.ready && !guest.error && ids.length > 0,
    queryFn: () => favoriteProductsForIds(ids, browser().api.catalog) });
  const offline = saved.fetchStatus === 'paused';
  if (!guest.ready || (ids.length > 0 && !guest.error && saved.isPending && !offline)) return <section className="state" role="status">Cargando favoritos…</section>;
  if (guest.error) return <section className="state" role="alert"><h1>No pudimos cargar tus favoritos</h1><p>{guest.error.message}</p><button className="button" onClick={() => void guest.refresh()}>Volver a intentar</button></section>;
  const products = (saved.data?.products ?? []).filter(p => saved.data?.metadata[p.id]), missing = ids.filter(id => !products.some(p => p.id === id));
  return <div className="wrap account-page"><div className="section-heading"><h1>Mis favoritos</h1><span className="muted">{ids.length} productos</span></div>
    {(offline || saved.isError) && <div className="notice error" role="alert"><p>{offline ? 'Sin conexión. Tus favoritos siguen guardados en este dispositivo; precios y disponibilidad se actualizarán al recuperar la conexión.' : 'No pudimos actualizar tus favoritos. Siguen guardados en este dispositivo.'}</p><button type="button" className="button secondary" onClick={() => void saved.refetch()}>Volver a intentar</button></div>}
    {products.length ? <ProductGrid products={products} metadata={saved.data!.metadata} /> : !ids.length ? <Empty title="Tus favoritos empiezan aquí" text="Toca el corazón de un producto para guardarlo y encontrarlo después." /> : null}
    {missing.length > 0 && <div className="notice"><p>{offline || saved.isError ? 'Tus productos guardados se mostrarán cuando podamos actualizar el catálogo.' : 'Algunos productos guardados ya no están disponibles.'}</p>{missing.map((id, index) => <button key={id} type="button" className="text-button" disabled={remove.isPending} onClick={() => remove.mutate(id)}>Quitar producto guardado {index + 1}</button>)}</div>}
    {remove.isError && <p className="notice error" role="alert">{remove.error.message}</p>}
  </div>;
}
function BuyerFavorites({ buyerId }: { buyerId: string }) {
  const { favoritesSyncing, favoritesSyncError } = useAccount();
  const products = useQuery({ queryKey: ['favorite-products', buyerId], enabled: !favoritesSyncing,
    queryFn: async () => { const bound = await captureBuyerApi(buyerId); const products = await bound.api.account.favoriteProductsForBuyer(buyerId); const metadata = await catalogMetadataMap(products.map(p => p.id), bound.api.catalog.metadata); await bound.assertCurrent(); return { products, metadata }; } });
  const reserved = useQuery({ queryKey: ['pending-guest-favorites', buyerId, favoritesSyncError], queryFn: () => guestFavorites.pendingMerge(buyerId), enabled: !!favoritesSyncError });
  const pendingProducts = useQuery({ queryKey: ['pending-guest-favorite-products', buyerId, reserved.data?.key], enabled: !!favoritesSyncError && !!reserved.data,
    queryFn: async () => { const bound = await captureBuyerApi(buyerId); const result = await favoriteProductsForIds(reserved.data!.productIds, bound.api.catalog); await bound.assertCurrent(); return result; } });
  if (favoritesSyncing || products.isPending) return <section className="state" role="status">{favoritesSyncing ? 'Incorporando tus favoritos…' : 'Cargando favoritos…'}</section>;
  const merged = [...(products.data?.products ?? []), ...(pendingProducts.data?.products ?? []).filter(p => !products.data?.products.some(old => old.id === p.id))];
  const metadata = { ...products.data?.metadata, ...pendingProducts.data?.metadata };
  return <div className="wrap account-page"><FavoritesSyncNotice />
    {products.isError ? <section className="state" role="alert"><h1>No pudimos cargar tus favoritos</h1><button className="button" onClick={() => void products.refetch()}>Volver a intentar</button></section> : <>
      <div className="section-heading"><h1>Mis favoritos</h1><span className="muted">{merged.length} productos</span></div>
      {merged.length ? <ProductGrid products={merged} metadata={metadata} /> : <Empty title="Tus favoritos empiezan aquí" text="Toca el corazón de un producto para guardarlo y encontrarlo después." />}
    </>}
    {(reserved.isError || pendingProducts.isError) && <p className="notice error" role="alert">No pudimos mostrar los favoritos por incorporar. Siguen guardados; reintenta la incorporación.</p>}
  </div>;
}
export default function Favorites() {
  const { session, ready } = useAccount();
  if (!ready) return <section className="state" role="status">Cargando favoritos…</section>;
  return session ? <BuyerFavorites key={session.user.id} buyerId={session.user.id} /> : <GuestFavorites />;
}
