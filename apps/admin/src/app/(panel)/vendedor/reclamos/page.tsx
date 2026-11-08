'use client';
import { ClaimsBoard } from '@/components/Claims';
import { PageHeader } from '@/components/ui';
import { useStore } from '@/lib/store';

export default function SellerClaims() {
  const { store } = useStore();
  return (
    <>
      <PageHeader eyebrow={store!.name} title="Reclamos" description="Responde dentro del plazo. Si el reclamo se escala, la administración decide con la conversación a la vista." />
      <ClaimsBoard role="seller" storeId={store!.id} />
    </>
  );
}
