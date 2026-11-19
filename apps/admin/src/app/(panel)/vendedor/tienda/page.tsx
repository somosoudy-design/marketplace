'use client';
import { StoreProfileForm } from '@/components/StoreProfileForm';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';

export default function StoreProfile() {
  const { store } = useStore();
  const { userId } = useAuth();
  return store && userId ? <StoreProfileForm key={userId + ':' + store.id} store={store} /> : null;
}
