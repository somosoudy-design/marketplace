'use client';
import { ReviewsBoard } from '@/components/Reviews';
import { PageHeader } from '@/components/ui';

export default function AdminReviews() {
  return (
    <>
      <PageHeader
        eyebrow="Catálogo"
        title="Opiniones"
        description="Solo pueden opinar compradores con la entrega completada. Oculta únicamente lo que incumple las normas (datos personales, ofensas, publicidad); el motivo queda registrado y lo ve el autor."
      />
      <ReviewsBoard role="admin" />
    </>
  );
}
