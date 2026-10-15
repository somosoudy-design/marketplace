'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function Home() {
  const { ready, session, isAdmin, isSeller } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    if (!session) router.replace('/login');
    else if (isAdmin) router.replace('/admin');
    else if (isSeller) router.replace('/vendedor');
    else router.replace('/sin-acceso');
  }, [ready, session, isAdmin, isSeller, router]);
  return <Loading rows={3} />;
}
