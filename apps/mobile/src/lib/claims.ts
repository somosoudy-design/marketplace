import type { Tone } from '@/components/ui/Badge';
import { brand } from './brand';

/** How a claim's state reads to the buyer (the panel keeps the operational labels from core). */
export const CLAIM_STATUS: Record<string, { label: string; tone: Tone }> = {
  open: { label: 'Esperando a la tienda', tone: 'warning' },
  seller_responded: { label: 'La tienda respondió', tone: 'info' },
  escalated: { label: `En revisión por ${brand.name}`, tone: 'brand' },
  resolved: { label: 'Resuelto', tone: 'success' },
  rejected: { label: 'Cerrado sin cambios', tone: 'muted' },
};
export const ACTIVE_CLAIM = ['open', 'seller_responded', 'escalated'];
