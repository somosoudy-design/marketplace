'use client';
import { OBLIGATION_KIND_LABEL, OBLIGATION_STATUS_LABEL } from '@kora/core';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader, Stat, Table, Tabs, Td } from '@/components/ui';
import { date, money } from '@/lib/format';
import { useProfiles } from '@/lib/hooks';
import { db, run } from '@/lib/kora';

type Row = { id: string; order_id: string; seq: number; kind: string; amount_usd: string; paid_usd: string; waived_usd: string; due_date: string; status: string; orders: { number: string; buyer_id: string; plan_code: string; status: string } | null };

export default function InstallmentsPage() {
  const [tab, setTab] = useState<'overdue' | 'upcoming' | 'paid'>('overdue');
  const today = new Date().toISOString().slice(0, 10);
  const q = useQuery({
    queryKey: ['obligations', tab],
    queryFn: () => {
      let r = db('payment_obligations').select('*, orders!inner(number, buyer_id, plan_code, status)').neq('orders.status', 'cancelled');
      if (tab === 'overdue') r = r.in('status', ['pending', 'partially_paid']).lt('due_date', today).order('due_date');
      else if (tab === 'upcoming') r = r.in('status', ['pending', 'partially_paid']).gte('due_date', today).order('due_date');
      else r = r.eq('status', 'paid').order('updated_at', { ascending: false });
      return run<Row[]>(r.limit(300));
    },
  });
  const name = useProfiles((q.data ?? []).map((o) => o.orders?.buyer_id));
  const outstanding = (q.data ?? []).reduce((s, o) => s + Number(o.amount_usd) - Number(o.paid_usd) - Number(o.waived_usd), 0);
  return (
    <>
      <PageHeader eyebrow="Operación" title="Cuotas y anticipos" description="Cada cuota está fijada en USD; el monto en bolívares se calcula al momento de pagar con la tasa vigente. Los recordatorios salen automáticamente antes del vencimiento." />
      <Tabs value={tab} onChange={setTab} items={[{ value: 'overdue', label: 'Vencidas' }, { value: 'upcoming', label: 'Por vencer' }, { value: 'paid', label: 'Pagadas' }]} />
      {tab !== 'paid' ? <div className="mb-5 grid max-w-md grid-cols-2 gap-3"><Stat label="Cuotas" value={q.data?.length ?? '—'} /><Stat label="Saldo" value={money(outstanding, 'USD')} tone={tab === 'overdue' && outstanding > 0 ? 'danger' : 'default'} /></div> : null}
      <Card padded={false}>
        {q.isPending ? <Loading /> : q.isError ? <ErrorBox error={q.error} /> : !q.data.length ? <Empty title={tab === 'overdue' ? 'No hay cuotas vencidas' : 'Sin cuotas'} /> : (
          <Table head={['Pedido', 'Cliente', 'Cuota', 'Vence', 'Monto', 'Pagado', 'Estado']}>
            {q.data.map((o) => (
              <tr key={o.id}>
                <Td><Link className="font-semibold text-brand" href={`/admin/pedidos/${o.order_id}`}>{o.orders?.number}</Link></Td>
                <Td>{name(o.orders?.buyer_id)}</Td>
                <Td>{OBLIGATION_KIND_LABEL[o.kind]} {o.seq}</Td>
                <Td className={`whitespace-nowrap ${tab === 'overdue' ? 'font-semibold text-danger' : ''}`}>{date(o.due_date)}</Td>
                <Td className="tabular">{money(o.amount_usd, 'USD')}</Td>
                <Td className="tabular text-ink-2">{money(o.paid_usd, 'USD')}</Td>
                <Td><Badge tone={o.status === 'paid' ? 'success' : tab === 'overdue' ? 'danger' : 'warning'}>{OBLIGATION_STATUS_LABEL[o.status]}</Badge></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
