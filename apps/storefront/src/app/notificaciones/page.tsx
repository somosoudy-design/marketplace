'use client';
import { Buyer } from '@/components/buyer';
import { Notifications } from '@/components/notifications';
export default function Page() {
  return <Buyer>{(id) => <Notifications buyerId={id} />}</Buyer>;
}
