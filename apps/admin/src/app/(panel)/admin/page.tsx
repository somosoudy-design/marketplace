'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Card, ErrorBox, Loading, Notice, PageHeader, Stat } from '@/components/ui';
import { ago, money, RATE_SOURCE_LABEL } from '@/lib/format';
import { kora } from '@/lib/kora';
import type { PushHealth } from '@kora/api';

export default function AdminHome() {
  const q = useQuery({ queryKey: ['admin-dashboard'], queryFn: () => kora().api.admin.dashboard(), refetchInterval: 60_000 });
  if (q.isPending) return <Loading rows={6} />;
  if (q.isError) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const rate = d.rate as { available: boolean; rate?: number; source?: string; observed_at?: string; is_manual?: boolean; is_fallback?: boolean; reason?: string };
  return (
    <>
      <PageHeader eyebrow="Administración" title="Resumen de hoy" description="Lo que necesita atención primero, y cómo va el negocio en los últimos 30 días." />
      {!rate.available ? (
        <div className="mb-5"><Notice tone="danger" title="No hay una tasa USD/VES válida">Los pagos en bolívares están bloqueados hasta que una fuente responda o fijes una tasa manual. <Link className="font-bold underline" href="/admin/tasas">Ir a tasas</Link></Notice></div>
      ) : rate.source === 'demo' ? (
        <div className="mb-5"><Notice tone="warning" title="Usando la tasa de demostración">Esta tasa no es real. En producción desactiva la fuente «demo» y configura BCV o una tasa manual. <Link className="font-bold underline" href="/admin/tasas">Ir a tasas</Link></Notice></div>
      ) : null}
      <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[0.12em] text-ink-3">Requiere atención</h2>
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Pagos por verificar" value={d.payments_pending} tone={d.payments_pending ? 'warning' : 'default'} href="/admin/pagos" />
        <Stat label="Productos por moderar" value={d.products_pending} tone={d.products_pending ? 'warning' : 'default'} href="/admin/productos" />
        <Stat label="Reclamos abiertos" value={d.claims_open} hint={d.claims_escalated ? `${d.claims_escalated} escalados` : undefined} tone={d.claims_escalated ? 'danger' : 'default'} href="/admin/reclamos" />
        <Stat label="Cuotas vencidas" value={d.overdue_installments} tone={d.overdue_installments ? 'danger' : 'default'} href="/admin/cuotas" />
        <Stat label="Tiendas por aprobar" value={d.stores_pending} href="/admin/tiendas" />
        <Stat label="Solicitudes de borrado" value={d.deletion_requests} href="/admin/usuarios" />
      </div>
      <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[0.12em] text-ink-3">Negocio</h2>
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Pedidos hoy" value={d.orders_today} />
        <Stat label="Pedidos en curso" value={d.orders_open} href="/admin/pedidos" />
        <Stat label="Ventas 30 días" value={money(d.gmv_30d_usd, 'USD')} />
        <Stat label="Cobrado 30 días" value={money(d.collected_30d_usd, 'USD')} tone="brand" />
        <Stat label="Ingreso de plataforma" value={money(d.platform_revenue_usd, 'USD')} hint="Comisiones y cargos" />
        <Stat label="Por pagar a vendedores" value={money(d.seller_payable_usd, 'USD')} href="/admin/liquidaciones" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card title="Tasa USD/VES en uso" actions={<Link href="/admin/tasas" className="text-sm font-bold text-brand">Gestionar</Link>}>
          {rate.available ? (
            <div>
              <p className="tabular font-display text-4xl font-semibold">{money(rate.rate, 'VES')}</p>
              <p className="mt-1 text-sm text-ink-2">
                {RATE_SOURCE_LABEL[rate.source ?? ''] ?? rate.source} · observada {ago(rate.observed_at)}
                {rate.is_manual ? ' · fijada manualmente' : rate.is_fallback ? ' · fuente de respaldo' : ''}
              </p>
            </div>
          ) : (
            <p className="text-sm text-danger">Sin tasa válida.</p>
          )}
        </Card>
        <Card title="Reembolsos pendientes">
          <p className="tabular font-display text-4xl font-semibold">{money(d.refunds_due_usd, 'USD')}</p>
          <p className="mt-1 text-sm text-ink-2">Montos aprobados que aún no se han devuelto al comprador. Regístralos desde el detalle de cada pedido.</p>
        </Card>
        <PushCard />
      </div>
    </>
  );
}

/** Phone notifications: whether the dispatcher runs, and what Apple and Google say about delivery. */
function PushCard() {
  const q = useQuery({ queryKey: ['push-health'], queryFn: () => kora().api.admin.pushHealth(), refetchInterval: 60_000 });
  const h: PushHealth | undefined = q.data;
  return (
    <Card title="Avisos al teléfono">
      {q.isPending ? (
        <Loading rows={2} />
      ) : q.isError || !h ? (
        <p className="text-sm text-danger">No pudimos leer el estado de los avisos.</p>
      ) : (
        <div data-testid="push-health" className="space-y-3">
          <div>
            <p className="tabular font-display text-4xl font-semibold">{h.devices}</p>
            <p className="mt-1 text-sm text-ink-2">{h.devices === 1 ? 'teléfono recibe avisos' : 'teléfonos reciben avisos'}</p>
          </div>
          <dl className="divide-y divide-line border-t border-line text-sm">
            <PushFigure label="Enviados en 24 horas" value={h.sent_24h} />
            <PushFigure label="Entregas confirmadas por Apple o Google" value={h.confirmed_24h} />
            <PushFigure label="Sin entregar" value={h.failed_24h} danger={h.failed_24h > 0} />
          </dl>
          {h.credentials_error ? (
            <Notice tone="danger" title="Credenciales de avisos rechazadas">
              Expo, Apple o Google rechazaron las credenciales (último rechazo: {ago(h.credentials_error)}). Ningún teléfono recibe avisos hasta corregirlas en Expo (EXPO_ACCESS_TOKEN y credenciales FCM/APNs).
            </Notice>
          ) : null}
          {h.stuck ? (
            <Notice tone="warning" title={h.stuck === 1 ? '1 aviso sin enviar' : `${h.stuck} avisos sin enviar`}>
              {h.stuck === 1 ? 'Espera' : 'Esperan'} hace más de 10 minutos. Revisa que la tarea programada push-dispatch y los secretos del Vault estén configurados.
            </Notice>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function PushFigure({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-ink-2">{label}</dt>
      <dd className={`tabular font-bold ${danger ? 'text-danger' : 'text-ink'}`}>{value}</dd>
    </div>
  );
}
