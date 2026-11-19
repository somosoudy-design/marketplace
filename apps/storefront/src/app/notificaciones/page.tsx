'use client';
import { Buyer } from '@/components/buyer';
import { Notifications } from '@/components/notifications';
export default function Page() {
  return <Buyer guestTitle="Inicia sesión para ver tus notificaciones">{(id) => <Notifications buyerId={id} />}</Buyer>;
}
