import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { publicImageUrl } from '@kora/api';
import { MAYAMI_STORE_ID, publicStorePath, publicStoreSlug } from '@kora/core';
import { publicStore } from '@/lib/server';
import { env } from '@/lib/env';
import { storeDisplayName } from '@/lib/store-presentation';
import { Failure } from '@/components/states';
import CatalogResults, { catalogHref, storeQueryParams, type CatalogQuery } from '../../buscar/catalog-results';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<CatalogQuery> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const store = await publicStore(slug);
    if (!store || store.status !== 'active') return { title: 'Tienda no disponible', robots: { index: false } };
    const name = storeDisplayName(store);
    const title = `Tienda ${name}`;
    const description = store.tagline || store.description || `Explora los productos de ${name}.`;
    const canonical = publicStorePath(store);
    const logo = store.id === MAYAMI_STORE_ID && (!store.logo_path || store.logo_path === 'demo/kora-logo.webp')
      ? '/brand/pwa/icon-512.png' : publicImageUrl(env.url, 'stores', store.logo_path);
    const images = logo ? [{ url: logo, alt: name }] : undefined;
    return {
      title: store.id === MAYAMI_STORE_ID ? { absolute: title } : title, description, alternates: { canonical },
      openGraph: { type: 'website', siteName: 'MAYAMI', locale: 'es_VE', title, description, url: canonical, images },
      twitter: { card: 'summary', title, description, images },
    };
  } catch { return { title: 'Tienda', robots: { index: false } }; }
}

export default async function StorePage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  let store;
  try { store = await publicStore(slug); }
  catch { return <Failure href={'/tienda/' + encodeURIComponent(slug)} message="No pudimos cargar esta tienda." />; }
  if (!store || store.status !== 'active') notFound();
  if (slug !== publicStoreSlug(store) || query.store !== undefined) {
    permanentRedirect(catalogHref(publicStorePath(store), storeQueryParams(query)));
  }
  return CatalogResults({ query, profile: store });
}
