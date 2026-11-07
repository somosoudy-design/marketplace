export type Availability = 'available' | 'on_order' | 'in_transit' | 'reservable' | 'sold_out' | 'unavailable';

export interface AvailabilityPresentation {
  label: string;
  /** primary CTA text */
  action: 'Comprar' | 'Encargar' | 'Reservar' | 'Avisarme';
  intent: 'buy' | 'order' | 'reserve' | 'notify';
  tone: 'success' | 'editorial' | 'info' | 'warning' | 'muted';
  purchasable: boolean;
}

export const AVAILABILITY: Record<Availability, AvailabilityPresentation> = {
  available: { label: 'Disponible', action: 'Comprar', intent: 'buy', tone: 'success', purchasable: true },
  on_order: { label: 'Por encargo', action: 'Encargar', intent: 'order', tone: 'editorial', purchasable: true },
  in_transit: { label: 'En camino', action: 'Reservar', intent: 'reserve', tone: 'info', purchasable: true },
  reservable: { label: 'Reservable', action: 'Reservar', intent: 'reserve', tone: 'warning', purchasable: true },
  sold_out: { label: 'Agotado', action: 'Avisarme', intent: 'notify', tone: 'muted', purchasable: false },
  unavailable: { label: 'No disponible', action: 'Avisarme', intent: 'notify', tone: 'muted', purchasable: false },
};

export const presentAvailability = (a: Availability | null | undefined) => AVAILABILITY[a ?? 'unavailable'];

/** Low stock signal shown only when it helps a decision. */
export function stockHint(stock: number | null | undefined, availability: Availability): string | null {
  if (availability !== 'available' || stock === null || stock === undefined) return null;
  if (stock <= 0) return null;
  if (stock <= 3) return stock === 1 ? 'Queda 1' : `Quedan ${stock}`;
  return null;
}
