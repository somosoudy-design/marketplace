'use client';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { panelLoginPath } from '@/lib/panel-navigation';
import { ErrorBox, Loading } from './ui';

/** Navigation guard only: hiding screens is a convenience, the database rejects unauthorized calls. */
export function Guard({ need, children }: { need: 'admin' | 'seller'; children: ReactNode }) {
  const { ready, session, isAdmin, isSeller, accessError, retryAccess } = useAuth();
  const router = useRouter();
  const allowed = need === 'admin' ? isAdmin : isSeller;
  useEffect(() => {
    if (!ready || accessError) return;
    if (!session) router.replace(panelLoginPath(window.location));
    else if (!allowed) router.replace('/');
  }, [ready, session, allowed, router, accessError]);
  if (accessError) return <ErrorBox error={accessError} onRetry={retryAccess} />;
  if (!ready || !session || !allowed) return <Loading rows={3} />;
  return <>{children}</>;
}
