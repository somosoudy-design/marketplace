import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { publicImageUrl, type ProductDetail as PublicProduct } from '@kora/api';
import { resolveProductSelection, variantDisplayTitle } from '@kora/core';
import { publicCatalogMetadata } from '@/lib/server';
import { ProductDetail } from '@/components/product-detail';
import { Failure } from '@/components/states';
import { catalogText } from '@/lib/photos';
import { storeDisplayName } from '@/lib/store-presentation';
import { env } from '@/lib/env';
import { reviewedSelectionInput } from '@/lib/catalog-selection';
import { productSharePath, requestedProductVariant } from '@/lib/product-link';

export type ProductQuery = { variant?: string | string[]; v?: string | string[] };
type LoadProduct = () => Promise<PublicProduct | null>;

export async function productMetadata(load: LoadProduct, query: ProductQuery): Promise<Metadata> {
  try {
    const p = await load();
    if (!p) return { title: 'Producto no encontrado', robots: { index: false } };
    const title = catalogText(p.title, p.is_demo, p.id) || p.title;
    const requested = requestedProductVariant(query.variant, query.v);
    const metadata = p.catalog_metadata;
    const selection = metadata && resolveProductSelection(reviewedSelectionInput(p, metadata), requested);
    const variant = requested && metadata?.variants.find(option => option.active && option.variant_id === requested);
    const option = variant && variantDisplayTitle(variant.title, variant.options);
    const shareTitle = option ? `${title} · ${option}` : title;
    const details = catalogText(p.subtitle || p.description, p.is_demo, p.id)
      ?.replace(/\s+/g, ' ').trim();
    const description = details && details.length > 155
      ? details.slice(0, 152).replace(/\s+\S*$/, '') + '…'
      : details || `${p.category_name} · Vendido por ${storeDisplayName(p.store)} en MAYAMI.`;
    const image = selection?.variant?.active
      ? selection.mediaState === 'unclassified' ? metadata?.general_images?.[0] : selection.cover
      : undefined;
    const imageUrl = publicImageUrl(env.url, 'catalog', image?.path);
    const images = imageUrl?.startsWith('https://') ? [{ url: imageUrl, alt: shareTitle }] : undefined;
    const canonical = productSharePath(p.slug, undefined, p.id);
    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        type: 'website',
        siteName: 'MAYAMI',
        locale: 'es_VE',
        title: shareTitle,
        description,
        url: variant ? productSharePath(p.slug, variant.variant_id, p.id) : canonical,
        images,
      },
      twitter: { card: images ? 'summary_large_image' : 'summary', title: shareTitle, description, images },
    };
  } catch {
    return { title: 'Producto' };
  }
}

export async function renderProduct(load: LoadProduct, href: string, query: ProductQuery) {
  let product;
  try {
    product = await load();
  } catch {
    return <Failure href={href} message="No pudimos cargar el producto." />;
  }
  if (!product) notFound();
  let metadata: Awaited<ReturnType<typeof publicCatalogMetadata>>;
  try { metadata = await publicCatalogMetadata(product.related.slice(0, 6).map(p => p.id)); }
  catch { return <Failure href={href} message="No pudimos cargar las opciones del producto." />; }
  if (!product.catalog_metadata) return <Failure href={href} message="No pudimos cargar las opciones del producto." />;
  return <ProductDetail routePath={href} product={product} metadata={product.catalog_metadata} relatedMetadata={metadata} initialVariantId={requestedProductVariant(query.variant, query.v)} />;
}
