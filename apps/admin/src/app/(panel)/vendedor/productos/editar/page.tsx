import { Suspense } from 'react';
import { Loading } from '@/components/ui';
import ProductEditor from './ProductEditor';

// /vendedor/productos/editar?id=<producto> edits; without id it creates one. The id travels in the query so the panel
// works the same with its Next server and as the static site it is published as.
export default function Page() {
  return (
    <Suspense fallback={<Loading rows={6} />}>
      <ProductEditor />
    </Suspense>
  );
}
