import { presentAvailability, type Availability } from '@kora/core';
import { Badge } from './Badge';

export function AvailabilityBadge({ value, hideWhenAvailable }: { value: Availability; hideWhenAvailable?: boolean }) {
  if (hideWhenAvailable && value === 'available') return null;
  const p = presentAvailability(value);
  return <Badge label={p.label} tone={p.tone} />;
}
