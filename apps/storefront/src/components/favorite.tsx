'use client';
import { Heart, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useQuery, useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { favoriteState, type FavoriteEntry } from '@kora/api';
import { useRouter } from 'next/navigation';
import { browser } from '@/lib/browser';
import { useAccount } from '@/lib/providers';

type Props = { id: string; title: string };
export function Favorite(props: Props) {
  const { session } = useAccount();
  return <FavoriteControl key={`${session?.user.id ?? 'guest'}:${props.id}`} {...props} />;
}
function FavoriteControl({ id, title }: Props) {
  const { session, ready } = useAccount();
  const user = session?.user.id;
  const router = useRouter();
  const qc = useQueryClient();
  const queryKey = ['favorites', user];
  const mutationKey = ['favorite-write', user];
  const [pulse, setPulse] = useState(0);
  const [failure, setFailure] = useState<{ on: boolean } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const favorites = useQuery({ queryKey, queryFn: () => browser().api.account.favoritesForBuyer(user!), enabled: !!user });
  const active = !!user && (favorites.data?.some((row) => row.product_id === id) ?? false);
  const pendingProducts = useMutationState({ filters: { mutationKey, status: 'pending' }, select: (m) => (m.state.variables as { productId: string }).productId });
  const pending = pendingProducts.includes(id);
  const mutation = useMutation({
    mutationKey,
    mutationFn: (v: { userId: string; productId: string; on: boolean }) => browser().api.account.setFavorite(v.userId, v.productId, v.on),
    onMutate: async (v) => {
      const key = ['favorites', v.userId];
      await qc.cancelQueries({ queryKey: key, exact: true });
      const previous = qc.getQueryData<FavoriteEntry[]>(key)?.find((row) => row.product_id === v.productId) ?? null;
      if (qc.getQueryState(key)) qc.setQueryData<FavoriteEntry[]>(key, (rows = []) => favoriteState(rows, v.productId, v.on ? previous ?? { product_id: v.productId, created_at: new Date().toISOString() } : null));
      return { key, previous };
    },
    onError: (_error, v, ctx) => {
      if (ctx && qc.getQueryState(ctx.key)) qc.setQueryData<FavoriteEntry[]>(ctx.key, (rows = []) => favoriteState(rows, v.productId, ctx.previous));
    },
    onSettled: (_data, _error, v) => {
      if (qc.isMutating({ mutationKey: ['favorite-write', v.userId] }) === 1) {
        qc.invalidateQueries({ queryKey: ['favorites', v.userId], exact: true });
        qc.invalidateQueries({ queryKey: ['favorite-products', v.userId] });
      }
    },
  });
  useEffect(() => {
    if (failure && !dialog.current?.open) dialog.current?.showModal();
    if (!failure && dialog.current?.open) dialog.current.close();
  }, [failure]);
  const save = async (on: boolean) => {
    if (!user) { router.push(`/cuenta?volver=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
    if (favorites.isError) {
      const result = await favorites.refetch();
      if (result.isError) { setFailure({ on }); return; }
    }
    if (qc.getQueryState(['favorites', user])?.status !== 'success' || qc.getMutationCache().findAll({ mutationKey, status: 'pending' }).some((m) => (m.state.variables as { productId: string }).productId === id)) return;
    setFailure(null);
    setPulse((n) => n + 1);
    mutation.mutate({ userId: user, productId: id, on }, { onError: () => setFailure({ on }) });
  };
  return <>
    <button type="button" className="favorite" aria-label={`${favorites.isError ? 'Reintentar cargar' : active ? 'Quitar de' : 'Guardar en'} favoritos: ${title}`} aria-pressed={active} aria-busy={pending}
      disabled={!ready || pending || (!!user && favorites.isPending)} onClick={() => save(!active)}>
      <span key={pulse} className="favorite-glyph" data-pulse={pulse > 0} aria-hidden="true"><Heart size={19} fill={active ? 'currentColor' : 'none'} />{pulse > 0 && active && <span className="favorite-burst" />}</span>
    </button>
    <dialog ref={dialog} className="favorite-error-dialog" aria-labelledby={titleId} onClose={() => setFailure(null)}>
      <button type="button" className="dialog-close" aria-label="Cerrar" onClick={() => setFailure(null)}><X size={20} /></button>
      <h2 id={titleId}>No pudimos actualizar favoritos</h2>
      <p role="alert">El cambio no se guardó. Revisa tu conexión e inténtalo de nuevo.</p>
      <button type="button" className="button" disabled={pending || favorites.isFetching} onClick={() => failure && save(failure.on)}>Reintentar</button>
    </dialog>
  </>;
}
