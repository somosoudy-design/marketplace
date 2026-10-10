'use client';
import { AVAILABILITY, FLOW_LABEL, ORIGIN_LABEL, SHIPPING_KIND_LABEL } from '@kora/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { CrudTable, type FieldDef } from '@/components/Crud';
import { Badge, Notice, PageHeader, Tabs } from '@/components/ui';
import { money } from '@/lib/format';
import { useCategoriesIndex, useStoresIndex } from '@/lib/hooks';
import { db, run } from '@/lib/kora';

type Tab = 'rates' | 'methods' | 'carriers' | 'zones' | 'pickup' | 'lead';
const opts = (m: Record<string, string>) => Object.entries(m).map(([value, label]) => ({ value, label }));
const days = (a: unknown, b: unknown) => (a === b ? `${a} d` : `${a}–${b} d`);
const DemoBadge = ({ on }: { on: unknown }) => (on ? <Badge tone="warning" className="ml-2">Demo</Badge> : null);
const minMax = (v: Record<string, unknown>) => (v.min_days != null && v.max_days != null && Number(v.max_days) < Number(v.min_days) ? 'El máximo de días no puede ser menor que el mínimo.' : null);

function useRefs() {
  const carriers = useQuery({ queryKey: ['crud', 'carriers', 'ref'], queryFn: () => run<{ id: string; name: string }[]>(db('carriers').select('id, name').order('name')) });
  const methods = useQuery({ queryKey: ['crud', 'shipping_methods', 'ref'], queryFn: () => run<{ id: string; name: string }[]>(db('shipping_methods').select('id, name').order('sort')) });
  const zones = useQuery({ queryKey: ['crud', 'shipping_zones', 'ref'], queryFn: () => run<{ id: string; name: string }[]>(db('shipping_zones').select('id, name').order('name')) });
  const regions = useQuery({ queryKey: ['regions'], queryFn: () => run<{ code: string; name: string }[]>(db('regions').select('code, name').eq('country_code', 'VE').order('sort')), staleTime: Infinity });
  const demo = useQuery({ queryKey: ['crud', 'shipping_rates', 'demo'], queryFn: async () => (await db('shipping_rates').select('id', { count: 'exact', head: true }).eq('is_demo', true).eq('active', true)).count ?? 0 });
  const toOpts = (l?: { id: string; name: string }[]) => (l ?? []).map((x) => ({ value: x.id, label: x.name }));
  return { carriers: toOpts(carriers.data), methods: toOpts(methods.data), zones: toOpts(zones.data), regions: (regions.data ?? []).map((r) => ({ value: r.code, label: r.name })), demoActive: demo.data ?? 0 };
}

export default function ShippingConfigPage() {
  const [tab, setTab] = useState<Tab>('rates');
  const refs = useRefs();
  const stores = useStoresIndex();
  const cats = useCategoriesIndex();
  const nameOf = (l: { value: string; label: string }[], id: unknown) => l.find((x) => x.value === id)?.label ?? '—';
  const storeOpts = stores.list.map((s) => ({ value: s.id, label: s.name }));
  const regionName = (code: unknown) => nameOf(refs.regions, code);

  const rateFields: FieldDef[] = [
    { key: 'method_id', label: 'Método', type: 'select', options: refs.methods, required: true },
    { key: 'zone_id', label: 'Zona', type: 'select', options: refs.zones, required: true },
    { key: 'store_id', label: 'Tienda', type: 'select', options: storeOpts, nullable: true, hint: 'Vacío: aplica a toda la plataforma. Con tienda: tarifa propia de esa tienda.' },
    { key: 'max_weight_kg', label: 'Peso máximo (kg)', type: 'decimal', nullable: true },
    { key: 'base_usd', label: 'Base (USD)', type: 'decimal', required: true },
    { key: 'per_kg_usd', label: 'Por kg adicional (USD)', type: 'decimal', required: true },
    { key: 'free_over_usd', label: 'Gratis desde (USD)', type: 'decimal', nullable: true, hint: 'Opcional. Subtotal de la entrega a partir del cual el envío es gratis.' },
    { key: 'min_days', label: 'Días mínimos de tránsito', type: 'int', required: true },
    { key: 'max_days', label: 'Días máximos de tránsito', type: 'int', required: true },
    { key: 'flows', label: 'Aplica a', type: 'checks', options: opts(FLOW_LABEL), required: true },
    { key: 'is_demo', label: 'Tarifa de demostración (no comercial)', type: 'toggle' },
    { key: 'active', label: 'Activa', type: 'toggle' },
  ];

  return (
    <>
      <PageHeader eyebrow="Plataforma" title="Transportistas y tarifas" description="Define cómo y cuánto cuesta llevar cada entrega. El checkout solo ofrece métodos con una tarifa activa para la zona de la dirección y el tipo de despacho." />
      {refs.demoActive ? (
        <div className="mb-5">
          <Notice tone="warning" title={`${refs.demoActive} tarifas activas son de demostración`}>
            No son tarifas comerciales reales. Reemplázalas por las acordadas con cada transportista y desmarca «demostración» antes de operar.
          </Notice>
        </div>
      ) : null}
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'rates', label: 'Tarifas' },
          { value: 'methods', label: 'Métodos de envío' },
          { value: 'carriers', label: 'Transportistas' },
          { value: 'zones', label: 'Zonas' },
          { value: 'pickup', label: 'Puntos de retiro' },
          { value: 'lead', label: 'Tiempos de preparación' },
        ]}
      />
      {tab === 'rates' ? (
        <CrudTable
          table="shipping_rates"
          select="id, method_id, zone_id, store_id, flows, base_usd, per_kg_usd, free_over_usd, min_days, max_days, max_weight_kg, active, is_demo"
          order="method_id"
          createLabel="Nueva tarifa"
          toggleKey="active"
          validate={minMax}
          defaults={{ flows: ['local_stock', 'import_order', 'seller_shipping'], per_kg_usd: '0', active: true, is_demo: false }}
          fields={rateFields}
          sortRows={(a, b) => nameOf(refs.methods, a.method_id).localeCompare(nameOf(refs.methods, b.method_id), 'es') || String(a.store_id ?? '').localeCompare(String(b.store_id ?? '')) || nameOf(refs.zones, a.zone_id).localeCompare(nameOf(refs.zones, b.zone_id), 'es')}
          columns={[
            { label: 'Método', render: (r) => <span className="font-semibold">{nameOf(refs.methods, r.method_id)}<DemoBadge on={r.is_demo} /></span>, className: 'min-w-[200px]' },
            { label: 'Zona', render: (r) => nameOf(refs.zones, r.zone_id), className: 'whitespace-nowrap' },
            { label: 'Tienda', render: (r) => (r.store_id ? stores.name(r.store_id as string) : 'Plataforma'), className: 'whitespace-nowrap' },
            { label: 'Base', render: (r) => money(r.base_usd as string, 'USD'), className: 'tabular' },
            { label: 'Por kg', render: (r) => money(r.per_kg_usd as string, 'USD'), className: 'tabular' },
            { label: 'Gratis desde', render: (r) => (r.free_over_usd ? money(r.free_over_usd as string, 'USD') : '—'), className: 'tabular' },
            { label: 'Tránsito', render: (r) => days(r.min_days, r.max_days), className: 'whitespace-nowrap' },
            { label: 'Aplica a', render: (r) => ((r.flows as string[]).length === 3 ? 'Todos' : (r.flows as string[]).map((f) => FLOW_LABEL[f]).join(', ')), className: 'text-[13px] text-ink-2' },
          ]}
        />
      ) : tab === 'methods' ? (
        <CrudTable
          table="shipping_methods"
          select="id, code, name, kind, carrier_id, description, active, sort"
          order="sort"
          createLabel="Nuevo método"
          toggleKey="active"
          defaults={{ kind: 'home_delivery', active: true, sort: '10' }}
          fields={[
            { key: 'name', label: 'Nombre visible', type: 'text', required: true },
            { key: 'code', label: 'Código interno', type: 'text', required: true, createOnly: true, hint: 'Sin espacios, no se puede cambiar.' },
            { key: 'kind', label: 'Tipo', type: 'select', options: opts(SHIPPING_KIND_LABEL), required: true },
            { key: 'carrier_id', label: 'Transportista', type: 'select', options: refs.carriers, nullable: true },
            { key: 'sort', label: 'Orden', type: 'int', required: true },
            { key: 'description', label: 'Descripción para el comprador', type: 'textarea', nullable: true },
          ]}
          validate={(v) => (v.code !== undefined && !/^[a-z0-9_]{2,40}$/.test(String(v.code)) ? 'El código solo admite minúsculas, números y guion bajo.' : null)}
          columns={[
            { label: 'Método', render: (r) => <><span className="font-semibold">{r.name as string}</span><span className="block text-[12px] text-ink-3">{r.code as string}</span></> },
            { label: 'Tipo', render: (r) => SHIPPING_KIND_LABEL[r.kind as string], className: 'whitespace-nowrap' },
            { label: 'Transportista', render: (r) => nameOf(refs.carriers, r.carrier_id) },
            { label: 'Orden', render: (r) => r.sort as number, className: 'tabular' },
          ]}
        />
      ) : tab === 'carriers' ? (
        <CrudTable
          table="carriers"
          select="id, code, name, tracking_url_template, active, is_demo"
          order="name"
          createLabel="Nuevo transportista"
          toggleKey="active"
          defaults={{ active: true }}
          fields={[
            { key: 'name', label: 'Nombre', type: 'text', required: true },
            { key: 'code', label: 'Código interno', type: 'text', required: true, createOnly: true },
            { key: 'tracking_url_template', label: 'Enlace de rastreo', type: 'text', nullable: true, wide: true, hint: 'Usa {tracking} donde va el número de guía. Ej.: https://transportista.example.com/rastreo?guia={tracking}' },
          ]}
          validate={(v) => (v.tracking_url_template && !String(v.tracking_url_template).startsWith('https://') ? 'El enlace de rastreo debe empezar por https://' : v.tracking_url_template && !String(v.tracking_url_template).includes('{tracking}') ? 'Incluye {tracking} en el enlace.' : null)}
          columns={[
            { label: 'Transportista', render: (r) => <span className="font-semibold">{r.name as string}<DemoBadge on={r.is_demo} /></span> },
            { label: 'Código', render: (r) => r.code as string, className: 'text-ink-3' },
            { label: 'Rastreo', render: (r) => (r.tracking_url_template ? <span className="text-[13px] text-ink-2">Configurado</span> : <span className="text-[13px] text-ink-3">Sin enlace</span>) },
          ]}
          footer="Los datos marcados como demo sirven para desarrollo: confirma con cada transportista sus condiciones antes de ofrecerlo."
        />
      ) : tab === 'zones' ? (
        <CrudTable
          table="shipping_zones"
          select="id, code, name, region_codes"
          order="name"
          createLabel="Nueva zona"
          defaults={{ region_codes: [] }}
          fields={[
            { key: 'name', label: 'Nombre', type: 'text', required: true },
            { key: 'code', label: 'Código interno', type: 'text', required: true, createOnly: true },
            { key: 'region_codes', label: 'Estados incluidos', type: 'checks', options: refs.regions, required: true },
          ]}
          columns={[
            { label: 'Zona', render: (r) => <span className="font-semibold">{r.name as string}</span>, className: 'whitespace-nowrap' },
            { label: 'Estados', render: (r) => (r.region_codes as string[]).map(regionName).join(', '), className: 'text-[13px] text-ink-2' },
          ]}
          footer="Cada estado debería pertenecer a una sola zona para que el costo de envío sea predecible."
        />
      ) : tab === 'pickup' ? (
        <CrudTable
          table="pickup_points"
          select="id, carrier_id, region_code, city, name, address, active, is_demo"
          order="city"
          createLabel="Nuevo punto"
          toggleKey="active"
          defaults={{ active: true, region_code: 'A' }}
          fields={[
            { key: 'carrier_id', label: 'Transportista', type: 'select', options: refs.carriers, required: true },
            { key: 'name', label: 'Nombre', type: 'text', required: true },
            { key: 'region_code', label: 'Estado', type: 'select', options: refs.regions, required: true },
            { key: 'city', label: 'Ciudad', type: 'text', required: true },
            { key: 'address', label: 'Dirección', type: 'textarea', required: true },
          ]}
          columns={[
            { label: 'Punto', render: (r) => <span className="font-semibold">{r.name as string}<DemoBadge on={r.is_demo} /></span> },
            { label: 'Transportista', render: (r) => nameOf(refs.carriers, r.carrier_id) },
            { label: 'Ubicación', render: (r) => `${r.city as string}, ${regionName(r.region_code)}`, className: 'whitespace-nowrap' },
            { label: 'Dirección', render: (r) => r.address as string, className: 'text-[13px] text-ink-2' },
          ]}
        />
      ) : (
        <CrudTable
          table="lead_time_rules"
          select="id, availability, origin, store_id, category_id, min_days, max_days, label, active"
          order="availability"
          createLabel="Nueva regla"
          toggleKey="active"
          validate={minMax}
          defaults={{ availability: 'on_order', active: true }}
          fields={[
            { key: 'availability', label: 'Disponibilidad', type: 'select', options: Object.entries(AVAILABILITY).map(([value, a]) => ({ value, label: a.label })), required: true },
            { key: 'origin', label: 'Origen', type: 'select', options: opts(ORIGIN_LABEL), nullable: true },
            { key: 'store_id', label: 'Tienda', type: 'select', options: storeOpts, nullable: true },
            { key: 'category_id', label: 'Categoría', type: 'select', options: cats.list.map((c) => ({ value: c.id, label: c.name })), nullable: true },
            { key: 'min_days', label: 'Días mínimos', type: 'int', required: true },
            { key: 'max_days', label: 'Días máximos', type: 'int', required: true },
            { key: 'label', label: 'Texto para el comprador', type: 'text', nullable: true, wide: true, hint: 'Opcional. Ej.: «Llega de EE. UU. en 15 a 25 días».' },
          ]}
          columns={[
            { label: 'Disponibilidad', render: (r) => AVAILABILITY[r.availability as keyof typeof AVAILABILITY].label, className: 'whitespace-nowrap font-semibold' },
            { label: 'Alcance', render: (r) => [r.store_id ? stores.name(r.store_id as string) : null, r.category_id ? cats.name(r.category_id as string) : null, r.origin ? ORIGIN_LABEL[r.origin as string] : null].filter(Boolean).join(' · ') || 'General' },
            { label: 'Preparación', render: (r) => days(r.min_days, r.max_days), className: 'whitespace-nowrap' },
            { label: 'Texto', render: (r) => (r.label as string) ?? '—', className: 'text-[13px] text-ink-2' },
          ]}
          footer="Días hasta que el artículo está listo para despachar, antes del tránsito. Gana la regla más específica: tienda, luego categoría, luego origen, luego disponibilidad."
        />
      )}
    </>
  );
}
