'use client';
import { Fragment, Suspense, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { planFromSearch, withPlan } from '@kora/core';
import { authHref } from '@/lib/auth-return';
import { useAccount } from '@/lib/providers';
import { Empty } from './states';
export function Buyer({ children }: { children: (buyerId: string) => ReactNode }) {
  return <Suspense fallback={<section className="state" role="status">Cargando tu cuenta…</section>}><BuyerSession>{children}</BuyerSession></Suspense>;
}
function BuyerSession({ children }: { children: (buyerId: string) => ReactNode }) {
  const { session, ready } = useAccount();
  const path = usePathname();
  const search = useSearchParams();
  // Only the public plan preference survives direct checkout authentication.
  const back = path === '/checkout' ? withPlan(path, planFromSearch(new URLSearchParams(search.toString()))) : path;
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
        href={authHref('/cuenta', back)}
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
