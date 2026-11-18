/** Opt-in UGC contracts. These do not enable the backend or replace legacy review methods. */
export type UgcTarget = 'review' | 'reply' | 'review_author' | 'store_author';
export type UgcReason = 'harassment' | 'hate' | 'sexual' | 'child_safety' | 'personal_data' | 'fraud' | 'spam' | 'other';
export type UgcDecision = 'dismiss' | 'hide_review' | 'hide_reply';
export interface UgcPolicy {
  version: string;
  enabled: boolean;
  policy: { title: string; paragraphs: string[] };
}
/** id identifies this actor's private block record; it is never an author's account UUID. */
export interface UgcBlock { id: string; kind: 'user' | 'store'; label: string; created_at: string }
export interface UgcStatus extends UgcPolicy { accepted: boolean; blocks: UgcBlock[] }
export interface UgcReportReceipt { id: string; status: 'open' | 'resolved' }
export interface UgcReport extends UgcReportReceipt {
  review_id: string | null; target: UgcTarget; reason: UgcReason;
  detail: string | null; excerpt: string | null; decision: UgcDecision | null;
  resolution_note: string | null; created_at: string; resolved_at: string | null;
}
/** Private operational result. Only an administrator or a member of the selected store may read it. */
export interface UgcStaffReview {
  id: string; order_item_id: string; product_id: string; store_id: string; user_id: string;
  rating: number; body: string | null; status: 'published' | 'hidden'; hidden_reason: string | null;
  reply_body: string | null; reply_at: string | null; reply_status: 'published' | 'hidden';
  reply_hidden_reason: string | null; created_at: string;
  products?: { title: string; slug: string };
  stores?: { name: string };
  order_items?: { variant_title: string | null };
}
export interface UgcStaffPageInput {
  storeId?: string | null; status?: 'published' | 'hidden' | null; maxRating?: number | null;
  pending?: boolean; limit?: number; offset?: number; reviewId?: string | null;
}
type Invoke = <T>(name: string, args?: Record<string, unknown>) => Promise<T>;
const UGC_MESSAGES: Record<string, string> = {
  ugc_not_enabled: 'Los controles de opiniones aún no están disponibles. Intenta más tarde.',
  ugc_policy_required: 'Lee y acepta las normas de opiniones y respuestas vigentes antes de publicar.',
  ugc_review_changed: 'El contenido cambió desde la denuncia. Revisa su estado actual antes de retirarlo.',
};

export function createUgcApi(invoke: Invoke) {
  async function call<T>(name: string, args?: Record<string, unknown>): Promise<T> {
    try { return await invoke<T>(name, args); }
    catch (error) {
      // Preserve the existing ApiError instance and all network/auth/business failures.
      const e = error as Error & { code?: string; cause?: { hint?: string } };
      const hint = e?.cause?.hint;
      if (e instanceof Error && hint && UGC_MESSAGES[hint]) { e.code = hint; e.message = UGC_MESSAGES[hint]!; }
      throw error;
    }
  }
  return {
    policy: () => call<UgcPolicy>('ugc_policy'),
    status: () => call<UgcStatus>('ugc_status'),
    accept: (version: string) => call<{ version: string; accepted_at: string }>('ugc_accept_policy', { p_version: version }),
    /** Keep a UUID requestId (Crypto.randomUUID) once per intent. Reconcile uncertain results before changing its payload. */
    report: (reviewId: string, target: UgcTarget, reason: UgcReason, detail: string | null, requestId: string) =>
      call<UgcReportReceipt>('ugc_report', { p_review_id: reviewId, p_target: target, p_reason: reason, p_detail: detail, p_request_id: requestId }),
    block: (reviewId: string, target: 'review_author' | 'store_author') =>
      call<{ id: string; kind: 'user' | 'store'; blocked: true }>('ugc_block', { p_review_id: reviewId, p_target: target }),
    unblock: (blockId: string) => call<{ id: string; blocked: false }>('ugc_unblock', { p_block_id: blockId }),
    staffReviews: (storeId: string | null = null) => call<UgcStaffReview[]>('ugc_staff_reviews', { p_store_id: storeId }),
    staffPage: (input: UgcStaffPageInput = {}) => call<{ items: UgcStaffReview[]; total: number }>('ugc_staff_reviews_page', {
      p_store_id: input.storeId ?? null, p_status: input.status ?? null, p_max_rating: input.maxRating ?? null,
      p_pending: input.pending ?? false, p_limit: input.limit ?? 50, p_offset: input.offset ?? 0, p_review_id: input.reviewId ?? null,
    }),
    reports: (status: 'open' | 'resolved' = 'open') => call<UgcReport[]>('ugc_reports', { p_status: status }),
    resolveReport: (reportId: string, decision: UgcDecision, note: string) =>
      call<UgcReportReceipt>('ugc_resolve_report', { p_report_id: reportId, p_decision: decision, p_note: note }),
    moderateReply: (reviewId: string, hide: boolean, reason: string | null = null) =>
      call<{ id: string; hidden: boolean }>('ugc_moderate_reply', { p_review_id: reviewId, p_hide: hide, p_reason: reason }),
  };
}
