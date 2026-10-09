import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { guestCart } from './guest-cart';
import { api, supabase } from './supabase';

interface AuthState {
  ready: boolean;
  session: Session | null;
  user: User | null;
  /** Roles from the access token (set by the auth hook). Used only for navigation; the database authorizes. */
  roles: string[];
  storeIds: string[];
  /** True while a visitor cart is being merged into the account; account cart queries wait for it. */
  cartSyncing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

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

  useEffect(() => {
    // Brings the visitor cart into the account (the server re-validates every line). The local copy is
    // kept if the merge fails, and retried on the next sign in or app start.
    const syncGuestCart = async () => {
      try {
        const lines = await guestCart.mergeLines();
        if (!lines.length) return;
        await api.cart.merge(lines);
        await guestCart.clear();
        qc.invalidateQueries();
      } catch {
        // offline or rejected: keep the lines for a later attempt
      } finally {
        setCartSyncing(false);
      }
    };
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
      if (data.session) {
        setCartSyncing(true);
        syncGuestCart();
      }
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_IN') {
        // hold account cart queries in the same render that exposes the session, so they cannot read the
        // cart before the merge lands; run the merge outside the auth callback, as supabase-js recommends
        setCartSyncing(true);
        setTimeout(syncGuestCart, 0);
      }
      if (event === 'SIGNED_OUT') qc.clear();
    });
    return () => data.subscription.unsubscribe();
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
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      },
      signUp: async (email, password, fullName) => {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim() } } });
        if (error) throw error;
        return { needsConfirmation: !data.session };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
      resetPassword: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (error) throw error;
      },
    };
  }, [session, ready, cartSyncing]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const a = useContext(AuthContext);
  if (!a) throw new Error('useAuth must be used inside AuthProvider');
  return a;
}

/** Spanish copy for Supabase Auth errors. */
export function authErrorMessage(e: unknown): string {
  const m = String((e as { message?: string })?.message ?? '');
  if (/invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/already registered|already exists/i.test(m)) return 'Ya existe una cuenta con ese correo. Inicia sesión.';
  if (/password should be at least|weak password/i.test(m)) return 'La contraseña debe tener al menos 8 caracteres, con letras y números.';
  if (/email not confirmed/i.test(m)) return 'Confirma tu correo para continuar. Revisa tu bandeja de entrada.';
  if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Espera un momento.';
  if (/fetch|network/i.test(m)) return 'Sin conexión. Revisa tu internet e intenta de nuevo.';
  return 'No pudimos completar la operación. Intenta de nuevo.';
}
