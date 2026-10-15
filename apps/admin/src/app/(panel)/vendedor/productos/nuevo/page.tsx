import { Suspense } from 'react';
import { Loading } from '@/components/ui';
import ProductEditor from '../editar/ProductEditor';

// The address the "Nuevo producto" buttons have always used; same editor as /vendedor/productos/editar without id.
export default function Page() {
  return (
    <Suspense fallback={<Loading rows={6} />}>
      <ProductEditor />
    </Suspense>
  );
}
