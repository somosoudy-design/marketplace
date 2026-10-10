'use client';
import { ClaimsBoard } from '@/components/Claims';
import { PageHeader } from '@/components/ui';
import { useStoresIndex } from '@/lib/hooks';

export default function AdminClaims() {
  const stores = useStoresIndex();
  return (
    <>
      <PageHeader eyebrow="Operación" title="Reclamos" description="La tienda responde primero. Si no lo hace a tiempo o el cliente no está conforme, el reclamo se escala y lo resuelve la administración." />
      <ClaimsBoard role="admin" storeName={stores.name} />
    </>
  );
}
