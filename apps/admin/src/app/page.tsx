'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ErrorBox, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function Home() {
  const { ready, session, isAdmin, isSeller, accessError, retryAccess } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!ready || accessError) return;
    if (!session) router.replace('/login');
    else if (isAdmin) router.replace('/admin');
    else if (isSeller) router.replace('/vendedor');
    else router.replace('/sin-acceso');
  }, [ready, session, isAdmin, isSeller, accessError, router]);
  if (accessError) return <ErrorBox error={accessError} onRetry={retryAccess} />;
  return <Loading rows={3} />;
}
