import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { publicProduct, publicCatalogMetadata } from '@/lib/server';
import { ProductDetail } from '@/components/product-detail';
import { Failure } from '@/components/states';
import { catalogText } from '@/lib/photos';
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try { const p = await publicProduct(slug); return { title: p ? catalogText(p.title, p.is_demo, p.id) : 'Producto no encontrado' }; }
  catch { return { title: 'Producto' }; }
}
export default async function Product({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ variant?: string | string[] }> }) {
  const { slug } = await params;
  let product;
  try {
    product = await publicProduct(slug);
  } catch {
    return <Failure href={`/p/${encodeURIComponent(slug)}`} message="No pudimos cargar el producto." />;
  }
  if (!product) notFound();
  let metadata: Awaited<ReturnType<typeof publicCatalogMetadata>>;
  try { metadata = await publicCatalogMetadata(product.related.slice(0, 6).map(p => p.id)); }
  catch { return <Failure href={`/p/${encodeURIComponent(slug)}`} message="No pudimos cargar las opciones del producto." />; }
  if (!product.catalog_metadata) return <Failure href={`/p/${encodeURIComponent(slug)}`} message="No pudimos cargar las opciones del producto." />;
  const query = await searchParams;
  return <ProductDetail product={product} metadata={product.catalog_metadata} relatedMetadata={metadata} initialVariantId={typeof query.variant === 'string' ? query.variant : undefined} />;
}
