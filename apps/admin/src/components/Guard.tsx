'use client';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { Loading } from './ui';

/** Navigation guard only: hiding screens is a convenience, the database rejects unauthorized calls. */
export function Guard({ need, children }: { need: 'admin' | 'seller'; children: ReactNode }) {
  const { ready, session, isAdmin, isSeller } = useAuth();
  const router = useRouter();
  const allowed = need === 'admin' ? isAdmin : isSeller;
  useEffect(() => {
    if (!ready) return;
    if (!session) router.replace('/login');
    else if (!allowed) router.replace('/');
  }, [ready, session, allowed, router]);
  if (!ready || !session || !allowed) return <Loading rows={3} />;
  return <>{children}</>;
}
