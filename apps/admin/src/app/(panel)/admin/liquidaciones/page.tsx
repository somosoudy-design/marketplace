'use client';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { BalanceStats, PayoutTable, usePayouts, type Balance, type Payout } from '@/components/Payouts';
import { useToast } from '@/components/toast';
import { Button, Card, Dialog, Empty, Field, Input, Loading, Notice, PageHeader, Select, Table, Td, Textarea } from '@/components/ui';
import { money } from '@/lib/format';
import { useStoresIndex } from '@/lib/hooks';
import { kora, rpc } from '@/lib/kora';

export default function SettlementsPage() {
  const stores = useStoresIndex();
  const sellerStores = stores.list.filter((s) => s.kind === 'seller');
  const balances = useQueries({ queries: sellerStores.map((s) => ({ queryKey: ['balance', s.id], queryFn: () => kora().api.seller.balance(s.id) as Promise<Balance> })) });
  const payouts = usePayouts();
  const [create, setCreate] = useState<{ storeId: string; max: number } | null>(null);
  const [adjust, setAdjust] = useState<string | null>(null);
  const [pay, setPay] = useState<Payout | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const cancel = useMutation({
    mutationFn: (id: string) => rpc('cancel_payout', { p_payout_id: id }),
    onSuccess: () => { toast.ok('Liquidación anulada'); qc.invalidateQueries(); },
    onError: toast.error,
  });
  const total = balances.reduce((acc, b) => ({ available_usd: acc.available_usd + Number(b.data?.available_usd ?? 0), scheduled_usd: acc.scheduled_usd + Number(b.data?.scheduled_usd ?? 0), pending_usd: acc.pending_usd + Number(b.data?.pending_usd ?? 0), paid_out_usd: acc.paid_out_usd + Number(b.data?.paid_out_usd ?? 0), commissions_usd: acc.commissions_usd + Number(b.data?.commissions_usd ?? 0) }), { available_usd: 0, scheduled_usd: 0, pending_usd: 0, paid_out_usd: 0, commissions_usd: 0 });

  return (
    <>
      <PageHeader eyebrow="Finanzas" title="Liquidaciones a vendedores" description="El saldo de cada tienda sale del libro contable: ventas entregadas menos comisiones, reembolsos y ajustes. Programar o marcar un pago no transfiere dinero; registra lo que hiciste fuera de la plataforma." />
      <div className="mb-6"><BalanceStats b={total} /></div>
      <Card title="Saldo por tienda" padded={false} className="mb-5">
        {stores.list.length === 0 ? <Loading /> : !sellerStores.length ? <Empty title="No hay tiendas de vendedores" /> : (
          <Table head={['Tienda', 'Disponible', 'Programado', 'En curso', 'Pagado', 'Comisiones', '']}>
            {sellerStores.map((s, i) => {
              const b = balances[i]?.data;
              const free = Number(b?.available_usd ?? 0) - Number(b?.scheduled_usd ?? 0);
              return (
                <tr key={s.id}>
                  <Td className="font-semibold">{s.name}</Td>
                  <Td className="tabular font-semibold text-brand">{money(b?.available_usd, 'USD')}</Td>
                  <Td className="tabular">{money(b?.scheduled_usd, 'USD')}</Td>
                  <Td className="tabular text-ink-2">{money(b?.pending_usd, 'USD')}</Td>
                  <Td className="tabular text-ink-2">{money(b?.paid_out_usd, 'USD')}</Td>
                  <Td className="tabular text-ink-2">{money(b?.commissions_usd, 'USD')}</Td>
                  <Td className="whitespace-nowrap text-right">
                    <Button size="sm" variant="ghost" onClick={() => setAdjust(s.id)}>Ajuste</Button>
                    <Button size="sm" disabled={free <= 0} onClick={() => setCreate({ storeId: s.id, max: free })}>Programar pago</Button>
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
      <Card title="Pagos a vendedores" padded={false}>
        {payouts.data?.length ? (
          <PayoutTable rows={payouts.data} storeName={stores.name} actions={(p) => p.status === 'draft' ? (
            <span className="whitespace-nowrap"><Button size="sm" variant="ghost" loading={cancel.isPending && cancel.variables === p.id} onClick={() => cancel.mutate(p.id)}>Anular</Button><Button size="sm" onClick={() => setPay(p)}>Marcar pagado</Button></span>
          ) : null} />
        ) : <Empty title="Aún no hay pagos programados" />}
      </Card>
      <CreatePayout target={create} name={create ? stores.name(create.storeId) : ''} onClose={() => setCreate(null)} />
      <MarkPaid payout={pay} onClose={() => setPay(null)} />
      <Adjustment storeId={adjust} name={adjust ? stores.name(adjust) : ''} onClose={() => setAdjust(null)} />
    </>
  );
}

function CreatePayout({ target, name, onClose }: { target: { storeId: string; max: number } | null; name: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const m = useMutation({
    mutationFn: () => kora().api.admin.createPayout(target!.storeId, Number(amount.replace(',', '.')), notes.trim() || undefined),
    onSuccess: () => { toast.ok('Pago programado'); qc.invalidateQueries(); setAmount(''); setNotes(''); onClose(); },
    onError: toast.error,
  });
  if (!target) return null;
  return (
    <Dialog open onClose={onClose} title={`Programar pago · ${name}`} footer={<Button disabled={!amount} loading={m.isPending} onClick={() => m.mutate()}>Programar</Button>}>
      <div className="flex flex-col gap-4">
        <Field label="Monto (USD)" hint={`Disponible sin programar: ${money(target.max, 'USD')}`}><Input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Nota"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Corte semanal" /></Field>
      </div>
    </Dialog>
  );
}

function MarkPaid({ payout, onClose }: { payout: Payout | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [method, setMethod] = useState('transferencia_ves');
  const [reference, setReference] = useState('');
  const m = useMutation({
    mutationFn: () => kora().api.admin.markPayoutPaid(payout!.id, method, reference.trim()),
    onSuccess: () => { toast.ok('Pago registrado como hecho'); qc.invalidateQueries(); setReference(''); onClose(); },
    onError: toast.error,
  });
  if (!payout) return null;
  return (
    <Dialog open onClose={onClose} title={`Registrar pago de ${money(payout.amount_usd, 'USD')}`} footer={<Button disabled={!reference.trim()} loading={m.isPending} onClick={() => m.mutate()}>Registrar</Button>}>
      <div className="flex flex-col gap-4">
        <Notice tone="warning">Hazlo solo después de transferir. El registro descuenta el saldo de la tienda en el libro contable.</Notice>
        <Field label="Medio"><Select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="transferencia_ves">Transferencia en bolívares</option><option value="pago_movil">Pago Móvil</option><option value="zelle">Zelle</option><option value="usdt">USDT</option><option value="efectivo">Efectivo</option>
        </Select></Field>
        <Field label="Referencia"><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
      </div>
    </Dialog>
  );
}

function Adjustment({ storeId, name, onClose }: { storeId: string | null; name: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const m = useMutation({
    mutationFn: () => rpc('post_adjustment', { p_store_id: storeId, p_amount: Number(amount.replace(',', '.')), p_memo: memo.trim() }),
    onSuccess: () => { toast.ok('Ajuste registrado'); qc.invalidateQueries(); setAmount(''); setMemo(''); onClose(); },
    onError: toast.error,
  });
  if (!storeId) return null;
  return (
    <Dialog open onClose={onClose} title={`Ajuste · ${name}`} footer={<Button disabled={!amount || !memo.trim()} loading={m.isPending} onClick={() => m.mutate()}>Registrar ajuste</Button>}>
      <div className="flex flex-col gap-4">
        <Field label="Monto (USD)" hint="Positivo: se le acredita a la tienda. Negativo: se le descuenta."><Input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="-5,00" /></Field>
        <Field label="Motivo (queda en auditoría)"><Textarea value={memo} onChange={(e) => setMemo(e.target.value)} /></Field>
      </div>
    </Dialog>
  );
}
