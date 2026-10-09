'use client';
import { FLOW_LABEL } from '@kora/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useToast } from './toast';
import { Badge, Button, Dialog, Field, Input, Select, Textarea } from './ui';
import { date, dateTime, money } from '@/lib/format';
import { db, kora, run } from '@/lib/kora';

export type Step = { flow: string; code: string; seq: number; label: string; requires_payment: string | null; is_terminal: boolean; seller_can_set: boolean };
export type FulfillmentRow = {
  id: string; order_id: string; seq: number; store_id: string; flow: string; status: string; shipping_method_name: string | null; shipping_kind: string | null;
  shipping_usd: string | null; eta_min_date: string | null; eta_max_date: string | null; carrier_name: string | null; tracking_number: string | null;
  cargo_batch_id: string | null; delivered_at: string | null; created_at: string; ship_to: Record<string, string | boolean | null>;
  fulfillment_events?: { id: number; step_code: string; note: string | null; source: string | null; visible_to_buyer: boolean; created_at: string }[];
};

export function useSteps() {
  const q = useQuery({ queryKey: ['fulfillment-steps'], queryFn: () => run<Step[]>(db('fulfillment_steps').select('*').order('flow').order('seq')), staleTime: Infinity });
  const steps = q.data ?? [];
  return {
    steps,
    label: (flow: string, code: string) => steps.find((s) => s.flow === flow && s.code === code)?.label ?? code,
    next: (flow: string, code: string, role: 'admin' | 'seller') => {
      const cur = steps.find((s) => s.flow === flow && s.code === code);
      if (!cur || cur.is_terminal) return [];
      return steps.filter((s) => s.flow === flow && s.seq > cur.seq && s.code !== 'cancelled' && (role === 'admin' || s.seller_can_set));
    },
  };
}

export function FulfillmentCard({ f, role, storeName, paymentLevel }: { f: FulfillmentRow; role: 'admin' | 'seller'; storeName?: string; paymentLevel?: 'full' | 'down_payment' | 'none' }) {
  const { label, next } = useSteps();
  const [open, setOpen] = useState(false);
  // Steps that need a confirmed payment are only offered once it is confirmed (the database enforces it too).
  const reachable = next(f.flow, f.status, role);
  const options = paymentLevel ? reachable.filter((s) => !s.requires_payment || paymentLevel === 'full' || (s.requires_payment === 'down_payment' && paymentLevel === 'down_payment')) : reachable;
  const waitingPayment = reachable.length > 0 && options.length === 0;
  const addr = f.ship_to ?? {};
  return (
    <div className="rounded-[16px] border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold">Entrega {f.seq}{storeName ? ` · ${storeName}` : ''}</p>
          <p className="text-[13px] text-ink-2">{FLOW_LABEL[f.flow]} · {f.shipping_method_name ?? 'Sin método'}{f.shipping_usd != null ? ` · ${money(f.shipping_usd, 'USD')}` : ''}</p>
          {f.eta_min_date ? <p className="text-[13px] text-ink-3">Estimado entre {date(f.eta_min_date)} y {date(f.eta_max_date)}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={f.status === 'delivered' ? 'success' : f.status === 'cancelled' ? 'danger' : 'brand'}>{label(f.flow, f.status)}</Badge>
          {options.length ? <Button size="sm" onClick={() => setOpen(true)}>Actualizar estado</Button> : waitingPayment ? <span className="text-[13px] font-semibold text-ink-3">Esperando pago</span> : null}
        </div>
      </div>
      <div className="mt-3 grid gap-3 text-[13px] sm:grid-cols-2">
        <div>
          <p className="font-semibold text-ink-3">Enviar a</p>
          {addr.anonymized ? <p className="text-ink-2">Datos anonimizados · {String(addr.city ?? '')}</p> : (
            <p className="text-ink-2">{[addr.recipient, addr.phone].filter(Boolean).join(' · ')}<br />{[addr.line1, addr.municipality, addr.city].filter(Boolean).join(', ')}{addr.reference ? <><br />Ref.: {String(addr.reference)}</> : null}</p>
          )}
        </div>
        <div>
          <p className="font-semibold text-ink-3">Transporte</p>
          <p className="text-ink-2">{f.carrier_name ?? '—'}{f.tracking_number ? ` · guía ${f.tracking_number}` : ''}{f.cargo_batch_id ? ' · en lote de carga' : ''}</p>
        </div>
      </div>
      {f.fulfillment_events?.length ? (
        <ol className="mt-3 border-t border-line pt-3 text-[13px]">
          {[...f.fulfillment_events].sort((a, b) => b.id - a.id).map((e) => (
            <li key={e.id} className="py-0.5 text-ink-2">
              <span className="text-ink-3">{dateTime(e.created_at)}</span> · <b>{label(f.flow, e.step_code)}</b>{e.note ? ` — ${e.note}` : ''}{!e.visible_to_buyer ? ' (interno)' : ''}
            </li>
          ))}
        </ol>
      ) : null}
      <AdvanceDialog f={f} open={open} onClose={() => setOpen(false)} options={options} />
    </div>
  );
}

function AdvanceDialog({ f, open, onClose, options }: { f: FulfillmentRow; open: boolean; onClose: () => void; options: Step[] }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [step, setStep] = useState('');
  const [note, setNote] = useState('');
  const [tracking, setTracking] = useState(f.tracking_number ?? '');
  const [carrier, setCarrier] = useState(f.carrier_name ?? '');
  const chosen = options.find((o) => o.code === (step || options[0]?.code));
  const m = useMutation({
    mutationFn: () => kora().api.seller.advance(f.id, chosen!.code, { note: note.trim() || undefined, tracking: tracking.trim() || undefined, carrier: carrier.trim() || undefined }),
    onSuccess: () => {
      toast.ok(`Entrega actualizada a «${chosen!.label}»`);
      qc.invalidateQueries();
      onClose();
    },
    onError: toast.error,
  });
  return (
    <Dialog open={open} onClose={onClose} title="Actualizar entrega" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button loading={m.isPending} disabled={!chosen} onClick={() => m.mutate()}>Guardar</Button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Nuevo estado" hint={chosen?.requires_payment ? `Requiere ${chosen.requires_payment === 'full' ? 'el pago completo' : 'el anticipo'} confirmado.` : undefined}>
          <Select value={chosen?.code ?? ''} onChange={(e) => setStep(e.target.value)}>
            {options.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
          </Select>
        </Field>
        {chosen && ['dispatched', 'out_for_delivery', 'in_transit'].includes(chosen.code) ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Empresa de envío"><Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="MRW, Zoom, Tealca…" /></Field>
            <Field label="Número de guía"><Input value={tracking} onChange={(e) => setTracking(e.target.value)} /></Field>
          </div>
        ) : null}
        <Field label="Nota para el cliente (opcional)"><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Dialog>
  );
}
