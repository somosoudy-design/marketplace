'use client';
import { Heart, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useQuery, useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { favoriteState, type FavoriteEntry } from '@kora/api';
import { useAccount } from '@/lib/providers';
import { useGuestFavoritesState } from '@/lib/guest-hooks';
import { guestFavorites } from '@/lib/guest-storage';
import { captureBuyerApi } from '@/lib/actor-api';
import { guestError } from '@/lib/guest-errors';

type Props = { id: string; title: string };
export function Favorite(props: Props) {
  const { session } = useAccount();
  return <FavoriteControl key={`${session?.user.id ?? 'guest'}:${props.id}`} {...props} />;
}
function FavoriteControl({ id, title }: Props) {
  const { session, ready, favoritesSyncing, favoritesSyncError, retryFavoritesSync } = useAccount();
  const user = session?.user.id;
  const guest = useGuestFavoritesState();
  const qc = useQueryClient();
  const queryKey = ['favorites', user];
  const mutationKey = ['favorite-write', user];
  const [pulse, setPulse] = useState(0);
  const [failure, setFailure] = useState<{ on: boolean; message?: string; sync?: boolean } | null>(null);
  const [localPending, setLocalPending] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const favorites = useQuery({
    queryKey,
    queryFn: async () => { const bound = await captureBuyerApi(user!); const rows = await bound.api.account.favoritesForBuyer(user!); await bound.assertCurrent(); return rows; },
    enabled: !!user && !favoritesSyncing && !favoritesSyncError,
  });
  const reserved = useQuery({ queryKey: ['pending-guest-favorites', user, favoritesSyncError], queryFn: () => guestFavorites.pendingMerge(user!), enabled: !!user && !!favoritesSyncError });
  const active = user ? (favorites.data?.some(row => row.product_id === id) ?? false) || (reserved.data?.productIds.includes(id) ?? false) : guest.data.some(row => row.product_id === id);
  const pendingProducts = useMutationState({
    filters: { mutationKey, status: 'pending' },
    select: (m) => (m.state.variables as { productId: string }).productId,
  });
  const pending = pendingProducts.includes(id) || localPending || (!!user && favoritesSyncing);
  const mutation = useMutation({
    mutationKey,
    mutationFn: async (v: { userId: string; productId: string; on: boolean }) => {
      const bound = await captureBuyerApi(v.userId); await bound.assertCurrent();
      await bound.api.account.setFavorite(v.userId, v.productId, v.on); await bound.assertCurrent();
    },
    onMutate: async (v) => {
      const key = ['favorites', v.userId];
      await qc.cancelQueries({ queryKey: key, exact: true });
      const previous = qc.getQueryData<FavoriteEntry[]>(key)?.find((row) => row.product_id === v.productId) ?? null;
      if (qc.getQueryState(key))
        qc.setQueryData<FavoriteEntry[]>(key, (rows = []) =>
          favoriteState(
            rows,
            v.productId,
            v.on ? (previous ?? { product_id: v.productId, created_at: new Date().toISOString() }) : null,
          ),
        );
      return { key, previous };
    },
    onError: (_error, v, ctx) => {
      if (ctx && qc.getQueryState(ctx.key))
        qc.setQueryData<FavoriteEntry[]>(ctx.key, (rows = []) => favoriteState(rows, v.productId, ctx.previous));
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
    if (!user) {
      if (localPending) return;
      setLocalPending(true); setFailure(null);
      try { await guestFavorites.set(id, on); setPulse(n => n + 1); retryFavoritesSync(); }
      catch (error) { setFailure({ on, message: guestError(error).message }); }
      finally { setLocalPending(false); }
      return;
    }
    if (favoritesSyncing) return;
    if (favoritesSyncError) { setFailure({ on, sync: true, message: favoritesSyncError }); return; }
    if (favorites.isError) {
      const result = await favorites.refetch();
      if (result.isError) {
        setFailure({ on });
        return;
      }
    }
    if (
      qc.getQueryState(['favorites', user])?.status !== 'success' ||
      qc
        .getMutationCache()
        .findAll({ mutationKey, status: 'pending' })
        .some((m) => (m.state.variables as { productId: string }).productId === id)
    )
      return;
    setFailure(null);
    setPulse((n) => n + 1);
    mutation.mutate({ userId: user, productId: id, on }, { onError: () => setFailure({ on }) });
  };
  return (
    <>
      <button
        type="button"
        className="favorite"
        aria-label={`${favorites.isError || favoritesSyncError || (!user && guest.error) ? 'Reintentar cargar' : active ? 'Quitar de' : 'Guardar en'} favoritos: ${title}`}
        aria-pressed={active}
        aria-busy={pending}
        disabled={!ready || pending || (!user && !guest.ready) || (!!user && !favoritesSyncError && favorites.isPending)}
        onClick={() => save(!active)}
      >
        <span key={pulse} className="favorite-glyph" data-pulse={pulse > 0} aria-hidden="true">
          <Heart size={19} fill={active ? 'currentColor' : 'none'} />
          {pulse > 0 && active && <span className="favorite-burst" />}
        </span>
      </button>
      <dialog ref={dialog} className="favorite-error-dialog" aria-labelledby={titleId} onClose={() => setFailure(null)}>
        {failure && (
          <>
            <button type="button" className="dialog-close" aria-label="Cerrar" onClick={() => setFailure(null)}>
              <X size={20} />
            </button>
            <h2 id={titleId}>No pudimos actualizar favoritos</h2>
            <p role="alert">{failure.message || 'El cambio no se guardó. Revisa tu conexión e inténtalo de nuevo.'}</p>
            <button
              type="button"
              className="button"
              disabled={pending || favorites.isFetching}
              onClick={() => { if (failure?.sync) { setFailure(null); retryFavoritesSync(); } else if (failure) void save(failure.on); }}
            >
              Reintentar
            </button>
          </>
        )}
      </dialog>
    </>
  );
}
