import { describe, expect, it } from 'vitest';
import { inForce } from '../src/lib/pricing';
import type { PricingSnapshot } from '@kora/api';
const snapshot = (taken: number, expires: number) =>
  ({ taken_at: new Date(taken).toISOString(), valid_until: new Date(expires).toISOString() }) as PricingSnapshot;
describe('panel snapshot validity matches server effective dates', () => {
  it('rejects a future snapshot even if it has not expired', () => {
    const now = Date.now();
    expect(inForce(snapshot(now + 3600000, now + 7200000))).toBe(false);
  });
  it('accepts a currently effective snapshot', () => {
    const now = Date.now();
    expect(inForce(snapshot(now - 3600000, now + 3600000))).toBe(true);
  });
  it('rejects expired or missing snapshots', () => {
    const now = Date.now();
    expect(inForce(snapshot(now - 7200000, now - 3600000))).toBe(false);
    expect(inForce(null)).toBe(false);
  });
});
