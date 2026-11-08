'use client';
import { use } from 'react';
import { Buyer } from '@/components/buyer';
import { Order } from '@/components/orders';
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Buyer>{(buyerId) => <Order key={id} buyerId={buyerId} id={id} />}</Buyer>;
}
