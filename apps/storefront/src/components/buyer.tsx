'use client';
import { Fragment, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAccount } from '@/lib/providers';
import { Empty } from './states';
export function Buyer({ children }: { children: (buyerId: string) => ReactNode }) {
  const { session, ready } = useAccount();
  const path = usePathname();
  if (!ready)
    return (
      <section className="state" role="status">
        Cargando tu cuenta…
      </section>
    );
  if (!session)
    return (
      <Empty
        title="Inicia sesión para continuar"
        text="Accede con la cuenta con la que realizas tus compras."
        href={`/cuenta?volver=${encodeURIComponent(path)}`}
        action="Iniciar sesión"
      />
    );
  return <Fragment key={session.user.id}>{children(session.user.id)}</Fragment>;
}
export function QueryError({ error, retry }: { error: Error | null; retry: () => void }) {
  return (
    <div className="notice error" role="alert">
      <p>{error?.message || 'No pudimos actualizar la información.'}</p>
      <button type="button" className="button secondary" onClick={retry}>
        Volver a intentar
      </button>
    </div>
  );
}
