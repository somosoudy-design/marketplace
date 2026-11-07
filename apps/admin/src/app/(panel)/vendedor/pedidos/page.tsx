'use client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FulfillmentCard, type FulfillmentRow } from '@/components/Fulfillment';
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader, Tabs, Thumb, type Tone } from '@/components/ui';
import { ago, money } from '@/lib/format';
import { catalogImage, rpc } from '@/lib/kora';
import { useStore } from '@/lib/store';

type Line = { id: string; title: string; variant_title: string | null; image_path: string | null; quantity: number; refunded_qty: number; unit_price_usd: number; line_total_usd: number; commission_usd: number };
type SellerFulfillment = FulfillmentRow & { order_number: string; placed_at: string; order_status: string; payment_level: 'full' | 'down_payment' | 'none'; items: Line[] };

const PAYMENT: Record<SellerFulfillment['payment_level'], { label: string; tone: Tone }> = {
  full: { label: 'Pago confirmado', tone: 'success' },
  down_payment: { label: 'Anticipo confirmado', tone: 'info' },
  none: { label: 'Esperando pago', tone: 'warning' },
};

export default function SellerOrders() {
  const { store } = useStore();
  const [scope, setScope] = useState<'open' | 'done'>('open');
  const q = useQuery({ queryKey: ['seller-fulfillments', store!.id, scope], queryFn: () => rpc<SellerFulfillment[]>('seller_fulfillments', { p_store_id: store!.id, p_scope: scope }) });
  return (
    <>
      <PageHeader eyebrow={store!.name} title="Pedidos y envíos" description="Prepara y despacha cuando el pago esté confirmado: los estados que lo requieren se habilitan solos. La plataforma verifica cada pago antes de avisarte." />
      <Tabs value={scope} onChange={setScope} items={[{ value: 'open', label: 'En curso', count: scope === 'open' ? q.data?.length : undefined }, { value: 'done', label: 'Entregados y cancelados' }]} />
      {q.isPending ? <Loading /> : q.isError ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : !q.data.length ? (
        <Card><Empty title={scope === 'open' ? 'No hay entregas pendientes' : 'Sin entregas cerradas'} body={scope === 'open' ? 'Cuando un cliente compre en tu tienda, la entrega aparecerá aquí.' : undefined} /></Card>
      ) : (
        <div className="flex flex-col gap-4">
          {q.data.map((f) => {
            const pay = PAYMENT[f.payment_level];
            return (
              <Card key={f.id} title={<span className="flex flex-wrap items-center gap-2">Pedido {f.order_number}<Badge tone={pay.tone}>{pay.label}</Badge></span>} actions={<span className="text-[13px] text-ink-3">{ago(f.placed_at)}</span>}>
                <ul className="mb-4 divide-y divide-line">
                  {f.items.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 py-2">
                      <Thumb src={catalogImage(i.image_path)} alt={i.title} size={34} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{i.title}</p>
                        <p className="text-[12.5px] text-ink-3">{i.variant_title && i.variant_title !== 'Única' ? `${i.variant_title} · ` : ''}{i.quantity} × {money(i.unit_price_usd, 'USD')}{i.refunded_qty ? ` · ${i.refunded_qty} reembolsada${i.refunded_qty === 1 ? '' : 's'}` : ''}</p>
                      </div>
                      <span className="tabular text-sm font-semibold">{money(i.line_total_usd, 'USD')}</span>
                    </li>
                  ))}
                </ul>
                <FulfillmentCard f={f} role="seller" paymentLevel={f.payment_level} />
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
