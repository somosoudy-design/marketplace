'use client';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { StoreProfileForm } from '@/components/StoreProfileForm';
import { Empty, ErrorBox, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { koraForActor, run } from '@/lib/kora';
import { validStoreId } from '@/lib/panel-navigation';
import type { StoreRow } from '@/lib/store';

function AdminStoreProfile() {
  const { userId, isAdmin } = useAuth();
  const id = useSearchParams().get('id');
  const query = useQuery({
    queryKey: ['admin-store-profile', userId, id],
    enabled: !!userId && isAdmin && validStoreId(id),
    queryFn: async () => {
      const bound = await koraForActor(userId!);
      const store = await run<StoreRow | null>(bound.client.from('stores').select('*').eq('id', id!).maybeSingle());
      await bound.assertCurrent();
      return store;
    },
  });
  if (!validStoreId(id) || !isAdmin || !userId) return <Empty title="Tienda no disponible" />;
  if (query.isPending) return <Loading rows={4} />;
  if (query.isError) return <ErrorBox error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return <Empty title="Tienda no disponible" />;
  return <StoreProfileForm key={userId + ':' + id} store={query.data} />;
}

export default function Page() {
  return <Suspense fallback={<Loading rows={4} />}><AdminStoreProfile /></Suspense>;
}
