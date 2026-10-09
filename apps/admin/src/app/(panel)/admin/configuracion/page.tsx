'use client';
import { FLOW_LABEL, INTEGRATION_LABEL } from '@kora/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { CrudTable } from '@/components/Crud';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, Dialog, ErrorBox, Field, Input, Loading, Notice, PageHeader, Tabs, Textarea, Toggle, cx } from '@/components/ui';
import { ago, integrationTone, money } from '@/lib/format';
import { useCategoriesIndex, useStoresIndex } from '@/lib/hooks';
import { db, run } from '@/lib/kora';

type Tab = 'payments' | 'plans' | 'commissions' | 'settings';
interface Method {
  code: string;
  name: string;
  rail: string;
  currency: 'USD' | 'VES' | 'USDT';
  kind: 'manual' | 'automated';
  integration_status: 'live' | 'sandbox' | 'pending_credentials' | 'disabled';
  enabled: boolean;
  fee_pct: string;
  fee_fixed_usd: string;
  min_usd: string;
  max_usd: string | null;
  quote_ttl_minutes: number;
  requires_reference: boolean;
  requires_proof: boolean;
  reference_pattern: string | null;
  instructions: Record<string, string>;
  description: string | null;
  sort: number;
}

const PCT = /^\d{1,2}([.,]\d{1,3})?$/;
const USD = /^\d{1,8}([.,]\d{1,2})?$/;
const n = (s: string) => s.trim().replace(',', '.');

export default function CommercialConfigPage() {
  const [tab, setTab] = useState<Tab>('payments');
  const stores = useStoresIndex();
  const cats = useCategoriesIndex();
  const defaultCommission = useQuery({ queryKey: ['setting', 'commission.default_pct'], queryFn: async () => (await run<{ value: number }>(db('app_settings').select('value').eq('key', 'commission.default_pct').single())).value });

  return (
    <>
      <PageHeader eyebrow="Plataforma" title="Configuración comercial" description="Métodos de pago, modalidades de cuotas, comisiones y parámetros generales. Cada cambio queda en la auditoría." />
      <Tabs value={tab} onChange={setTab} items={[{ value: 'payments', label: 'Métodos de pago' }, { value: 'plans', label: 'Modalidades de pago' }, { value: 'commissions', label: 'Comisiones' }, { value: 'settings', label: 'Parámetros' }]} />
      {tab === 'payments' ? <PaymentMethods /> : tab === 'plans' ? (
        <CrudTable
          table="installment_plans"
          idKey="code"
          select="code, name, description, down_payment_pct, installments, interval_days, surcharge_pct, min_order_usd, allowed_flows, active, sort"
          order="sort"
          toggleKey="active"
          createLabel="Nueva modalidad"
          editTitle={(r) => `Editar «${r.name as string}»`}
          defaults={{ down_payment_pct: '100', installments: '0', interval_days: '30', surcharge_pct: '0', min_order_usd: '0', allowed_flows: ['local_stock', 'import_order', 'seller_shipping'], active: false, sort: '10' }}
          fields={[
            { key: 'name', label: 'Nombre visible', type: 'text', required: true },
            { key: 'code', label: 'Código interno', type: 'text', required: true, createOnly: true, hint: 'Minúsculas, números y guion bajo.' },
            { key: 'down_payment_pct', label: 'Pago inicial (%)', type: 'decimal', required: true, hint: '100 = pago completo.' },
            { key: 'installments', label: 'Cuotas posteriores', type: 'int', required: true },
            { key: 'interval_days', label: 'Días entre cuotas', type: 'int', required: true },
            { key: 'surcharge_pct', label: 'Recargo (%)', type: 'decimal', required: true, hint: 'Solo si existe un recargo acordado. 0 si no aplica.' },
            { key: 'min_order_usd', label: 'Pedido mínimo (USD)', type: 'decimal', required: true },
            { key: 'sort', label: 'Orden', type: 'int', required: true },
            { key: 'allowed_flows', label: 'Disponible para', type: 'checks', options: Object.entries(FLOW_LABEL).map(([value, label]) => ({ value, label })), required: true },
            { key: 'description', label: 'Descripción para el comprador', type: 'textarea', nullable: true },
          ]}
          validate={(v) => {
            if (v.code !== undefined && !/^[a-z0-9_]{2,40}$/.test(String(v.code))) return 'El código solo admite minúsculas, números y guion bajo.';
            const down = Number(v.down_payment_pct);
            if (down > 100) return 'El pago inicial no puede superar el 100 %.';
            if (down === 100 && Number(v.installments) !== 0) return 'Con pago inicial del 100 % no hay cuotas posteriores.';
            if (down < 100 && Number(v.installments) < 1) return 'Indica cuántas cuotas cubren el resto.';
            if (Number(v.installments) > 24) return 'Máximo 24 cuotas.';
            return null;
          }}
          columns={[
            { label: 'Modalidad', render: (r) => <><span className="font-semibold">{r.name as string}</span><span className="block text-[12px] text-ink-3">{r.code as string}</span></> },
            { label: 'Estructura', render: (r) => (Number(r.down_payment_pct) === 100 ? 'Pago completo' : `${Number(r.down_payment_pct)} % inicial + ${r.installments} cuota${r.installments === 1 ? '' : 's'} cada ${r.interval_days} días`) },
            { label: 'Recargo', render: (r) => `${Number(r.surcharge_pct)} %`, className: 'tabular' },
            { label: 'Mínimo', render: (r) => money(r.min_order_usd as string, 'USD'), className: 'tabular' },
            { label: 'Disponible para', render: (r) => (r.allowed_flows as string[]).map((f) => FLOW_LABEL[f]).join(', '), className: 'text-[13px] text-ink-2' },
          ]}
          footer="Las cuotas se calculan en USD y nunca se congelan en bolívares: cada cuota se cotiza con la tasa del día en que se paga."
        />
      ) : tab === 'commissions' ? (
        <CrudTable
          table="commission_rules"
          select="id, store_id, category_id, rate_pct, active, note"
          order="rate_pct"
          toggleKey="active"
          createLabel="Nueva regla"
          defaults={{ active: true }}
          fields={[
            { key: 'store_id', label: 'Tienda', type: 'select', options: stores.list.filter((s) => s.kind === 'seller').map((s) => ({ value: s.id, label: s.name })), nullable: true },
            { key: 'category_id', label: 'Categoría', type: 'select', options: cats.list.map((c) => ({ value: c.id, label: c.name })), nullable: true },
            { key: 'rate_pct', label: 'Comisión (%)', type: 'decimal', required: true },
            { key: 'note', label: 'Nota interna', type: 'text', nullable: true, hint: 'Ej.: acuerdo firmado el 1 de octubre.' },
          ]}
          validate={(v) => (!v.store_id && !v.category_id ? 'Elige una tienda, una categoría o ambas. La comisión general está en Parámetros.' : Number(v.rate_pct) > 60 ? 'La comisión no puede superar el 60 %.' : null)}
          columns={[
            { label: 'Aplica a', render: (r) => <span className="font-semibold">{[r.store_id ? stores.name(r.store_id as string) : null, r.category_id ? cats.name(r.category_id as string) : null].filter(Boolean).join(' · ')}</span> },
            { label: 'Comisión', render: (r) => `${Number(r.rate_pct)} %`, className: 'tabular' },
            { label: 'Nota', render: (r) => (r.note as string) ?? '—', className: 'text-[13px] text-ink-2' },
          ]}
          footer={`Comisión general: ${defaultCommission.data ?? '…'} %. Gana la regla más específica (tienda y categoría, luego tienda, luego categoría). La comisión se fija en cada venta al confirmarse el pedido.`}
        />
      ) : (
        <CrudTable
          table="app_settings"
          idKey="key"
          select="key, value, description, is_public, updated_at"
          order="key"
          canCreate={false}
          editTitle={(r) => (r.description as string) ?? (r.key as string)}
          defaults={{}}
          fields={[{ key: 'value', label: 'Valor (JSON)', type: 'json', required: true, hint: 'Números sin comillas; textos entre comillas; objetos con llaves.' }]}
          columns={[
            { label: 'Parámetro', render: (r) => <><span className="font-semibold">{(r.description as string) ?? (r.key as string)}</span><span className="block text-[12px] text-ink-3">{r.key as string}</span></> },
            { label: 'Valor', render: (r) => <code className="block max-w-[420px] truncate rounded bg-sunken px-2 py-1 text-[12.5px]">{JSON.stringify(r.value)}</code> },
            { label: 'Visible en la app', render: (r) => (r.is_public ? <Badge tone="info">Pública</Badge> : <Badge>Interna</Badge>) },
            { label: 'Actualizado', render: (r) => ago(r.updated_at as string), className: 'whitespace-nowrap text-ink-3' },
          ]}
          footer="«pricing.import» trae valores de ejemplo y «configured: false»: define el margen real antes de usar precios sugeridos para importaciones."
        />
      )}
    </>
  );
}

function PaymentMethods() {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Method | null>(null);
  const list = useQuery({ queryKey: ['payment-methods'], queryFn: () => run<Method[]>(db('payment_methods').select('*').order('sort')) });
  const toggle = useMutation({
    mutationFn: (m: Method) => run(db('payment_methods').update({ enabled: !m.enabled }).eq('code', m.code)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-methods'] }),
    onError: toast.error,
  });
  if (list.isPending) return <Loading />;
  if (list.isError) return <ErrorBox error={list.error} onRetry={() => list.refetch()} />;
  const demoData = list.data.some((m) => m.enabled && Object.values(m.instructions ?? {}).some((v) => /demostraci|ficticio|demo/i.test(String(v))));

  return (
    <>
      {demoData ? <div className="mb-4"><Notice tone="warning" title="Hay métodos activos con datos de pago ficticios">Reemplaza las cuentas de demostración por las reales de la empresa antes de recibir pagos.</Notice></div> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {list.data.map((m) => {
          const automatedBlocked = m.kind === 'automated' && !['live', 'sandbox'].includes(m.integration_status);
          return (
            <Card key={m.code} className={cx(!m.enabled && 'opacity-80')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-xl font-semibold">{m.name}</p>
                  <p className="mt-0.5 text-[13px] text-ink-3">{m.currency} · {m.kind === 'manual' ? 'Verificación manual' : 'Pasarela del proveedor'}</p>
                </div>
                <Toggle checked={m.enabled} disabled={automatedBlocked && !m.enabled} label={`Ofrecer ${m.name}`} onChange={() => toggle.mutate(m)} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone={integrationTone[m.integration_status]}>{INTEGRATION_LABEL[m.integration_status]}</Badge>
                {m.enabled ? <Badge tone="success">Visible en el checkout</Badge> : <Badge>Oculto</Badge>}
                {m.requires_proof ? <Badge tone="info">Pide comprobante</Badge> : null}
              </div>
              {m.description ? <p className="mt-3 text-sm text-ink-2">{m.description}</p> : null}
              <dl className="mt-3 grid grid-cols-3 gap-2 text-[13px]">
                <div><dt className="text-ink-3">Comisión</dt><dd className="tabular font-semibold">{Number(m.fee_pct)} %{Number(m.fee_fixed_usd) ? ` + ${money(m.fee_fixed_usd, 'USD')}` : ''}</dd></div>
                <div><dt className="text-ink-3">Límites</dt><dd className="tabular font-semibold">{money(m.min_usd, 'USD')} – {m.max_usd ? money(m.max_usd, 'USD') : 'sin tope'}</dd></div>
                <div><dt className="text-ink-3">Monto válido</dt><dd className="tabular font-semibold">{m.quote_ttl_minutes >= 120 ? `${Math.round(m.quote_ttl_minutes / 60)} h` : `${m.quote_ttl_minutes} min`}</dd></div>
              </dl>
              {automatedBlocked ? (
                <p className="mt-3 text-[13px] text-ink-3">Para activarlo hace falta una cuenta de comercio aprobada por el proveedor y sus credenciales configuradas en el servidor. Ver la guía de servicios externos.</p>
              ) : null}
              <div className="mt-4 flex justify-end">
                <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(m)}>Editar</Button>
              </div>
            </Card>
          );
        })}
      </div>
      {editing ? <MethodDialog key={editing.code} method={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function MethodDialog({ method: m, onClose }: { method: Method; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({
    name: m.name, description: m.description ?? '', fee_pct: String(Number(m.fee_pct)), fee_fixed_usd: String(Number(m.fee_fixed_usd)), min_usd: String(Number(m.min_usd)),
    max_usd: m.max_usd ? String(Number(m.max_usd)) : '', ttl: String(m.quote_ttl_minutes), requires_reference: m.requires_reference, requires_proof: m.requires_proof, reference_pattern: m.reference_pattern ?? '',
  });
  const [rows, setRows] = useState<{ k: string; v: string }[]>(Object.entries(m.instructions ?? {}).map(([k, v]) => ({ k, v: String(v) })));
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const ttl = Number(f.ttl);
      const err = f.name.trim().length < 2 ? 'Escribe un nombre.'
        : !PCT.test(n(f.fee_pct)) || Number(n(f.fee_pct)) > 20 ? 'La comisión debe estar entre 0 y 20 %.'
        : !USD.test(n(f.fee_fixed_usd)) || !USD.test(n(f.min_usd)) || (f.max_usd.trim() && !USD.test(n(f.max_usd))) ? 'Revisa los montos en USD.'
        : f.max_usd.trim() && Number(n(f.max_usd)) <= Number(n(f.min_usd)) ? 'El máximo debe ser mayor que el mínimo.'
        : !Number.isInteger(ttl) || ttl < 5 || ttl > 4320 ? 'La vigencia del monto debe estar entre 5 minutos y 72 horas.'
        : rows.some((r) => !r.k.trim() || !r.v.trim()) ? 'Completa o quita las filas vacías de los datos de pago.'
        : null;
      if (!err && f.reference_pattern.trim()) {
        try { new RegExp(f.reference_pattern.trim()); } catch { setError('El formato de referencia no es una expresión válida.'); throw null; }
      }
      if (err) { setError(err); throw null; }
      await run(db('payment_methods').update({
        name: f.name.trim(), description: f.description.trim() || null, fee_pct: n(f.fee_pct), fee_fixed_usd: n(f.fee_fixed_usd), min_usd: n(f.min_usd),
        max_usd: f.max_usd.trim() ? n(f.max_usd) : null, quote_ttl_minutes: ttl, requires_reference: f.requires_reference, requires_proof: f.requires_proof,
        reference_pattern: f.reference_pattern.trim() || null, instructions: Object.fromEntries(rows.map((r) => [r.k.trim(), r.v.trim()])),
      }).eq('code', m.code));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-methods'] }); toast.ok('Método actualizado.'); onClose(); },
    onError: (e) => { if (e) toast.error(e); },
  });

  return (
    <Dialog open onClose={onClose} title={`Editar ${m.name}`} wide footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button loading={save.isPending} onClick={() => { setError(null); save.mutate(); }}>Guardar</Button></>}>
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre visible"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Vigencia del monto (minutos)" hint="Tras este tiempo el comprador debe recotizar."><Input inputMode="numeric" className="tabular" value={f.ttl} onChange={(e) => setF({ ...f, ttl: e.target.value })} /></Field>
          <Field label="Descripción para el comprador" className="sm:col-span-2"><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Comisión del método (%)" hint="Se suma al monto a pagar. 0 si no aplica."><Input inputMode="decimal" className="tabular" value={f.fee_pct} onChange={(e) => setF({ ...f, fee_pct: e.target.value })} /></Field>
          <Field label="Comisión fija (USD)"><Input inputMode="decimal" className="tabular" value={f.fee_fixed_usd} onChange={(e) => setF({ ...f, fee_fixed_usd: e.target.value })} /></Field>
          <Field label="Monto mínimo (USD)"><Input inputMode="decimal" className="tabular" value={f.min_usd} onChange={(e) => setF({ ...f, min_usd: e.target.value })} /></Field>
          <Field label="Monto máximo (USD)" hint="Vacío: sin tope."><Input inputMode="decimal" className="tabular" value={f.max_usd} onChange={(e) => setF({ ...f, max_usd: e.target.value })} /></Field>
        </div>
        {m.kind === 'manual' ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-[14px] border border-line px-3.5 py-2.5"><span className="text-sm font-semibold text-ink-2">Pedir número de referencia</span><Toggle checked={f.requires_reference} label="Pedir número de referencia" onChange={(v) => setF({ ...f, requires_reference: v })} /></div>
              <div className="flex items-center justify-between rounded-[14px] border border-line px-3.5 py-2.5"><span className="text-sm font-semibold text-ink-2">Pedir comprobante</span><Toggle checked={f.requires_proof} label="Pedir comprobante" onChange={(v) => setF({ ...f, requires_proof: v })} /></div>
              <Field label="Formato de la referencia (expresión regular)" hint="Opcional. Ej.: ^[0-9]{4,20}$" className="sm:col-span-2"><Input className="font-mono text-[13px]" value={f.reference_pattern} onChange={(e) => setF({ ...f, reference_pattern: e.target.value })} /></Field>
            </div>
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold">Datos de pago que ve el comprador</h3>
                <Button size="sm" variant="ghost" icon={Plus} onClick={() => setRows([...rows, { k: '', v: '' }])}>Agregar dato</Button>
              </div>
              <p className="mb-3 text-[13px] text-ink-3">Banco, teléfono, documento, titular, correo o dirección de la billetera. Solo datos para recibir pagos: nunca contraseñas ni claves privadas.</p>
              {!rows.length ? <Notice tone="warning">Sin datos de pago: el método no se puede activar.</Notice> : (
                <div className="flex flex-col gap-2">
                  {rows.map((r, i) => (
                    <div key={i} className="grid grid-cols-[160px_1fr_auto] gap-2">
                      <Input aria-label={`Dato ${i + 1}`} placeholder="titular" value={r.k} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} />
                      <Input aria-label={`Valor ${i + 1}`} value={r.v} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} />
                      <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Quitar dato ${i + 1}`} onClick={() => setRows(rows.filter((_, j) => j !== i))} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <Notice tone="info" title={`Integración: ${INTEGRATION_LABEL[m.integration_status]}`}>
            El estado de la integración depende de las credenciales del servidor y no se cambia desde aquí. El cobro y su confirmación los hace el proveedor; no se acepta una referencia manual.
          </Notice>
        )}
        {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
      </div>
    </Dialog>
  );
}
