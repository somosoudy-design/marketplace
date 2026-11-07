'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { browser } from './browser';
import { configured } from './env';
import { captureBuyerApi } from './actor-api';
import { guestCart, guestFavorites, guestLock } from './guest-storage';
import { guestError } from './guest-errors';
interface AccountState {
  session: Session | null; ready: boolean;
  cartSyncing: boolean; cartSyncError: string | null;
  favoritesSyncing: boolean; favoritesSyncError: string | null;
}
interface AccountContext extends AccountState { retryCartSync: () => void; retryFavoritesSync: () => void }
const empty: AccountState = { session: null, ready: false, cartSyncing: false, cartSyncError: null, favoritesSyncing: false, favoritesSyncError: null };
const Context = createContext<AccountContext>({ ...empty, retryCartSync: () => undefined, retryFavoritesSync: () => undefined });
export const useAccount = () => useContext(Context);
function Account({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [state, setState] = useState<AccountState>({ ...empty, ready: !configured });
  const retry = useRef<{ cart: () => void; favorites: () => void }>({ cart: () => undefined, favorites: () => undefined });
  useEffect(() => {
    if (!configured) return;
    let active = true, identity: string | null | undefined, authEpoch = 0, cartRun = 0, favoritesRun = 0;
    const current = (actor: string, kind: 'cart' | 'favorites', run: number) => active && identity === actor && run === (kind === 'cart' ? cartRun : favoritesRun);
    const sync = async (actor: string, kind: 'cart' | 'favorites', run: number) => {
      const valid = () => current(actor, kind, run);
      try {
        await guestLock(`${kind}.sync:${actor}`, async () => {
          if (!valid()) return;
          const bound = await captureBuyerApi(actor);
          while (valid()) {
            if (kind === 'cart') {
              const reserved = await guestCart.reserveMerge(actor, () => crypto.randomUUID());
              if (!reserved || !valid()) return;
              await bound.assertCurrent(); if (!valid()) return;
              await bound.api.cart.mergeWithIntent(JSON.parse(reserved.payloadJson) as { variant_id: string; quantity: number }[], reserved.key);
              await bound.assertCurrent(); if (!valid()) return;
              const summary = await bound.api.cart.summaryReviewed();
              await bound.assertCurrent(); if (!valid()) return;
              qc.setQueryData(['cart', actor], summary);
              await guestCart.completeMerge(reserved);
            } else {
              const reserved = await guestFavorites.reserveMerge(actor, () => crypto.randomUUID());
              if (!reserved || !valid()) return;
              await bound.assertCurrent(); if (!valid()) return;
              await bound.api.account.mergeFavoritesWithIntent(JSON.parse(reserved.payloadJson) as string[], reserved.key);
              await bound.assertCurrent(); if (!valid()) return;
              const rows = await bound.api.account.favoritesForBuyer(actor);
              await bound.assertCurrent(); if (!valid()) return;
              qc.setQueryData(['favorites', actor], rows);
              await qc.invalidateQueries({ queryKey: ['favorite-products', actor], refetchType: 'none' });
              await bound.assertCurrent(); if (!valid()) return;
              await guestFavorites.completeMerge(reserved);
            }
          }
        });
      } catch (error) {
        if (valid()) setState(old => kind === 'cart'
          ? { ...old, cartSyncError: guestError(error).message }
          : { ...old, favoritesSyncError: guestError(error).message });
      } finally {
        if (valid()) setState(old => kind === 'cart' ? { ...old, cartSyncing: false } : { ...old, favoritesSyncing: false });
      }
    };
    const schedule = (actor: string, kind: 'cart' | 'favorites') => {
      const run = kind === 'cart' ? ++cartRun : ++favoritesRun;
      setState(old => kind === 'cart' ? { ...old, cartSyncing: true, cartSyncError: null } : { ...old, favoritesSyncing: true, favoritesSyncError: null });
      // Supabase work stays outside its synchronous auth event callback.
      setTimeout(() => { void sync(actor, kind, run); }, 0);
    };
    const accept = (session: Session | null) => {
      if (!active) return;
      const actor = session?.user.id ?? null;
      if (identity !== actor) {
        identity = actor; authEpoch++; cartRun++; favoritesRun++;
        void qc.cancelQueries(); qc.clear();
        setState({ ...empty, session, ready: true, cartSyncing: !!actor, favoritesSyncing: !!actor });
        if (actor) { schedule(actor, 'cart'); schedule(actor, 'favorites'); }
      } else setState(old => ({ ...old, session, ready: true }));
    };
    const again = (kind: 'cart' | 'favorites') => {
      const actor = identity;
      if (!actor) return;
      browser().client.auth.getSession().then(({ data, error }) => {
        if (error) throw error;
        if (!active || identity !== actor) return;
        if (data.session?.user.id !== actor) { accept(data.session); return; }
        schedule(actor, kind);
      }).catch(error => { if (active && identity === actor) setState(old => kind === 'cart' ? { ...old, cartSyncError: (error as Error).message || 'No pudimos comprobar tu sesión. Intenta de nuevo.' } : { ...old, favoritesSyncError: (error as Error).message || 'No pudimos comprobar tu sesión. Intenta de nuevo.' }); });
    };
    retry.current = { cart: () => again('cart'), favorites: () => again('favorites') };
    const { client } = browser(), epoch = authEpoch;
    const { data } = client.auth.onAuthStateChange((_event, session) => accept(session));
    client.auth.getSession().then(({ data }) => { if (active && epoch === authEpoch) accept(data.session); }).catch(() => { if (active && epoch === authEpoch) accept(null); });
    return () => { active = false; cartRun++; favoritesRun++; retry.current = { cart: () => undefined, favorites: () => undefined }; data.subscription.unsubscribe(); };
  }, [qc]);
  return <Context.Provider value={{ ...state, retryCartSync: () => retry.current.cart(), retryFavoritesSync: () => retry.current.favorites() }}>{children}</Context.Provider>;
}
export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: false }, mutations: { retry: false } } }));
  return <QueryClientProvider client={qc}><Account>{children}</Account></QueryClientProvider>;
}
