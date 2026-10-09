-- =====================================================================
-- Cart summary, checkout preview and order placement.
-- All prices, shipping, plans and totals are computed here, never on the client.
-- =====================================================================

-- Lines of a user's cart with everything needed to price and group them.
create or replace function public._cart_lines(p_user uuid)
returns table (
  variant_id uuid, product_id uuid, store_id uuid, store_name text, store_slug text, store_kind public.store_kind,
  store_status public.store_status, category_id uuid, title text, variant_title text, image_path text,
  availability public.availability, origin public.product_origin, moderation public.moderation_status,
  variant_active boolean, unit_price_usd numeric, quantity int, stock int, max_per_order int, weight_kg numeric,
  flow public.fulfillment_flow, group_key text, ready_min int, ready_max int, issue text
) language sql stable security definer set search_path = public as $$
  select v.id, p.id, s.id, s.name, s.slug, s.kind, s.status, p.category_id, p.title, v.title,
         (select path from public.product_images i where i.product_id = p.id order by sort limit 1),
         p.availability, p.origin, p.moderation_status, v.active, v.price_usd, c.quantity, v.stock, p.max_per_order, p.weight_kg,
         public.flow_for(p.origin, s.kind),
         s.id::text || ':' || public.flow_for(p.origin, s.kind)::text || ':' ||
           case when p.availability in ('in_transit', 'reservable') then 'incoming' else 'ready' end,
         coalesce(lt.min_days, 0), coalesce(lt.max_days, 0),
         case
           when p.moderation_status <> 'published' or s.status <> 'active' or not v.active then 'unavailable'
           when p.availability in ('sold_out', 'unavailable') then 'sold_out'
           when v.stock is not null and v.stock = 0 then 'sold_out'
           when v.stock is not null and v.stock < c.quantity then 'insufficient_stock'
           when c.quantity > p.max_per_order then 'over_limit'
           else null
         end
    from public.cart_items c
    join public.product_variants v on v.id = c.variant_id
    join public.products p on p.id = v.product_id
    join public.stores s on s.id = p.store_id
    left join lateral public.lead_time(p.id) lt on true
   where c.user_id = p_user
   order by c.added_at;
$$;
revoke execute on function public._cart_lines(uuid) from public, anon, authenticated;

create or replace function public._group_label(p_flow public.fulfillment_flow, p_key text, p_store_name text) returns text
language sql immutable as $$
  select case
    when p_flow = 'seller_shipping' then 'Enviado por ' || p_store_name
    when p_flow = 'import_order' then 'Por encargo'
    when p_key like '%:incoming' then 'En camino a Venezuela'
    else 'Disponible para envío'
  end;
$$;

-- Builds the full checkout picture. Used by cart_summary / checkout_preview (read-only) and place_order.
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
    from public.installment_plans
   where active and v_items >= min_order_usd and (v_flows is null or v_flows <@ allowed_flows);

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
revoke execute on function public._build_checkout(uuid, uuid, jsonb, text) from public, anon, authenticated;

-- Splits a total into obligations. Exact to the cent: rounding remainder goes to the last installment.
create or replace function public._plan_schedule(p_total numeric, p_plan public.installment_plans) returns jsonb
language plpgsql immutable as $$
declare
  v_down numeric := round(p_total * p_plan.down_payment_pct / 100, 2);
  v_rest numeric;
  v_each numeric;
  v_out jsonb := '[]'::jsonb;
  i int;
begin
  if p_plan.down_payment_pct >= 100 then
    return jsonb_build_array(jsonb_build_object('seq', 1, 'kind', 'full', 'amount_usd', p_total, 'due_in_days', 0));
  end if;
  v_rest := p_total - v_down;
  if v_down > 0 then
    v_out := v_out || jsonb_build_object('seq', 1, 'kind', 'down_payment', 'amount_usd', v_down, 'due_in_days', 0);
  end if;
  v_each := trunc(v_rest / p_plan.installments, 2);
  for i in 1 .. p_plan.installments loop
    v_out := v_out || jsonb_build_object(
      'seq', jsonb_array_length(v_out) + 1, 'kind', 'installment',
      'amount_usd', case when i = p_plan.installments then v_rest - v_each * (p_plan.installments - 1) else v_each end,
      'due_in_days', case when v_down > 0 then p_plan.interval_days * i else p_plan.interval_days * (i - 1) end);
  end loop;
  return v_out;
end $$;

create or replace function public.cart_summary(p_address_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  return public._build_checkout(public.require_user(), p_address_id, '{}'::jsonb, null);
end $$;

create or replace function public.checkout_preview(p_address_id uuid, p_shipping jsonb default '{}'::jsonb, p_plan_code text default 'full')
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  return public._build_checkout(public.require_user(), p_address_id, coalesce(p_shipping, '{}'::jsonb), p_plan_code);
end $$;

-- Cart mutations with server-side limits (client also updates optimistically).
create or replace function public.cart_set_quantity(p_variant_id uuid, p_quantity int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_user uuid := public.require_user(); v_max int; v_stock int; v_avail public.availability;
begin
  perform public.check_rate_limit('cart', 120, 60);
  if p_quantity <= 0 then
    delete from public.cart_items where user_id = v_user and variant_id = p_variant_id;
    return jsonb_build_object('variant_id', p_variant_id, 'quantity', 0);
  end if;
  select p.max_per_order, v.stock, p.availability into v_max, v_stock, v_avail
    from public.product_variants v join public.products p on p.id = v.product_id
   where v.id = p_variant_id and v.active and p.moderation_status = 'published';
  if not found then raise exception 'product unavailable' using errcode = 'P0002', hint = 'unavailable'; end if;
  if v_avail in ('sold_out', 'unavailable') then raise exception 'sold out' using errcode = 'P0001', hint = 'sold_out'; end if;
  p_quantity := least(p_quantity, v_max, coalesce(v_stock, v_max));
  if p_quantity <= 0 then raise exception 'sold out' using errcode = 'P0001', hint = 'sold_out'; end if;
  insert into public.cart_items (user_id, variant_id, quantity) values (v_user, p_variant_id, p_quantity)
  on conflict (user_id, variant_id) do update set quantity = excluded.quantity;
  return jsonb_build_object('variant_id', p_variant_id, 'quantity', p_quantity);
end $$;

create or replace function public.cart_add(p_variant_id uuid, p_quantity int default 1) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_current int;
begin
  select quantity into v_current from public.cart_items where user_id = public.require_user() and variant_id = p_variant_id;
  return public.cart_set_quantity(p_variant_id, coalesce(v_current, 0) + greatest(p_quantity, 1));
end $$;

-- Merge a guest (device-local) cart after sign in: [{variant_id, quantity}]
create or replace function public.cart_merge(p_lines jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v_line jsonb; v_n int := 0;
begin
  perform public.require_user();
  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) limit 50 loop
    begin
      perform public.cart_add((v_line ->> 'variant_id')::uuid, greatest(1, least(100, (v_line ->> 'quantity')::int)));
      v_n := v_n + 1;
    exception when others then null; -- skip lines that are no longer purchasable
    end;
  end loop;
  return v_n;
end $$;

-- ---------- place order ----------
create or replace function public.place_order(
  p_address_id uuid, p_shipping jsonb, p_plan_code text, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := public.require_user();
  v_existing public.orders;
  v_preview jsonb;
  v_line record;
  v_order_id uuid;
  v_number text;
  v_group jsonb;
  v_f_id uuid;
  v_first_step text;
  v_schedule jsonb;
  v_ob jsonb;
  v_ship_to jsonb;
  v_addr public.addresses;
  v_pct numeric;
  v_store record;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception 'idempotency key required' using errcode = '22023', hint = 'idempotency_required';
  end if;

  -- serialize checkouts per buyer (double tap, two devices)
  perform pg_advisory_xact_lock(hashtextextended('checkout:' || v_user::text, 0));

  select * into v_existing from public.orders where buyer_id = v_user and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('order_id', v_existing.id, 'number', v_existing.number, 'replayed', true);
  end if;

  perform public.check_rate_limit('place_order', 10, 600);

  -- lock every variant in the cart in a stable order to avoid deadlocks, then re-read under lock
  perform 1 from public.product_variants v
    where v.id in (select variant_id from public.cart_items where user_id = v_user)
    order by v.id for update;

  v_preview := public._build_checkout(v_user, p_address_id, coalesce(p_shipping, '{}'::jsonb), coalesce(p_plan_code, 'full'));

  if (v_preview ->> 'line_count')::int = 0 then
    raise exception 'cart is empty' using errcode = 'P0001', hint = 'cart_empty';
  end if;
  if (v_preview ->> 'issues')::int > 0 then
    raise exception 'some items are no longer available' using errcode = 'P0001', hint = 'cart_has_issues',
      detail = (select string_agg(l ->> 'variant_id' || ':' || (l ->> 'issue'), ',')
                  from jsonb_array_elements(v_preview -> 'groups') g, jsonb_array_elements(g -> 'lines') l
                 where l ->> 'issue' is not null);
  end if;
  if (v_preview ->> 'needs_address')::boolean then
    raise exception 'address required' using errcode = 'P0001', hint = 'address_required';
  end if;
  if (v_preview ->> 'needs_shipping')::boolean then
    raise exception 'no shipping available for this address' using errcode = 'P0001', hint = 'shipping_unavailable';
  end if;

  select * into v_addr from public.addresses where id = (v_preview -> 'address' ->> 'id')::uuid;
  v_ship_to := jsonb_build_object(
    'recipient', v_addr.recipient, 'phone', v_addr.phone, 'country_code', v_addr.country_code, 'region_code', v_addr.region_code,
    'region_name', (select name from public.regions where country_code = v_addr.country_code and code = v_addr.region_code),
    'city', v_addr.city, 'municipality', v_addr.municipality, 'line1', v_addr.line1, 'reference', v_addr.reference,
    'id_document', v_addr.id_document);

  v_number := coalesce(public.setting('orders.number_prefix') #>> '{}', 'P') || '-' || nextval('public.order_number_seq');
  insert into public.orders (number, buyer_id, items_usd, shipping_usd, financing_usd, total_usd, plan_code, ship_to, idempotency_key)
  values (v_number, v_user, (v_preview ->> 'items_usd')::numeric, (v_preview ->> 'shipping_usd')::numeric,
          (v_preview ->> 'financing_usd')::numeric, (v_preview ->> 'total_usd')::numeric,
          coalesce(p_plan_code, 'full'), v_ship_to, p_idempotency_key)
  returning id into v_order_id;

  for v_group in select * from jsonb_array_elements(v_preview -> 'groups') loop
    select code into v_first_step from public.fulfillment_steps where flow = (v_group ->> 'flow')::public.fulfillment_flow order by seq limit 1;
    insert into public.fulfillments (order_id, seq, store_id, flow, group_key, status, shipping_method_id, shipping_method_name, shipping_kind,
                                     shipping_usd, ready_min_days, ready_max_days, eta_min_date, eta_max_date, ship_to, carrier_name)
    values (v_order_id, (v_group ->> 'seq')::int, (v_group -> 'store' ->> 'id')::uuid, (v_group ->> 'flow')::public.fulfillment_flow,
            v_group ->> 'key', v_first_step, (v_group -> 'selected_shipping' ->> 'method_id')::uuid,
            v_group -> 'selected_shipping' ->> 'name', (v_group -> 'selected_shipping' ->> 'kind')::public.shipping_kind,
            (v_group -> 'selected_shipping' ->> 'cost_usd')::numeric,
            (v_group ->> 'ready_min_days')::int, (v_group ->> 'ready_max_days')::int,
            (v_group -> 'selected_shipping' ->> 'eta_min_date')::date, (v_group -> 'selected_shipping' ->> 'eta_max_date')::date,
            v_ship_to, v_group -> 'selected_shipping' ->> 'carrier')
    returning id into v_f_id;
    insert into public.fulfillment_events (fulfillment_id, step_code, note, source) values (v_f_id, v_first_step, null, 'system');

    for v_line in
      select (l ->> 'variant_id')::uuid as variant_id, (l ->> 'product_id')::uuid as product_id, l ->> 'title' as title,
             l ->> 'variant_title' as variant_title, l ->> 'image_path' as image_path, (l ->> 'availability')::public.availability as availability,
             (l ->> 'unit_price_usd')::numeric as price, (l ->> 'quantity')::int as qty
        from jsonb_array_elements(v_group -> 'lines') l
    loop
      v_pct := public.commission_pct((v_group -> 'store' ->> 'id')::uuid, (select category_id from public.products where id = v_line.product_id));
      insert into public.order_items (order_id, fulfillment_id, store_id, product_id, variant_id, title, variant_title, image_path,
                                      availability, unit_price_usd, quantity, line_total_usd, commission_pct, commission_usd)
      values (v_order_id, v_f_id, (v_group -> 'store' ->> 'id')::uuid, v_line.product_id, v_line.variant_id, v_line.title, v_line.variant_title,
              v_line.image_path, v_line.availability, v_line.price, v_line.qty, v_line.price * v_line.qty, v_pct,
              round(v_line.price * v_line.qty * v_pct / 100, 2));
      -- atomic stock decrement; the guard makes concurrent last-unit purchases fail cleanly
      update public.product_variants set stock = stock - v_line.qty
       where id = v_line.variant_id and stock is not null;
      if exists (select 1 from public.product_variants where id = v_line.variant_id and stock is not null and stock < 0) then
        raise exception 'insufficient stock' using errcode = 'P0001', hint = 'insufficient_stock', detail = v_line.variant_id::text;
      end if;
      insert into public.user_events (user_id, kind, product_id) values (v_user, 'purchase', v_line.product_id);
    end loop;
  end loop;

  v_schedule := v_preview -> 'schedule';
  for v_ob in select * from jsonb_array_elements(v_schedule) loop
    insert into public.payment_obligations (order_id, seq, kind, amount_usd, due_date)
    values (v_order_id, (v_ob ->> 'seq')::int, (v_ob ->> 'kind')::public.obligation_kind, (v_ob ->> 'amount_usd')::numeric,
            current_date + (v_ob ->> 'due_in_days')::int);
  end loop;

  perform public.ledger_post('order_placed', jsonb_build_array(
    jsonb_build_object('account', 'buyer_receivable', 'amount', (v_preview ->> 'total_usd')::numeric),
    jsonb_build_object('account', 'deferred_revenue', 'amount', -(v_preview ->> 'total_usd')::numeric)
  ), v_order_id);

  delete from public.cart_items c
   where c.user_id = v_user
     and c.variant_id in (select variant_id from public.order_items where order_id = v_order_id);

  perform public.notify(v_user, 'order_placed', 'Pedido ' || v_number || ' recibido',
    'Te avisaremos cuando confirmemos tu pago.', jsonb_build_object('order_id', v_order_id));
  for v_store in select distinct store_id from public.fulfillments where order_id = v_order_id loop
    perform public.notify_store(v_store.store_id, 'seller_new_order', 'Nuevo pedido ' || v_number,
      'Se habilitará la preparación cuando el pago esté verificado.', jsonb_build_object('order_id', v_order_id));
  end loop;
  perform public.audit('place', 'order', v_order_id::text, jsonb_build_object('total', v_preview ->> 'total_usd', 'plan', p_plan_code));

  return jsonb_build_object('order_id', v_order_id, 'number', v_number, 'replayed', false);
end $$;
