export const ORDER_STATUS_LABEL: Record<string, string> = {
  placed: 'Recibido', in_progress: 'En proceso', completed: 'Completado', cancelled: 'Cancelado',
};
export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  unpaid: 'Pendiente de pago', partially_paid: 'Pago parcial', paid: 'Pagado', refund_due: 'Reembolso pendiente', refunded: 'Reembolsado',
};
export const PAYMENT_RECORD_LABEL: Record<string, string> = {
  pending_verification: 'En verificación', processing: 'Procesando', confirmed: 'Confirmado', rejected: 'Rechazado', refunded: 'Reembolsado', failed: 'Fallido',
};
export const OBLIGATION_KIND_LABEL: Record<string, string> = { full: 'Pago total', down_payment: 'Anticipo', installment: 'Cuota' };
export const FLOW_LABEL: Record<string, string> = { local_stock: 'Stock local', import_order: 'Por encargo', seller_shipping: 'Vendedor externo' };
export const MODERATION_LABEL: Record<string, string> = {
  pending: 'Pendiente', published: 'Publicado', in_review: 'En revisión', rejected: 'Rechazado', suspended: 'Suspendido',
};
export const CLAIM_STATUS_LABEL: Record<string, string> = {
  open: 'Abierto', seller_responded: 'Respondido por la tienda', escalated: 'Escalado', resolved: 'Resuelto', rejected: 'Cerrado',
};
export const CLAIM_REASON_LABEL: Record<string, string> = {
  not_received: 'No lo recibí', damaged: 'Llegó dañado', wrong_item: 'Producto equivocado', not_as_described: 'No es como se describe',
  missing_parts: 'Faltan piezas o unidades', other: 'Otro motivo',
};
export const STORE_STATUS_LABEL: Record<string, string> = { pending: 'Pendiente', active: 'Activa', suspended: 'Suspendida' };
export const PAYOUT_STATUS_LABEL: Record<string, string> = { draft: 'Programada', paid: 'Pagada', cancelled: 'Anulada' };
export const RISK_LABEL: Record<string, string> = { low: 'Normal', restricted: 'Restringida', regulated: 'Regulada' };
export const INTEGRATION_LABEL: Record<string, string> = {
  live: 'Operativa', sandbox: 'En pruebas (sandbox)', pending_credentials: 'Pendiente de credenciales', disabled: 'Deshabilitada',
};
export const OBLIGATION_STATUS_LABEL: Record<string, string> = { pending: 'Pendiente', partially_paid: 'Pago parcial', paid: 'Pagada', cancelled: 'Anulada' };
export const SHIPPING_KIND_LABEL: Record<string, string> = { home_delivery: 'A domicilio', office_pickup: 'Retiro en oficina', store_pickup: 'Retiro en tienda' };
export const ORIGIN_LABEL: Record<string, string> = { local: 'Stock local', import: 'Importación por encargo', seller: 'Envía el vendedor' };
