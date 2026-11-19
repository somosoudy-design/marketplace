export type ClosureState = 'completed' | 'processing' | 'busy' | 'failed' | 'retention_pending';
export type ClosureResult = { requestId: string; state: ClosureState };

/** A transport success or a legacy status alone is never proof of completed cleanup. */
export function closureResult(value: unknown, requestId: string): ClosureResult {
  const result = value as Partial<ClosureResult> | null;
  if (!result || result.requestId !== requestId ||
    !['completed', 'processing', 'busy', 'failed', 'retention_pending'].includes(result.state ?? ''))
    throw new Error('No se pudo verificar el resultado del cierre. Actualiza la solicitud antes de reintentar.');
  return { requestId, state: result.state as ClosureState };
}

export function closureLabel(status: string, cleanup?: string | null): string {
  if (status === 'completed') return cleanup === 'completed' ? 'Cierre verificado' : 'Cierre anterior sin verificar';
  if (cleanup === 'retention_pending') return 'Retención por revisar';
  if (cleanup === 'failed') return 'Limpieza interrumpida';
  if (cleanup === 'processing') return 'En proceso';
  return ({ requested: 'Pendiente', in_review: 'En revisión', rejected: 'Rechazada' } as Record<string, string>)[status] ?? 'Estado por revisar';
}

export function closureMessage(state: ClosureState): string {
  return {
    completed: 'Cierre verificado: credenciales, datos de uso y archivos comprobados.',
    processing: 'El cierre sigue en proceso. Aún no está completado.',
    busy: 'Ya hay una limpieza en curso. Actualiza la solicitud antes de reintentar.',
    failed: 'La limpieza se interrumpió. La solicitud sigue abierta y puede reintentarse.',
    retention_pending: 'El cierre sigue pendiente: hay datos cuya retención requiere revisión.',
  }[state];
}
