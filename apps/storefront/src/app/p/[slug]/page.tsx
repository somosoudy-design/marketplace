import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { publicProduct } from '@/lib/server';
import { ProductDetail } from '@/components/product-detail';
import { Failure } from '@/components/states';
import { catalogText } from '@/lib/photos';
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try { const p = await publicProduct(slug); return { title: p ? catalogText(p.title, p.is_demo, p.id) : 'Producto no encontrado' }; }
  catch { return { title: 'Producto' }; }
}
export default async function Product({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let product;
  try {
    product = await publicProduct(slug);
  } catch {
    return <Failure href={`/p/${encodeURIComponent(slug)}`} message="No pudimos cargar el producto." />;
  }
  if (!product) notFound();
  return <ProductDetail product={product} />;
}
