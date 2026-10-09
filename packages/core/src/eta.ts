const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

function addDays(d: Date, n: number) {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}

export function formatShortDate(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d.length === 10 ? `${d}T12:00:00` : d) : d;
  return `${x.getDate()} ${MONTHS[x.getMonth()]}`;
}

/** "Llega entre el 12 y el 15 oct (estimado)" — estimates are always labelled as such. */
export function describeEtaDates(min: string | Date, max: string | Date): string {
  const a = formatShortDate(min);
  const b = formatShortDate(max);
  if (a === b) return `Llega el ${a} (estimado)`;
  const [da, ma] = a.split(' ');
  const [db, mb] = b.split(' ');
  return ma === mb ? `Llega entre el ${da} y el ${db} ${mb} (estimado)` : `Llega entre el ${a} y el ${b} (estimado)`;
}

/** For product pages (ready time before shipping, from lead_time rules). */
export function describeLeadTime(minDays: number | null | undefined, maxDays: number | null | undefined, availability: string): string | null {
  if (minDays === null || minDays === undefined || maxDays === null || maxDays === undefined) return null;
  if (availability === 'available') return maxDays <= 1 ? 'Listo para despacho en 24 h' : `Listo para despacho en ${minDays}–${maxDays} días`;
  const range = minDays === maxDays ? `${minDays} días` : `${minDays} a ${maxDays} días`;
  if (availability === 'on_order') return `Llega a Venezuela en ${range} aprox.`;
  if (availability === 'in_transit') return `En camino: disponible en ${range} aprox.`;
  if (availability === 'reservable') return `Próximo lote en ${range} aprox.`;
  return null;
}

export function etaFromToday(minDays: number, maxDays: number, today = new Date()): string {
  return describeEtaDates(addDays(today, minDays), addDays(today, maxDays));
}
