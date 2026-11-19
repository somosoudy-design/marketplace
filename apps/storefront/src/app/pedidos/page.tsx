'use client';
import { Buyer } from '@/components/buyer';
import { Orders } from '@/components/orders';
export default function Page() {
  return <Buyer guestTitle="Inicia sesión para ver tus pedidos">{(id) => <Orders buyerId={id} />}</Buyer>;
}
