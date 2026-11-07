// Shared with the horizontal rail, so spacing changes cannot silently alter its impression count.
export const RECENT_RAIL_GAP = 10;
export const RECENT_RAIL_INSET = 16;

/** Count initially visible cards at the same 60% threshold used by product rails. */
export function initialRecentVisibleCount(count: number, viewport: number, card: number): number {
  if (count <= 0 || viewport <= 0 || card <= 0) return 0;
  let visible = 0;
  for (let i = 0; i < count; i++) {
    const left = RECENT_RAIL_INSET + i * (card + RECENT_RAIL_GAP), right = left + card;
    const overlap = Math.max(0, Math.min(right, viewport) - left);
    if (overlap >= 0.6 * card) visible++;
  }
  return visible;
}
