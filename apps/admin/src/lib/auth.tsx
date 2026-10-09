'use client';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isConfigured } from './env';
import { kora } from './kora';

interface AuthState {
  ready: boolean;
  session: Session | null;
  userId: string | null;
  email: string | null;
  /** From the access token; used for navigation only. The database authorizes every read and write. */
  roles: string[];
  storeIds: string[];
  isAdmin: boolean;
  isSuperadmin: boolean;
  isSeller: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

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

  useEffect(() => {
    if (!isConfigured) return setReady(true);
    const { client } = kora();
    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = client.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_OUT') qc.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [qc]);

  const value = useMemo<AuthState>(() => {
    const c = claims(session);
    const isSuperadmin = c.roles.includes('superadmin');
    const isAdmin = isSuperadmin || c.roles.includes('admin');
    return {
      ready,
      session,
      userId: session?.user.id ?? null,
      email: session?.user.email ?? null,
      roles: c.roles,
      storeIds: c.stores,
      isAdmin,
      isSuperadmin,
      isSeller: c.stores.length > 0,
      signIn: async (email, password) => {
        const { error } = await kora().client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      },
      signOut: async () => {
        await kora().client.auth.signOut();
      },
      // roles and stores live in the token: refresh it after they change
      refresh: async () => {
        const { data } = await kora().client.auth.refreshSession();
        setSession(data.session);
      },
    };
  }, [session, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const a = useContext(Ctx);
  if (!a) throw new Error('useAuth must be used inside AuthProvider');
  return a;
}

export function authErrorMessage(e: unknown): string {
  const m = String((e as { message?: string })?.message ?? '');
  if (/invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(m)) return 'Confirma tu correo para continuar.';
  if (/banned/i.test(m)) return 'Esta cuenta está bloqueada.';
  if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Espera un momento.';
  if (/fetch|network/i.test(m)) return 'Sin conexión con el servidor.';
  return 'No pudimos iniciar sesión. Intenta de nuevo.';
}
