import type { ProductDetail } from '@kora/api';

export function quantityLimitLabel(max: number, stock?: number | null, perOrder?: number): string | null {
  if (!Number.isSafeInteger(max) || max < 1) return null;
  const units = max === 1 ? '1 unidad' : `${max} unidades`;
  let reason = 'según la disponibilidad actual';
  if (typeof stock === 'number' && stock === max && (perOrder == null || stock < perOrder)) {
    reason = 'según las existencias actuales';
  } else if (perOrder === max) {
    reason = 'por pedido';
  }
  return `Máximo ${units} ${reason}.`;
}

/** Product reads may be newer than a cart summary. Only use their estimate when modality still agrees. */
export function matchingCartProduct(
  product: ProductDetail | null | undefined,
  productId: string,
  availability: ProductDetail['availability'],
): product is ProductDetail {
  return product?.id === productId && product.availability === availability;
}
