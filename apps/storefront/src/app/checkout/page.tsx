'use client';
import { Buyer } from '@/components/buyer';
import { Checkout } from '@/components/checkout';
export default function Page() {
  return <Buyer>{(id) => <Checkout buyerId={id} />}</Buyer>;
}
