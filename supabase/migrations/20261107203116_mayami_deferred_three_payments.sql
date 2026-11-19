-- Future eligibility only: three total payments for preorder/on-order carts.
-- Existing plan rows, financial schedules, permissions and historic data remain untouched.
-- Same existing public reader + checkout builder. No new public RPC, GRANT, role,
-- policy, interest, dates, plan row, product row or historic business row changes.
-- Current real public plan receipt: ../public/plans-active.json (MIM, 7nov2026).
-- Runner owns transaction. Existing wrappers keep their owner/ACL/security attributes.

-- Fail closed if a newer implementation replaced either reviewed function.
do $$ begin
  if (select md5(prosrc) from pg_proc where oid='public._build_checkout(uuid,uuid,jsonb,text)'::regprocedure)<>'2052c218ca383e8366fd8bf85b27a833' then raise exception 'checkout source differs from reviewed baseline'; end if;
  if (select md5(prosrc) from pg_proc where oid='public.product_detail_commercial(uuid)'::regprocedure)<>'62fee35a611d6593055bad973f016d6b' then raise exception 'checkout source differs from reviewed baseline'; end if;
end $$;

do $$
declare p public.installment_plans;
begin
  select * into p from public.installment_plans where code='three_parts';
  if not found or not p.active or p.down_payment_pct<>0 or p.installments<>3 or p.interval_days<>15
      or p.surcharge_pct<>0 or p.min_order_usd<>60
      or not (p.allowed_flows @> array['local_stock','import_order']::public.fulfillment_flow[])
      or not (p.allowed_flows <@ array['local_stock','import_order']::public.fulfillment_flow[]) then
    raise exception 'current three_parts config differs from reviewed real receipt';
  end if;
end $$;

create function checkout_private.installment_plan_eligible(
  p_plan public.installment_plans,p_items_usd numeric,p_flows public.fulfillment_flow[],p_all_target boolean
) returns boolean language sql immutable security invoker set search_path=public,pg_temp as $$
  select p_plan.active and (
    (p_items_usd>=p_plan.min_order_usd and (p_flows is null or p_flows<@p_plan.allowed_flows))
    or (p_plan.code='three_parts' and p_plan.down_payment_pct=0 and p_plan.installments=3
      and p_plan.surcharge_pct=0 and coalesce(p_all_target,false) and p_items_usd>=0.03)
  )
$$;
revoke all on function checkout_private.installment_plan_eligible(public.installment_plans,numeric,public.fulfillment_flow[],boolean)
  from public,anon,authenticated,service_role;

create or replace function public._build_checkout(
  p_user uuid, p_address_id uuid, p_shipping jsonb, p_plan_code text
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_addr public.addresses;
  v_groups jsonb := '[]'::jsonb;
  v_group record;
  v_options jsonb;
  v_selected jsonb;
  v_sel_id text;
  v_items numeric := 0;
  v_shipping numeric := 0;
  v_issues int := 0;
  v_needs_shipping boolean := false;
  v_seq int := 0;
  v_plan public.installment_plans;
  v_plans jsonb;
  v_total numeric;
  v_financing numeric := 0;
  v_schedule jsonb := '[]'::jsonb;
  v_flows public.fulfillment_flow[];
  v_count int := 0;
  v_preorder_only boolean := true;
begin
  if p_address_id is not null then
    select * into v_addr from public.addresses where id = p_address_id and user_id = p_user;
    if not found then raise exception 'address not found' using errcode = 'P0002', hint = 'address_not_found'; end if;
  else
    select * into v_addr from public.addresses where user_id = p_user and is_default;
  end if;

  for v_group in
    select l.group_key, l.store_id, min(l.store_name) as store_name, min(l.store_slug) as store_slug,
           min(l.store_kind::text) as store_kind, l.flow,
           sum(case when l.issue is null then l.unit_price_usd * l.quantity else 0 end) as subtotal,
           sum(case when l.issue is null then l.weight_kg * l.quantity else 0 end) as weight,
           max(l.ready_min) as ready_min, max(l.ready_max) as ready_max,
           count(*) filter (where l.issue is not null) as issues,
           count(*) filter (where l.issue is null) as ok_lines,
           bool_and(l.issue is null and l.availability in ('reservable','on_order')) as preorder_only,
           jsonb_agg(jsonb_build_object(
             'variant_id', l.variant_id, 'product_id', l.product_id, 'title', l.title, 'variant_title', l.variant_title,
             'image_path', l.image_path, 'availability', l.availability, 'unit_price_usd', l.unit_price_usd,
             'quantity', l.quantity, 'line_total_usd', l.unit_price_usd * l.quantity,
             'max_quantity', least(l.max_per_order, coalesce(l.stock, l.max_per_order)), 'issue', l.issue
           )) as lines
      from public._cart_lines(p_user) l
     group by l.group_key, l.store_id, l.flow
     order by case l.flow when 'local_stock' then 0 when 'import_order' then 1 else 2 end, min(l.store_name), l.group_key
  loop
    v_count := v_count + 1;
    v_preorder_only := v_preorder_only and coalesce(v_group.preorder_only,false);
    v_issues := v_issues + v_group.issues;
    v_items := v_items + v_group.subtotal;
    v_options := null; v_selected := null;
    if v_group.ok_lines > 0 then
      v_seq := v_seq + 1;
      v_flows := array_append(v_flows, v_group.flow);
      if v_addr.id is not null then
        select coalesce(jsonb_agg(jsonb_build_object(
                 'method_id', o.method_id, 'code', o.method_code, 'name', o.method_name, 'kind', o.kind,
                 'carrier', o.carrier_name, 'cost_usd', o.cost_usd,
                 'min_days', v_group.ready_min + o.min_days, 'max_days', v_group.ready_max + o.max_days,
                 'eta_min_date', current_date + (v_group.ready_min + o.min_days),
                 'eta_max_date', current_date + (v_group.ready_max + o.max_days),
                 'is_demo', o.is_demo) order by o.cost_usd), '[]'::jsonb)
          into v_options
          from public.shipping_options(v_group.store_id, v_group.flow, v_addr.region_code, v_group.weight, v_group.subtotal, v_addr.country_code) o;
        v_sel_id := nullif(p_shipping ->> v_group.group_key, ''); -- method id or method code
        if v_sel_id is not null then
          select e into v_selected from jsonb_array_elements(v_options) e where e ->> 'method_id' = v_sel_id or e ->> 'code' = v_sel_id;
          if v_selected is null then
            raise exception 'shipping method not available for this delivery' using errcode = 'P0001', hint = 'shipping_invalid';
          end if;
        else
          v_selected := v_options -> 0; -- cheapest by default
        end if;
        if v_selected is null then v_needs_shipping := true; else v_shipping := v_shipping + (v_selected ->> 'cost_usd')::numeric; end if;
      else
        v_needs_shipping := true;
      end if;
    end if;
    v_groups := v_groups || jsonb_build_object(
      'key', v_group.group_key, 'seq', case when v_group.ok_lines > 0 then v_seq end,
      'store', jsonb_build_object('id', v_group.store_id, 'name', v_group.store_name, 'slug', v_group.store_slug, 'kind', v_group.store_kind),
      'flow', v_group.flow, 'label', public._group_label(v_group.flow, v_group.group_key, v_group.store_name),
      'subtotal_usd', v_group.subtotal, 'weight_kg', v_group.weight,
      'ready_min_days', v_group.ready_min, 'ready_max_days', v_group.ready_max,
      'shipping_options', v_options, 'selected_shipping', v_selected, 'lines', v_group.lines);
  end loop;

  v_total := v_items + v_shipping;

  -- plans available for this cart
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', code, 'name', name, 'description', description, 'down_payment_pct', down_payment_pct,
           'installments', installments, 'interval_days', interval_days, 'surcharge_pct', surcharge_pct) order by sort), '[]'::jsonb)
    into v_plans
    from public.installment_plans ip
   where checkout_private.installment_plan_eligible(ip,v_items,v_flows,v_seq>0 and v_preorder_only);

  if p_plan_code is not null then
    select * into v_plan from public.installment_plans where code = p_plan_code and active;
    if not found or not exists (select 1 from jsonb_array_elements(v_plans) e where e ->> 'code' = p_plan_code) then
      raise exception 'plan not available for this cart' using errcode = 'P0001', hint = 'plan_invalid';
    end if;
    v_financing := round((v_total - round(v_total * v_plan.down_payment_pct / 100, 2)) * v_plan.surcharge_pct / 100, 2);
    v_total := v_total + v_financing;
    v_schedule := public._plan_schedule(v_total, v_plan);
  end if;

  return jsonb_build_object(
    'groups', v_groups,
    'address', case when v_addr.id is null then null else to_jsonb(v_addr) end,
    'items_usd', v_items, 'shipping_usd', v_shipping, 'financing_usd', v_financing, 'total_usd', v_total,
    'line_count', v_count, 'issues', v_issues, 'needs_address', v_addr.id is null,
    'needs_shipping', v_needs_shipping, 'plans', v_plans,
    'plan', case when v_plan.code is null then null else to_jsonb(v_plan) end,
    'schedule', v_schedule,
    'can_place', v_issues = 0 and v_seq > 0 and v_addr.id is not null and not v_needs_shipping and p_plan_code is not null
  );
end $$;

create or replace function public.product_detail_commercial(p_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare v_detail jsonb; v_meta jsonb; v_variants jsonb; v_images jsonb; v_links jsonb; v_installment_options jsonb;
begin
  v_detail := public.product_detail(p_id);
  if v_detail is null then return null; end if;
  v_meta := public.catalog_metadata(array[p_id]) -> 0;
  if v_meta is null then return null; end if;
  -- STABLE functions share the calling query's snapshot; no second client round trip.
  select coalesce(jsonb_agg(v.value || jsonb_build_object(
      'media_classified', (m.value->>'media_classified')::boolean, 'sku', m.value->'sku'
    ) order by v.ordinality), '[]'::jsonb) into v_variants
    from jsonb_array_elements(v_detail->'variants') with ordinality v(value, ordinality)
    join jsonb_array_elements(v_meta->'variants') m(value) on m.value->>'variant_id'=v.value->>'id';
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'path',i.path,'alt',i.alt,
      'width',i.width,'height',i.height) order by i.sort,i.id),'[]'::jsonb) into v_images
    from public.product_images i where i.product_id=p_id;
  select coalesce(jsonb_agg(jsonb_build_object('variant_id',m.variant_id,'image_id',m.image_id,'sort',m.sort)
      order by m.variant_id,m.sort),'[]'::jsonb) into v_links
    from public.product_variant_images m join public.product_variants v on v.id=m.variant_id and v.product_id=m.product_id
    where m.product_id=p_id and v.active and v.media_classified;
  -- This reader stays INVOKER and cannot call the revoked private checkout helper.
  -- RLS and the existing active-plan SELECT surface remain authoritative.
  -- The inline eligibility expression is parity-tested against that helper.
  with visible_variants as (
    select v.id as variant_id,v.price_usd,p.availability,
      least(p.max_per_order,coalesce(v.stock,p.max_per_order)) as max_quantity,
      case when s.kind='seller' then 'seller_shipping'::public.fulfillment_flow
        when p.origin='import' then 'import_order'::public.fulfillment_flow
        else 'local_stock'::public.fulfillment_flow end as flow
    from public.products p join public.stores s on s.id=p.store_id
      join public.product_variants v on v.product_id=p.id
    where p.id=p_id and p.moderation_status='published' and s.status='active' and v.active
      and p.availability not in ('sold_out','unavailable') and v.price_usd>0
  ), candidates as (
    select v.variant_id,v.price_usd,v.max_quantity,ip as plan,
      case when ip.code='three_parts' and ip.down_payment_pct=0 and ip.installments=3
          and ip.surcharge_pct=0 and v.availability in ('reservable','on_order')
        then greatest(1,ceil(0.03/v.price_usd))
        else greatest(1,ceil(ip.min_order_usd/v.price_usd)) end as min_quantity,
      v.flow=any(ip.allowed_flows)
        or (ip.code='three_parts' and ip.down_payment_pct=0 and ip.installments=3
          and ip.surcharge_pct=0 and v.availability in ('reservable','on_order')) as flow_allowed
    from visible_variants v cross join public.installment_plans ip
    where ip.active and v.max_quantity>0
  ), per_variant as (
    select c.variant_id,c.price_usd,c.max_quantity,
      jsonb_agg(to_jsonb(c.plan)||jsonb_build_object('min_quantity',c.min_quantity,
        'max_quantity',c.max_quantity) order by (c.plan).sort,(c.plan).code) as plans
    from candidates c where c.flow_allowed and c.min_quantity<=c.max_quantity
    group by c.variant_id,c.price_usd,c.max_quantity
  )
  select coalesce(jsonb_agg(jsonb_build_object('variant_id',variant_id,'unit_price_usd',price_usd,
    'max_quantity',max_quantity,'basis','products_only_excludes_shipping','plans',plans)
    order by variant_id),'[]'::jsonb) into v_installment_options from per_variant;

  return v_detail || jsonb_build_object('condition',v_meta->'condition','available_colors',v_meta->'colors',
    'variants',v_variants,'images',v_images,'variant_image_links',v_links,'general_images',v_meta->'general_images',
    'catalog_metadata',v_meta,'installment_options',v_installment_options);
end $$;

-- Intentionally no GRANT or SECURITY DEFINER change on the public product reader.
