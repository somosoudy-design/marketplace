'use client';
import { MODERATION_LABEL } from '@kora/core';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Card, ErrorBox, Loading, Notice, PageHeader, Stat } from '@/components/ui';
import { money } from '@/lib/format';
import { kora } from '@/lib/kora';
import { useStore } from '@/lib/store';

type Dashboard = {
  balance: { available_usd: number; pending_usd: number };
  to_prepare: number;
  in_transit: number;
  sales_30d_usd: number;
  units_30d: number;
  products: Record<string, number> | null;
  low_stock: number;
  claims_open: number;
};

export default function SellerHome() {
  const { store } = useStore();
  const s = store!;
  const q = useQuery({ queryKey: ['seller-dashboard', s.id], queryFn: () => kora().api.seller.dashboard(s.id) as Promise<Dashboard> });
  const d = q.data;
  return (
    <>
      <PageHeader eyebrow={s.name} title="Resumen" description="Lo que necesita tu atención hoy y cómo van tus ventas." />
      {s.status !== 'active' ? (
        <div className="mb-5">
          <Notice tone={s.status === 'suspended' ? 'danger' : 'warning'} title={s.status === 'suspended' ? 'Tu tienda está suspendida' : 'Tu tienda está en revisión'}>
            {s.status === 'suspended' ? 'Tus productos no se muestran. Escríbenos para resolverlo.' : 'Puedes cargar productos. Se publicarán cuando activemos la tienda.'}
          </Notice>
        </div>
      ) : null}
      {q.isPending ? <Loading rows={3} /> : q.isError ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Por preparar" value={d!.to_prepare} tone={d!.to_prepare ? 'brand' : 'default'} hint="Entregas recibidas o en preparación" href="/vendedor/pedidos" />
            <Stat label="En camino" value={d!.in_transit} href="/vendedor/pedidos" />
            <Stat label="Ventas 30 días" value={money(d!.sales_30d_usd, 'USD')} hint={`${d!.units_30d} unidades`} href="/vendedor/ventas" />
            <Stat label="Disponible para liquidar" value={money(d!.balance.available_usd, 'USD')} hint={`${money(d!.balance.pending_usd, 'USD')} en curso`} href="/vendedor/balance" />
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card title="Catálogo" actions={<Link href="/vendedor/productos" className="text-sm font-semibold text-brand">Ver productos</Link>}>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                {Object.entries(MODERATION_LABEL).map(([k, label]) => (
                  <div key={k} className="rounded-[14px] bg-sunken/60 px-3 py-2.5">
                    <dt className="text-[12.5px] text-ink-3">{label}</dt>
                    <dd className="tabular text-xl font-bold">{d!.products?.[k] ?? 0}</dd>
                  </div>
                ))}
                <div className="rounded-[14px] bg-sunken/60 px-3 py-2.5">
                  <dt className="text-[12.5px] text-ink-3">Variantes con stock bajo</dt>
                  <dd className={`tabular text-xl font-bold ${d!.low_stock ? 'text-warning' : ''}`}>{d!.low_stock}</dd>
                </div>
              </dl>
            </Card>
            <Card title="Atención al cliente" actions={<Link href="/vendedor/reclamos" className="text-sm font-semibold text-brand">Ver reclamos</Link>}>
              {d!.claims_open ? (
                <Notice tone="warning" title={`${d!.claims_open} reclamo${d!.claims_open === 1 ? '' : 's'} abierto${d!.claims_open === 1 ? '' : 's'}`}>Responde dentro del plazo para evitar que se escalen.</Notice>
              ) : (
                <p className="text-sm text-ink-2">No tienes reclamos abiertos.</p>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
