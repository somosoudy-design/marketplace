import type { CartLine, CatalogMetadata, ProductDetail } from '@kora/api';
import { D, resolveProductSelection, type GuestLine } from '@kora/core';
import { reviewedSelectionInput } from './catalog-selection';
export interface GuestCartLine extends CartLine { slug: string | null; priceKnown: boolean; storeId: string; storeName: string }
export async function readGuestCartCatalog(
  ids: string[],
  readProduct: (id: string) => Promise<ProductDetail | null>,
  readMetadata: (ids: string[]) => Promise<CatalogMetadata[]>,
) {
  ids = [...new Set(ids)];
  const products = new Map((await Promise.all(ids.map(async id => [id, await readProduct(id)] as const))));
  const missing = ids.filter(id => products.get(id) && !products.get(id)?.catalog_metadata);
  const metadata = new Map<string, CatalogMetadata>();
  for (let start = 0; start < missing.length; start += 100) for (const row of await readMetadata(missing.slice(start, start + 100))) metadata.set(row.product_id, row);
  return { products, metadata };
}
export function guestCartView(saved: GuestLine[], { products, metadata }: Awaited<ReturnType<typeof readGuestCartCatalog>>) {
  const lines: GuestCartLine[] = saved.map(old => {
    const p = products.get(old.product_id), m = p?.catalog_metadata ?? metadata.get(old.product_id);
    const selected = p && m ? resolveProductSelection(reviewedSelectionInput(p, m), old.variant_id) : null;
    const v = m?.variants.find(v => v.variant_id === old.variant_id);
    const priceKnown = selected?.price_usd != null && Number.isFinite(selected.price_usd) && selected.price_usd > 0;
    const unit = priceKnown ? selected!.price_usd! : 0;
    const max = selected?.maxQuantity ?? 0;
    const issue: CartLine['issue'] = !selected?.variant?.active || !p ? 'unavailable'
      : selected.stock === 0 ? 'sold_out'
        : !selected.canBuy ? 'unavailable'
          : old.quantity > p.max_per_order ? 'over_limit'
            : old.quantity > max ? 'insufficient_stock' : null;
    return {
      variant_id: old.variant_id, product_id: old.product_id, quantity: old.quantity,
      title: p?.title ?? (typeof old.title === 'string' ? old.title : 'Producto guardado'), variant_title: v?.title ?? (typeof old.variant_title === 'string' ? old.variant_title : null),
      image_path: selected?.cover?.path ?? (m?.variants.length === 1 ? m.general_images?.[0]?.path ?? null : null), image_scope: selected?.cover ? 'variant' : 'general', availability: p?.availability ?? 'unavailable',
      max_quantity: Math.max(1, max), product_condition: m?.condition ?? old.product_condition,
      unit_price_usd: unit, line_total_usd: D(unit).times(old.quantity).toNumber(), issue,
      slug: p?.slug ?? null, priceKnown, storeId: p?.store_id ?? 'unavailable', storeName: p?.store_name ?? 'Productos guardados',
    };
  });
  const groups = [...new Set(lines.map(line => line.storeId))].map(id => ({ key: id, storeName: lines.find(line => line.storeId === id)!.storeName, lines: lines.filter(line => line.storeId === id) }));
  return { lines, groups, units: lines.reduce((n, l) => n + l.quantity, 0), issues: lines.filter(l => !!l.issue).length,
    items_usd: lines.every(l => l.priceKnown) ? lines.reduce((sum, l) => sum.plus(l.line_total_usd), D(0)).toNumber() : null };
}
