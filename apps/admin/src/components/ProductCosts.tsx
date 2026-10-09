'use client';
import type { ProductPricing } from '@kora/api';
import { priceFromCost, type PriceBreakdown } from '@kora/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, ErrorBox, Field, Input, Loading, Notice, Select, Toggle } from '@/components/ui';
import { dateTime, money } from '@/lib/format';
import { kora } from '@/lib/kora';
import { gapRates, inForce, pct } from '@/lib/pricing';

// "Costos y precio" of a product (docs/PRECIOS.md): purchase cost per variant, freight, logistics and margin when
// they differ from the rule, and whether the price follows the cost and the day's gap. The preview uses the shared
// core with the rule and the snapshot the database sends; saving goes through set_product_costs, which reprices.

const AMOUNT = /^\d{1,7}([.,]\d{1,2})?$/;
const n = (s: string) => s.trim().replace(',', '.');
const SOURCES = { amazon: 'Amazon', proveedor: 'Proveedor', propio: 'Producción propia', otro: 'Otro' } as const;
type Source = keyof typeof SOURCES;

interface Draft {
  source: Source;
  url: string;
  freight: string;
  logistics: string;
  margin: string;
  auto: boolean;
  costs: Record<string, string>;
}

const fromServer = (d: ProductPricing): Draft => ({
  source: d.costs?.source ?? 'amazon',
  url: d.costs?.source_url ?? '',
  freight: d.costs?.freight_usd != null ? String(Number(d.costs.freight_usd)) : '',
  logistics: d.costs?.logistics_usd != null ? String(Number(d.costs.logistics_usd)) : '',
  margin: d.costs?.margin_pct != null ? String(Number(d.costs.margin_pct)) : '',
  auto: d.costs?.auto_price ?? true,
  costs: Object.fromEntries(d.variants.map((v) => [v.variant_id, v.cost_usd != null ? String(Number(v.cost_usd)) : ''])),
});

export function ProductCosts({ productId }: { productId: string }) {
  const q = useQuery({ queryKey: ['product-pricing', productId], queryFn: () => kora().api.seller.productPricing(productId) });
  if (q.isPending) return <Card title="Costos y precio"><Loading rows={3} /></Card>;
  if (q.isError) return <Card title="Costos y precio"><ErrorBox error={q.error} onRetry={() => q.refetch()} /></Card>;
  return <CostsForm key={q.data.costs?.updated_at ?? 'new'} data={q.data} />;
}

function CostsForm({ data }: { data: ProductPricing }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [d, setD] = useState<Draft>(() => fromServer(data));
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const snap = inForce(data.snapshot) ? data.snapshot : null;
  const rule = data.rule;

  const errors = {
    url: d.url.trim() && !/^https?:\/\//.test(d.url.trim()) ? 'Pega el enlace completo (https://…).' : null,
    freight: d.freight.trim() && !AMOUNT.test(d.freight.trim()) ? 'Monto en USD, hasta 2 decimales.' : null,
    logistics: d.logistics.trim() && !AMOUNT.test(d.logistics.trim()) ? 'Monto en USD, hasta 2 decimales.' : null,
    margin: d.margin.trim() && (!/^\d{1,3}([.,]\d{1,2})?$/.test(d.margin.trim()) || Number(n(d.margin)) > 500) ? 'Entre 0 y 500 %.' : null,
    costs: Object.values(d.costs).some((c) => c.trim() && (!AMOUNT.test(c.trim()) || Number(n(c)) <= 0)) ? 'Cada costo es un monto en USD mayor que 0.' : null,
  };
  const valid = Object.values(errors).every((e) => !e);

  const preview = (variantCost: string): PriceBreakdown | null => {
    if (!variantCost.trim() || errors.costs || errors.freight || errors.logistics || errors.margin) return null;
    return priceFromCost(
      { cost_usd: n(variantCost), weight_kg: data.weight_kg, freight_usd: d.freight.trim() ? n(d.freight) : null, logistics_usd: d.logistics.trim() ? n(d.logistics) : null, margin_pct: d.margin.trim() ? n(d.margin) : null },
      rule,
      snap ? gapRates(snap) : { bcv: 1, usdt_ves: 1 },
    );
  };

  const save = useMutation({
    mutationFn: () =>
      kora().api.seller.setProductCosts(
        data.product_id,
        { source: d.source, source_url: d.url.trim() || null, freight_usd: d.freight.trim() ? n(d.freight) : null, logistics_usd: d.logistics.trim() ? n(d.logistics) : null, margin_pct: d.margin.trim() ? n(d.margin) : null, auto_price: d.auto } as never,
        data.variants.map((v) => ({ variant_id: v.variant_id, cost_usd: d.costs[v.variant_id]?.trim() ? Number(n(d.costs[v.variant_id]!)) : null })),
      ),
    onSuccess: (r) => {
      qc.setQueryData(['product-pricing', data.product_id], r);
      qc.invalidateQueries({ queryKey: ['seller-product', data.product_id] });
      qc.invalidateQueries({ queryKey: ['seller-products'] });
      const moved = r.variants.filter((v) => d.auto && v.breakdown?.price_usd != null && Number(v.breakdown.price_usd) === Number(v.price_usd));
      toast.ok(moved.length ? `Costos guardados. Precio: ${moved.map((v) => money(v.price_usd, 'USD')).join(', ')} a tasa BCV.` : 'Costos guardados.');
    },
    onError: toast.error,
  });

  const freightHint = `Vacío: ${String(data.weight_kg).replace('.', ',')} kg × ${money(rule.per_kg_usd, 'USD')} por kg`;
  return (
    <Card title="Costos y precio" actions={snap ? <Badge tone="info">Brecha del día {pct(snap.gap_pct)}</Badge> : <Badge tone="warning">Sin brecha vigente</Badge>}>
      <div className="flex flex-col gap-4" data-testid="product-costs">
        <p className="text-[13px] text-ink-3">
          Solo tu tienda y la administración ven estos datos. El precio a tasa BCV sale del costo, el flete, los gastos y el margen,
          con la brecha del día; Zelle y USDT pagan lo que el producto debe dejar en divisas. Los campos vacíos usan la regla
          general que define la administración.
        </p>
        <div className="grid gap-4 md:grid-cols-[180px_1fr]">
          <Field label="Origen">
            <Select value={d.source} onChange={(e) => set({ source: e.target.value as Source })}>
              {Object.entries(SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Enlace de compra" error={errors.url}>
            <Input value={d.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://www.amazon.com/dp/…" data-testid="costs-url" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Flete por unidad (USD)" error={errors.freight} hint={freightHint}>
            <Input inputMode="decimal" className="tabular" value={d.freight} onChange={(e) => set({ freight: e.target.value })} data-testid="costs-freight" />
          </Field>
          <Field label="Gastos logísticos (USD)" error={errors.logistics} hint={`Vacío: ${money(rule.fixed_usd, 'USD')} de la regla`}>
            <Input inputMode="decimal" className="tabular" value={d.logistics} onChange={(e) => set({ logistics: e.target.value })} data-testid="costs-logistics" />
          </Field>
          <Field label="Margen (%)" error={errors.margin} hint={`Vacío: ${String(rule.markup_pct).replace('.', ',')} % de la regla`}>
            <Input inputMode="decimal" className="tabular" value={d.margin} onChange={(e) => set({ margin: e.target.value })} data-testid="costs-margin" />
          </Field>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="text-left text-[12px] font-bold uppercase tracking-wide text-ink-3">
                <th className="py-1.5 pr-3">Variante</th><th className="py-1.5 pr-3">Costo USD</th><th className="py-1.5 pr-3">Debe dejar</th>
                <th className="py-1.5 pr-3">Precio BCV</th><th className="py-1.5 pr-3">Zelle / USDT</th><th className="py-1.5">Ganancia</th>
              </tr>
            </thead>
            <tbody>
              {data.variants.map((v) => {
                const b = preview(d.costs[v.variant_id] ?? '');
                return (
                  <tr key={v.variant_id} className="border-t border-line align-middle">
                    <td className="py-2 pr-3 font-semibold">{v.title}<span className="block text-[12px] font-normal text-ink-3">Hoy {money(v.price_usd, 'USD')}</span></td>
                    <td className="py-2 pr-3">
                      <Input inputMode="decimal" className="tabular max-w-28" value={d.costs[v.variant_id] ?? ''} placeholder="0.00" aria-label={`Costo de ${v.title}`}
                        onChange={(e) => set({ costs: { ...d.costs, [v.variant_id]: e.target.value } })} data-testid={`costs-variant-${v.title}`} />
                    </td>
                    <td className="tabular py-2 pr-3 text-ink-2">{b ? money(b.target_divisas_usd, 'USD') : '—'}</td>
                    <td className="tabular py-2 pr-3 font-bold" data-testid={`costs-price-${v.title}`}>{b && snap ? money(b.price_usd, 'USD') : '—'}</td>
                    <td className="tabular py-2 pr-3 text-success">{b && snap ? `${money(b.price_divisas_usd, 'USD')} (−${pct(b.divisas_discount_pct)})` : '—'}</td>
                    <td className="tabular py-2 text-ink-2">{b && snap ? `${money(b.profit_usd, 'USD')} · ${pct(b.profit_pct)}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {errors.costs ? <p className="text-[13px] text-danger">{errors.costs}</p> : null}
        {!snap ? (
          <Notice tone="warning">Sin brecha del día no se puede calcular el precio a tasa BCV. Se toma sola cada día; también a mano en Tasas.</Notice>
        ) : (
          <p className="text-[12.5px] text-ink-3">
            Brecha tomada {dateTime(snap.taken_at)}: dólar BCV {money(snap.bcv_rate, 'VES')} y USDT {money(snap.usdt_ves_rate, 'VES')}. Vale hasta {dateTime(snap.valid_until)}.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <label className="flex items-center gap-3 text-[14px]">
            <span data-testid="costs-auto"><Toggle label="El precio sigue al costo y a la brecha del día" checked={d.auto} onChange={(v) => set({ auto: v })} /></span>
            <span>
              <span className="font-semibold text-ink">El precio sigue al costo y a la brecha del día</span>
              <span className="block text-[12.5px] text-ink-3">Apagado: el precio de las variantes queda como lo escribas arriba.</span>
            </span>
          </label>
          <Button onClick={() => valid && save.mutate()} disabled={!valid} loading={save.isPending} data-testid="costs-save">Guardar costos</Button>
        </div>
      </div>
    </Card>
  );
}
