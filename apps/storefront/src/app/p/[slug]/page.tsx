import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { publicApi } from '@/lib/server';
import { ProductDetail } from '@/components/product-detail';
import { Failure } from '@/components/states';
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  // Public metadata only; no auth/session state in this route.
  const { slug } = await params;
  return { title: slug.replaceAll('-', ' ') };
}
export default async function Product({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let product;
  try {
    const api = publicApi();
    const id = await api.catalog.productIdBySlug(slug);
    product = id ? await api.catalog.product(id) : null;
  } catch {
    return <Failure href={`/p/${encodeURIComponent(slug)}`} message="No pudimos cargar el producto." />;
  }
  if (!product) notFound();
  return <ProductDetail product={product} />;
}
