import '@/components/product-detail.css';
import { decodeProductId } from '@/lib/product-link';
import { publicProductById } from '@/lib/server';
import { productMetadata, renderProduct, type ProductQuery } from '../../product-page';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ code: string }>; searchParams: Promise<ProductQuery> };

function readProduct(code: string) {
  const id = decodeProductId(code);
  return () => id ? publicProductById(id) : Promise.resolve(null);
}

export async function generateMetadata({ params, searchParams }: Props) {
  const [{ code }, query] = await Promise.all([params, searchParams]);
  return productMetadata(readProduct(code), query);
}

export default async function SharedProduct({ params, searchParams }: Props) {
  const [{ code }, query] = await Promise.all([params, searchParams]);
  return renderProduct(readProduct(code), '/p/i/' + encodeURIComponent(code), query);
}
