import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { isOfficialStoreAlias, MAYAMI_STORE_ID, publicStorePath } from '@kora/core';
import { publicStore } from '@/lib/server';
import { Failure } from '@/components/states';
import CatalogResults, { catalogHref, storeQueryParams, type CatalogQuery } from './catalog-results';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const params = await searchParams;
  return { title: params.q ? 'Resultados de búsqueda' : params.store ? 'Productos de la tienda' : params.category ? 'Explorar categoría' : params.availability === 'on_order' ? 'Por encargo' : params.sort === 'newest' ? 'Novedades' : 'Catálogo' };
}
export default async function Search({ searchParams }: { searchParams: Promise<CatalogQuery> }) {
  const query = await searchParams;
  if (typeof query.store === 'string' && isOfficialStoreAlias(query.store)) {
    let store;
    try { store = await publicStore(query.store); }
    catch { return <Failure href="/buscar" message="No pudimos cargar esta tienda." />; }
    if (store?.id === MAYAMI_STORE_ID) permanentRedirect(catalogHref(publicStorePath(store), storeQueryParams(query)));
  }
  return CatalogResults({ query });
}
