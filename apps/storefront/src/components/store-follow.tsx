'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { Check, UserPlus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAccount } from '@/lib/providers';
import { captureBuyerApi } from '@/lib/actor-api';
import { authHref } from '@/lib/auth-return';

export function StoreFollow({ storeId, returnTo }: { storeId: string; returnTo: string }) {
  const { session, ready } = useAccount();
  const buyerId = session?.user.id;
  if (!ready) return <button type="button" className="button store-follow-trigger" disabled>Seguir tienda</button>;
  if (!buyerId) return (
    <Link className="button store-follow-trigger" href={authHref('/cuenta', returnTo)} prefetch={false}>
      <UserPlus size={18} aria-hidden="true" />Seguir tienda
    </Link>
  );
  return <FollowForBuyer key={`${buyerId}:${storeId}`} buyerId={buyerId} storeId={storeId} />;
}

function FollowForBuyer({ buyerId, storeId }: { buyerId: string; storeId: string }) {
  const qc = useQueryClient();
  const key = ['store-follow', buyerId, storeId];
  const writing = useRef(false);
  const status = useQuery({
    queryKey: key,
    queryFn: async () => {
      const captured = await captureBuyerApi(buyerId);
      const follows = await captured.api.account.followsStore(buyerId, storeId);
      await captured.assertCurrent();
      return follows;
    },
  });
  const follow = useMutation({
    mutationFn: async (on: boolean) => {
      const captured = await captureBuyerApi(buyerId);
      await captured.assertCurrent();
      await captured.api.account.setStoreFollow(buyerId, storeId, on);
      await captured.assertCurrent();
      return on;
    },
    onMutate: () => qc.cancelQueries({ queryKey: key }),
    onSuccess: (on) => qc.setQueryData(key, on),
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: key });
      writing.current = false;
    },
  });
  const active = status.data;
  return <>
    <button type="button" className="button store-follow-trigger" aria-pressed={active}
      disabled={status.isPending || follow.isPending}
      onClick={() => {
        if (writing.current) return;
        if (status.isError || active === undefined) { void status.refetch(); return; }
        writing.current = true;
        follow.mutate(!active);
      }}>
      {active ? <Check size={18} aria-hidden="true" /> : <UserPlus size={18} aria-hidden="true" />}
      {follow.isPending ? 'Guardando…' : status.isError ? 'Volver a intentar' : active ? 'Siguiendo' : 'Seguir tienda'}
    </button>
    {(follow.isError || status.isError) && <p className="store-follow-feedback" role="status">
      {follow.isError ? 'No se pudo guardar el cambio. Puedes intentarlo de nuevo.' : 'No se pudo consultar si sigues esta tienda.'}
    </p>}
  </>;
}
