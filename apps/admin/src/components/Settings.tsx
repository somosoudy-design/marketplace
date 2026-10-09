'use client';
import { priceFromCost, type CostRule } from '@kora/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { CrudTable } from '@/components/Crud';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, ErrorBox, Field, Input, Loading, Notice, Toggle } from '@/components/ui';
import { ago, money } from '@/lib/format';
import { db, run } from '@/lib/kora';
import { gapRates, pct, useGap } from '@/lib/pricing';

// Purpose-built forms for the settings the database computes with. Each rule mirrors the database guard
// (migration 001800, guard_setting_value), so Save only enables for a value the server will accept; the server
// still has the last word and its message is shown as is.

type Kind = 'int' | 'decimal' | 'optional-decimal' | 'prefix' | 'email' | 'text' | 'bool';
interface Spec {
  id: string;
  key: string;
  /** property inside an object-valued setting */
  path?: string;
  label: string;
  hint?: string;
  kind: Kind;
  min?: number;
  max?: number;
  suffix?: string;
  maxLength?: number;
  /** a sentence that says what the current value means */
  explain?: (v: number) => string;
}
interface Group {
  id: string;
  title: string;
  description: ReactNode;
  specs: Spec[];
}
interface SettingRow { key: string; value: unknown; updated_at: string }
type Draft = Record<string, string | boolean>;
type Parsed = Record<string, number | string | boolean | null>;

const show = (n: number) => String(n).replace('.', ',');
const plural = (n: number, one: string, many: string) => `${show(n)} ${n === 1 ? one : many}`;
const hoursText = (h: number) => (h % 24 === 0 ? plural(h / 24, 'día', 'días') : h > 24 ? `${plural(Math.floor(h / 24), 'día', 'días')} y ${plural(h % 24, 'hora', 'horas')}` : plural(h, 'hora', 'horas'));
const minutesText = (m: number) => (m % 60 === 0 ? hoursText(m / 60) : m > 60 ? `${hoursText(Math.floor(m / 60))} y ${plural(m % 60, 'minuto', 'minutos')}` : plural(m, 'minuto', 'minutos'));

const GROUPS: Group[] = [
  {
    id: 'orders',
    title: 'Pedidos y pagos',
    description: 'Plazos que el sistema aplica solo: cuándo se cancela un pedido sin pago, cuánto espera a un proveedor en línea y cuándo recuerda una cuota.',
    specs: [
      { id: 'prefix', key: 'orders.number_prefix', label: 'Prefijo del número de pedido', kind: 'prefix', hint: 'De 1 a 4 letras. Solo cambia los pedidos nuevos.' },
      { id: 'unpaid', key: 'orders.unpaid_expiry_hours', label: 'Plazo para pagar un pedido', kind: 'int', min: 1, max: 720, suffix: 'horas', explain: (v) => `A las ${hoursText(v)} sin pago se cancela y el inventario vuelve a la venta.` },
      { id: 'provider', key: 'payments.provider_expiry_minutes', label: 'Espera de un pago en línea', kind: 'int', min: 5, max: 10080, suffix: 'minutos', explain: (v) => `Si Binance Pay o PayPal no confirman en ${minutesText(v)}, el pedido se libera para pagar de otra forma.` },
      { id: 'reminder', key: 'payments.reminder_days_before', label: 'Recordatorio de cuota', kind: 'int', min: 0, max: 30, suffix: 'días antes', explain: (v) => (v === 0 ? 'Se avisa el mismo día del vencimiento.' : `Se avisa ${plural(v, 'día', 'días')} antes del vencimiento.`) },
    ],
  },
  {
    id: 'sellers',
    title: 'Vendedores y reclamos',
    description: 'La comisión general se aplica cuando no hay una regla por tienda o categoría (pestaña Comisiones).',
    specs: [
      { id: 'commission', key: 'commission.default_pct', label: 'Comisión general', kind: 'decimal', min: 0, max: 50, suffix: '%', explain: (v) => `En una venta de $100,00 la plataforma retiene ${money(v, 'USD')}.` },
      { id: 'claims', key: 'claims.seller_response_hours', label: 'Plazo de respuesta a un reclamo', kind: 'int', min: 1, max: 720, suffix: 'horas', explain: (v) => `Si la tienda no responde en ${hoursText(v)}, el comprador puede pedir que intervenga la plataforma.` },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacidad',
    description: 'Cuánto se guardan las señales de navegación que ordenan las recomendaciones. Cada comprador puede borrarlas antes desde la app.',
    specs: [
      { id: 'retention', key: 'privacy.event_retention_days', label: 'Conservación de la actividad', kind: 'int', min: 30, max: 730, suffix: 'días', explain: (v) => `Las señales de más de ${plural(v, 'día', 'días')} se borran solas.` },
    ],
  },
  {
    id: 'support',
    title: 'Atención al cliente',
    description: 'Se muestra en la app, en Cuenta › Ayuda, y abre el correo del comprador.',
    specs: [
      { id: 'support-email', key: 'support', path: 'email', label: 'Correo de soporte', kind: 'email' },
      { id: 'support-hours', key: 'support', path: 'hours', label: 'Horario de atención', kind: 'text', maxLength: 80, hint: 'Por ejemplo: Lun a Vie, 9:00 a 18:00.' },
    ],
  },
];

const PRICING: Group = {
  id: 'pricing',
  title: 'Regla de precios',
  description: (
    <>
      Del costo al precio (docs/PRECIOS.md): costo + flete + gastos logísticos, más el margen, es lo que el producto debe dejar en
      divisas; con la brecha del día se convierte en el precio en dólares a tasa BCV. Cada producto puede cambiar flete, gastos o
      margen en su ficha (Costos y precio). El importador por URL sugiere precios con esta regla.
    </>
  ),
  specs: [
    { id: 'markup', key: 'pricing.import', path: 'markup_pct', label: 'Margen sobre el costo puesto en Venezuela', kind: 'decimal', min: 0, max: 500, suffix: '%' },
    { id: 'per-kg', key: 'pricing.import', path: 'per_kg_usd', label: 'Flete', kind: 'decimal', min: 0, max: 200, suffix: 'USD por kg' },
    { id: 'fixed', key: 'pricing.import', path: 'fixed_usd', label: 'Gastos logísticos', kind: 'decimal', min: 0, max: 1000, suffix: 'USD por unidad' },
    { id: 'round', key: 'pricing.import', path: 'round_to', label: 'Terminación del precio', kind: 'optional-decimal', min: 0, max: 0.99, hint: 'Por ejemplo 0,99 para $41,99. Vacío: sin redondear.' },
    { id: 'configured', key: 'pricing.import', path: 'configured', label: 'Regla revisada y lista para usar', kind: 'bool', hint: 'Mientras esté apagada, el importador no sugiere precios.' },
  ],
};

const GAP: Group = {
  id: 'gap',
  title: 'Brecha del día',
  description: (
    <>
      La brecha entre el dólar BCV y el USDT (Binance P2P) se toma sola con las tasas vigentes y fija el precio en divisas de Zelle
      y USDT. Si no hay una vigente, esos métodos cobran el precio principal, sin descuento. Se puede tomar a mano en{' '}
      <Link className="font-semibold text-brand" href="/admin/tasas">Tasas</Link>.
    </>
  ),
  specs: [
    { id: 'divisas', key: 'pricing.gap', path: 'divisas_prices', label: 'Precio especial en divisas (Zelle, USDT)', kind: 'bool', hint: 'Apagado: todos los métodos cobran el precio principal. Los precios que siguen al costo igual usan la brecha.' },
    { id: 'refresh', key: 'pricing.gap', path: 'refresh_hours', label: 'Tomar una brecha nueva cada', kind: 'int', min: 1, max: 72, suffix: 'horas', explain: (v) => `Una vez cada ${hoursText(v)}, con las tasas del momento.` },
    { id: 'valid', key: 'pricing.gap', path: 'valid_hours', label: 'Cada brecha vale', kind: 'int', min: 2, max: 96, suffix: 'horas', explain: (v) => `Pasadas ${hoursText(v)} sin una nueva, Zelle y USDT cobran el precio principal. Debe ser más que el intervalo.` },
    { id: 'max-gap', key: 'pricing.gap', path: 'max_gap_pct', label: 'Brecha máxima aceptada', kind: 'decimal', min: 1, max: 1000, suffix: '%', explain: (v) => `Una lectura por encima de ${show(v)} % no se usa: se revisa a mano.` },
  ],
};

/** Keys these forms own; anything else stays editable in "Otros parámetros". Ranking has its own page. */
export const FORM_KEYS = new Set([...GROUPS, PRICING, GAP].flatMap((g) => g.specs.map((s) => s.key)).concat('ranking'));

function rawOf(spec: Spec, rows: Map<string, SettingRow>): unknown {
  const v = rows.get(spec.key)?.value;
  return spec.path ? (v && typeof v === 'object' ? (v as Record<string, unknown>)[spec.path] : undefined) : v;
}

function display(spec: Spec, raw: unknown): string | boolean {
  if (spec.kind === 'bool') return raw === true;
  if (raw === null || raw === undefined) return '';
  return typeof raw === 'number' ? show(raw) : String(raw);
}

function check(spec: Spec, v: string | boolean): { error: string | null; value: number | string | boolean | null } {
  if (spec.kind === 'bool') return { error: null, value: v === true };
  const s = String(v).trim();
  if (spec.kind === 'prefix') return /^[A-Z]{1,4}$/.test(s) ? { error: null, value: s } : { error: 'De 1 a 4 letras, sin números ni espacios.', value: null };
  if (spec.kind === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? { error: null, value: s } : { error: 'Escribe un correo válido.', value: null };
  if (spec.kind === 'text') return s && s.length <= (spec.maxLength ?? 200) ? { error: null, value: s } : { error: s ? `Hasta ${spec.maxLength} caracteres.` : 'No puede quedar vacío.', value: null };
  if (spec.kind === 'optional-decimal' && s === '') return { error: null, value: null };
  const integer = spec.kind === 'int';
  if (!(integer ? /^\d+$/ : /^\d+([.,]\d+)?$/).test(s)) return { error: integer ? 'Escribe un número entero, sin decimales.' : 'Escribe un número.', value: null };
  const n = Number(s.replace(',', '.'));
  if (n < spec.min! || n > spec.max!) return { error: `Entre ${show(spec.min!)} y ${show(spec.max!)}.`, value: null };
  return { error: null, value: n };
}

function useSettings() {
  return useQuery({ queryKey: ['app-settings'], queryFn: () => run<SettingRow[]>(db('app_settings').select('key, value, updated_at').order('key')) });
}

export function SettingsForms() {
  const q = useSettings();
  if (q.isPending) return <Loading rows={6} />;
  if (q.isError) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const rows = new Map(q.data.map((r) => [r.key, r]));
  const others = q.data.filter((r) => !FORM_KEYS.has(r.key));
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 xl:grid-cols-2">
        {GROUPS.map((g) => <SettingsGroup key={g.id} group={g} rows={rows} />)}
      </div>
      <SettingsGroup group={PRICING} rows={rows} preview={(p) => <PricingPreview values={p} />} />
      <SettingsGroup group={GAP} rows={rows} />
      <p className="text-[13px] text-ink-3">
        Los pesos de las recomendaciones se ajustan en <Link className="font-semibold text-brand" href="/admin/recomendaciones">Recomendaciones</Link>. Cada cambio queda en la auditoría.
      </p>
      {others.length ? (
        <CrudTable
          title="Otros parámetros"
          table="app_settings"
          idKey="key"
          scope="others"
          select="key, value, description, is_public, updated_at"
          order="key"
          filter={(x) => x.not('key', 'in', `(${[...FORM_KEYS].map((k) => `"${k}"`).join(',')})`)}
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
        />
      ) : null}
    </div>
  );
}

function SettingsGroup({ group, rows, preview }: { group: Group; rows: Map<string, SettingRow>; preview?: (values: Parsed) => ReactNode }) {
  const qc = useQueryClient();
  const toast = useToast();
  const current: Draft = Object.fromEntries(group.specs.map((s) => [s.id, display(s, rawOf(s, rows))]));
  const [draft, setDraft] = useState<Draft | null>(null);
  const values = draft ?? current;
  const checks = Object.fromEntries(group.specs.map((s) => [s.id, check(s, values[s.id]!)]));
  const valid = group.specs.every((s) => !checks[s.id]!.error);
  const changed = group.specs.filter((s) => {
    const before = check(s, current[s.id]!).value;
    return checks[s.id]!.value !== before || (before === null && values[s.id] !== current[s.id]);
  });
  const updated = group.specs.map((s) => rows.get(s.key)?.updated_at).filter(Boolean).sort().at(-1);
  const parsed: Parsed = Object.fromEntries(group.specs.map((s) => [s.id, checks[s.id]!.value]));

  const save = useMutation({
    mutationFn: async () => {
      // one update per setting; object settings keep the properties this form does not edit
      const keys = [...new Set(changed.map((s) => s.key))];
      for (const key of keys) {
        const specs = changed.filter((s) => s.key === key);
        const before = rows.get(key)?.value;
        const value = specs[0]!.path
          ? { ...(before && typeof before === 'object' ? before : {}), ...Object.fromEntries(specs.map((s) => [s.path!, checks[s.id]!.value])) }
          : checks[specs[0]!.id]!.value;
        const done = await run<{ key: string }[]>(db('app_settings').update({ value }).eq('key', key).select('key'));
        if (!done.length) throw new Error(`El parámetro ${key} no existe en esta base.`);
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['app-settings'] });
      qc.invalidateQueries({ queryKey: ['setting'] });
      setDraft(null);
      toast.ok(`${group.title}: cambios guardados. Se aplican desde ahora.`);
    },
    onError: toast.error,
  });

  const set = (id: string, v: string | boolean) => setDraft({ ...values, [id]: v });
  return (
    <Card title={group.title}>
      <form
        className="flex h-full flex-col gap-4"
        data-testid={`settings-${group.id}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && changed.length) save.mutate();
        }}
      >
        <p className="max-w-2xl text-[14px] text-ink-2">{group.description}</p>
        <div className={group.id === 'pricing' || group.id === 'gap' ? 'grid gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-4' : 'flex flex-col gap-4'}>
          {group.specs.map((s) => {
            const c = checks[s.id]!;
            if (s.kind === 'bool') {
              return (
                <div key={s.id} className="flex items-start justify-between gap-4 sm:col-span-2 xl:col-span-4">
                  <div>
                    <p className="text-[14px] font-semibold text-ink">{s.label}</p>
                    {s.hint ? <p className="text-[13px] text-ink-3">{s.hint}</p> : null}
                  </div>
                  <span data-testid={`setting-${s.id}`}><Toggle label={s.label} checked={values[s.id] === true} onChange={(v) => set(s.id, v)} /></span>
                </div>
              );
            }
            const meaning = !c.error && typeof c.value === 'number' && s.explain ? s.explain(c.value) : null;
            return (
              <Field key={s.id} label={s.label} error={c.error} hint={meaning ?? s.hint}>
                <div className="flex items-center gap-2">
                  <Input
                    value={String(values[s.id] ?? '')}
                    onChange={(e) => set(s.id, s.kind === 'prefix' ? e.target.value.toUpperCase() : e.target.value)}
                    inputMode={s.kind === 'int' ? 'numeric' : s.kind === 'decimal' || s.kind === 'optional-decimal' ? 'decimal' : s.kind === 'email' ? 'email' : undefined}
                    maxLength={s.kind === 'prefix' ? 4 : s.maxLength}
                    className={s.kind === 'email' || s.kind === 'text' ? '' : 'tabular max-w-40'}
                    data-testid={`setting-${s.id}`}
                  />
                  {s.suffix ? <span className="shrink-0 text-[13px] text-ink-3">{s.suffix}</span> : null}
                  {s.kind === 'prefix' && !c.error ? <span className="shrink-0 text-[13px] text-ink-3">Ejemplo: <span className="tabular font-semibold text-ink-2">{String(c.value)}-100245</span></span> : null}
                </div>
              </Field>
            );
          })}
        </div>
        {preview && valid ? preview(parsed) : null}
        <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button type="submit" disabled={!changed.length || !valid} loading={save.isPending} data-testid={`settings-save-${group.id}`}>Guardar</Button>
          {draft && changed.length ? <Button type="button" variant="ghost" onClick={() => setDraft(null)}>Descartar</Button> : null}
          <p className="text-[13px] text-ink-3">{changed.length ? `${changed.length === 1 ? '1 cambio sin guardar' : `${changed.length} cambios sin guardar`}` : updated ? `Actualizado ${ago(updated)}` : ''}</p>
        </div>
      </form>
    </Card>
  );
}

function PricingPreview({ values }: { values: Parsed }) {
  const gap = useGap();
  const rule: CostRule = { markup_pct: values.markup as number, per_kg_usd: values['per-kg'] as number, fixed_usd: values.fixed as number, round_to: values.round as number | null };
  // without a gap in force the BCV price cannot be known: the example shows what the product must bring in divisas
  const p = priceFromCost({ cost_usd: 20, weight_kg: 0.5 }, rule, gap.current ? gapRates(gap.current) : { bcv: 1, usdt_ves: 1 });
  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-[14px] bg-sunken px-4 py-3 text-[14px] text-ink-2" data-testid="pricing-preview">
        Ejemplo: un producto que nos cuesta {money(20, 'USD')} y pesa 0,5 kg queda puesto en {money(p.landed_usd, 'USD')} (flete{' '}
        {money(p.freight_usd, 'USD')}, gastos {money(p.logistics_usd, 'USD')}) y con el margen debe dejar {money(p.target_divisas_usd, 'USD')} en divisas.{' '}
        {gap.current ? (
          <>
            Con la brecha del día ({pct(p.gap_pct)}) su precio es <span className="tabular font-bold text-ink">{money(p.price_usd, 'USD')}</span> a tasa BCV;
            con Zelle o USDT paga {money(p.price_divisas_usd, 'USD')}.
          </>
        ) : (
          <span className="text-ink-3">No hay brecha vigente: el precio a tasa BCV se calcula cuando se tome una en Tasas.</span>
        )}
      </p>
      {values.configured !== true ? (
        <Notice tone="warning">La regla todavía trae valores de ejemplo. Revísala y activa «Regla revisada» para que el importador sugiera precios.</Notice>
      ) : null}
    </div>
  );
}

/** The import pricing rule, only when an operator marked it as reviewed. */
export function useImportPricing() {
  const q = useSettings();
  const v = q.data?.find((r) => r.key === 'pricing.import')?.value as (CostRule & { configured?: boolean }) | undefined;
  return { isPending: q.isPending, rule: v && v.configured === true ? v : null };
}
