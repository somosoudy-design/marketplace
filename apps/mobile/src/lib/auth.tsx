import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { authRedirect } from './auth-link';
import { guestCart } from './guest-cart';
import { unregisterPush } from './push';
import { clearAccountCache } from './query';
import { supabase } from './supabase';
import { captureActorApi } from './actor-api';
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
  signIn: (email: string, password: string) => Promise<void>;
  /** Creates the account. Unless the project skips confirmation, Supabase emails a six-digit code and there is no session yet. */
  signUp: (email: string, password: string, fullName: string) => Promise<{ needsConfirmation: boolean }>;
  /** Emails a new code: to confirm the account, or to choose a new password. */
  sendEmailCode: (email: string, purpose: EmailCodePurpose) => Promise<void>;
  /** Checks the emailed code with Supabase; a right code signs the user in. */
  verifyEmailCode: (email: string, code: string, purpose: EmailCodePurpose) => Promise<void>;
  signOut: () => Promise<void>;
  /** Saves a new password for the signed-in user (after the recovery code or reset link). */
  updatePassword: (password: string) => Promise<void>;
}

export type EmailCodePurpose = 'signup' | 'recovery';

const AuthContext = createContext<AuthState | null>(null);

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

  useEffect(() => {
    let active = true, syncRun = 0;
    let owner: string | null | undefined;
    const current = (actorId: string, run: number) => active && owner === actorId && run === syncRun;
    const syncGuestCart = async (actorId: string, run: number) => {
      try {
        if (!current(actorId, run)) return;
        const bound = await captureActorApi(actorId);
        while(current(actorId,run)){
          const reserved = await guestCart.reserveMerge(actorId, () => intentKey('cart-merge'));
          if (!reserved || !current(actorId, run)) return;
          await bound.assertCurrent();
          const lines = JSON.parse(reserved.payloadJson) as { variant_id: string; quantity: number }[];
          await bound.api.cart.mergeWithIntent(lines, reserved.key);
          await bound.assertCurrent();
          if (!current(actorId, run)) return;
          await qc.invalidateQueries({ queryKey: ['cart',actorId] });
          await bound.assertCurrent();
          if (!current(actorId, run)) return;
          await guestCart.completeMerge(reserved);
          // Lines added after the reserved snapshot are a new operation, never a reason to clear them.
        }
      } catch (error) {
        // Another account's durable reservation stays private and intact. It must
        // not prevent this buyer from checking out their own server cart.
        if (current(actorId, run) && (error as {code?:string})?.code !== 'foreign_guest_merge') setCartSyncError((error as Error).message || 'No pudimos incorporar tu carrito. Tus productos siguen guardados.');
      } finally {
        if (current(actorId, run)) setCartSyncing(false);
      }
    };
    const scheduleSync = (actorId: string) => {
      const run = ++syncRun;
      setCartSyncError(null);
      setCartSyncing(true);
      // Keep Supabase work outside its auth callback.
      setTimeout(() => { void syncGuestCart(actorId, run); }, 0);
    };
    retrySync.current = () => {
      supabase.auth.getSession().then(({ data }) => {
        const actorId = data.session?.user.id;
        if (active && actorId && actorId === owner) scheduleSync(actorId);
      }).catch(() => undefined);
    };
    // the device keeps one account's data for offline use (lib/query); another account must never see it
    const ownedBy = (id: string | null) => {
      if (owner !== id) { syncRun++; setCartSyncing(false); setCartSyncError(null); }
      if (owner !== undefined && owner !== id) clearAccountCache().catch(() => qc.clear());
      if (owner === undefined && id === null) clearAccountCache().catch(() => undefined);
      owner = id;
    };
    const initialRun = syncRun;
    supabase.auth.getSession().then(({ data }) => {
      if (!active || syncRun !== initialRun) return;
      ownedBy(data.session?.user.id ?? null);
      setSession(data.session);
      setReady(true);
      if (data.session) {
        scheduleSync(data.session.user.id);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (!active) return;
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') ownedBy(s?.user.id ?? null);
      setSession(s);
      setReady(true);
      if (event === 'SIGNED_IN') {
        // hold account cart queries in the same render that exposes the session, so they cannot read the
        // cart before the merge lands; run the merge outside the auth callback, as supabase-js recommends
        if (s) scheduleSync(s.user.id);
      }
    });
    // The server answering "sign in" while the app shows an account means the stored session is gone (expired
    // and not refreshable, or unreadable): show the visitor's app instead of account screens that cannot load.
    const sessionGone = (error: unknown) => {
      if ((error as { code?: string } | null)?.code !== 'auth_required') return;
      supabase.auth.getSession().then(({ data: current }) => {
        if (current.session) return;
        ownedBy(null);
        setSession(null);
      });
    };
    const stopQueries = qc.getQueryCache().subscribe((e) => {
      if (e.type === 'updated' && e.action.type === 'error') sessionGone(e.action.error);
    });
    const stopMutations = qc.getMutationCache().subscribe((e) => {
      if (e.type === 'updated' && e.action.type === 'error') sessionGone(e.action.error);
    });
    return () => {
      active = false; syncRun++; retrySync.current = () => undefined;
      data.subscription.unsubscribe();
      stopQueries();
      stopMutations();
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
      updatePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      },
    };
  }, [session, ready, cartSyncing, cartSyncError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const a = useContext(AuthContext);
  if (!a) throw new Error('useAuth must be used inside AuthProvider');
  return a;
}

/** Spanish copy for Supabase Auth errors (shared with the tests in @kora/core). */
export { authErrorMessage } from '@kora/core';
