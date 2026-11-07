'use client';
import { Buyer } from '@/components/buyer';
import { Addresses } from '@/components/addresses';
export default function Page() {
  return <Buyer>{(id) => <Addresses buyerId={id} />}</Buyer>;
}
