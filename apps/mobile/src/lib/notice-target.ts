import type { Href } from 'expo-router';

/**
 * Where tapping a notice leads, in the notices list or on a push. Store-team notices are handled in the seller panel,
 * so they open nothing here.
 */
export function noticeTarget(kind: string, data: Record<string, unknown> | null | undefined): Href | null {
  const d = (data ?? {}) as Record<string, string>;
  if (d.audience === 'store') return null;
  if (kind === 'claim_update' && d.fulfillment_id) return { pathname: '/claim/[fulfillmentId]', params: { fulfillmentId: d.fulfillment_id } };
  if (d.order_id) return { pathname: '/orders/[id]', params: { id: d.order_id } };
  if (d.product_id) return { pathname: '/product/[id]', params: { id: d.product_id } };
  return null;
}
