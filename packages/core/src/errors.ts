/**
 * Maps database error hints (raised with `using hint = '...'`) to buyer-facing Spanish copy.
 * Keep messages short, specific and actionable.
 */
export const ERROR_MESSAGES: Record<string, string> = {
  product_id_required: 'No encontramos el producto. Actualiza la lista.',
  updated_at_required: 'Actualiza la ficha del producto antes de eliminarlo.',
  product_not_found: 'El producto ya no existe. Cierra esta ficha y actualiza la lista.',
  product_not_suspended: 'Sólo se pueden eliminar productos suspendidos. Actualiza la lista.',
  product_changed: 'El producto cambió. Cierra esta ficha y vuelve a abrirla antes de eliminarlo.',
  product_has_orders: 'Este producto pertenece a pedidos. Se conserva suspendido para mantener su historial.',
  product_in_carts: 'Este producto está en un carrito. Se conserva suspendido; intenta eliminarlo cuando ya no esté vinculado.',
  product_has_reviews: 'Este producto tiene opiniones vinculadas. Se conserva suspendido para mantener su historial.',
  product_busy: 'El producto se está actualizando. Espera un momento y vuelve a intentarlo.',
  auth_required: 'Inicia sesión para continuar.',
  forbidden: 'No tienes permiso para hacer esto.',
  admin_required: 'Esta acción requiere permisos de administración.',
  invalid_state: 'Este registro ya no está en un estado que permita esa acción.',
  ledger_unbalanced: 'No pudimos registrar la operación contable. Intenta de nuevo o contacta a soporte.',
  method_automated: 'Este método se paga desde la pasarela del proveedor, no con referencia manual.',
  rate_limited: 'Demasiados intentos seguidos. Espera un momento y vuelve a intentarlo.',
  cart_empty: 'Tu carrito está vacío.',
  cart_has_issues: 'Algunos productos cambiaron de disponibilidad. Revisa tu carrito.',
  insufficient_stock: 'Ya no queda suficiente inventario de un producto. Ajustamos tu carrito.',
  sold_out: 'Este producto se agotó.',
  unavailable: 'Este producto ya no está disponible.',
  address_required: 'Agrega una dirección de entrega.',
  address_not_found: 'No encontramos esa dirección.',
  shipping_unavailable: 'Aún no hacemos envíos a esa zona para este pedido.',
  shipping_invalid: 'Ese método de envío ya no está disponible. Elige otro.',
  plan_invalid: 'Esa modalidad de pago no aplica a este carrito.',
  seller_revision_conflict: 'El producto cambió mientras lo editabas. Actualiza sus datos antes de volver a guardar.',
  seller_price_review_required: 'Este producto usa precio automático. Revisa sus costos antes de cambiar el precio o el peso.',
  checkout_changed: 'El pedido cambió. Revisa los productos, la entrega y el total antes de confirmar.',
  idempotency_conflict: 'Esta solicitud ya corresponde a otra operación. Comprueba su resultado antes de continuar.',
  catalog_version_conflict: 'El producto cambió. Actualiza sus datos antes de guardar.',
  catalog_sensitive_review_required: 'Este producto requiere revisión administrativa para cambiar su condición o sus fotos.',
  catalog_metadata_review_required: 'Este cambio requiere revisión. Conservamos los datos anteriores.',
  catalog_metadata_guarded: 'Actualiza los datos del producto y guarda desde la gestión de la tienda.',
  idempotency_required: 'No pudimos procesar la solicitud. Intenta de nuevo.',
  cart_intent_cancelled: 'Esta operación de carrito fue cancelada. Revisa el carrito actual antes de continuar.',
  method_unavailable: 'Este método de pago no está disponible por ahora.',
  method_limits: 'El monto está fuera de los límites de este método de pago.',
  rate_unavailable: 'No tenemos una tasa de cambio actualizada en este momento. Paga en USD o intenta más tarde.',
  payment_pending_verification: 'Ya tienes un pago en verificación para este monto.',
  nothing_due: 'Este pedido no tiene saldo pendiente.',
  obligations_invalid: 'Selecciona cuotas pendientes de este pedido.',
  obligations_order: 'Paga primero la cuota más antigua.',
  quote_expired: 'El monto expiró porque la tasa pudo cambiar. Te mostramos el monto actualizado.',
  quote_used: 'Este monto ya se usó. Genera uno nuevo.',
  reference_required: 'Escribe la referencia del pago.',
  reference_invalid: 'La referencia no tiene el formato esperado.',
  proof_required: 'Adjunta el comprobante del pago.',
  proof_invalid: 'El comprobante no es válido.',
  duplicate_reference: 'Esta referencia ya fue registrada. Si es un error, contáctanos.',
  obligation_already_paid: 'Esa cuota ya fue pagada.',
  order_cancelled: 'Este pedido fue cancelado.',
  cancel_requires_support: 'Para cancelar un pedido con pagos, escríbenos.',
  invalid_transition: 'Ese cambio de estado no es posible.',
  payment_required: 'El pago requerido para este paso aún no está confirmado.',
  tracking_required: 'Agrega el número de guía para despachar.',
  step_not_allowed: 'Este estado lo gestiona la plataforma.',
  store_access_denied: 'No tienes acceso a esta tienda.',
  claim_closed: 'Este reclamo ya está cerrado.',
  too_early: 'Puedes escalar el reclamo cuando venza el plazo de respuesta de la tienda.',
  note_required: 'Agrega una nota que explique el motivo.',
  reason_required: 'Agrega el motivo.',
  already_reviewed: 'Este pago ya fue revisado.',
  amount_exceeds_quote: 'El monto recibido supera el cotizado.',
  insufficient_balance: 'El monto supera el saldo disponible.',
  invalid_amount: 'Monto inválido.',
  invalid_quantity: 'Cantidad inválida.',
  invalid_step: 'Estado logístico inválido.',
  superadmin_required: 'Solo la superadministración puede gestionar roles.',
  self_role_change: 'No puedes quitarte tus propios permisos.',
  user_not_found: 'No hay ninguna cuenta con ese correo.',
  already_processed: 'Esta solicitud ya fue procesada.',
  open_orders: 'La cuenta tiene pedidos abiertos. Ciérralos antes de eliminarla.',
  has_roles: 'Quita primero los permisos de administración y el acceso a tiendas.',
  image_rights_required: 'Confirma los derechos de uso de cada imagen antes de publicarla.',
  integration_managed: 'El estado de la integración lo define la configuración del servidor, no el panel.',
  integration_not_ready: 'Esta integración aún no tiene credenciales configuradas. No se puede activar.',
  instructions_required: 'Agrega los datos de pago (cuenta, teléfono o dirección) antes de activar este método.',
  rate_anomaly: 'La tasa recibida varía demasiado respecto a la anterior. Revísala manualmente.',
  invalid_setting: 'Ese valor no es válido para este parámetro.',
  invalid_input: 'Revisa los datos: hay un valor fuera de lo permitido.',
  not_found: 'No encontramos lo que buscas. Puede que ya no exista o no tengas acceso.',
  not_reviewable: 'Podrás calificar este producto cuando se complete la entrega.',
  review_locked: 'Una opinión se puede editar durante 60 días después de publicarla.',
  network: 'Sin conexión. Revisa tu internet e intenta de nuevo.',
  unknown: 'Algo salió mal. Intenta de nuevo.',
};

const DETAILED = new Set(['invalid_setting']);

export interface AppError { code: string; message: string; detail?: string; cause?: unknown }

/** Normalizes PostgREST / Supabase / fetch errors into an AppError with a friendly message. */
export function toAppError(err: unknown): AppError {
  const e = err as { hint?: string; message?: string; code?: string; details?: string; name?: string } | null;
  if (!e) return { code: 'unknown', message: ERROR_MESSAGES.unknown! };
  if (e.name === 'TypeError' && /fetch|network/i.test(e.message ?? '')) return { code: 'network', message: ERROR_MESSAGES.network!, cause: err };
  if (/Failed to fetch|Network request failed|NetworkError/i.test(e.message ?? '')) return { code: 'network', message: ERROR_MESSAGES.network!, cause: err };
  // Functions that need an account are not executable by guests at all, so Postgres answers before the
  // function's own auth check: for the app that means "sign in", not "you are not allowed".
  const guestBlocked = e.code === '42501' && /permission denied for function/i.test(e.message ?? '');
  const hint = e.hint ?? (guestBlocked ? 'auth_required' : e.code === '42501' ? 'forbidden' : e.code === '28000' ? 'auth_required' : undefined);
  // these hints come with a Spanish detail written by the database that says exactly what to fix
  if (hint && DETAILED.has(hint) && e.details) return { code: hint, message: e.details, cause: err };
  if (hint && ERROR_MESSAGES[hint]) return { code: hint, message: ERROR_MESSAGES[hint]!, detail: e.details, cause: err };
  return { code: e.code ?? 'unknown', message: ERROR_MESSAGES.unknown!, detail: e.message, cause: err };
}
