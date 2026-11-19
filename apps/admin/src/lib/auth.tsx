'use client';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isConfigured } from './env';
import { kora, koraForActor, run } from './kora';
import { ugcOwner } from './ugc-owner';

interface AuthState {
  ready: boolean;
  session: Session | null;
  userId: string | null;
  email: string | null;
  accessError: unknown;
  retryAccess: () => void;
  /** From RLS-protected role and membership rows for the current actor. */
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!isConfigured);

  useEffect(() => {
    if (!isConfigured) return;
    const { client } = kora();
    const initialOwner = ugcOwner.snapshot();
    client.auth.getSession().then(({ data }) => {
      if (ugcOwner.snapshot() !== initialOwner && ugcOwner.snapshot().actor !== (data.session?.user.id ?? null)) return;
      ugcOwner.update(data.session?.user.id ?? null);
      setSession(data.session);
      setReady(true);
    });
    const { data } = client.auth.onAuthStateChange((event, s) => {
      const previousActor = ugcOwner.snapshot().actor;
      ugcOwner.update(s?.user.id ?? null);
      setSession(s);
      setReady(true);
      if (event === 'SIGNED_OUT' || (previousActor && previousActor !== s?.user.id)) qc.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [qc]);

  const actor = session?.user.id ?? null;
  const accessKey = ['panel-access', actor, ugcOwner.snapshot().revision] as const;
  const access = useQuery({
    queryKey: accessKey,
    enabled: !!actor,
    queryFn: async () => {
      const bound = await koraForActor(actor!);
      const [roles, memberships] = await Promise.all([
        bound.api.account.roles(actor!),
        run<{ store_id: string }[]>(bound.client.from('store_members').select('store_id').eq('user_id', actor!)),
      ]);
      await bound.assertCurrent();
      return { roles: roles.map(row => row.role), stores: memberships.map(row => row.store_id) };
    },
  });
  const { data, error, isPending, refetch } = access;
  const value = useMemo<AuthState>(() => {
    const c = (actor && !error ? data : null) ?? { roles: [], stores: [] };
    const isSuperadmin = c.roles.includes('superadmin');
    const isAdmin = isSuperadmin || c.roles.includes('admin');
    return {
      ready: ready && (!actor || !isPending),
      accessError: actor ? error : null,
      retryAccess: () => { void refetch(); },
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
      // Preserve token refresh and reread current database memberships.
      refresh: async () => {
        const { data } = await kora().client.auth.refreshSession();
        setSession(data.session);
        await refetch();
      },
    };
  }, [session, ready, actor, error, data, isPending, refetch]);

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
