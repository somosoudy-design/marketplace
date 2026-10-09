'use client';
import { OBLIGATION_KIND_LABEL, OBLIGATION_STATUS_LABEL, ORDER_STATUS_LABEL, PAYMENT_RECORD_LABEL, PAYMENT_STATUS_LABEL } from '@kora/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { FulfillmentCard, type FulfillmentRow } from '@/components/Fulfillment';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, Dialog, ErrorBox, Field, Input, Loading, Notice, PageHeader, Select, Table, Td, Textarea, Thumb, Toggle } from '@/components/ui';
import { date, dateTime, money, orderPayTone, paymentTone } from '@/lib/format';
import { useProfiles, useStoresIndex } from '@/lib/hooks';
import { catalogImage, db, kora, rpc, run } from '@/lib/kora';

type Item = { id: string; fulfillment_id: string; store_id: string; title: string; variant_title: string | null; image_path: string | null; unit_price_usd: string; quantity: number; line_total_usd: string; commission_usd: string; refunded_qty: number; refunded_usd: string };
type Order = {
  id: string; number: string; buyer_id: string; status: string; payment_status: string; items_usd: string; shipping_usd: string; discount_usd: string; financing_usd: string;
  refunded_usd: string; total_usd: string; paid_usd: string; plan_code: string; placed_at: string; notes: string | null; cancel_reason: string | null; is_demo: boolean;
  order_items: Item[]; fulfillments: FulfillmentRow[];
  payment_obligations: { id: string; seq: number; kind: string; amount_usd: string; paid_usd: string; waived_usd: string; due_date: string; status: string }[];
  payments: { id: string; number: string; method_code: string; currency: string; amount: string; usd_recognized: string | null; status: string; reference: string | null; created_at: string }[];
  refunds: { id: string; amount_usd: string; reason: string; quantity: number | null; restock: boolean; created_at: string }[];
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const stores = useStoresIndex();
  const [refundItem, setRefundItem] = useState<Item | null>(null);
  const [payout, setPayout] = useState(false);
  const q = useQuery({
    queryKey: ['admin-order', id],
    queryFn: () => run<Order>(db('orders').select('*, order_items(*), fulfillments(*, fulfillment_events(*)), payment_obligations(*), payments(id, number, method_code, currency, amount, usd_recognized, status, reference, created_at), refunds(*)').eq('id', id).single()),
  });
  const ledger = useQuery({
    queryKey: ['admin-order-ledger', id],
    queryFn: () => run<{ id: number; entry_group: string; account: string; amount_usd: string; event: string; memo: string | null; created_at: string }[]>(db('ledger_entries').select('id, entry_group, account, amount_usd, event, memo, created_at').eq('order_id', id).order('id')),
  });
  const name = useProfiles([q.data?.buyer_id]);
  if (q.isPending) return <Loading rows={8} />;
  if (q.isError) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const o = q.data;
  const due = Number(o.total_usd) - Number(o.refunded_usd) - Number(o.paid_usd);
  const refundDue = o.payment_status === 'refund_due';

  return (
    <>
      <Link href="/admin/pedidos" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink"><ArrowLeft size={16} /> Pedidos</Link>
      <PageHeader
        title={`Pedido ${o.number}`}
        description={`${name(o.buyer_id)} · ${dateTime(o.placed_at)} · plan ${o.plan_code}`}
        actions={<><Badge>{ORDER_STATUS_LABEL[o.status]}</Badge><Badge tone={orderPayTone[o.payment_status]}>{PAYMENT_STATUS_LABEL[o.payment_status]}</Badge>{o.is_demo ? <Badge tone="editorial">Demo</Badge> : null}</>}
      />
      {refundDue ? (
        <div className="mb-5"><Notice tone="danger" title="Hay un reembolso por devolver al cliente">
          Cuando hagas la transferencia, regístrala aquí con su referencia. <button className="font-bold underline" onClick={() => setPayout(true)}>Registrar devolución</button>
        </Notice></div>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-5">
          <Card title="Entregas">
            <div className="flex flex-col gap-3">
              {[...o.fulfillments].sort((a, b) => a.seq - b.seq).map((f) => <FulfillmentCard key={f.id} f={f} role="admin" storeName={stores.name(f.store_id)} />)}
            </div>
          </Card>
          <Card title="Productos" padded={false}>
            <Table head={['Producto', 'Tienda', 'Cant.', 'Total', 'Comisión', 'Reembolsado', '']}>
              {o.order_items.map((i) => (
                <tr key={i.id}>
                  <Td><div className="flex items-center gap-3"><Thumb src={catalogImage(i.image_path)} alt={i.title} size={32} /><div><p className="font-semibold">{i.title}</p>{i.variant_title ? <p className="text-[12px] text-ink-3">{i.variant_title}</p> : null}</div></div></Td>
                  <Td className="whitespace-nowrap">{stores.name(i.store_id)}</Td>
                  <Td className="tabular">{i.quantity}</Td>
                  <Td className="tabular whitespace-nowrap">{money(i.line_total_usd, 'USD')}</Td>
                  <Td className="tabular whitespace-nowrap text-ink-2">{money(i.commission_usd, 'USD')}</Td>
                  <Td className="tabular whitespace-nowrap">{i.refunded_qty ? `${i.refunded_qty} · ${money(i.refunded_usd, 'USD')}` : '—'}</Td>
                  <Td className="text-right">{i.refunded_qty < i.quantity ? <Button size="sm" variant="secondary" onClick={() => setRefundItem(i)}>Reembolsar</Button> : null}</Td>
                </tr>
              ))}
            </Table>
          </Card>
          <Card title="Movimientos contables" padded={false}>
            {ledger.data?.length ? (
              <Table head={['Fecha', 'Evento', 'Cuenta', 'Monto', 'Nota']}>
                {ledger.data.map((l) => (
                  <tr key={l.id}>
                    <Td className="whitespace-nowrap text-ink-3">{dateTime(l.created_at)}</Td>
                    <Td>{l.event}</Td><Td className="font-mono text-[12px]">{l.account}</Td>
                    <Td className={`tabular whitespace-nowrap ${Number(l.amount_usd) < 0 ? 'text-danger' : ''}`}>{money(l.amount_usd, 'USD')}</Td>
                    <Td className="text-ink-2">{l.memo ?? ''}</Td>
                  </tr>
                ))}
              </Table>
            ) : <p className="p-5 text-sm text-ink-3">Sin movimientos todavía. Se registran al confirmar pagos, reembolsos y liquidaciones.</p>}
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          <Card title="Saldo">
            <dl className="tabular flex flex-col gap-1.5 text-sm">
              <Row k="Productos" v={money(o.items_usd, 'USD')} />
              <Row k="Envío" v={money(o.shipping_usd, 'USD')} />
              {Number(o.financing_usd) ? <Row k="Recargo por cuotas" v={money(o.financing_usd, 'USD')} /> : null}
              {Number(o.discount_usd) ? <Row k="Descuento" v={`−${money(o.discount_usd, 'USD')}`} /> : null}
              <Row k="Total" v={money(o.total_usd, 'USD')} strong />
              <Row k="Pagado y confirmado" v={money(o.paid_usd, 'USD')} />
              {Number(o.refunded_usd) ? <Row k="Reembolsado" v={money(o.refunded_usd, 'USD')} /> : null}
              <Row k="Saldo pendiente" v={money(Math.max(due, 0), 'USD')} strong />
            </dl>
          </Card>
          <Card title="Plan de pago" padded={false}>
            <Table head={['#', 'Tipo', 'Vence', 'Monto', 'Estado']}>
              {[...o.payment_obligations].sort((a, b) => a.seq - b.seq).map((ob) => (
                <tr key={ob.id}>
                  <Td>{ob.seq}</Td><Td>{OBLIGATION_KIND_LABEL[ob.kind]}</Td><Td className="whitespace-nowrap">{date(ob.due_date)}</Td>
                  <Td className="tabular whitespace-nowrap">{money(ob.amount_usd, 'USD')}{Number(ob.paid_usd) && ob.status !== 'paid' ? <span className="block text-[12px] text-ink-3">pagado {money(ob.paid_usd, 'USD')}</span> : null}</Td>
                  <Td><Badge tone={ob.status === 'paid' ? 'success' : ob.status === 'cancelled' ? 'neutral' : new Date(ob.due_date) < new Date() ? 'danger' : 'warning'}>{OBLIGATION_STATUS_LABEL[ob.status]}</Badge></Td>
                </tr>
              ))}
            </Table>
          </Card>
          <Card title="Pagos" padded={false}>
            {o.payments.length ? (
              <Table head={['Pago', 'Monto', 'Estado']}>
                {o.payments.map((p) => (
                  <tr key={p.id}>
                    <Td className="whitespace-nowrap"><Link href="/admin/pagos" className="font-semibold text-brand">{p.number}</Link><span className="block text-[12px] text-ink-3">{dateTime(p.created_at)}</span></Td>
                    <Td className="tabular whitespace-nowrap">{money(p.amount, p.currency)}{p.usd_recognized ? <span className="block text-[12px] text-ink-3">{money(p.usd_recognized, 'USD')} reconocidos</span> : null}</Td>
                    <Td><Badge tone={paymentTone[p.status]}>{PAYMENT_RECORD_LABEL[p.status]}</Badge></Td>
                  </tr>
                ))}
              </Table>
            ) : <p className="p-5 text-sm text-ink-3">Sin pagos registrados.</p>}
          </Card>
          {o.refunds.length ? (
            <Card title="Reembolsos">
              <ul className="flex flex-col gap-2 text-sm">
                {o.refunds.map((r) => <li key={r.id}><b className="tabular">{money(r.amount_usd, 'USD')}</b> · {r.reason}<span className="block text-[12px] text-ink-3">{dateTime(r.created_at)}{r.restock ? ' · volvió al inventario' : ''}</span></li>)}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
      <RefundDialog item={refundItem} onClose={() => setRefundItem(null)} />
      <RefundPayoutDialog orderId={o.id} open={payout} onClose={() => setPayout(false)} />
    </>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return <div className={`flex justify-between gap-4 ${strong ? 'border-t border-line pt-1.5 font-bold' : 'text-ink-2'}`}><dt>{k}</dt><dd>{v}</dd></div>;
}

function RefundDialog({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState('');
  const [restock, setRestock] = useState(false);
  const m = useMutation({
    mutationFn: () => kora().api.admin.refundItem(item!.id, qty, reason.trim(), restock),
    onSuccess: (r) => {
      toast.ok(`Reembolso registrado: ${money(r.refunded_usd, 'USD')}${Number(r.refund_due_usd) > 0 ? `. Por devolver: ${money(r.refund_due_usd, 'USD')}` : ''}`);
      qc.invalidateQueries();
      onClose();
    },
    onError: toast.error,
  });
  if (!item) return null;
  const max = item.quantity - item.refunded_qty;
  return (
    <Dialog open onClose={onClose} title={`Reembolsar «${item.title}»`} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="danger" disabled={!reason.trim() || qty < 1 || qty > max} loading={m.isPending} onClick={() => m.mutate()}>Registrar reembolso</Button></>}>
      <div className="flex flex-col gap-4">
        <Notice tone="info">El monto se calcula en el servidor según el precio pagado. Si el cliente ya pagó, el pedido queda con un reembolso pendiente hasta que registres la devolución.</Notice>
        <Field label={`Unidades (máximo ${max})`}><Input type="number" min={1} max={max} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></Field>
        <Field label="Motivo"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Llegó dañado; el cliente envió fotos." /></Field>
        <label className="flex items-center justify-between gap-3 text-sm"><span>Devolver las unidades al inventario</span><Toggle label="Devolver al inventario" checked={restock} onChange={setRestock} /></label>
      </div>
    </Dialog>
  );
}

function RefundPayoutDialog({ orderId, open, onClose }: { orderId: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('pago_movil');
  const [reference, setReference] = useState('');
  const m = useMutation({
    mutationFn: () => rpc('record_refund_payout', { p_order_id: orderId, p_amount: Number(amount.replace(',', '.')), p_method: method, p_reference: reference.trim() }),
    onSuccess: () => { toast.ok('Devolución registrada'); qc.invalidateQueries(); onClose(); },
    onError: toast.error,
  });
  return (
    <Dialog open={open} onClose={onClose} title="Registrar devolución al cliente" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={!amount || !reference.trim()} loading={m.isPending} onClick={() => m.mutate()}>Registrar</Button></>}>
      <div className="flex flex-col gap-4">
        <Notice tone="warning">Registra solo transferencias que ya hiciste. Este paso no mueve dinero: deja constancia contable de la devolución.</Notice>
        <Field label="Monto devuelto (USD equivalentes)"><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Medio"><Select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="pago_movil">Pago Móvil</option><option value="transferencia_ves">Transferencia en bolívares</option><option value="zelle">Zelle</option><option value="usdt">USDT</option><option value="efectivo">Efectivo</option>
        </Select></Field>
        <Field label="Referencia"><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
      </div>
    </Dialog>
  );
}
