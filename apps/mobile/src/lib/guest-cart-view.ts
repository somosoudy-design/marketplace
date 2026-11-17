import type { CartLine, ProductDetail } from '@kora/api';
import {
  AVAILABILITY,
  D,
  describeDispatchStage,
  resolveProductSelection,
  type Availability,
  type GuestLine,
} from '@kora/core';

export interface GuestOfferLine extends CartLine {
  priceKnown: boolean;
  dispatchStage: string | null;
  storeId: string;
  storeName: string;
}

/** A saved selection retains its identity. Only a successful catalogue read supplies current offer data. */
export function guestCartOffer(
  saved: readonly GuestLine[],
  products: ReadonlyMap<string, ProductDetail | null> | undefined,
  reliable: boolean,
) {
  const lines: GuestOfferLine[] = saved.map((old) => {
    const product = reliable ? products?.get(old.product_id) : undefined;
    const selected = product ? resolveProductSelection(product, old.variant_id) : null;
    const variant = product?.variants.find((row) => row.id === old.variant_id);
    const priceKnown = selected?.price_usd != null && Number.isFinite(selected.price_usd) && selected.price_usd > 0;
    const unitPrice = priceKnown ? selected!.price_usd! : 0;
    const issue: CartLine['issue'] = !reliable
      ? null
      : !product || !selected?.variant?.active
        ? 'unavailable'
        : selected.stock === 0
          ? 'sold_out'
          : !selected.canBuy
            ? 'unavailable'
            : old.quantity > product.max_per_order
              ? 'over_limit'
              : old.quantity > selected.maxQuantity
                ? 'insufficient_stock'
                : null;
    const savedAvailability = Object.hasOwn(AVAILABILITY, old.availability)
      ? (old.availability as Availability)
      : 'unavailable';
    const image =
      selected?.cover?.path ??
      (selected?.mediaState === 'unclassified' ? (product?.general_images?.[0]?.path ?? null) : null);
    return {
      product_id: old.product_id,
      variant_id: old.variant_id,
      quantity: old.quantity,
      title: product?.title ?? old.title,
      variant_title: variant?.title ?? old.variant_title,
      image_path: reliable ? image : old.image_path,
      product_condition: product ? product.condition : old.product_condition,
      availability: product?.availability ?? (reliable ? 'unavailable' : savedAvailability),
      max_quantity: selected?.maxQuantity ?? 0,
      unit_price_usd: unitPrice,
      line_total_usd: D(unitPrice).times(old.quantity).toNumber(),
      issue,
      priceKnown,
      dispatchStage:
        product && selected?.canBuy
          ? describeDispatchStage(product.availability, product.lead_min_days, product.lead_max_days)
          : null,
      storeId: product?.store.id ?? 'saved',
      storeName: product?.store.name ?? 'Productos guardados',
    };
  });
  const groups = [...new Set(lines.map((line) => line.storeId))].map((id) => ({
    key: id,
    storeName: lines.find((line) => line.storeId === id)!.storeName,
    lines: lines.filter((line) => line.storeId === id),
  }));
  return {
    lines,
    groups,
    units: lines.reduce((sum, line) => sum + line.quantity, 0),
    issues: lines.filter((line) => line.issue !== null).length,
    itemsUsd:
      reliable && lines.every((line) => line.priceKnown)
        ? lines.reduce((sum, line) => sum.plus(line.line_total_usd), D(0)).toNumber()
        : null,
  };
}
