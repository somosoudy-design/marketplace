-- =====================================================================
-- Version 20261009153318 = the one the Supabase connector recorded when applying it to the remote project.
-- Hardening from the Supabase security advisor on the first remote project.
--  * Guests (anon) can only execute the public catalog functions. Everything that needs an account
--    (buyer, seller, admin) is executable by signed-in users only; each function still authorizes
--    internally, this just removes the anonymous surface (defense in depth).
--  * Every function pins its search_path, not only the SECURITY DEFINER ones.
-- =====================================================================

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname = any (array[
         -- buyer
         'cart_add', 'cart_merge', 'cart_set_quantity', 'cart_summary', 'checkout_preview', 'place_order', 'cancel_order',
         'create_payment_quote', 'submit_payment', 'start_provider_payment', 'cancel_provider_payment', 'open_claim',
         'post_claim_message', 'escalate_claim', 'mark_notifications_read', 'register_push_token', 'request_account_deletion',
         'recently_viewed', 'clear_my_activity', 'submit_review',
         -- seller
         'seller_dashboard', 'seller_balance', 'advance_fulfillment', 'seller_fulfillments', 'seller_sales', 'reply_review',
         -- admin
         'admin_dashboard', 'assign_to_batch', 'update_cargo_batch', 'moderate_product', 'review_payment', 'refund_item',
         'record_refund_payout', 'create_payout', 'cancel_payout', 'mark_payout_paid', 'post_adjustment', 'resolve_claim',
         'set_manual_rate', 'ingest_rate', 'admin_users', 'set_user_role', 'add_store_member', 'process_account_deletion',
         'publish_import', 'moderate_review', 'recommendation_metrics', 'push_health'])
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end $$;

alter function public._group_label(public.fulfillment_flow, text, text) set search_path = public;
alter function public._outstanding(public.payment_obligations) set search_path = public;
alter function public._plan_schedule(numeric, public.installment_plans) set search_path = public;
alter function public.flow_for(public.product_origin, public.store_kind) set search_path = public;
alter function public.is_service_role() set search_path = public;
alter function public.ledger_group_balanced() set search_path = public;
alter function public.ledger_immutable() set search_path = public;
alter function public.products_search_vector() set search_path = public;
alter function public.require_user() set search_path = public;
alter function public.touch_updated_at() set search_path = public;
