'use client';
import { PAYOUT_STATUS_LABEL } from '@kora/core';
import { useQuery } from '@tanstack/react-query';
import { Badge, Stat, Table, Td } from './ui';
import { dateTime, money } from '@/lib/format';
import { db, kora, run } from '@/lib/kora';

export type Balance = { available_usd: number; scheduled_usd: number; pending_usd: number; paid_out_usd: number; commissions_usd: number };
export type Payout = { id: string; store_id: string; amount_usd: string; status: string; method: string | null; reference: string | null; notes: string | null; created_at: string; paid_at: string | null };

export function useBalance(storeId: string | undefined) {
  return useQuery({ queryKey: ['balance', storeId], queryFn: () => kora().api.seller.balance(storeId!) as Promise<Balance>, enabled: !!storeId });
}
export function usePayouts(storeId?: string) {
  return useQuery({
    queryKey: ['payouts', storeId ?? 'all'],
    queryFn: () => {
      let q = db('payouts').select('*').order('created_at', { ascending: false }).limit(200);
      if (storeId) q = q.eq('store_id', storeId);
      return run<Payout[]>(q);
    },
  });
}

export function BalanceStats({ b }: { b: Balance | undefined }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Stat label="Disponible para liquidar" value={money(b?.available_usd, 'USD')} tone="brand" hint="Entregas cerradas, menos comisiones" />
      <Stat label="Programado" value={money(b?.scheduled_usd, 'USD')} hint="Pagos en preparación" />
      <Stat label="En curso" value={money(b?.pending_usd, 'USD')} hint="Se libera al entregar" />
      <Stat label="Pagado" value={money(b?.paid_out_usd, 'USD')} />
      <Stat label="Comisiones" value={money(b?.commissions_usd, 'USD')} />
    </div>
  );
}

export function PayoutTable({ rows, storeName, actions }: { rows: Payout[]; storeName?: (id: string) => string; actions?: (p: Payout) => React.ReactNode }) {
  return (
    <Table head={[...(storeName ? ['Tienda'] : []), 'Creado', 'Monto', 'Estado', 'Medio y referencia', 'Nota', ...(actions ? [''] : [])]}>
      {rows.map((p) => (
        <tr key={p.id}>
          {storeName ? <Td className="font-semibold">{storeName(p.store_id)}</Td> : null}
          <Td className="whitespace-nowrap text-ink-2">{dateTime(p.created_at)}</Td>
          <Td className="tabular font-semibold">{money(p.amount_usd, 'USD')}</Td>
          <Td><Badge tone={p.status === 'paid' ? 'success' : p.status === 'cancelled' ? 'neutral' : 'warning'}>{PAYOUT_STATUS_LABEL[p.status]}</Badge></Td>
          <Td className="text-ink-2">{p.status === 'paid' ? `${p.method ?? ''} · ${p.reference ?? ''} · ${dateTime(p.paid_at)}` : '—'}</Td>
          <Td className="text-ink-2">{p.notes ?? ''}</Td>
          {actions ? <Td className="text-right">{actions(p)}</Td> : null}
        </tr>
      ))}
    </Table>
  );
}
