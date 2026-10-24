'use client';
import { PAYMENT_RECORD_LABEL } from '@kora/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileImage, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, Dialog, Empty, ErrorBox, Field, Input, Loading, Notice, PageHeader, Table, Tabs, Td, Textarea } from '@/components/ui';
import { ago, dateTime, money, paymentTone, RATE_SOURCE_LABEL } from '@/lib/format';
import { useProfiles } from '@/lib/hooks';
import { db, kora, run } from '@/lib/kora';

type Row = {
  id: string; number: string; order_id: string; buyer_id: string; quote_id: string; method_code: string; currency: string; amount: string;
  amount_received: string | null; rate_applied: string; base_usd: string; fee_usd: string; usd_recognized: string | null; reference: string | null;
  proof_path: string | null; payer_name: string | null; payer_bank: string | null; payer_phone: string | null; declared_paid_at: string | null;
  status: string; provider: string | null; verified_at: string | null; rejection_reason: string | null; created_at: string;
  orders: { number: string; total_usd: string; paid_usd: string } | null;
  payment_methods: { name: string; kind: string } | null;
  payment_quotes: { rate_source: string; rate_observed_at: string; issued_at: string; expires_at: string } | null;
};
type Filter = 'pending' | 'confirmed' | 'rejected';

export default function PaymentsPage() {
  const [filter, setFilter] = useState<Filter>('pending');
  const [open, setOpen] = useState<Row | null>(null);
  const statuses = filter === 'pending' ? ['pending_verification', 'processing'] : filter === 'confirmed' ? ['confirmed', 'refunded'] : ['rejected', 'failed'];
  const q = useQuery({
    queryKey: ['admin-payments', filter],
    queryFn: () =>
      run<Row[]>(
        db('payments')
          .select('*, orders(number, total_usd, paid_usd), payment_methods(name, kind), payment_quotes(rate_source, rate_observed_at, issued_at, expires_at)')
          .in('status', statuses)
          .order('created_at', { ascending: filter === 'pending' })
          .limit(200),
      ),
    refetchInterval: filter === 'pending' ? 30_000 : false,
  });
  const name = useProfiles((q.data ?? []).map((p) => p.buyer_id));

  return (
    <>
      <PageHeader
        eyebrow="Operación"
        title="Verificar pagos"
        description="Confirma cada pago contra el estado de cuenta o la billetera antes de aprobarlo. Un comprobante o una referencia no bastan por sí solos."
      />
      <Tabs value={filter} onChange={setFilter} items={[{ value: 'pending', label: 'Por verificar' }, { value: 'confirmed', label: 'Confirmados' }, { value: 'rejected', label: 'Rechazados' }]} />
      <Card padded={false}>
        {q.isPending ? <Loading /> : q.isError ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : !q.data.length ? (
          <Empty title={filter === 'pending' ? 'No hay pagos por verificar' : 'Sin registros'} body={filter === 'pending' ? 'Los pagos que envíen los compradores aparecerán aquí, del más antiguo al más reciente.' : undefined} />
        ) : (
          <Table head={['Pago', 'Pedido', 'Cliente', 'Método', 'Monto', 'Referencia', 'Enviado', 'Estado', '']}>
            {q.data.map((p) => (
              <tr key={p.id} className="hover:bg-sunken/50">
                <Td className="whitespace-nowrap font-semibold">{p.number}</Td>
                <Td className="whitespace-nowrap"><Link className="font-semibold text-brand" href={`/admin/pedidos/ver?id=${p.order_id}`}>{p.orders?.number}</Link></Td>
                <Td>{p.payer_name ?? name(p.buyer_id)}</Td>
                <Td className="whitespace-nowrap">{p.payment_methods?.name ?? p.method_code}</Td>
                <Td className="tabular whitespace-nowrap">
                  <span className="font-semibold">{money(p.amount, p.currency)}</span>
                  <span className="block text-[12px] text-ink-3">{money(Number(p.base_usd) + Number(p.fee_usd), 'USD')}{p.currency !== 'USD' ? ` · tasa ${Number(p.rate_applied).toLocaleString('es-VE')}` : ''}</span>
                </Td>
                <Td className="font-mono text-[13px]">{p.reference ?? '—'}</Td>
                <Td className="whitespace-nowrap text-ink-2">{ago(p.created_at)}</Td>
                <Td><Badge tone={paymentTone[p.status]}>{PAYMENT_RECORD_LABEL[p.status] ?? p.status}</Badge></Td>
                <Td className="text-right">
                  <Button size="sm" variant={filter === 'pending' ? 'primary' : 'secondary'} onClick={() => setOpen(p)}>{filter === 'pending' ? 'Revisar' : 'Ver'}</Button>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <ReviewDialog key={open?.id ?? 'closed'} payment={open} buyerName={open ? open.payer_name ?? name(open.buyer_id) : ''} onClose={() => setOpen(null)} />
    </>
  );
}

function ReviewDialog({ payment: p, buyerName, onClose }: { payment: Row | null; buyerName: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [mode, setMode] = useState<'view' | 'reject' | 'partial'>('view');
  const [reason, setReason] = useState('');
  const [received, setReceived] = useState('');
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofError, setProofError] = useState(false);

  useEffect(() => {
    // the dialog is keyed by payment, so its form state starts fresh for each one
    if (!p?.proof_path) return;
    let url: string | null = null;
    let cancelled = false;
    kora().client.storage.from('payment-proofs').download(p.proof_path).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) return setProofError(true);
      url = URL.createObjectURL(data);
      setProofUrl(url);
    });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [p?.id, p?.proof_path]);

  const review = useMutation({
    mutationFn: (approve: boolean) =>
      kora().api.admin.reviewPayment(p!.id, approve, {
        amountReceived: approve && mode === 'partial' && received ? Number(received.replace(',', '.')) : undefined,
        reason: reason.trim() || undefined,
      }),
    onSuccess: (r) => {
      toast.ok(r.status === 'confirmed' ? `Pago ${p!.number} confirmado` : `Pago ${p!.number} rechazado`);
      qc.invalidateQueries({ queryKey: ['admin-payments'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      onClose();
    },
    onError: toast.error,
  });
  if (!p) return <Dialog open={false} onClose={onClose} title="">{null}</Dialog>;
  const pending = p.status === 'pending_verification' || p.status === 'processing';
  const isProvider = p.payment_methods?.kind === 'automated';

  return (
    <Dialog
      open={!!p}
      onClose={onClose}
      wide
      title={`Pago ${p.number}`}
      footer={
        pending ? (
          mode === 'view' ? (
            <>
              <Button variant="ghost" onClick={() => setMode('reject')}>Rechazar</Button>
              <Button variant="secondary" onClick={() => setMode('partial')}>Llegó un monto distinto</Button>
              <Button icon={ShieldCheck} loading={review.isPending} onClick={() => review.mutate(true)}>Confirmar recibido</Button>
            </>
          ) : mode === 'reject' ? (
            <>
              <Button variant="ghost" onClick={() => setMode('view')}>Volver</Button>
              <Button variant="danger" disabled={!reason.trim()} loading={review.isPending} onClick={() => review.mutate(false)}>Rechazar pago</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setMode('view')}>Volver</Button>
              <Button disabled={!received || !reason.trim()} loading={review.isPending} onClick={() => review.mutate(true)}>Confirmar monto parcial</Button>
            </>
          )
        ) : undefined
      }
    >
      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Item label="Pedido" value={<Link className="font-semibold text-brand" href={`/admin/pedidos/ver?id=${p.order_id}`}>{p.orders?.number}</Link>} />
            <Item label="Cliente" value={buyerName} />
            <Item label="Método" value={p.payment_methods?.name ?? p.method_code} />
            <Item label="Monto a recibir" value={<span className="tabular text-base font-bold">{money(p.amount, p.currency)}</span>} />
            <Item label="Equivale a" value={<span className="tabular">{money(Number(p.base_usd) + Number(p.fee_usd), 'USD')}{Number(p.fee_usd) > 0 ? ` (incluye ${money(p.fee_usd, 'USD')} de cargo)` : ''}</span>} />
            {p.currency !== 'USD' ? <Item label="Tasa aplicada" value={<span className="tabular">{Number(p.rate_applied).toLocaleString('es-VE', { maximumFractionDigits: 6 })} · {RATE_SOURCE_LABEL[p.payment_quotes?.rate_source ?? ''] ?? p.payment_quotes?.rate_source}</span>} /> : null}
            <Item label="Referencia" value={<span className="font-mono">{p.reference ?? '—'}</span>} />
            <Item label="Banco / teléfono del pagador" value={[p.payer_bank, p.payer_phone].filter(Boolean).join(' · ') || '—'} />
            <Item label="Cotización emitida" value={dateTime(p.payment_quotes?.issued_at)} />
            <Item label="Enviado por el cliente" value={dateTime(p.created_at)} />
            {p.amount_received ? <Item label="Monto recibido" value={money(p.amount_received, p.currency)} /> : null}
            {p.usd_recognized ? <Item label="Reconocido en USD" value={money(p.usd_recognized, 'USD')} /> : null}
            {p.rejection_reason ? <Item label="Motivo" value={p.rejection_reason} /> : null}
          </dl>
          {pending && isProvider ? <Notice tone="info">Pago iniciado en la pasarela del proveedor. Se confirma solo con la notificación firmada del proveedor; apruébalo manualmente únicamente si lo verificaste en su panel.</Notice> : null}
          {pending && mode === 'view' ? (
            <Notice tone="warning" title="Antes de confirmar">Verifica en el banco o la billetera que el monto exacto llegó con esta referencia. Al confirmar, el saldo del pedido se actualiza y el cliente recibe la notificación.</Notice>
          ) : null}
          {mode === 'reject' ? (
            <Field label="Motivo del rechazo (lo verá el cliente)">
              <Textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="No encontramos un pago con esa referencia en la fecha indicada." />
            </Field>
          ) : null}
          {mode === 'partial' ? (
            <>
              <Field label={`Monto recibido en ${p.currency}`} hint={`Máximo ${money(p.amount, p.currency)}. El pedido abona la parte proporcional en USD.`}>
                <Input autoFocus inputMode="decimal" value={received} onChange={(e) => setReceived(e.target.value)} />
              </Field>
              <Field label="Nota interna">
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Llegó un monto menor por comisión bancaria." />
              </Field>
            </>
          ) : null}
        </div>
        <div>
          <p className="mb-2 text-[13px] font-semibold text-ink-2">Comprobante</p>
          {!p.proof_path ? (
            <div className="grid h-64 place-items-center rounded-[16px] border border-dashed border-line-strong text-center text-sm text-ink-3"><span><FileImage className="mx-auto mb-2" />Sin comprobante adjunto</span></div>
          ) : proofError ? (
            <Notice tone="danger">No pudimos abrir el comprobante.</Notice>
          ) : proofUrl ? (
            <a href={proofUrl} target="_blank" rel="noreferrer">
              <img src={proofUrl} alt={`Comprobante del pago ${p.number}`} className="max-h-[420px] w-full rounded-[16px] border border-line object-contain" />
            </a>
          ) : (
            <div className="h-64 animate-pulse rounded-[16px] bg-sunken" />
          )}
        </div>
      </div>
    </Dialog>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] font-semibold text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-ink">{value}</dd>
    </div>
  );
}
