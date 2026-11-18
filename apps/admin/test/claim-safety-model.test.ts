import { describe, expect, it } from 'vitest';
import { sameClaimEvidence, claimRecipientsReady, retainedClaimReportIntent } from '../src/lib/claim-safety-model';
describe('claim moderation version fence', () => {
  const baseline = { fingerprint: 'original', content_version: 1, hidden: false };
  it('requires an inspected version before deciding', () => expect(sameClaimEvidence(undefined, baseline)).toBe(false));
  it('accepts only the same content, version and visibility', () => {
    expect(sameClaimEvidence(baseline, { ...baseline })).toBe(true);
    expect(sameClaimEvidence(baseline, { ...baseline, fingerprint: 'different' })).toBe(false);
    expect(sameClaimEvidence(baseline, { ...baseline, content_version: 2 })).toBe(false);
    expect(sameClaimEvidence(baseline, { ...baseline, hidden: true })).toBe(false);
  });
});
describe('claim outgoing intent', () => {
  it('does not silently choose an administrative audience', () => {
    expect(claimRecipientsReady(true, '')).toBe(false);
    for (const audience of ['participants', 'buyer_admin', 'store_admin'] as const) expect(claimRecipientsReady(true, audience)).toBe(true);
    expect(claimRecipientsReady(false, '')).toBe(true);
  });
  it('retries the same report identity and payload despite later edits', () => {
    const first = retainedClaimReportIntent(null, { id: 'first', reason: 'harassment', detail: 'original' });
    const retried = retainedClaimReportIntent(first, { id: 'second', reason: 'other', detail: 'changed' });
    expect(retried).toBe(first); expect(retried.detail).toBe('original'); expect(Object.isFrozen(first)).toBe(true);
  });
});
