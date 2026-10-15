'use client';
import { FLOW_LABEL } from '@kora/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSteps } from '@/components/Fulfillment';
import { Card, Empty, ErrorBox, Loading, PageHeader, Select, Stat, Table, Td } from '@/components/ui';
import { date, money } from '@/lib/format';
import { rpc } from '@/lib/kora';
import { useStore } from '@/lib/store';

type Sale = {
  id: string; order_number: string; placed_at: string; order_status: string; payment_status: string; fulfillment_status: string; flow: string;
  title: string; variant_title: string | null; quantity: number; refunded_qty: number; unit_price_usd: number; line_total_usd: number; refunded_usd: number;
  commission_pct: number; commission_usd: number; net_usd: number;
};

export default function SellerSales() {
  const { store } = useStore();
  const [days, setDays] = useState(30);
  const { label } = useSteps();
  const q = useQuery({ queryKey: ['seller-sales', store!.id, days], queryFn: () => rpc<Sale[]>('seller_sales', { p_store_id: store!.id, p_days: days }) });
  const rows = (q.data ?? []).filter((s) => s.order_status !== 'cancelled');
  const sum = (k: 'line_total_usd' | 'refunded_usd' | 'commission_usd' | 'net_usd') => rows.reduce((a, s) => a + Number(s[k]), 0);
  return (
    <>
      <PageHeader
        eyebrow={store!.name}
        title="Ventas y comisiones"
        description="Cada línea muestra la comisión fijada al momento de la compra. El neto se libera para liquidar cuando la entrega se completa."
        actions={
          <Select aria-label="Periodo" value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-auto">
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
            <option value={365}>Último año</option>
          </Select>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Vendido" value={money(sum('line_total_usd'), 'USD')} hint={`${rows.length} líneas`} />
        <Stat label="Reembolsado" value={money(sum('refunded_usd'), 'USD')} />
        <Stat label="Comisiones" value={money(sum('commission_usd'), 'USD')} />
        <Stat label="Neto" value={money(sum('net_usd'), 'USD')} tone="brand" />
      </div>
      <Card padded={false}>
        {q.isPending ? <Loading /> : q.isError ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : !q.data.length ? <Empty title="Sin ventas en este periodo" /> : (
          <Table head={['Fecha', 'Pedido', 'Producto', 'Cant.', 'Total', 'Comisión', 'Neto', 'Entrega']}>
            {q.data.map((s) => (
              <tr key={s.id} className={s.order_status === 'cancelled' ? 'opacity-50' : undefined}>
                <Td className="whitespace-nowrap text-ink-2">{date(s.placed_at)}</Td>
                <Td className="whitespace-nowrap font-semibold">{s.order_number}</Td>
                <Td className="max-w-[280px]"><span className="block truncate">{s.title}</span>{s.variant_title && s.variant_title !== 'Única' ? <span className="text-[12px] text-ink-3">{s.variant_title}</span> : null}</Td>
                <Td className="tabular">{s.quantity}{s.refunded_qty ? <span className="text-ink-3"> (−{s.refunded_qty})</span> : null}</Td>
                <Td className="tabular">{money(s.line_total_usd, 'USD')}</Td>
                <Td className="tabular whitespace-nowrap">{money(s.commission_usd, 'USD')} <span className="text-ink-3">· {Number(s.commission_pct)} %</span></Td>
                <Td className="tabular font-semibold">{money(s.net_usd, 'USD')}</Td>
                <Td className="whitespace-nowrap text-ink-2">{s.order_status === 'cancelled' ? 'Cancelado' : label(s.flow, s.fulfillment_status)}<span className="block text-[12px] text-ink-3">{FLOW_LABEL[s.flow]}</span></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
