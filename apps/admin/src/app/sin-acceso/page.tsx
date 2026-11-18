'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Empty, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function NoAccess() {
  const { signOut, email, ready, session } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (ready && !session) router.replace('/login');
  }, [ready, session, router]);
  if (!ready || !session) return <Loading rows={2} />;
  return (
    <div className="grid min-h-dvh place-items-center">
      <Empty
        title="Tu cuenta no tiene acceso al panel"
        body={`${email ?? 'Esta cuenta'} no administra ninguna tienda ni tiene permisos de administración. Si crees que es un error, pide acceso a la administración.`}
        action={<div className="flex flex-wrap items-center justify-center gap-4"><a className="font-semibold text-brand" href="https://mayami.app/cuenta">Volver a MAYAMI</a><Button variant="secondary" onClick={() => signOut()}>Cerrar sesión</Button></div>}
      />
    </div>
  );
}
