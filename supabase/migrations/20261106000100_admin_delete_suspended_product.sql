-- Individually confirmed catalog cleanup; no direct DELETE grants.
-- Delete an individually confirmed suspended product only when it has no commercial history.
-- Existing order FKs, RLS, direct DELETE privileges, prices and Storage objects stay unchanged.
create or replace function public.admin_delete_suspended_product(
  p_product_id uuid,
  p_expected_updated_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = public set lock_timeout = '500ms' as $$
declare
  v_actor uuid;
  v_product public.products%rowtype;
  v_variant_ids uuid[];
  v_variants jsonb;
  v_images jsonb;
  v_moderation jsonb;
begin
  -- A human admin session is required; require_admin alone also admits service_role.
  v_actor := public.require_user();
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501', hint = 'admin_required';
  end if;
  perform public.require_admin();

  if p_product_id is null then
    raise exception 'product id required' using errcode = '22023', hint = 'product_id_required';
  end if;
  if p_expected_updated_at is null then
    raise exception 'expected updated_at required' using errcode = '22023', hint = 'updated_at_required';
  end if;

  select * into v_product from public.products
    where id = p_product_id for update nowait;
  if not found then
    raise exception 'product not found' using errcode = 'P0002', hint = 'product_not_found';
  end if;
  if v_product.moderation_status <> 'suspended' then
    raise exception 'only suspended products can be deleted'
      using errcode = '22023', hint = 'product_not_suspended';
  end if;
  if v_product.updated_at is distinct from p_expected_updated_at then
    raise exception 'product changed; refresh before deleting'
      using errcode = '40001', hint = 'product_changed';
  end if;

  -- Checkout/stock updates lock variants first. NOWAIT prevents an inverse lock-order wait.
  -- Product lock also prevents new FK children from being committed during this operation.
  perform 1 from public.product_variants
    where product_id = p_product_id order by id for update nowait;
  select coalesce(array_agg(id order by id), array[]::uuid[]) into v_variant_ids
    from public.product_variants where product_id = p_product_id;

  -- Image edits can update existing rows without changing the parent product.
  perform 1 from public.product_images where product_id=p_product_id order by id for update nowait;

  -- Cost editing locks costs before repricing variants. Never wait with the reverse order.
  perform 1 from public.product_costs where product_id=p_product_id for update nowait;
  perform 1 from public.variant_costs where variant_id=any(v_variant_ids) order by variant_id for update nowait;

  if exists (select 1 from public.order_items
      where product_id = p_product_id or variant_id = any(v_variant_ids)) then
    raise exception 'product has order history and must remain suspended'
      using errcode = '23503', hint = 'product_has_orders';
  end if;
  if exists (select 1 from public.cart_items where variant_id = any(v_variant_ids)) then
    raise exception 'product is in a cart and must remain suspended'
      using errcode = '23503', hint = 'product_in_carts';
  end if;
  if exists (select 1 from public.reviews where product_id = p_product_id) then
    raise exception 'product has reviews and must remain suspended'
      using errcode = '23503', hint = 'product_has_reviews';
  end if;

  select coalesce(jsonb_agg(to_jsonb(v) order by v.id), '[]'::jsonb) into v_variants
    from public.product_variants v where v.product_id = p_product_id;
  select coalesce(jsonb_agg(to_jsonb(i) order by i.sort, i.id), '[]'::jsonb) into v_images
    from public.product_images i where i.product_id = p_product_id;
  select coalesce(jsonb_agg(to_jsonb(m) order by m.id), '[]'::jsonb) into v_moderation
    from public.moderation_events m where m.product_id = p_product_id;

  -- Existing products_audit does not audit DELETE; keep identity, provenance and moderation
  -- in the append-only audit log. Any DELETE failure rolls back this audit entry too.
  perform public.audit('delete_suspended', 'product', p_product_id::text,
    jsonb_build_object(
      'product', to_jsonb(v_product),
      'variants', v_variants,
      'images', v_images,
      'moderation_events', v_moderation,
      'product_costs', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from public.product_costs c where c.product_id=p_product_id),
      'variant_costs', (select coalesce(jsonb_agg(to_jsonb(c) order by c.variant_id), '[]'::jsonb) from public.variant_costs c where c.variant_id=any(v_variant_ids)),
      'storage_objects_deleted', false
    ));

  delete from public.products where id = p_product_id;
  if not found then
    raise exception 'product not found' using errcode = 'P0002', hint = 'product_not_found';
  end if;
  return jsonb_build_object('product_id', p_product_id, 'deleted', true);
exception
  when lock_not_available then
    raise exception 'product is busy; retry after the current operation'
      using errcode = '55P03', hint = 'product_busy';
end;
$$;

revoke all on function public.admin_delete_suspended_product(uuid, timestamptz)
  from public, anon, service_role;
grant execute on function public.admin_delete_suspended_product(uuid, timestamptz) to authenticated;
comment on function public.admin_delete_suspended_product(uuid, timestamptz) is
  'Authenticated admin only. Deletes a suspended product without orders, carts or reviews; preserves an audit snapshot and Storage files. No direct table DELETE grant.';
