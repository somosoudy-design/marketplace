import { z } from 'zod';

/** Unknown legacy condition stays null/undefined; neither means new nor refurbished. */
export const productConditionSchema = z.enum(['new', 'refurbished']);
export type ProductCondition = z.infer<typeof productConditionSchema>;
export const optionalProductConditionSchema = productConditionSchema.nullable().optional();
export const variantOptionsSchema = z.record(z.string().trim().min(1).max(40), z.string().trim().min(1).max(80));
export const productConditionLabel = (condition: ProductCondition | null | undefined): string | null =>
  condition === 'refurbished' ? 'Reacondicionado' : condition === 'new' ? 'Nuevo' : null;

export interface SelectableVariant {
  id: string;
  options?: Record<string, string>;
  price_usd: number;
  stock: number | null;
  active: boolean;
  media_classified?: boolean;
}
export interface SelectionImage {
  id?: string;
  path: string;
  alt?: string | null;
}
export interface VariantImageLink {
  variant_id: string;
  image_id: string;
  sort: number;
}
export interface ProductSelectionInput {
  availability: string;
  max_per_order: number;
  variants: readonly SelectableVariant[];
  images: readonly SelectionImage[];
  variant_image_links?: readonly VariantImageLink[];
  condition?: ProductCondition | null;
}
export interface ProductColorSummary {
  value: string;
  variant_ids: string[];
  available_variant_ids: string[];
  price_from_usd: number;
  stock: number | null;
}
const purchasable = new Set(['available', 'on_order', 'in_transit', 'reservable']);
const validPrice = (v: SelectableVariant) => Number.isFinite(v.price_usd) && v.price_usd > 0;
const color = (v: SelectableVariant) => {
  const declared = new Set(
    Object.entries(v.options ?? {})
      .filter(([name, value]) => name.trim().toLowerCase() === 'color' && typeof value === 'string' && value.trim())
      .map(([, value]) => value),
  );
  return declared.size === 1 ? [...declared][0] : undefined;
};

/** Only declared options; no colour guessing from titles, photos or a hex palette. */
export function productColorSummaries(variants: readonly SelectableVariant[]): ProductColorSummary[] {
  const groups = new Map<string, SelectableVariant[]>();
  for (const variant of variants) {
    const value = color(variant);
    if (!variant.active || !value || !validPrice(variant)) continue;
    groups.set(value, [...(groups.get(value) ?? []), variant]);
  }
  return [...groups].map(([value, rows]) => {
    const available = rows.filter((v) => v.stock == null || v.stock > 0);
    return {
      value,
      variant_ids: rows.map((v) => v.id),
      available_variant_ids: available.map((v) => v.id),
      price_from_usd: Math.min(...(available.length ? available : rows).map((v) => v.price_usd)),
      stock: rows.some((v) => v.stock == null) ? null : rows.reduce((n, v) => n + Math.max(0, v.stock ?? 0), 0),
    };
  });
}

/** Resolve against the latest response, never a stale variant object held by a screen. */
export function resolveProductSelection(product: ProductSelectionInput, selectedVariantId?: string | null) {
  const id =
    selectedVariantId ??
    product.variants.find((v) => v.active && validPrice(v) && (v.stock == null || v.stock > 0))?.id ??
    product.variants.find((v) => v.active)?.id ??
    null;
  const variant = product.variants.find((v) => v.id === id) ?? null;
  const max = Number.isInteger(product.max_per_order) && product.max_per_order > 0 ? product.max_per_order : 0;
  const stock = variant?.stock;
  const validStock = stock === null || (typeof stock === 'number' && Number.isInteger(stock) && stock >= 0);
  const maxQuantity = variant?.active && validPrice(variant) && validStock ? Math.min(max, stock ?? max) : 0;
  const images = new Map(product.images.filter((i) => !!i.id).map((i) => [i.id!, i]));
  const links = [...(product.variant_image_links ?? [])]
    .filter((i) => i.variant_id === variant?.id)
    .sort((a, b) => a.sort - b.sort || a.image_id.localeCompare(b.image_id));
  const ids = [...new Set(links.map((i) => i.image_id))];
  const gallery = variant?.media_classified ? ids.flatMap((id) => (images.has(id) ? [images.get(id)!] : [])) : [];
  return {
    selectedVariantId: id,
    variant,
    price_usd: variant?.price_usd ?? null,
    stock: variant?.stock ?? null,
    maxQuantity,
    canBuy: !!variant?.active && maxQuantity > 0 && purchasable.has(product.availability),
    gallery,
    cover: gallery[0] ?? null,
    mediaState: !variant?.media_classified
      ? ('unclassified' as const)
      : gallery.length
        ? ('assigned' as const)
        : ('none' as const),
    // Preserve originals for a deliberately labelled general-product presentation, never assign them to a colour.
    unclassifiedImages: variant?.media_classified ? [] : [...product.images],
    condition: product.condition,
    conditionLabel: productConditionLabel(product.condition),
  };
}

export interface ProductSelectionState {
  selectedVariantId: string | null;
  galleryIndex: number;
}
export type SelectionAction =
  { type: 'select'; variantId: string } | { type: 'swipe'; index: number } | { type: 'refresh' };
export function reconcileProductSelection(
  product: ProductSelectionInput,
  state: ProductSelectionState,
  action: SelectionAction,
) {
  const selected = action.type === 'select' ? action.variantId : state.selectedVariantId;
  const resolved = resolveProductSelection(product, selected);
  const desired = action.type === 'select' ? 0 : action.type === 'swipe' ? action.index : state.galleryIndex;
  const index = Math.max(
    0,
    Math.min(Number.isInteger(desired) ? desired : 0, Math.max(0, resolved.gallery.length - 1)),
  );
  return { ...resolved, state: { selectedVariantId: resolved.selectedVariantId, galleryIndex: index } };
}
