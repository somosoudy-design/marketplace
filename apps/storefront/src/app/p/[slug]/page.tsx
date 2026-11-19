import '@/components/product-detail.css';
import { publicProduct } from '@/lib/server';
import { productMetadata, renderProduct, type ProductQuery } from '../product-page';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<ProductQuery> };

export async function generateMetadata({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  return productMetadata(() => publicProduct(slug), query);
}

export default async function Product({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  return renderProduct(() => publicProduct(slug), '/p/' + encodeURIComponent(slug), query);
}
