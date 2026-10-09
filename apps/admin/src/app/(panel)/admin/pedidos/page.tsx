'use client';
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '@kora/core';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Card, Empty, ErrorBox, Input, Loading, PageHeader, Select, Table, Td } from '@/components/ui';
import { dateTime, money, orderPayTone } from '@/lib/format';
import { useProfiles } from '@/lib/hooks';
import { db, run } from '@/lib/kora';

type Row = { id: string; number: string; buyer_id: string; status: string; payment_status: string; total_usd: string; paid_usd: string; refunded_usd: string; plan_code: string; placed_at: string; is_demo: boolean; ship_to: { city?: string; region_code?: string } };

export default function OrdersPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [pay, setPay] = useState('');
  const q = useQuery({
    queryKey: ['admin-orders', query, status, pay],
    queryFn: () => {
      let r = db('orders').select('id, number, buyer_id, status, payment_status, total_usd, paid_usd, refunded_usd, plan_code, placed_at, is_demo, ship_to');
      if (query.trim()) r = r.ilike('number', `%${query.trim()}%`);
      if (status) r = r.eq('status', status);
      if (pay) r = r.eq('payment_status', pay);
      return run<Row[]>(r.order('placed_at', { ascending: false }).limit(200));
    },
  });
  const name = useProfiles((q.data ?? []).map((o) => o.buyer_id));
  return (
    <>
      <PageHeader eyebrow="Operación" title="Pedidos" description="Todos los pedidos con su saldo. Abre uno para ver entregas, pagos, cuotas y reembolsos." />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
          <Input aria-label="Buscar pedido" placeholder="Número de pedido (P-100…)" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10" />
        </div>
        <Select aria-label="Estado" value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
          <option value="">Todos los estados</option>
          {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select aria-label="Pago" value={pay} onChange={(e) => setPay(e.target.value)} className="w-auto">
          <option value="">Todos los pagos</option>
          {Object.entries(PAYMENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>
      <Card padded={false}>
        {q.isPending ? <Loading /> : q.isError ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : !q.data.length ? <Empty title="Sin pedidos" /> : (
          <Table head={['Pedido', 'Cliente', 'Destino', 'Fecha', 'Estado', 'Pago', 'Total', 'Saldo']}>
            {q.data.map((o) => {
              const due = Number(o.total_usd) - Number(o.refunded_usd ?? 0) - Number(o.paid_usd);
              return (
                <tr key={o.id} className="hover:bg-sunken/50">
                  <Td className="whitespace-nowrap"><Link className="font-semibold text-brand" href={`/admin/pedidos/${o.id}`}>{o.number}</Link>{o.is_demo ? <Badge tone="editorial" className="ml-2">Demo</Badge> : null}</Td>
                  <Td>{name(o.buyer_id)}</Td>
                  <Td className="whitespace-nowrap text-ink-2">{o.ship_to?.city ?? '—'}</Td>
                  <Td className="whitespace-nowrap text-ink-2">{dateTime(o.placed_at)}</Td>
                  <Td><Badge>{ORDER_STATUS_LABEL[o.status]}</Badge></Td>
                  <Td><Badge tone={orderPayTone[o.payment_status]}>{PAYMENT_STATUS_LABEL[o.payment_status]}</Badge></Td>
                  <Td className="tabular whitespace-nowrap">{money(o.total_usd, 'USD')}</Td>
                  <Td className={`tabular whitespace-nowrap font-semibold ${due > 0 ? 'text-warning' : 'text-ink-3'}`}>{money(Math.max(due, 0), 'USD')}</Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </>
  );
}
