'use client';
import { Buyer } from '@/components/buyer';
import { Addresses } from '@/components/addresses';
export default function Page() {
  return <Buyer guestTitle="Inicia sesión para ver tus direcciones">{(id) => <Addresses buyerId={id} />}</Buyer>;
}
