'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { guestCart } from '@/lib/guest-storage';
import { captureBuyerApi } from '@/lib/actor-api';
import { useAccount } from '@/lib/providers';
export function FavoritesSyncNotice() {
  const { favoritesSyncing, favoritesSyncError, retryFavoritesSync } = useAccount();
  if (favoritesSyncing) return <p className="notice" role="status">Incorporando tus favoritos…</p>;
  if (!favoritesSyncError) return null;
  return <div className="notice error" role="alert"><p>{favoritesSyncError}</p><p>Tus favoritos por incorporar siguen guardados en este dispositivo.</p><button type="button" className="button secondary" onClick={retryFavoritesSync}>Reintentar incorporación</button></div>;
}
export function PendingCartMerge() {
  const { session, cartSyncError, cartSyncing, retryCartSync } = useAccount();
  const actor = session?.user.id, qc = useQueryClient();
  const [busy, setBusy] = useState(false), [failure, setFailure] = useState<string | null>(null), [remove, setRemove] = useState<string | null>(null);
  const pending = useQuery({ queryKey: ['pending-guest-merge', actor, cartSyncError], queryFn: () => guestCart.pendingMerge(actor!), enabled: !!actor && !!cartSyncError });
  if (!cartSyncError) return null;
  const reconcile = async () => {
    if (!actor || !pending.data || !remove || busy) return;
    const reserved = pending.data; setBusy(true); setFailure(null);
    try {
      const bound = await captureBuyerApi(actor); await bound.assertCurrent();
      const result = await bound.api.cart.cancelIntent({ operation: 'merge', payload: JSON.parse(reserved.payloadJson) as { variant_id: string; quantity: number }[] }, reserved.key);
      await bound.assertCurrent();
      if (result.state === 'completed') {
        const summary = await bound.api.cart.summaryReviewed(); await bound.assertCurrent(); qc.setQueryData(['cart', actor], summary);
        await guestCart.completeMerge(reserved);
      } else await guestCart.replaceCancelledMerge(reserved, reserved.lines.filter(line => line.variant_id !== remove).map(line => line.variant_id), () => crypto.randomUUID(), result);
      await bound.assertCurrent(); await pending.refetch(); setRemove(null); retryCartSync();
    } catch (error) { setFailure((error as Error).message || 'No pudimos comprobar el cambio. Tus productos siguen guardados.'); }
    finally { setBusy(false); }
  };
  return <div className="wrap"><section className="notice error" data-testid="cart-sync-pending">
    <h2>Productos por incorporar</h2><p role="alert">{cartSyncError}</p>
    {pending.isError && <p role="alert">{pending.error.message}</p>}
    {pending.data?.lines.map(line => <div key={line.variant_id}><p>{typeof line.title === 'string' ? line.title : 'Producto guardado'}{typeof line.variant_title === 'string' && line.variant_title ? ` · ${line.variant_title}` : ''} · {line.quantity}</p><button type="button" className="text-button" disabled={busy || cartSyncing} onClick={() => setRemove(line.variant_id)}>Quitar de estos productos</button></div>)}
    {remove && <div className="remove-confirm"><p>Primero comprobaremos la incorporación anterior. Si ya se completó, actualizaremos tu carrito para que revises su cantidad.</p><button type="button" disabled={busy} onClick={() => setRemove(null)}>Conservar</button><button type="button" disabled={busy} onClick={() => void reconcile()}>Quitar</button></div>}
    {failure && <p role="alert">{failure}</p>}
    <button type="button" className="button secondary" disabled={busy || cartSyncing} onClick={retryCartSync}>Reintentar incorporación</button>
  </section></div>;
}
