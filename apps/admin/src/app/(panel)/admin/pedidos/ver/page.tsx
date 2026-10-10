import { Suspense } from 'react';
import { Loading } from '@/components/ui';
import OrderDetail from './OrderDetail';

// /admin/pedidos/ver?id=<pedido>: a fixed page whose id travels in the query, so the panel works the same with its
// Next server and as the static site it is published as (no page per order to generate).
export default function Page() {
  return (
    <Suspense fallback={<Loading rows={6} />}>
      <OrderDetail />
    </Suspense>
  );
}
