'use client';
import { FLOW_LABEL } from '@kora/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useSteps } from '@/components/Fulfillment';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, Dialog, Empty, ErrorBox, Field, Input, Loading, Notice, PageHeader, Select, Table, Tabs, Td, Textarea } from '@/components/ui';
import { ago, date, dateTime } from '@/lib/format';
import { useStoresIndex } from '@/lib/hooks';
import { db, kora, rpc, run } from '@/lib/kora';

type Batch = { id: string; code: string; step_code: string; description: string | null; carrier: string | null; tracking_number: string | null; created_at: string; updated_at: string; fulfillments: { count: number }[] };
type F = { id: string; seq: number; flow: string; status: string; store_id: string; cargo_batch_id: string | null; eta_max_date: string | null; created_at: string; orders: { id: string; number: string; payment_status: string } | null };

export default function ShippingPage() {
  const [tab, setTab] = useState<'batches' | 'unassigned' | 'active'>('batches');
  const [creating, setCreating] = useState(false);
  const [openBatch, setOpenBatch] = useState<Batch | null>(null);
  const { label } = useSteps();
  const stores = useStoresIndex();
  const batches = useQuery({ queryKey: ['batches'], queryFn: () => run<Batch[]>(db('cargo_batches').select('*, fulfillments(count)').order('created_at', { ascending: false }).limit(100)) });
  const fulfillments = useQuery({
    queryKey: ['active-fulfillments'],
    queryFn: () => run<F[]>(db('fulfillments').select('id, seq, flow, status, store_id, cargo_batch_id, eta_max_date, created_at, orders(id, number, payment_status)').not('status', 'in', '(delivered,cancelled)').order('created_at').limit(500)),
  });
  const unassigned = (fulfillments.data ?? []).filter((f) => f.flow === 'import_order' && !f.cargo_batch_id);

  return (
    <>
      <PageHeader eyebrow="Operación" title="Lotes y envíos" description="Los pedidos por encargo viajan agrupados en lotes de carga: al avanzar un lote, cada entrega que cumpla sus requisitos de pago avanza con él y el cliente recibe el aviso." actions={<Button icon={Plus} onClick={() => setCreating(true)}>Nuevo lote</Button>} />
      <Tabs value={tab} onChange={setTab} items={[{ value: 'batches', label: 'Lotes', count: batches.data?.length }, { value: 'unassigned', label: 'Encargos sin lote', count: unassigned.length }, { value: 'active', label: 'Entregas en curso', count: fulfillments.data?.length }]} />
      {tab === 'batches' ? (
        <Card padded={false}>
          {batches.isPending ? <Loading /> : batches.isError ? <ErrorBox error={batches.error} /> : !batches.data.length ? <Empty title="Aún no hay lotes" body="Crea un lote cuando compres mercancía para varios encargos." /> : (
            <Table head={['Lote', 'Estado', 'Entregas', 'Transporte', 'Actualizado', '']}>
              {batches.data.map((b) => (
                <tr key={b.id} className="hover:bg-sunken/50">
                  <Td><p className="font-semibold">{b.code}</p>{b.description ? <p className="text-[12px] text-ink-3">{b.description}</p> : null}</Td>
                  <Td><Badge tone="brand">{label('import_order', b.step_code)}</Badge></Td>
                  <Td className="tabular">{b.fulfillments?.[0]?.count ?? 0}</Td>
                  <Td className="text-ink-2">{[b.carrier, b.tracking_number].filter(Boolean).join(' · ') || '—'}</Td>
                  <Td className="whitespace-nowrap text-ink-3">{ago(b.updated_at)}</Td>
                  <Td className="text-right"><Button size="sm" variant="secondary" onClick={() => setOpenBatch(b)}>Abrir</Button></Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      ) : tab === 'unassigned' ? (
        <Unassigned rows={unassigned} batches={batches.data ?? []} storeName={stores.name} />
      ) : (
        <Card padded={false}>
          {fulfillments.isPending ? <Loading /> : !fulfillments.data?.length ? <Empty title="No hay entregas en curso" /> : (
            <Table head={['Pedido', 'Entrega', 'Tienda', 'Flujo', 'Estado', 'Llega a más tardar']}>
              {fulfillments.data.map((f) => (
                <tr key={f.id}>
                  <Td><Link className="font-semibold text-brand" href={`/admin/pedidos/${f.orders?.id}`}>{f.orders?.number}</Link></Td>
                  <Td>{f.seq}</Td><Td>{stores.name(f.store_id)}</Td><Td>{FLOW_LABEL[f.flow]}</Td>
                  <Td><Badge tone="brand">{label(f.flow, f.status)}</Badge></Td>
                  <Td className={f.eta_max_date && new Date(f.eta_max_date) < new Date() ? 'font-semibold text-danger' : 'text-ink-2'}>{date(f.eta_max_date)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}
      <CreateBatch open={creating} onClose={() => setCreating(false)} />
      <BatchDialog batch={openBatch} onClose={() => setOpenBatch(null)} storeName={stores.name} />
    </>
  );
}

function Unassigned({ rows, batches, storeName }: { rows: F[]; batches: Batch[]; storeName: (id: string) => string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { label } = useSteps();
  const [sel, setSel] = useState<string[]>([]);
  const [batchId, setBatchId] = useState('');
  const open = batches.filter((b) => b.step_code !== 'delivered');
  const assign = useMutation({
    mutationFn: () => rpc<number>('assign_to_batch', { p_batch_id: batchId || open[0]?.id, p_fulfillment_ids: sel }),
    onSuccess: (n) => { toast.ok(`${n} entregas asignadas al lote`); setSel([]); qc.invalidateQueries(); },
    onError: toast.error,
  });
  if (!rows.length) return <Card><Empty title="Todos los encargos tienen lote" /></Card>;
  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
        <span className="text-sm text-ink-2">{sel.length} seleccionadas</span>
        <Select aria-label="Lote" value={batchId || open[0]?.id || ''} onChange={(e) => setBatchId(e.target.value)} className="h-9 w-auto">
          {open.map((b) => <option key={b.id} value={b.id}>{b.code} · {label('import_order', b.step_code)}</option>)}
        </Select>
        <Button size="sm" disabled={!sel.length || !open.length} loading={assign.isPending} onClick={() => assign.mutate()}>Asignar al lote</Button>
      </div>
      <Table head={['', 'Pedido', 'Tienda', 'Estado', 'Pago', 'Creado']}>
        {rows.map((f) => (
          <tr key={f.id}>
            <Td><input type="checkbox" aria-label={`Seleccionar ${f.orders?.number}`} checked={sel.includes(f.id)} onChange={(e) => setSel((x) => (e.target.checked ? [...x, f.id] : x.filter((i) => i !== f.id)))} /></Td>
            <Td className="font-semibold">{f.orders?.number} · {f.seq}</Td><Td>{storeName(f.store_id)}</Td>
            <Td><Badge tone="brand">{label(f.flow, f.status)}</Badge></Td>
            <Td>{f.orders?.payment_status === 'unpaid' ? <Badge tone="warning">Sin anticipo</Badge> : <Badge tone="success">Con pago</Badge>}</Td>
            <Td className="text-ink-3">{ago(f.created_at)}</Td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

function CreateBatch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ code: '', description: '', carrier: '', tracking: '' });
  const m = useMutation({
    mutationFn: () => run(db('cargo_batches').insert({ code: f.code.trim().toUpperCase(), description: f.description.trim() || null, carrier: f.carrier.trim() || null, tracking_number: f.tracking.trim() || null })),
    onSuccess: () => { toast.ok('Lote creado'); qc.invalidateQueries({ queryKey: ['batches'] }); setF({ code: '', description: '', carrier: '', tracking: '' }); onClose(); },
    onError: toast.error,
  });
  return (
    <Dialog open={open} onClose={onClose} title="Nuevo lote de carga" footer={<Button disabled={!f.code.trim()} loading={m.isPending} onClick={() => m.mutate()}>Crear lote</Button>}>
      <div className="flex flex-col gap-4">
        <Field label="Código" hint="Único. Ej.: MIA-2026-10-A"><Input autoFocus value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
        <Field label="Descripción"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Transportista"><Input value={f.carrier} onChange={(e) => setF({ ...f, carrier: e.target.value })} /></Field>
          <Field label="Guía"><Input value={f.tracking} onChange={(e) => setF({ ...f, tracking: e.target.value })} /></Field>
        </div>
      </div>
    </Dialog>
  );
}

function BatchDialog({ batch, onClose, storeName }: { batch: Batch | null; onClose: () => void; storeName: (id: string) => string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { steps, label } = useSteps();
  const [step, setStep] = useState('');
  const [note, setNote] = useState('');
  const items = useQuery({
    queryKey: ['batch-items', batch?.id],
    queryFn: () => run<F[]>(db('fulfillments').select('id, seq, flow, status, store_id, cargo_batch_id, eta_max_date, created_at, orders(id, number, payment_status)').eq('cargo_batch_id', batch!.id).order('created_at')),
    enabled: !!batch,
  });
  const cur = steps.find((s) => s.flow === 'import_order' && s.code === batch?.step_code);
  const nextSteps = steps.filter((s) => s.flow === 'import_order' && !s.is_terminal && s.code !== 'cancelled' && (!cur || s.seq > cur.seq));
  const target = step || nextSteps[0]?.code || '';
  const advance = useMutation({
    mutationFn: () => kora().api.admin.updateBatch(batch!.id, target, note.trim() || undefined),
    onSuccess: (r) => {
      toast.ok(`Lote en «${label('import_order', target)}»: ${r.updated} entregas avanzaron${r.skipped.length ? `, ${r.skipped.length} quedaron pendientes` : ''}`);
      qc.invalidateQueries();
      setNote(''); setStep('');
      onClose();
    },
    onError: toast.error,
  });
  if (!batch) return null;
  return (
    <Dialog open onClose={onClose} wide title={`Lote ${batch.code}`} footer={nextSteps.length ? <Button loading={advance.isPending} onClick={() => advance.mutate()}>Avanzar lote</Button> : undefined}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2 text-sm"><Badge tone="brand">{label('import_order', batch.step_code)}</Badge><span className="text-ink-3">creado {dateTime(batch.created_at)}</span></div>
        {nextSteps.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Avanzar a"><Select value={target} onChange={(e) => setStep(e.target.value)}>{nextSteps.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}</Select></Field>
            <Field label="Nota para los clientes (opcional)"><Textarea className="min-h-10" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          </div>
        ) : <Notice tone="success">El lote completó su recorrido. La entrega final se marca en cada pedido.</Notice>}
        <Notice tone="info">Las entregas sin el pago requerido para el siguiente estado no avanzan y se informan como pendientes.</Notice>
        <Table head={['Pedido', 'Tienda', 'Estado', 'Pago']}>
          {(items.data ?? []).map((f) => (
            <tr key={f.id}>
              <Td><Link className="font-semibold text-brand" href={`/admin/pedidos/${f.orders?.id}`}>{f.orders?.number}</Link> · {f.seq}</Td>
              <Td>{storeName(f.store_id)}</Td><Td>{label(f.flow, f.status)}</Td>
              <Td>{f.orders?.payment_status === 'unpaid' ? <Badge tone="warning">Sin anticipo</Badge> : <Badge tone="success">Con pago</Badge>}</Td>
            </tr>
          ))}
        </Table>
      </div>
    </Dialog>
  );
}
