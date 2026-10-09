'use client';
import { Button, Empty } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function NoAccess() {
  const { signOut, email } = useAuth();
  return (
    <div className="grid min-h-dvh place-items-center">
      <Empty
        title="Tu cuenta no tiene acceso al panel"
        body={`${email ?? 'Esta cuenta'} no administra ninguna tienda ni tiene permisos de administración. Si crees que es un error, pide acceso a la administración.`}
        action={<Button variant="secondary" onClick={() => signOut()}>Cerrar sesión</Button>}
      />
    </div>
  );
}
