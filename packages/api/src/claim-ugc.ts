import type { UgcPolicy, UgcReason, UgcReportReceipt } from './ugc';
export type ClaimAudience = 'participants' | 'buyer_admin' | 'store_admin';
export interface ClaimUgcStatus {
  enabled: boolean;
  actor_role: 'buyer' | 'seller' | 'admin';
  blocked: boolean;
  own_block: boolean;
  policy: UgcPolicy;
}
export interface ClaimUgcReport extends UgcReportReceipt {
  claim_id: string;
  message_id: number | null;
  reason: UgcReason;
  detail: string | null;
  created_at: string;
  decision: 'dismiss' | 'hide_message' | null;
  resolution_note: string | null;
  resolved_at: string | null;
  hidden: boolean | null;
  audience: ClaimAudience | null;
  content_version: number | null;
}
type Invoke = <T>(name: string, args?: Record<string, unknown>) => Promise<T>;
/** No legacy fallback: absent capabilities and permission failures propagate without pretending success. */
export function createClaimUgcApi(call: Invoke) {
  return {
    status: (claimId: string) => call<ClaimUgcStatus>('claim_ugc_status', { p_claim_id: claimId }),
    setBlock: (claimId: string, blocked: boolean) => call<ClaimUgcStatus>('claim_ugc_set_block', { p_claim_id: claimId, p_blocked: blocked }),
    /** Retain requestId and the same payload across uncertain retries, scoped to the authenticated actor. */
    report: (claimId: string, messageId: number | null, reason: UgcReason, detail: string | null, requestId: string) =>
      call<UgcReportReceipt>('claim_ugc_report', { p_claim_id: claimId, p_message_id: messageId, p_reason: reason, p_detail: detail, p_request_id: requestId }),
    reports: (limit = 50, offset = 0) => call<{ items: ClaimUgcReport[]; total: number }>('claim_ugc_reports', { p_limit: limit, p_offset: offset }),
    resolveReport: (reportId: string, decision: 'dismiss' | 'hide_message', note: string) =>
      call<UgcReportReceipt>('claim_ugc_resolve_report', { p_report_id: reportId, p_decision: decision, p_note: note }),
    messageEvidence: (messageId: number) => call<{ id: number; claim_id: string; body: string; hidden: boolean; audience: ClaimAudience; content_version: number; fingerprint: string }>('claim_ugc_message_evidence', { p_message_id: messageId }),
    moderateMessage: (messageId: number, hidden: boolean, note: string) =>
      call<void>('claim_ugc_moderate_message', { p_message_id: messageId, p_hidden: hidden, p_note: note }),
    adminMessage: (claimId: string, body: string, audience: ClaimAudience) =>
      call<unknown>('post_claim_admin_message', { p_claim_id: claimId, p_body: body, p_audience: audience }),
  };
}
