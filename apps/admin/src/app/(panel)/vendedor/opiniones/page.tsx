'use client';
import { ReviewsBoard } from '@/components/Reviews';
import { PageHeader } from '@/components/ui';
import { useStore } from '@/lib/store';

export default function SellerReviews() {
  const { store } = useStore();
  return (
    <>
      <PageHeader eyebrow={store!.name} title="Opiniones" description="Lo que dicen tus compradores. Tu respuesta se publica debajo de la opinión, en la ficha del producto." />
      <ReviewsBoard role="seller" storeId={store!.id} />
    </>
  );
}
