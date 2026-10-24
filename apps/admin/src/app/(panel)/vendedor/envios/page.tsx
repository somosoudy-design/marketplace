'use client';
import { useQuery } from '@tanstack/react-query';
import { CrudTable } from '@/components/Crud';
import { Notice, PageHeader } from '@/components/ui';
import { money } from '@/lib/format';
import { db, run } from '@/lib/kora';
import { useStore } from '@/lib/store';

export default function SellerShipping() {
  const { store } = useStore();
  const s = store!;
  const methods = useQuery({ queryKey: ['methods-ref'], queryFn: () => run<{ id: string; name: string; kind: string }[]>(db('shipping_methods').select('id, name, kind').eq('active', true).order('sort')) });
  const zones = useQuery({ queryKey: ['zones-ref'], queryFn: () => run<{ id: string; name: string }[]>(db('shipping_zones').select('id, name').order('name')) });
  const mOpts = (methods.data ?? []).filter((m) => m.kind !== 'store_pickup').map((m) => ({ value: m.id, label: m.name }));
  const zOpts = (zones.data ?? []).map((z) => ({ value: z.id, label: z.name }));
  const name = (l: { value: string; label: string }[], id: unknown) => l.find((x) => x.value === id)?.label ?? '—';

  if (s.kind !== 'seller') {
    return (
      <>
        <PageHeader eyebrow={s.name} title="Tarifas de envío" />
        <Notice tone="info">Los envíos de esta tienda los gestiona la plataforma desde Transportistas y tarifas.</Notice>
      </>
    );
  }
  return (
    <>
      <PageHeader eyebrow={s.name} title="Tarifas de envío" description="Lo que cobras por despachar tus pedidos según la zona de la dirección. Solo se ofrecen al comprador las tarifas activas." />
      <CrudTable
        table="shipping_rates"
        scope={s.id}
        filter={(q) => q.eq('store_id', s.id)}
        select="id, method_id, zone_id, base_usd, per_kg_usd, free_over_usd, min_days, max_days, max_weight_kg, active, is_demo"
        order="zone_id"
        toggleKey="active"
        createLabel="Nueva tarifa"
        defaults={{ per_kg_usd: '0', active: true }}
        fixed={{ store_id: s.id, flows: ['seller_shipping'], is_demo: false }}
        validate={(v) => (Number(v.max_days) < Number(v.min_days) ? 'El máximo de días no puede ser menor que el mínimo.' : null)}
        fields={[
          { key: 'method_id', label: 'Método', type: 'select', options: mOpts, required: true },
          { key: 'zone_id', label: 'Zona', type: 'select', options: zOpts, required: true },
          { key: 'base_usd', label: 'Base (USD)', type: 'decimal', required: true },
          { key: 'per_kg_usd', label: 'Por kg adicional (USD)', type: 'decimal', required: true },
          { key: 'free_over_usd', label: 'Gratis desde (USD)', type: 'decimal', nullable: true },
          { key: 'max_weight_kg', label: 'Peso máximo (kg)', type: 'decimal', nullable: true },
          { key: 'min_days', label: 'Días mínimos', type: 'int', required: true },
          { key: 'max_days', label: 'Días máximos', type: 'int', required: true },
        ]}
        sortRows={(a, b) => name(zOpts, a.zone_id).localeCompare(name(zOpts, b.zone_id), 'es') || name(mOpts, a.method_id).localeCompare(name(mOpts, b.method_id), 'es')}
        columns={[
          { label: 'Zona', render: (r) => <span className="font-semibold">{name(zOpts, r.zone_id)}</span>, className: 'whitespace-nowrap' },
          { label: 'Método', render: (r) => <>{name(mOpts, r.method_id)}{r.is_demo ? <span className="ml-2 text-[12px] font-bold text-warning">Demo · revisa y guarda</span> : null}</> },
          { label: 'Base', render: (r) => money(r.base_usd as string, 'USD'), className: 'tabular' },
          { label: 'Por kg', render: (r) => money(r.per_kg_usd as string, 'USD'), className: 'tabular' },
          { label: 'Gratis desde', render: (r) => (r.free_over_usd ? money(r.free_over_usd as string, 'USD') : '—'), className: 'tabular' },
          { label: 'Tránsito', render: (r) => `${r.min_days}–${r.max_days} d`, className: 'whitespace-nowrap' },
        ]}
        footer="Al guardar una tarifa confirmas que es la que cobras realmente. La plataforma la muestra tal cual al comprador."
      />
    </>
  );
}
