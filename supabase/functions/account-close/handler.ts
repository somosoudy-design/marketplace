import { defaultDeps, type Deps } from '../_shared/env.ts';
import { bearer, cors, json, readJson } from '../_shared/http.ts';
import { rest } from '../_shared/rest.ts';

interface Job { state: string; user_id?: string; lease_token?: string; blockers?: Record<string, number> }
interface Target { bucket_id: string; name: string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class CleanupFailure extends Error { constructor(readonly code: string) { super(code); } }

/** Only an authenticated operator can approve. Server credentials never enter the browser. */
export function createHandler(deps: Deps = defaultDeps()) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    const token = bearer(req);
    if (!token) return json({ error: 'auth_required' }, 401);
    const origin = deps.env('SUPABASE_URL');
    const service = deps.env('SUPABASE_SERVICE_ROLE_KEY');
    if (!origin || !service) return json({ error: 'closure_unavailable' }, 503);
    const db = rest(deps.env);
    if (await db.rpc<boolean>('is_admin', {}, { as: token }).catch(() => false) !== true)
      return json({ error: 'admin_required' }, 403);
    const body = await readJson<{ requestId?: unknown; notes?: unknown }>(req);
    const id = typeof body?.requestId === 'string' ? body.requestId : '';
    if (!uuid.test(id)) return json({ error: 'invalid_request' }, 400);
    // Repeated approval is idempotent. Staff/open-operation checks remain in the database.
    try {
      await db.rpc('process_account_deletion', {
        p_request_id: id, p_approve: true,
        p_notes: typeof body?.notes === 'string' ? body.notes.trim().slice(0, 500) || null : null,
      }, { as: token });
    } catch {
      // Do not disclose a provider/database message containing personal information.
      return json({ error: 'closure_not_approved', message: 'No se aprobó el cierre. Revisa las operaciones y los permisos de la cuenta.' }, 409);
    }
    let job: Job;
    try { job = await db.rpc<Job>('account_close_claim', { p_request_id: id }); }
    catch { return json({ state: 'failed', requestId: id, code: 'claim_unavailable', retryable: true }, 202); }
    if (job.state === 'completed') return json({ state: 'completed', requestId: id });
    if (job.state !== 'processing' || !job.user_id || !job.lease_token)
      return json({ state: job.state, requestId: id, retryable: true, blockers: job.blockers ?? [] }, 202);
    const user = job.user_id, lease = job.lease_token;
    if (!uuid.test(user) || !uuid.test(lease)) return json({ state: 'failed', code: 'invalid_claim' }, 502);
    const args = { p_request_id: id, p_lease_token: lease };
    const headers: Record<string, string> = { apikey: service, 'content-type': 'application/json' };
    if (service.split('.').length === 3) headers.authorization = `Bearer ${service}`;
    const call = (path: string, init: RequestInit = {}) => deps.fetch(origin + path, {
      ...init, headers: { ...headers, ...init.headers }, redirect: 'error', signal: AbortSignal.timeout(15_000),
    });
    const missing = async (response: Response) => {
      if (response.status === 404) return true;
      if (response.status !== 400) return false;
      const value = await response.json().catch(() => null) as { statusCode?: unknown; error?: unknown; code?: unknown } | null;
      return value?.statusCode === '404' || value?.statusCode === 404 ||
        value?.error === 'not_found' || value?.code === 'NoSuchKey';
    };
    try {
      // Auth owns identity, credential and factor deletion. Soft deletion preserves FK references via a tombstone UID.
      if (!await db.rpc<boolean>('account_close_auth_ready', args)) {
        const deleted = await call('/auth/v1/admin/users/' + user, {
          method: 'DELETE', body: JSON.stringify({ should_soft_delete: true }),
        });
        if (!deleted.ok) throw new CleanupFailure('auth_delete_failed');
        await deleted.arrayBuffer();
      }
      if (!await db.rpc<boolean>('account_close_auth_ready', args)) throw new CleanupFailure('auth_verification_failed');
      // Bounded batches resume from the remaining objects after a failure; never delete bucket metadata in SQL.
      for (let batch = 0; batch < 10; batch++) {
        const targets = await db.rpc<Target[]>('account_close_targets', args);
        if (!targets.length) break;
        if (targets.length > 100) throw new CleanupFailure('invalid_targets');
        for (const target of targets) {
          // This module only classifies personal avatars. Other documents await explicit retention classification.
          if (target.bucket_id !== 'avatars' || !target.name.startsWith(user + '/') || target.name.includes('..') || /[\\\u0000-\u001f]/.test(target.name))
            throw new CleanupFailure('unclassified_target');
        }
        const removed = await call('/storage/v1/object/avatars', {
          method: 'DELETE', body: JSON.stringify({ prefixes: targets.map(target => target.name) }),
        });
        if (!removed.ok) throw new CleanupFailure('storage_delete_failed');
        await removed.arrayBuffer();
        for (const target of targets) {
          const path = target.name.split('/').map(encodeURIComponent).join('/');
          const check = await call('/storage/v1/object/authenticated/avatars/' + path);
          if (!await missing(check)) { await check.body?.cancel(); throw new CleanupFailure('storage_verification_failed'); }
        }
      }
      if ((await db.rpc<Target[]>('account_close_targets', args)).length) throw new CleanupFailure('cleanup_batch_limit');
      await db.rpc('account_close_clean_data', args);
      // The database verifies Auth's resulting state and every supported cleanup domain before completed.
      const finished = await db.rpc<{ state: string }>('account_close_finish', args);
      if (finished.state !== 'completed') throw new CleanupFailure('completion_not_verified');
      return json({ state: 'completed', requestId: id });
    } catch (error) {
      const retention = ['retention_pending', 'auth_audit_retention_pending'].includes((error as { hint?: string }).hint ?? '');
      const code = retention ? 'retention_pending' : error instanceof CleanupFailure ? error.code : 'cleanup_interrupted';
      // No original error, object path, email, password or provider response is persisted in the receipt.
      await db.rpc('account_close_fail', { ...args, p_code: code }).catch(() => undefined);
      return json({ state: retention ? 'retention_pending' : 'failed', requestId: id, code, retryable: true, ...(retention ? { blockers: ['retention_review_required'] } : {}) }, 202);
    }
  };
}
