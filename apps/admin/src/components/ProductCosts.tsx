'use client';
import type { SellerProductChanges, SellerReviewedPricing } from '@kora/api';
import { priceFromCost, type PriceBreakdown, type CostRule } from '@kora/core';
import { Badge, Button, Card, Field, Input, Notice, Select, Toggle } from '@/components/ui';
import { dateTime, money } from '@/lib/format';
import { pct } from '@/lib/pricing';

// "Costos y precio" of a product (docs/PRECIOS.md): purchase cost per variant, freight, logistics and margin when
// they differ from the rule, and whether the price follows the cost and the day's gap. The preview uses the shared
// core with the rule and the snapshot the database sends; saving goes through set_product_costs, which reprices.

const AMOUNT = /^\d{1,7}([.,]\d{1,2})?$/;
const n = (s: string) => s.trim().replace(',', '.');
const SOURCES = { amazon: 'Amazon', proveedor: 'Proveedor', propio: 'Producción propia', otro: 'Otro' } as const;
type Source = keyof typeof SOURCES;

export interface ProductCostsDraft {
  source: string;
  url: string;
  freight: string;
  logistics: string;
  margin: string;
  auto: boolean;
  costs: Record<string, string>;
}

export const productCostsDraft = (d: SellerReviewedPricing): ProductCostsDraft => ({
  source: d.costs?.source ?? 'amazon',
  url: d.costs?.source_url ?? '',
  freight: d.costs?.freight_usd != null ? String(Number(d.costs.freight_usd)) : '',
  logistics: d.costs?.logistics_usd != null ? String(Number(d.costs.logistics_usd)) : '',
  margin: d.costs?.margin_pct != null ? String(Number(d.costs.margin_pct)) : '',
  auto: d.costs?.auto_price ?? true,
  costs: Object.fromEntries(d.variants.map((v) => [v.variant_id, v.cost_usd != null ? String(Number(v.cost_usd)) : ''])),
});

export function productCostsPatch(data: SellerReviewedPricing, draft: ProductCostsDraft): SellerProductChanges {
  const original = productCostsDraft(data);
  if (JSON.stringify(original) === JSON.stringify(draft)) return {};
  const costs: NonNullable<SellerProductChanges['costs']> = {};
  if (original.source !== draft.source) costs.source = draft.source;
  if (original.url !== draft.url) costs.source_url = draft.url.trim() || null;
  if (original.freight !== draft.freight) costs.freight_usd = draft.freight.trim() ? Number(n(draft.freight)) : null;
  if (original.logistics !== draft.logistics) costs.logistics_usd = draft.logistics.trim() ? Number(n(draft.logistics)) : null;
  if (original.margin !== draft.margin) costs.margin_pct = draft.margin.trim() ? Number(n(draft.margin)) : null;
  if (original.auto !== draft.auto) costs.auto_price = draft.auto;
  return {
    costs,
    variantCosts: data.variants.filter(v => original.costs[v.variant_id] !== draft.costs[v.variant_id]).map(v => ({
      variant_id: v.variant_id, cost_usd: draft.costs[v.variant_id]?.trim() ? Number(n(draft.costs[v.variant_id]!)) : null,
    })),
  };
}

export function productCostsErrors(d: ProductCostsDraft) {
  return {
    url: d.url.trim() && !/^https?:\/\//.test(d.url.trim()) ? 'Pega el enlace completo (https://…).' : null,
    freight: d.freight.trim() && !AMOUNT.test(d.freight.trim()) ? 'Monto en USD, hasta 2 decimales.' : null,
    logistics: d.logistics.trim() && !AMOUNT.test(d.logistics.trim()) ? 'Monto en USD, hasta 2 decimales.' : null,
    margin: d.margin.trim() && (!/^\d{1,3}([.,]\d{1,2})?$/.test(d.margin.trim()) || Number(n(d.margin)) > 500) ? 'Entre 0 y 500 %.' : null,
    costs: Object.values(d.costs).some(c => c.trim() && (!AMOUNT.test(c.trim()) || Number(n(c)) <= 0)) ? 'Cada costo es un monto en USD mayor que 0.' : null,
  };
}

function costRule(value: SellerReviewedPricing['rule']): CostRule | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { markup_pct, per_kg_usd, fixed_usd, round_to } = value;
  if (![markup_pct, per_kg_usd, fixed_usd].every(v => typeof v === 'number' && Number.isFinite(v)) ||
      !(round_to === null || (typeof round_to === 'number' && Number.isFinite(round_to)))) return null;
  return { markup_pct: markup_pct as number, per_kg_usd: per_kg_usd as number, fixed_usd: fixed_usd as number, round_to };
}

function snapshotInForce(snapshot: SellerReviewedPricing['snapshot']) {
  const now = Date.now();
  return !!snapshot && new Date(snapshot.taken_at).getTime() <= now && new Date(snapshot.valid_until).getTime() > now;
}

/** Controlled by the reviewed product form; costs never write separately from its revision. */
export function ProductCosts({ data, weightKg, draft: d, onChange, onReviewed, reviewed }: {
  data: SellerReviewedPricing; weightKg: number | null; draft: ProductCostsDraft; onChange: (draft: ProductCostsDraft) => void;
  onReviewed: () => void; reviewed: boolean;
}) {
  const set = (patch: Partial<ProductCostsDraft>) => onChange({ ...d, ...patch });
  const snap = snapshotInForce(data.snapshot) ? data.snapshot : null;
  const rule = costRule(data.rule);
  const errors = productCostsErrors(d);
  const valid = Object.values(errors).every(e => !e);
  const preview = (variantCost: string): PriceBreakdown | null => {
    if (!rule || weightKg == null || !Number.isFinite(weightKg) || !variantCost.trim() || errors.costs || errors.freight || errors.logistics || errors.margin) return null;
    return priceFromCost(
      { cost_usd: n(variantCost), weight_kg: weightKg, freight_usd: d.freight.trim() ? n(d.freight) : null, logistics_usd: d.logistics.trim() ? n(d.logistics) : null, margin_pct: d.margin.trim() ? n(d.margin) : null },
      rule,
      snap ? { bcv: snap.bcv_rate, usdt_ves: snap.usdt_ves_rate, usd_usdt: snap.usd_usdt_rate } : { bcv: 1, usdt_ves: 1 },
    );
  };

  const freightHint = weightKg == null ? 'Revisa el peso del producto para calcular el flete.' : rule ? `Vacío: ${String(weightKg).replace('.', ',')} kg × ${money(rule.per_kg_usd, 'USD')} por kg` : 'No se pudo leer la regla de precios.';
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
          <Field label="Gastos logísticos (USD)" error={errors.logistics} hint={rule ? `Vacío: ${money(rule.fixed_usd, 'USD')} de la regla` : undefined}>
            <Input inputMode="decimal" className="tabular" value={d.logistics} onChange={(e) => set({ logistics: e.target.value })} data-testid="costs-logistics" />
          </Field>
          <Field label="Recargo sobre el costo total (%)" error={errors.margin} hint={rule ? `Vacío: ${String(rule.markup_pct).replace('.', ',')} % de la regla. No es el margen sobre el precio.` : undefined}>
            <Input inputMode="decimal" className="tabular" value={d.margin} onChange={(e) => set({ margin: e.target.value })} data-testid="costs-margin" />
          </Field>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="text-left text-[12px] font-bold uppercase tracking-wide text-ink-3">
                <th className="py-1.5 pr-3">Variante</th><th className="py-1.5 pr-3">Costo de compra</th><th className="py-1.5 pr-3">Cuesta traerlo</th><th className="py-1.5 pr-3">Debe dejar</th>
                <th className="py-1.5 pr-3">Precio sugerido (BCV)</th><th className="py-1.5 pr-3">Recibimos con Zelle / USDT</th><th className="py-1.5">Ganancia · margen sobre venta</th>
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
                    <td className="tabular py-2 pr-3 text-ink-2">{b ? money(b.landed_usd, 'USD') : '—'}</td>
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
        <p className="text-[12.5px] text-ink-3">
          «Cuesta traerlo» = compra + flete + gastos. «Debe dejar» = eso más el recargo. Con Pago Móvil o transferencia se cobra el
          precio sugerido en bolívares a tasa BCV, que al cambiarlos a USDT vuelve a ser lo que «debe dejar»; con Zelle o USDT se
          recibe directamente. El margen sobre venta es la ganancia dividida entre lo que se recibe.
        </p>
        {!snap ? (
          <Notice tone="warning">Sin brecha del día no se puede calcular el precio a tasa BCV. Se toma sola cada día; también a mano en Tasas.</Notice>
        ) : (
          <p className="text-[12.5px] text-ink-3">
            Brecha tomada {dateTime(snap.taken_at)}: dólar BCV {money(snap.bcv_rate, 'VES')} y USDT {money(snap.usdt_ves_rate, 'VES')}. Vale hasta {dateTime(snap.valid_until)}.
          </p>
        )}
        <p className="text-[12.5px] text-ink-3">Los costos se guardan junto con los cambios del producto.</p>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <label className="flex items-center gap-3 text-[14px]">
            <span data-testid="costs-auto"><Toggle label="El precio sigue al costo y a la brecha del día" checked={d.auto} onChange={(v) => set({ auto: v })} /></span>
            <span>
              <span className="font-semibold text-ink">El precio sigue al costo y a la brecha del día</span>
              <span className="block text-[12.5px] text-ink-3">Apagado: el precio de las variantes queda como lo escribas arriba.</span>
            </span>
          </label>
          <Button onClick={onReviewed} disabled={!valid || weightKg == null} data-testid="costs-save">{reviewed ? 'Costos revisados' : 'Confirmar revisión de costos'}</Button>
        </div>
      </div>
    </Card>
  );
}
