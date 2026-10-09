import { afterAll, describe, expect, it } from 'vitest';
import { admin, asUser, createUser, pool } from '../../src/db';

// Every function reachable through /rest/v1/rpc must be listed here on purpose.
// Each one authorizes internally (require_user / require_admin / store membership) or is read-only public data.
const EXPOSED = {
  public: [
    'current_rate', 'home_feed', 'lead_time', 'product_detail', 'rate_status', 'recommended_products',
    'search_products', 'shipping_options', 'track_event', 'store_profile', 'product_reviews', 'track_recommendation',
    // used by RLS policies, so they must stay callable
    'has_role', 'is_admin', 'is_store_member', 'is_superadmin',
  ],
  buyer: [
    'cart_add', 'cart_merge', 'cart_set_quantity', 'cart_summary', 'checkout_preview', 'place_order', 'cancel_order',
    'create_payment_quote', 'submit_payment', 'start_provider_payment', 'cancel_provider_payment', 'open_claim', 'post_claim_message', 'escalate_claim',
    'mark_notifications_read', 'register_push_token', 'request_account_deletion', 'recently_viewed', 'clear_my_activity',
    'submit_review',
  ],
  seller: ['seller_dashboard', 'seller_balance', 'advance_fulfillment', 'seller_fulfillments', 'seller_sales', 'reply_review'],
  admin: [
    'admin_dashboard', 'assign_to_batch', 'update_cargo_batch', 'moderate_product', 'review_payment', 'refund_item',
    'record_refund_payout', 'create_payout', 'cancel_payout', 'mark_payout_paid', 'post_adjustment', 'resolve_claim',
    'set_manual_rate', 'ingest_rate', 'admin_users', 'set_user_role', 'add_store_member', 'process_account_deletion', 'publish_import',
    'moderate_review', 'recommendation_metrics',
  ],
};

afterAll(() => pool.end());

describe('function privileges', () => {
  it('only allowlisted functions are executable by API roles', async () => {
    const rows = await admin(`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prokind = 'f'
         and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
       order by 1`);
    const allowed = Object.values(EXPOSED).flat().sort();
    expect(rows.map((r: any) => r.proname)).toEqual(allowed);
  });

  it('internal helpers cannot be called directly', async () => {
    const u = await createUser('priv');
    for (const call of [
      `select public.audit('forged', 'orders', 'x', '{}')`,
      `select public.setting('commission.default_pct')`,
      `select public.refresh_popularity()`,
      `select public.notify('${u.id}', 'system', 't', 'b')`,
      `select public.check_rate_limit('x', 1, 60)`,
    ]) {
      await expect(asUser(u.id, (sql) => sql(call))).rejects.toMatchObject({ code: '42501' });
    }
  });

  it('privileged functions refuse buyers even though they are exposed', async () => {
    const u = await createUser('priv2');
    for (const fn of EXPOSED.admin) {
      const [{ args }] = await admin(
        `select pg_get_function_identity_arguments(p.oid) as args from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = $1`, [fn]);
      const nulls = args ? args.split(',').map(() => 'null').join(', ') : '';
      await expect(asUser(u.id, (sql) => sql(`select public.${fn}(${nulls})`)), fn).rejects.toMatchObject({ code: '42501' });
    }
  });
});
