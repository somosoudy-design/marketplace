import type { ClaimAudience } from '@kora/api';
export type EvidenceVersion = { fingerprint: string; content_version: number; hidden: boolean };
export function sameClaimEvidence(previous: EvidenceVersion | undefined, current: EvidenceVersion) {
  return !!previous && previous.fingerprint === current.fingerprint && previous.content_version === current.content_version && previous.hidden === current.hidden;
}
export function claimRecipientsReady(admin: boolean, audience: '' | ClaimAudience) {
  return !admin || ['participants', 'buyer_admin', 'store_admin'].includes(audience);
}
export type ReportIntent = { id: string; reason: string; detail: string };
/** An uncertain request keeps its original UUID and payload; no retry adopts edited fields. */
export function retainedClaimReportIntent(previous: ReportIntent | null, next: ReportIntent) {
  return previous ?? Object.freeze({ ...next });
}
