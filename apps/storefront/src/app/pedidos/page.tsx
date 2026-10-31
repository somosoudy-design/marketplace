'use client';
import { Buyer } from '@/components/buyer';
import { Orders } from '@/components/orders';
export default function Page() {
  return <Buyer>{(id) => <Orders buyerId={id} />}</Buyer>;
}
