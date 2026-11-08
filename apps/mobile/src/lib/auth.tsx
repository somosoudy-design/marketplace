import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { authRedirect } from './auth-link';
import { guestCart } from './guest-cart';
import { guestFavorites, pendingFavoritesKey } from './guest-favorites';
import { unregisterPush } from './push';
import { clearAccountCache } from './query';
import { supabase } from './supabase';
import { captureActorApi, updateActorPassword, ActorChangedError } from './actor-api';
import { intentKey } from './ids';

interface AuthState {
  ready: boolean;
  session: Session | null;
  user: User | null;
  /** Roles from the access token (set by the auth hook). Used only for navigation; the database authorizes. */
  roles: string[];
  storeIds: string[];
  /** True while a visitor cart is being merged into the account; account cart queries wait for it. */
  cartSyncing: boolean;
  cartSyncError: string | null;
  retryCartSync: () => void;
  favoritesSyncing: boolean;
  favoritesSyncError: string | null;
  retryFavoritesSync: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  /** Creates the account. Unless the project skips confirmation, Supabase emails a six-digit code and there is no session yet. */
  signUp: (email: string, password: string, fullName: string) => Promise<{ needsConfirmation: boolean }>;
  /** Emails a new code: to confirm the account, or to choose a new password. */
  sendEmailCode: (email: string, purpose: EmailCodePurpose) => Promise<void>;
  /** Checks the emailed code with Supabase; a right code signs the user in. */
  verifyEmailCode: (email: string, code: string, purpose: EmailCodePurpose) => Promise<void>;
  signOut: () => Promise<void>;
  /** Saves a new password for the signed-in user (after the recovery code or reset link). */
  updatePassword: (password: string, stillCurrent?: () => boolean) => Promise<void>;
}

export type EmailCodePurpose = 'signup' | 'recovery';

const AuthContext = createContext<AuthState | null>(null);
const syncMessage = (error: unknown, fallback: string) => {
  const value = error as { code?: string; message?: string };
  return typeof value?.code === 'string' && value.message ? value.message : fallback;
};

function claims(session: Session | null): { roles: string[]; stores: string[] } {
  if (!session) return { roles: [], stores: [] };
  try {
    const payload = JSON.parse(atob(session.access_token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')));
    return { roles: payload.app_metadata?.roles ?? [], stores: payload.app_metadata?.stores ?? [] };
  } catch {
    return { roles: [], stores: [] };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [cartSyncing, setCartSyncing] = useState(false);
  const [cartSyncError, setCartSyncError] = useState<string | null>(null);
  const retrySync = useRef<() => void>(() => undefined);
  const [favoritesSyncing, setFavoritesSyncing] = useState(false);
  const [favoritesSyncError, setFavoritesSyncError] = useState<string | null>(null);
  const retryFavorites = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    let active = true, cartRun = 0, favoritesRun = 0;
    let owner: string | null | undefined;
    const current = (actorId: string, run: number, kind: 'cart' | 'favorites') => active && owner === actorId && run === (kind === 'cart' ? cartRun : favoritesRun);
    const syncGuestCart = async (actorId: string, run: number) => {
      try {
        if (!current(actorId, run, 'cart')) return;
        const bound = await captureActorApi(actorId);
        while (current(actorId, run, 'cart')) {
          const reserved = await guestCart.reserveMerge(actorId, () => intentKey('cart-merge'));
          if (!reserved || !current(actorId, run, 'cart')) return;
          await bound.assertCurrent();
          const lines = JSON.parse(reserved.payloadJson) as { variant_id: string; quantity: number }[];
          await bound.api.cart.mergeWithIntent(lines, reserved.key);
          await bound.assertCurrent();
          if (!current(actorId, run, 'cart')) return;
          await qc.invalidateQueries({ queryKey: ['cart', actorId] });
          await bound.assertCurrent();
          if (!current(actorId, run, 'cart')) return;
          await guestCart.completeMerge(reserved);
        }
      } catch (error) {
        if (current(actorId, run, 'cart')) setCartSyncError(syncMessage(error, 'No pudimos incorporar tu carrito. Tus productos siguen guardados.'));
      } finally {
        if (current(actorId, run, 'cart')) setCartSyncing(false);
      }
    };
    const syncGuestFavorites = async (actorId: string, run: number) => {
      try {
        if (!current(actorId, run, 'favorites')) return;
        const bound = await captureActorApi(actorId);
        while (current(actorId, run, 'favorites')) {
          const reserved = await guestFavorites.reserveMerge(actorId, () => intentKey('favorite-merge'));
          if (!current(actorId, run, 'favorites')) return;
          qc.setQueryData(pendingFavoritesKey(actorId), reserved);
          if (!reserved) return;
          await bound.assertCurrent();
          // The immutable snapshot/key goes to the receipt RPC, never a fresh sequence of upserts.
          await bound.api.account.mergeFavoritesWithIntent(reserved.productIds, reserved.key);
          await bound.assertCurrent();
          if (!current(actorId, run, 'favorites')) return;
          await qc.fetchQuery({ queryKey: ['favorites', actorId], queryFn: async () => {
            const rows = await bound.api.account.favoritesForBuyer(actorId); await bound.assertCurrent(); return rows;
          }, retry: false, staleTime: 0 });
          await qc.invalidateQueries({ queryKey: ['favorite-products', actorId] });
          await bound.assertCurrent();
          if (!current(actorId, run, 'favorites')) return;
          await guestFavorites.completeMerge(reserved);
          if (current(actorId, run, 'favorites')) qc.setQueryData(pendingFavoritesKey(actorId), null);
        }
      } catch (error) {
        if (current(actorId, run, 'favorites')) setFavoritesSyncError(syncMessage(error, 'No pudimos incorporar tus favoritos. Siguen guardados para esta cuenta.'));
      } finally {
        if (current(actorId, run, 'favorites')) setFavoritesSyncing(false);
      }
    };
    const scheduleCart = (actorId: string) => {
      const run = ++cartRun;
      setCartSyncError(null); setCartSyncing(true);
      setTimeout(() => { void syncGuestCart(actorId, run); }, 0);
    };
    const scheduleFavorites = (actorId: string): Promise<void> => {
      const run = ++favoritesRun;
      setFavoritesSyncError(null); setFavoritesSyncing(true);
      // Neither Supabase nor disk/RPC work runs within the auth callback.
      return new Promise(resolve => { setTimeout(() => { void syncGuestFavorites(actorId, run).finally(() => resolve()); }, 0); });
    };
    retrySync.current = () => {
      supabase.auth.getSession().then(({ data, error }) => {
        if (error) return;
        const actorId = data.session?.user.id;
        if (active && actorId && actorId === owner) scheduleCart(actorId);
      }).catch(() => undefined);
    };
    retryFavorites.current = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const actorId = data.session?.user.id;
      if (active && actorId && actorId === owner) await scheduleFavorites(actorId);
    };
    const ownedBy = (id: string | null) => {
      if (owner !== id) {
        cartRun++; favoritesRun++;
        setCartSyncing(false); setCartSyncError(null);
        setFavoritesSyncing(false); setFavoritesSyncError(null);
      }
      if (owner !== undefined && owner !== id) clearAccountCache().catch(() => qc.clear());
      if (owner === undefined && id === null) clearAccountCache().catch(() => undefined);
      owner = id;
    };
    const initialRun = cartRun;
    supabase.auth.getSession().then(({ data }) => {
      if (!active || cartRun !== initialRun) return;
      ownedBy(data.session?.user.id ?? null);
      setSession(data.session); setReady(true);
      if (data.session) { scheduleCart(data.session.user.id); void scheduleFavorites(data.session.user.id); }
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') ownedBy(next?.user.id ?? null);
      setSession(next); setReady(true);
      if (event === 'SIGNED_IN' && next) { scheduleCart(next.user.id); void scheduleFavorites(next.user.id); }
    });
    const sessionGone = (error: unknown) => {
      if ((error as { code?: string } | null)?.code !== 'auth_required') return;
      supabase.auth.getSession().then(({ data: next }) => {
        if (!active || next.session) return;
        ownedBy(null); setSession(null);
      });
    };
    const stopQueries = qc.getQueryCache().subscribe(event => {
      if (event.type === 'updated' && event.action.type === 'error') sessionGone(event.action.error);
    });
    const stopMutations = qc.getMutationCache().subscribe(event => {
      if (event.type === 'updated' && event.action.type === 'error') sessionGone(event.action.error);
    });
    return () => {
      active = false; cartRun++; favoritesRun++;
      retrySync.current = () => undefined; retryFavorites.current = async () => undefined;
      data.subscription.unsubscribe(); stopQueries(); stopMutations();
    };
  }, [qc]);

  const value = useMemo<AuthState>(() => {
    const c = claims(session);
    return {
      ready,
      session,
      user: session?.user ?? null,
      roles: c.roles,
      storeIds: c.stores,
      cartSyncing,
      cartSyncError,
      retryCartSync: () => retrySync.current(),
      favoritesSyncing,
      favoritesSyncError,
      retryFavoritesSync: () => retryFavorites.current(),
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      },
      signUp: async (email, password, fullName) => {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          // the email carries a code; the redirect only matters for older link templates
          options: { data: { full_name: fullName.trim() }, emailRedirectTo: authRedirect('/auth-callback') },
        });
        if (error) throw error;
        // a confirmed address comes back as a user without identities and no email is sent
        if (data.user && !data.session && data.user.identities?.length === 0) throw Object.assign(new Error('User already registered'), { code: 'user_already_exists' });
        return { needsConfirmation: !data.session };
      },
      sendEmailCode: async (email, purpose) => {
        const { error } = purpose === 'signup'
          ? await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: authRedirect('/auth-callback') } })
          : await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirect('/reset-password') });
        if (error) throw error;
      },
      verifyEmailCode: async (email, code, purpose) => {
        const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: purpose });
        if (error) throw error;
        if (!data.session) throw Object.assign(new Error('Auth session missing'), { code: 'session_not_found' });
      },
      signOut: async () => {
        await unregisterPush();
        await supabase.auth.signOut();
      },
      updatePassword: async (password, stillCurrent = () => true) => {
        // This closure belongs to the session exposed with this AuthState value.
        const actorId = session?.user.id;
        if (!actorId) throw new ActorChangedError();
        await updateActorPassword(actorId, password, stillCurrent);
      },
    };
  }, [session, ready, cartSyncing, cartSyncError, favoritesSyncing, favoritesSyncError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const a = useContext(AuthContext);
  if (!a) throw new Error('useAuth must be used inside AuthProvider');
  return a;
}

/** Spanish copy for Supabase Auth errors (shared with the tests in @kora/core). */
export { authErrorMessage } from '@kora/core';
