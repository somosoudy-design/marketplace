'use client';
import { use } from 'react';
import { Buyer } from '@/components/buyer';
import { PaymentPage } from '@/components/payment';
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Buyer>{(buyerId) => <PaymentPage key={id} buyerId={buyerId} id={id} />}</Buyer>;
}
