-- =====================================================================
-- Proyecto Supabase "Marketplace" (mimnotafmfasvwrclxan): migraciones 7 a 21.
-- Las 6 primeras ya están aplicadas. Este archivo se genera desde supabase/migrations
-- con tools/supabase-remote/build.py; no lo edites a mano.
--
-- Cómo usarlo: copia todo el archivo, pégalo en el SQL Editor del proyecto y pulsa Run.
-- El editor avisará de "operaciones destructivas": son reemplazos de funciones y reglas
-- y borrados dentro de funciones que solo se ejecutan cuando la app las llame. En un
-- proyecto vacío no hay datos que perder. Todo corre en una sola transacción: si algo
-- falla, no queda nada a medias. No carga datos demo ni cuentas de prueba.
-- =====================================================================
begin;

do $guard$
begin
  if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'payment_obligations') then
    raise exception 'Faltan las migraciones 1 a 6; no se aplicó nada.';
  end if;
  if exists (select 1 from pg_proc where proname = 'place_order' and pronamespace = 'public'::regnamespace) then
    raise exception 'Este archivo ya se aplicó antes; no se aplicó nada.';
  end if;
end $guard$;

-- ===================== 20261009000700_checkout.sql =====================
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

-- ===================== 20261009000800_payments.sql =====================
-- =====================================================================
-- Payment quotes, manual payment submission, admin verification,
-- automated provider events, allocation to obligations, refunds,
-- order cancellation and seller payouts.
-- =====================================================================

create or replace function public._outstanding(p_ob public.payment_obligations) returns numeric
language sql immutable as $$ select p_ob.amount_usd - p_ob.paid_usd - p_ob.waived_usd; $$;

-- recompute obligation statuses + order payment fields from the source of truth (obligations, refunds)
create or replace function public._recompute_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_paid numeric;
  v_refund_due numeric;
  v_total numeric;
  v_refunded numeric;
begin
  update public.payment_obligations
     set status = case
       when status = 'cancelled' then 'cancelled'
       when paid_usd + waived_usd >= amount_usd then 'paid'
       when paid_usd > 0 then 'partially_paid'
       else 'pending' end::public.obligation_status
   where order_id = p_order_id;

  select coalesce(sum(usd_recognized), 0) into v_paid from public.payments where order_id = p_order_id and status = 'confirmed';
  v_paid := v_paid - coalesce((select sum(amount_usd) from public.buyer_refund_payouts where order_id = p_order_id), 0);
  select -coalesce(sum(amount_usd), 0) into v_refund_due from public.ledger_entries
   where order_id = p_order_id and account = 'buyer_refund_payable';
  select total_usd, refunded_usd into v_total, v_refunded from public.orders where id = p_order_id;

  update public.orders set
    paid_usd = greatest(v_paid, 0),
    payment_status = case
      when v_refund_due > 0 then 'refund_due'
      when v_total = 0 and v_refunded > 0 then 'refunded'
      when v_paid >= v_total and v_total > 0 then 'paid'
      when v_paid > 0 then 'partially_paid'
      else 'unpaid' end::public.order_payment_status
   where id = p_order_id;
end $$;
revoke execute on function public._recompute_order(uuid) from public, anon, authenticated;

create or replace function public._order_payment_level(p_order_id uuid) returns text
language sql stable security definer set search_path = public as $$
  -- 'full' when everything owed is covered, 'down_payment' when the first obligation is covered, else 'none'
  select case
    when (select paid_usd >= total_usd from public.orders where id = p_order_id) then 'full'
    when exists (select 1 from public.payment_obligations where order_id = p_order_id and seq = 1 and status = 'paid') then 'down_payment'
    else 'none' end;
$$;

-- ---------- quotes ----------
create or replace function public.create_payment_quote(p_order_id uuid, p_method_code text, p_obligation_ids uuid[] default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := public.require_user();
  v_order public.orders;
  v_method public.payment_methods;
  v_obs uuid[];
  v_first_seq int;
  v_base numeric;
  v_fee numeric;
  v_rate record;
  v_quote public.payment_quotes;
begin
  perform public.check_rate_limit('quote', 30, 600);
  select * into v_order from public.orders where id = p_order_id and buyer_id = v_user;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if v_order.status = 'cancelled' then raise exception 'order cancelled' using errcode = 'P0001', hint = 'order_cancelled'; end if;

  select * into v_method from public.payment_methods where code = p_method_code and enabled;
  if not found then raise exception 'payment method unavailable' using errcode = 'P0001', hint = 'method_unavailable'; end if;
  if v_method.kind = 'automated' and v_method.integration_status not in ('live', 'sandbox') then
    raise exception 'payment method not configured' using errcode = 'P0001', hint = 'method_unavailable';
  end if;

  if exists (
    select 1 from public.payments p join public.payment_quotes q on q.id = p.quote_id
     where p.order_id = p_order_id and p.status in ('pending_verification', 'processing')
       and (p_obligation_ids is null or q.obligation_ids && p_obligation_ids)
  ) then
    raise exception 'a payment for this amount is being verified' using errcode = 'P0001', hint = 'payment_pending_verification';
  end if;

  select min(seq) into v_first_seq from public.payment_obligations o
   where o.order_id = p_order_id and o.status in ('pending', 'partially_paid');
  if v_first_seq is null then raise exception 'nothing to pay' using errcode = 'P0001', hint = 'nothing_due'; end if;

  if p_obligation_ids is null or cardinality(p_obligation_ids) = 0 then
    select array_agg(id) into v_obs from public.payment_obligations where order_id = p_order_id and seq = v_first_seq;
  else
    select array_agg(id order by seq) into v_obs from public.payment_obligations
     where order_id = p_order_id and id = any (p_obligation_ids) and status in ('pending', 'partially_paid');
    if v_obs is null or cardinality(v_obs) <> cardinality(p_obligation_ids) then
      raise exception 'invalid obligations' using errcode = 'P0001', hint = 'obligations_invalid';
    end if;
    -- installments are paid in order: the earliest outstanding one must be included
    if not exists (select 1 from public.payment_obligations where id = any (v_obs) and seq = v_first_seq) then
      raise exception 'pay the earliest installment first' using errcode = 'P0001', hint = 'obligations_order';
    end if;
  end if;

  select sum(public._outstanding(o)) into v_base from public.payment_obligations o where o.id = any (v_obs);
  if v_base < v_method.min_usd or (v_method.max_usd is not null and v_base > v_method.max_usd) then
    raise exception 'amount outside method limits' using errcode = 'P0001', hint = 'method_limits';
  end if;
  v_fee := round(v_base * v_method.fee_pct / 100 + v_method.fee_fixed_usd, 2);

  select * into v_rate from public.current_rate('USD/' || v_method.currency); -- raises rate_unavailable when stale

  update public.payment_quotes set status = 'cancelled' where order_id = p_order_id and buyer_id = v_user and status = 'open';

  insert into public.payment_quotes (buyer_id, order_id, method_code, obligation_ids, base_usd, fee_usd, currency, rate_pair,
                                     rate_base, rate_applied, rate_source, rate_observed_at, amount_due, expires_at)
  values (v_user, p_order_id, p_method_code, v_obs, v_base, v_fee, v_method.currency, 'USD/' || v_method.currency,
          v_rate.rate_base, v_rate.rate_applied, v_rate.source_code, v_rate.observed_at,
          round((v_base + v_fee) * v_rate.rate_applied, 2), now() + make_interval(mins => v_method.quote_ttl_minutes))
  returning * into v_quote;

  return to_jsonb(v_quote) || jsonb_build_object(
    'method', jsonb_build_object('code', v_method.code, 'name', v_method.name, 'kind', v_method.kind, 'rail', v_method.rail,
      'requires_reference', v_method.requires_reference, 'requires_proof', v_method.requires_proof,
      'instructions', v_method.instructions, 'integration_status', v_method.integration_status));
end $$;

-- ---------- manual payment submission ----------
create or replace function public.submit_payment(
  p_quote_id uuid, p_reference text, p_proof_path text, p_payer jsonb, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := public.require_user();
  v_existing public.payments;
  v_quote public.payment_quotes;
  v_method public.payment_methods;
  v_ref text := nullif(trim(p_reference), '');
  v_norm text;
  v_payment public.payments;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception 'idempotency key required' using errcode = '22023', hint = 'idempotency_required';
  end if;
  select * into v_existing from public.payments where buyer_id = v_user and idempotency_key = p_idempotency_key;
  if found then return to_jsonb(v_existing) || jsonb_build_object('replayed', true); end if;

  perform public.check_rate_limit('submit_payment', 10, 3600);

  select * into v_quote from public.payment_quotes where id = p_quote_id and buyer_id = v_user for update;
  if not found then raise exception 'quote not found' using errcode = 'P0002'; end if;
  if v_quote.status <> 'open' then raise exception 'quote no longer valid' using errcode = 'P0001', hint = 'quote_used'; end if;
  if v_quote.expires_at < now() then
    update public.payment_quotes set status = 'expired' where id = p_quote_id;
    -- the status change must persist even though we abort: report via return instead of raising
    return jsonb_build_object('error', 'quote_expired');
  end if;

  select * into v_method from public.payment_methods where code = v_quote.method_code;
  if v_method.kind <> 'manual' then raise exception 'use the provider flow for this method' using errcode = 'P0001', hint = 'method_automated'; end if;
  if v_method.requires_reference and (v_ref is null or char_length(v_ref) < 4) then
    raise exception 'reference required' using errcode = '22023', hint = 'reference_required';
  end if;
  if v_ref is not null and v_method.reference_pattern is not null
     and regexp_replace(v_ref, '[^A-Za-z0-9]', '', 'g') !~ v_method.reference_pattern then
    raise exception 'reference format invalid' using errcode = '22023', hint = 'reference_invalid';
  end if;
  if v_method.requires_proof and p_proof_path is null then
    raise exception 'proof required' using errcode = '22023', hint = 'proof_required';
  end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> v_user::text then
    raise exception 'invalid proof path' using errcode = '42501', hint = 'proof_invalid';
  end if;
  if exists (select 1 from public.payment_obligations where id = any (v_quote.obligation_ids) and status not in ('pending', 'partially_paid')) then
    update public.payment_quotes set status = 'cancelled' where id = p_quote_id;
    return jsonb_build_object('error', 'obligation_already_paid');
  end if;

  v_norm := case when v_ref is null then null else upper(regexp_replace(v_ref, '[^A-Za-z0-9]', '', 'g')) end;
  if v_norm is not null and exists (
    select 1 from public.payments where method_code = v_quote.method_code and reference_normalized = v_norm
       and status in ('pending_verification', 'processing', 'confirmed')
  ) then
    raise exception 'this reference was already submitted' using errcode = '23505', hint = 'duplicate_reference';
  end if;

  insert into public.payments (number, order_id, buyer_id, quote_id, method_code, currency, amount, rate_applied, base_usd, fee_usd,
                               reference, reference_normalized, proof_path, payer_name, payer_bank, payer_phone, declared_paid_at,
                               status, idempotency_key)
  values ('PG-' || nextval('public.payment_number_seq'), v_quote.order_id, v_user, v_quote.id, v_quote.method_code, v_quote.currency,
          v_quote.amount_due, v_quote.rate_applied, v_quote.base_usd, v_quote.fee_usd, v_ref, v_norm, p_proof_path,
          left(p_payer ->> 'name', 120), left(p_payer ->> 'bank', 80), left(p_payer ->> 'phone', 32),
          coalesce((p_payer ->> 'paid_at')::timestamptz, now()), 'pending_verification', p_idempotency_key)
  returning * into v_payment;

  update public.payment_quotes set status = 'used', used_at = now() where id = p_quote_id;
  perform public.notify(v_user, 'payment_received', 'Pago recibido',
    'Estamos verificando tu pago ' || v_payment.number || '. Te avisaremos al confirmarlo.',
    jsonb_build_object('order_id', v_quote.order_id, 'payment_id', v_payment.id));
  return to_jsonb(v_payment) || jsonb_build_object('replayed', false);
end $$;

-- ---------- allocation (shared by admin verification and provider webhooks) ----------
create or replace function public._apply_payment(p_payment_id uuid, p_usd numeric, p_fee numeric, p_actor_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_p public.payments;
  v_q public.payment_quotes;
  v_left numeric := p_usd;
  v_ob public.payment_obligations;
  v_take numeric;
  v_order public.orders;
  v_f record;
  v_level text;
begin
  select * into v_p from public.payments where id = p_payment_id for update;
  select * into v_q from public.payment_quotes where id = v_p.quote_id;
  select * into v_order from public.orders where id = v_p.order_id for update;

  -- quoted obligations first (in order), then any other outstanding obligations of the order
  for v_ob in
    select * from public.payment_obligations
     where order_id = v_p.order_id and status in ('pending', 'partially_paid')
     order by (id = any (v_q.obligation_ids)) desc, seq
     for update
  loop
    exit when v_left <= 0;
    v_take := least(v_left, public._outstanding(v_ob));
    if v_take > 0 then
      update public.payment_obligations set paid_usd = paid_usd + v_take where id = v_ob.id;
      insert into public.payment_allocations (payment_id, obligation_id, amount_usd) values (p_payment_id, v_ob.id, v_take);
      v_left := v_left - v_take;
    end if;
  end loop;

  update public.payments set status = 'confirmed', usd_recognized = p_usd, verified_at = now(), verified_by = auth.uid()
   where id = p_payment_id;

  perform public.ledger_post('payment_confirmed', jsonb_build_array(
    jsonb_build_object('account', 'cash_clearing', 'amount', p_usd + p_fee),
    jsonb_build_object('account', 'buyer_receivable', 'amount', -(p_usd - v_left)),
    jsonb_build_object('account', 'buyer_refund_payable', 'amount', -v_left),
    jsonb_build_object('account', 'fee_revenue', 'amount', -p_fee)
  ), v_p.order_id, p_payment_id, null, null,
     v_p.method_code || ' ' || v_p.currency || ' ' || coalesce(v_p.amount_received, v_p.amount) || ' @ ' || v_p.rate_applied || coalesce(' · ' || p_actor_note, ''));

  perform public._recompute_order(v_p.order_id);
  update public.orders set status = 'in_progress' where id = v_p.order_id and status = 'placed';

  -- "Anticipo verificado": automatically advance import fulfillments waiting on the deposit
  v_level := public._order_payment_level(v_p.order_id);
  for v_f in
    select f.id from public.fulfillments f
      join public.fulfillment_steps cur on cur.flow = f.flow and cur.code = f.status
      join public.fulfillment_steps nxt on nxt.flow = f.flow and nxt.seq = cur.seq + 1
     where f.order_id = v_p.order_id and f.flow = 'import_order' and nxt.code = 'deposit_verified'
       and (nxt.requires_payment is null or nxt.requires_payment = 'down_payment' and v_level in ('down_payment', 'full') or v_level = 'full')
  loop
    perform public._set_fulfillment_step(v_f.id, 'deposit_verified', null, 'system', null, null);
  end loop;

  select * into v_order from public.orders where id = v_p.order_id;
  perform public.notify(v_p.buyer_id, 'payment_confirmed', 'Pago confirmado',
    case when v_order.payment_status = 'paid' then 'Tu pedido ' || v_order.number || ' está pagado por completo.'
         else 'Saldo pendiente: ' || public._fmt_usd(v_order.total_usd - v_order.paid_usd) || '.' end,
    jsonb_build_object('order_id', v_p.order_id, 'payment_id', p_payment_id));
  if v_order.payment_status = 'paid' then
    for v_f in select distinct store_id from public.fulfillments where order_id = v_p.order_id and flow = 'seller_shipping' loop
      perform public.notify_store(v_f.store_id, 'seller_new_order', 'Pedido ' || v_order.number || ' pagado',
        'Ya puedes confirmarlo y prepararlo.', jsonb_build_object('order_id', v_p.order_id));
    end loop;
  end if;
end $$;
revoke execute on function public._apply_payment(uuid, numeric, numeric, text) from public, anon, authenticated;

create or replace function public.review_payment(p_payment_id uuid, p_approve boolean, p_amount_received numeric default null, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_p public.payments;
  v_received numeric;
  v_usd numeric;
  v_fee numeric;
begin
  perform public.require_admin();
  select * into v_p from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment not found' using errcode = 'P0002'; end if;
  if v_p.status not in ('pending_verification', 'processing') then
    raise exception 'payment already reviewed' using errcode = 'P0001', hint = 'already_reviewed';
  end if;

  if not p_approve then
    if coalesce(trim(p_reason), '') = '' then raise exception 'reason required' using errcode = '22023', hint = 'reason_required'; end if;
    update public.payments set status = 'rejected', rejection_reason = p_reason, verified_at = now(), verified_by = auth.uid()
     where id = p_payment_id;
    perform public.notify(v_p.buyer_id, 'payment_rejected', 'No pudimos confirmar tu pago',
      p_reason, jsonb_build_object('order_id', v_p.order_id, 'payment_id', p_payment_id));
    return jsonb_build_object('status', 'rejected');
  end if;

  v_received := coalesce(p_amount_received, v_p.amount);
  if v_received <= 0 then raise exception 'invalid amount' using errcode = '22023'; end if;
  if v_received > v_p.amount then
    raise exception 'received amount exceeds quoted amount; record the excess separately' using errcode = '22023', hint = 'amount_exceeds_quote';
  end if;
  if v_received < v_p.amount and coalesce(trim(p_reason), '') = '' then
    raise exception 'note required for partial amounts' using errcode = '22023', hint = 'reason_required';
  end if;
  -- proportional recognition for partial receipts; exact when the full amount arrived
  if v_received = v_p.amount then
    v_usd := v_p.base_usd; v_fee := v_p.fee_usd;
  else
    v_usd := trunc(v_p.base_usd * v_received / v_p.amount, 2);
    v_fee := trunc(v_p.fee_usd * v_received / v_p.amount, 2);
  end if;
  update public.payments set amount_received = v_received where id = p_payment_id;
  perform public._apply_payment(p_payment_id, v_usd, v_fee, p_reason);
  return jsonb_build_object('status', 'confirmed', 'usd_recognized', v_usd);
end $$;

-- ---------- automated providers (PayPal / Binance Pay ...) ----------
create or replace function public.start_provider_payment(p_quote_id uuid, p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_user uuid := public.require_user(); v_quote public.payment_quotes; v_method public.payment_methods; v_payment public.payments;
begin
  select * into v_payment from public.payments where buyer_id = v_user and idempotency_key = p_idempotency_key;
  if found then return to_jsonb(v_payment) || jsonb_build_object('replayed', true); end if;
  select * into v_quote from public.payment_quotes where id = p_quote_id and buyer_id = v_user for update;
  if not found then raise exception 'quote not found' using errcode = 'P0002'; end if;
  if v_quote.status <> 'open' or v_quote.expires_at < now() then raise exception 'quote no longer valid' using errcode = 'P0001', hint = 'quote_expired'; end if;
  select * into v_method from public.payment_methods where code = v_quote.method_code;
  if v_method.kind <> 'automated' or v_method.integration_status not in ('live', 'sandbox') then
    raise exception 'provider not available' using errcode = 'P0001', hint = 'method_unavailable';
  end if;
  insert into public.payments (number, order_id, buyer_id, quote_id, method_code, currency, amount, rate_applied, base_usd, fee_usd,
                               status, idempotency_key, provider)
  values ('PG-' || nextval('public.payment_number_seq'), v_quote.order_id, v_user, v_quote.id, v_quote.method_code, v_quote.currency,
          v_quote.amount_due, v_quote.rate_applied, v_quote.base_usd, v_quote.fee_usd, 'processing', p_idempotency_key, v_method.rail)
  returning * into v_payment;
  update public.payment_quotes set status = 'used', used_at = now() where id = p_quote_id;
  return to_jsonb(v_payment) || jsonb_build_object('replayed', false);
end $$;

create or replace function public.attach_provider_payment(p_payment_id uuid, p_provider_payment_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.payments set provider_payment_id = p_provider_payment_id where id = p_payment_id and status = 'processing';
end $$;

-- Webhook entry point (called by edge functions with the service role AFTER signature verification).
create or replace function public.record_provider_event(
  p_provider text, p_event_id text, p_event_type text, p_provider_payment_id text, p_outcome text,
  p_amount numeric, p_currency text, p_signature_valid boolean, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_event_id bigint; v_p public.payments;
begin
  if not public.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.payment_events (provider, provider_event_id, event_type, signature_valid, payload)
  values (p_provider, p_event_id, p_event_type, p_signature_valid, p_payload)
  on conflict (provider, provider_event_id) do nothing
  returning id into v_event_id;
  if v_event_id is null then return jsonb_build_object('status', 'duplicate'); end if;
  if not p_signature_valid then
    update public.payment_events set error = 'invalid signature' where id = v_event_id;
    return jsonb_build_object('status', 'rejected_signature');
  end if;
  select * into v_p from public.payments where provider = p_provider and provider_payment_id = p_provider_payment_id for update;
  if not found then
    update public.payment_events set error = 'unknown payment' where id = v_event_id;
    return jsonb_build_object('status', 'unknown_payment');
  end if;
  update public.payment_events set payment_id = v_p.id where id = v_event_id;
  if p_outcome = 'succeeded' then
    if v_p.status <> 'processing' then
      update public.payment_events set processed = true, error = 'payment not processing' where id = v_event_id;
      return jsonb_build_object('status', 'ignored');
    end if;
    if p_currency <> v_p.currency or p_amount < v_p.amount then
      update public.payments set status = 'pending_verification', amount_received = p_amount where id = v_p.id;
      update public.payment_events set processed = true, error = 'amount/currency mismatch: manual review' where id = v_event_id;
      return jsonb_build_object('status', 'needs_review');
    end if;
    update public.payments set amount_received = p_amount where id = v_p.id;
    perform public._apply_payment(v_p.id, v_p.base_usd, v_p.fee_usd, p_provider || ' event ' || p_event_id);
  elsif p_outcome in ('failed', 'cancelled', 'expired') then
    update public.payments set status = 'failed', rejection_reason = p_event_type where id = v_p.id and status = 'processing';
  end if;
  update public.payment_events set processed = true where id = v_event_id;
  return jsonb_build_object('status', 'processed');
end $$;

-- ---------- fulfillment progression ----------
create or replace function public._set_fulfillment_step(
  p_fulfillment_id uuid, p_step text, p_note text, p_source text, p_tracking text, p_carrier text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_f public.fulfillments;
  v_step public.fulfillment_steps;
  v_order public.orders;
  v_kind text;
begin
  select * into v_f from public.fulfillments where id = p_fulfillment_id for update;
  select * into v_step from public.fulfillment_steps where flow = v_f.flow and code = p_step;
  update public.fulfillments
     set status = p_step,
         tracking_number = coalesce(nullif(trim(p_tracking), ''), tracking_number),
         carrier_name = coalesce(nullif(trim(p_carrier), ''), carrier_name),
         delivered_at = case when p_step = 'delivered' then now() else delivered_at end
   where id = p_fulfillment_id;
  insert into public.fulfillment_events (fulfillment_id, step_code, note, source, actor_id)
  values (p_fulfillment_id, p_step, p_note, p_source, auth.uid());

  select * into v_order from public.orders where id = v_f.order_id;
  if v_step.notify_buyer then
    v_kind := case p_step when 'dispatched' then 'order_dispatched' when 'delivered' then 'order_delivered' else 'fulfillment_update' end;
    perform public.notify(v_order.buyer_id, v_kind, v_step.buyer_label,
      'Pedido ' || v_order.number || ' · Entrega ' || v_f.seq || coalesce('. ' || v_step.buyer_description, ''),
      jsonb_build_object('order_id', v_f.order_id, 'fulfillment_id', p_fulfillment_id));
  end if;
  if p_step = 'delivered' then perform public._settle_fulfillment(p_fulfillment_id); end if;

  -- order completes when every delivery is terminal
  if not exists (
    select 1 from public.fulfillments f join public.fulfillment_steps s on s.flow = f.flow and s.code = f.status
     where f.order_id = v_f.order_id and not s.is_terminal
  ) then
    update public.orders set status = case when exists (select 1 from public.fulfillments where order_id = v_f.order_id and status <> 'cancelled')
                                           then 'completed' else 'cancelled' end::public.order_status
     where id = v_f.order_id and status <> 'cancelled';
  elsif v_order.status = 'placed' and p_step <> 'cancelled' then
    update public.orders set status = 'in_progress' where id = v_f.order_id;
  end if;
end $$;
revoke execute on function public._set_fulfillment_step(uuid, text, text, text, text, text) from public, anon, authenticated;

create or replace function public.advance_fulfillment(p_fulfillment_id uuid, p_step text, p_note text default null,
  p_tracking text default null, p_carrier text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_f public.fulfillments;
  v_cur public.fulfillment_steps;
  v_next public.fulfillment_steps;
  v_admin boolean := public.is_admin() or public.is_service_role();
  v_level text;
begin
  select * into v_f from public.fulfillments where id = p_fulfillment_id for update;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  if not v_admin and not public.is_store_member(v_f.store_id) then raise exception 'not found' using errcode = 'P0002'; end if;
  select * into v_cur from public.fulfillment_steps where flow = v_f.flow and code = v_f.status;
  select * into v_next from public.fulfillment_steps where flow = v_f.flow and code = p_step;
  if not found then raise exception 'unknown step' using errcode = '22023', hint = 'invalid_step'; end if;
  if v_cur.is_terminal then raise exception 'delivery already closed' using errcode = 'P0001', hint = 'invalid_transition'; end if;
  if p_step = 'cancelled' and not v_admin then raise exception 'only admins can cancel deliveries' using errcode = '42501'; end if;
  if p_step <> 'cancelled' and v_next.seq <= v_cur.seq then
    raise exception 'logistic states only move forward' using errcode = 'P0001', hint = 'invalid_transition';
  end if;
  if not v_admin and not v_next.seller_can_set then
    raise exception 'this state is managed by the platform' using errcode = '42501', hint = 'step_not_allowed';
  end if;
  v_level := public._order_payment_level(v_f.order_id);
  if v_next.requires_payment = 'full' and v_level <> 'full'
     or v_next.requires_payment = 'down_payment' and v_level = 'none' then
    raise exception 'payment requirement not met for this state' using errcode = 'P0001', hint = 'payment_required';
  end if;
  if p_step = 'dispatched' and v_f.flow = 'seller_shipping' and v_f.shipping_kind = 'home_delivery'
     and coalesce(nullif(trim(p_tracking), ''), v_f.tracking_number) is null then
    raise exception 'tracking number required to dispatch' using errcode = '22023', hint = 'tracking_required';
  end if;
  if p_step = 'cancelled' then
    perform public._cancel_fulfillment(p_fulfillment_id, coalesce(p_note, 'cancelled'));
    return;
  end if;
  perform public._set_fulfillment_step(p_fulfillment_id, p_step, p_note,
    case when v_admin then 'admin' else 'seller' end, p_tracking, p_carrier);
end $$;

-- ---------- settlement (revenue recognition on delivery) ----------
create or replace function public._settle_fulfillment(p_fulfillment_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_f public.fulfillments;
  v_kind public.store_kind;
  v_net numeric;
  v_comm numeric;
begin
  select * into v_f from public.fulfillments where id = p_fulfillment_id for update;
  if v_f.settled then return; end if;
  select kind into v_kind from public.stores where id = v_f.store_id;
  select coalesce(sum(line_total_usd - refunded_usd), 0),
         coalesce(sum(round((line_total_usd - refunded_usd) * commission_pct / 100, 2)), 0)
    into v_net, v_comm
    from public.order_items where fulfillment_id = p_fulfillment_id;
  if v_kind = 'platform' then
    perform public.ledger_post('fulfillment_settled', jsonb_build_array(
      jsonb_build_object('account', 'deferred_revenue', 'amount', v_net + v_f.shipping_usd),
      jsonb_build_object('account', 'sales_revenue', 'amount', -(v_net + v_f.shipping_usd))
    ), v_f.order_id, null, p_fulfillment_id);
  else
    -- seller ships with own logistics: shipping charged to the buyer is owed to the seller
    perform public.ledger_post('fulfillment_settled', jsonb_build_array(
      jsonb_build_object('account', 'deferred_revenue', 'amount', v_net + v_f.shipping_usd),
      jsonb_build_object('account', 'seller_payable', 'amount', -(v_net - v_comm + v_f.shipping_usd), 'store_id', v_f.store_id),
      jsonb_build_object('account', 'commission_revenue', 'amount', -v_comm)
    ), v_f.order_id, null, p_fulfillment_id);
  end if;
  update public.fulfillments set settled = true where id = p_fulfillment_id;
end $$;
revoke execute on function public._settle_fulfillment(uuid) from public, anon, authenticated;

-- ---------- cargo batches ----------
create or replace function public.assign_to_batch(p_batch_id uuid, p_fulfillment_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  perform public.require_admin();
  update public.fulfillments set cargo_batch_id = p_batch_id
   where id = any (p_fulfillment_ids) and flow = 'import_order' and status not in ('delivered', 'cancelled');
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.update_cargo_batch(p_batch_id uuid, p_step text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_target public.fulfillment_steps;
  v_f record;
  v_updated int := 0;
  v_skipped jsonb := '[]'::jsonb;
  v_level text;
begin
  perform public.require_admin();
  select * into v_target from public.fulfillment_steps where flow = 'import_order' and code = p_step;
  if not found or v_target.is_terminal then raise exception 'invalid batch step' using errcode = '22023', hint = 'invalid_step'; end if;
  update public.cargo_batches set step_code = p_step where id = p_batch_id;
  if not found then raise exception 'batch not found' using errcode = 'P0002'; end if;
  for v_f in
    select f.id, f.order_id, s.seq from public.fulfillments f
      join public.fulfillment_steps s on s.flow = f.flow and s.code = f.status
     where f.cargo_batch_id = p_batch_id and not s.is_terminal
     order by f.created_at
  loop
    if v_f.seq >= v_target.seq then continue; end if;
    v_level := public._order_payment_level(v_f.order_id);
    if v_target.requires_payment = 'full' and v_level <> 'full' or v_target.requires_payment = 'down_payment' and v_level = 'none' then
      v_skipped := v_skipped || jsonb_build_object('fulfillment_id', v_f.id, 'reason', 'payment_required');
      continue;
    end if;
    perform public._set_fulfillment_step(v_f.id, p_step, p_note, 'batch', null, null);
    v_updated := v_updated + 1;
  end loop;
  perform public.audit('batch_step', 'cargo_batch', p_batch_id::text, jsonb_build_object('step', p_step, 'updated', v_updated, 'skipped', v_skipped));
  return jsonb_build_object('updated', v_updated, 'skipped', v_skipped);
end $$;

-- ---------- refunds ----------
-- Reduces what the buyer owes: first waives outstanding obligations (latest first),
-- anything already paid beyond the new total becomes a refund payable to the buyer.
create or replace function public._reduce_buyer_debt(p_order_id uuid, p_amount numeric, p_event text) returns numeric
language plpgsql security definer set search_path = public as $$
declare v_left numeric := p_amount; v_ob public.payment_obligations; v_take numeric;
begin
  for v_ob in select * from public.payment_obligations where order_id = p_order_id and status in ('pending', 'partially_paid')
              order by seq desc for update loop
    exit when v_left <= 0;
    v_take := least(v_left, public._outstanding(v_ob));
    update public.payment_obligations set waived_usd = waived_usd + v_take where id = v_ob.id;
    v_left := v_left - v_take;
  end loop;
  if v_left > 0 then
    perform public.ledger_post(p_event || '_refund_due', jsonb_build_array(
      jsonb_build_object('account', 'buyer_receivable', 'amount', v_left),
      jsonb_build_object('account', 'buyer_refund_payable', 'amount', -v_left)
    ), p_order_id);
  end if;
  return v_left;
end $$;
revoke execute on function public._reduce_buyer_debt(uuid, numeric, text) from public, anon, authenticated;

create or replace function public.refund_item(p_order_item_id uuid, p_quantity int, p_reason text, p_restock boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_item public.order_items;
  v_f public.fulfillments;
  v_kind public.store_kind;
  v_amount numeric;
  v_comm numeric;
  v_due numeric;
  v_order public.orders;
begin
  perform public.require_admin();
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason required' using errcode = '22023', hint = 'reason_required'; end if;
  select * into v_item from public.order_items where id = p_order_item_id for update;
  if not found then raise exception 'item not found' using errcode = 'P0002'; end if;
  select * into v_order from public.orders where id = v_item.order_id for update;
  if p_quantity <= 0 or p_quantity > v_item.quantity - v_item.refunded_qty then
    raise exception 'invalid quantity' using errcode = '22023', hint = 'invalid_quantity';
  end if;
  select * into v_f from public.fulfillments where id = v_item.fulfillment_id;
  select kind into v_kind from public.stores where id = v_item.store_id;
  v_amount := v_item.unit_price_usd * p_quantity;
  v_comm := round(v_amount * v_item.commission_pct / 100, 2);

  update public.order_items set refunded_qty = refunded_qty + p_quantity, refunded_usd = refunded_usd + v_amount where id = v_item.id;
  update public.orders set refunded_usd = refunded_usd + v_amount, total_usd = total_usd - v_amount where id = v_item.order_id;
  if p_restock then
    update public.product_variants set stock = stock + p_quantity where id = v_item.variant_id and stock is not null;
  end if;

  if v_f.settled then
    if v_kind = 'platform' then
      perform public.ledger_post('refund', jsonb_build_array(
        jsonb_build_object('account', 'sales_revenue', 'amount', v_amount),
        jsonb_build_object('account', 'buyer_receivable', 'amount', -v_amount)), v_item.order_id, null, v_f.id, null, p_reason);
    else
      perform public.ledger_post('refund', jsonb_build_array(
        jsonb_build_object('account', 'seller_payable', 'amount', v_amount - v_comm, 'store_id', v_item.store_id),
        jsonb_build_object('account', 'commission_revenue', 'amount', v_comm),
        jsonb_build_object('account', 'buyer_receivable', 'amount', -v_amount)), v_item.order_id, null, v_f.id, null, p_reason);
    end if;
  else
    perform public.ledger_post('refund', jsonb_build_array(
      jsonb_build_object('account', 'deferred_revenue', 'amount', v_amount),
      jsonb_build_object('account', 'buyer_receivable', 'amount', -v_amount)), v_item.order_id, null, v_f.id, null, p_reason);
  end if;

  v_due := public._reduce_buyer_debt(v_item.order_id, v_amount, 'refund');
  insert into public.refunds (order_id, order_item_id, quantity, amount_usd, reason, restock, created_by)
  values (v_item.order_id, v_item.id, p_quantity, v_amount, p_reason, p_restock, auth.uid());
  perform public._recompute_order(v_item.order_id);
  perform public.notify(v_order.buyer_id, 'system', 'Reembolso registrado',
    'Pedido ' || v_order.number || ': ' || public._fmt_usd(v_amount) || '.' ||
    case when v_due > 0 then ' Te devolveremos ' || public._fmt_usd(v_due) || '.' else ' Se descontó de tu saldo pendiente.' end,
    jsonb_build_object('order_id', v_item.order_id));
  return jsonb_build_object('refunded_usd', v_amount, 'refund_due_usd', v_due);
end $$;

create or replace function public.record_refund_payout(p_order_id uuid, p_amount numeric, p_method text, p_reference text)
returns void language plpgsql security definer set search_path = public as $$
declare v_due numeric;
begin
  perform public.require_admin();
  perform 1 from public.orders where id = p_order_id for update;
  select -coalesce(sum(amount_usd), 0) into v_due from public.ledger_entries where order_id = p_order_id and account = 'buyer_refund_payable';
  if p_amount <= 0 or p_amount > v_due then raise exception 'amount exceeds refund due (%)', v_due using errcode = '22023', hint = 'invalid_amount'; end if;
  if coalesce(trim(p_reference), '') = '' then raise exception 'reference required' using errcode = '22023', hint = 'reference_required'; end if;
  insert into public.buyer_refund_payouts (order_id, amount_usd, method, reference, paid_by) values (p_order_id, p_amount, p_method, p_reference, auth.uid());
  perform public.ledger_post('refund_paid', jsonb_build_array(
    jsonb_build_object('account', 'buyer_refund_payable', 'amount', p_amount),
    jsonb_build_object('account', 'cash_clearing', 'amount', -p_amount)), p_order_id, null, null, null, p_method || ' ' || p_reference);
  perform public._recompute_order(p_order_id);
end $$;

-- ---------- cancellation ----------
create or replace function public._cancel_fulfillment(p_fulfillment_id uuid, p_reason text) returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_f public.fulfillments;
  v_open numeric;
  v_item record;
begin
  select * into v_f from public.fulfillments where id = p_fulfillment_id for update;
  if v_f.status in ('delivered', 'cancelled') then return 0; end if;
  for v_item in select * from public.order_items where fulfillment_id = p_fulfillment_id and refunded_qty < quantity for update loop
    update public.product_variants set stock = stock + (v_item.quantity - v_item.refunded_qty)
     where id = v_item.variant_id and stock is not null;
  end loop;
  select coalesce(sum(line_total_usd - refunded_usd), 0) + v_f.shipping_usd into v_open
    from public.order_items where fulfillment_id = p_fulfillment_id;
  update public.order_items set refunded_usd = line_total_usd, refunded_qty = quantity where fulfillment_id = p_fulfillment_id;
  update public.orders set refunded_usd = refunded_usd + v_open, total_usd = total_usd - v_open where id = v_f.order_id;
  if v_open > 0 then
    perform public.ledger_post('fulfillment_cancelled', jsonb_build_array(
      jsonb_build_object('account', 'deferred_revenue', 'amount', v_open),
      jsonb_build_object('account', 'buyer_receivable', 'amount', -v_open)), v_f.order_id, null, p_fulfillment_id, null, p_reason);
    perform public._reduce_buyer_debt(v_f.order_id, v_open, 'cancel');
  end if;
  perform public._set_fulfillment_step(p_fulfillment_id, 'cancelled', p_reason, case when public.is_admin() then 'admin' else 'system' end, null, null);
  perform public._recompute_order(v_f.order_id);
  return v_open;
end $$;
revoke execute on function public._cancel_fulfillment(uuid, text) from public, anon, authenticated;

create or replace function public.cancel_order(p_order_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_order public.orders; v_f record; v_admin boolean := public.is_admin() or public.is_service_role();
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or (not v_admin and v_order.buyer_id <> auth.uid()) then raise exception 'not found' using errcode = 'P0002'; end if;
  if v_order.status in ('cancelled', 'completed') then raise exception 'order closed' using errcode = 'P0001', hint = 'invalid_transition'; end if;
  if not v_admin then
    if v_order.paid_usd > 0 or exists (select 1 from public.payments where order_id = p_order_id and status in ('pending_verification', 'processing')) then
      raise exception 'contact support to cancel a paid order' using errcode = 'P0001', hint = 'cancel_requires_support';
    end if;
  end if;
  update public.payment_quotes set status = 'cancelled' where order_id = p_order_id and status = 'open';
  for v_f in select id from public.fulfillments where order_id = p_order_id and status not in ('delivered', 'cancelled') loop
    perform public._cancel_fulfillment(v_f.id, coalesce(p_reason, 'cancelled'));
  end loop;
  update public.payment_obligations set status = 'cancelled' where order_id = p_order_id and status in ('pending', 'partially_paid') and paid_usd = 0;
  update public.orders set status = 'cancelled', cancel_reason = p_reason where id = p_order_id;
  perform public._recompute_order(p_order_id);
  perform public.audit('cancel', 'order', p_order_id::text, jsonb_build_object('reason', p_reason));
end $$;

-- Releases stock of orders never paid within the configured window (run on a schedule).
create or replace function public.expire_unpaid_orders() returns int
language plpgsql security definer set search_path = public as $$
declare v_o record; v_n int := 0; v_hours int := (public.setting('orders.unpaid_expiry_hours', '48'))::int;
begin
  if not public.is_service_role() and not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  for v_o in select o.id from public.orders o
              where o.status = 'placed' and o.payment_status = 'unpaid' and o.placed_at < now() - make_interval(hours => v_hours)
                and not exists (select 1 from public.payments p where p.order_id = o.id and p.status in ('pending_verification', 'processing'))
  loop
    perform public.cancel_order(v_o.id, 'Sin pago dentro de ' || v_hours || ' horas');
    v_n := v_n + 1;
  end loop;
  update public.payment_quotes set status = 'expired' where status = 'open' and expires_at < now();
  return v_n;
end $$;

-- ---------- seller balances & payouts ----------
create or replace function public.seller_balance(p_store_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_available numeric; v_pending numeric; v_paid numeric; v_comm numeric; v_draft numeric;
begin
  perform public.require_store_member(p_store_id);
  select -coalesce(sum(amount_usd), 0) into v_available from public.ledger_entries where account = 'seller_payable' and store_id = p_store_id;
  select coalesce(sum(i.line_total_usd - i.refunded_usd - round((i.line_total_usd - i.refunded_usd) * i.commission_pct / 100, 2)), 0)
    into v_pending
    from public.order_items i join public.fulfillments f on f.id = i.fulfillment_id
   where i.store_id = p_store_id and not f.settled and f.status <> 'cancelled';
  select coalesce(sum(amount_usd), 0) into v_paid from public.payouts where store_id = p_store_id and status = 'paid';
  select coalesce(sum(amount_usd), 0) into v_draft from public.payouts where store_id = p_store_id and status = 'draft';
  select coalesce(sum(round((i.line_total_usd - i.refunded_usd) * i.commission_pct / 100, 2)), 0) into v_comm
    from public.order_items i join public.fulfillments f on f.id = i.fulfillment_id where i.store_id = p_store_id and f.settled;
  return jsonb_build_object('available_usd', v_available, 'scheduled_usd', v_draft, 'pending_usd', v_pending,
                            'paid_out_usd', v_paid, 'commissions_usd', v_comm);
end $$;

create or replace function public.create_payout(p_store_id uuid, p_amount numeric, p_notes text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_bal jsonb;
begin
  perform public.require_admin();
  perform pg_advisory_xact_lock(hashtextextended('payout:' || p_store_id::text, 0));
  v_bal := public.seller_balance(p_store_id);
  if p_amount <= 0 or p_amount > (v_bal ->> 'available_usd')::numeric - (v_bal ->> 'scheduled_usd')::numeric then
    raise exception 'amount exceeds available balance' using errcode = 'P0001', hint = 'insufficient_balance';
  end if;
  insert into public.payouts (store_id, amount_usd, notes, created_by) values (p_store_id, p_amount, p_notes, auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.mark_payout_paid(p_payout_id uuid, p_method text, p_reference text) returns void
language plpgsql security definer set search_path = public as $$
declare v_p public.payouts;
begin
  perform public.require_admin();
  if coalesce(trim(p_reference), '') = '' then raise exception 'reference required' using errcode = '22023', hint = 'reference_required'; end if;
  select * into v_p from public.payouts where id = p_payout_id for update;
  if not found or v_p.status <> 'draft' then raise exception 'payout not payable' using errcode = 'P0001', hint = 'invalid_transition'; end if;
  update public.payouts set status = 'paid', method = p_method, reference = p_reference, paid_at = now(), paid_by = auth.uid() where id = p_payout_id;
  perform public.ledger_post('payout', jsonb_build_array(
    jsonb_build_object('account', 'seller_payable', 'amount', v_p.amount_usd, 'store_id', v_p.store_id),
    jsonb_build_object('account', 'cash_clearing', 'amount', -v_p.amount_usd)), null, null, null, p_payout_id, p_method || ' ' || p_reference);
end $$;

create or replace function public.cancel_payout(p_payout_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.payouts set status = 'cancelled' where id = p_payout_id and status = 'draft';
  if not found then raise exception 'payout not cancellable' using errcode = 'P0001', hint = 'invalid_transition'; end if;
end $$;

-- generic manual adjustment (two legs, admin, reasoned, audited)
create or replace function public.post_adjustment(p_store_id uuid, p_amount numeric, p_memo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_group uuid;
begin
  perform public.require_admin();
  if coalesce(trim(p_memo), '') = '' then raise exception 'memo required' using errcode = '22023', hint = 'reason_required'; end if;
  -- positive amount credits the seller (platform owes more), negative debits
  v_group := public.ledger_post('adjustment', jsonb_build_array(
    jsonb_build_object('account', 'seller_payable', 'amount', -p_amount, 'store_id', p_store_id),
    jsonb_build_object('account', 'adjustments', 'amount', p_amount)), null, null, null, null, p_memo);
  perform public.audit('adjustment', 'store', p_store_id::text, jsonb_build_object('amount', p_amount, 'memo', p_memo));
  return v_group;
end $$;

-- ===================== 20261009000900_discovery.sql =====================
-- =====================================================================
-- Discovery: product cards view, search, product detail, home feed,
-- configurable recommendations, events, dashboards.
-- =====================================================================

create or replace view public.product_cards with (security_invoker = true) as
select p.id, p.slug, p.title, p.subtitle, p.store_id, s.name as store_name, s.slug as store_slug, s.kind as store_kind,
       p.category_id, c.slug as category_slug, c.name as category_name, c.tone, b.name as brand_name,
       p.availability, p.origin, p.base_price_usd as price_usd, p.compare_at_usd,
       (select path from public.product_images i where i.product_id = p.id order by i.sort limit 1) as image_path,
       (select sum(stock) from public.product_variants v where v.product_id = p.id and v.active) as stock_total,
       lt.min_days as lead_min_days, lt.max_days as lead_max_days,
       p.popularity, p.published_at, p.is_demo, p.moderation_status, s.status as store_status
  from public.products p
  join public.stores s on s.id = p.store_id
  join public.categories c on c.id = p.category_id
  left join public.brands b on b.id = p.brand_id
  left join lateral public.lead_time(p.id) lt on true;
grant select on public.product_cards to anon, authenticated;

-- Public catalog search with filters/sorting and stable pagination.
create or replace function public.search_products(
  p_query text default null, p_category text default null, p_store text default null,
  p_availability public.availability[] default null, p_min_price numeric default null, p_max_price numeric default null,
  p_sort text default 'relevance', p_limit int default 24, p_offset int default 0, p_collection text default null
) returns setof public.product_cards
language plpgsql stable security invoker set search_path = public, extensions as $$
declare
  v_q text := nullif(trim(p_query), '');
  v_ts tsquery;
begin
  if v_q is not null then
    v_ts := to_tsquery('simple', array_to_string(array(
      select unaccent(lexeme) || ':*' from unnest(regexp_split_to_array(lower(v_q), '\s+')) lexeme where lexeme ~ '^[[:alnum:]áéíóúñü]+$'
    ), ' & '));
  end if;
  return query
  select pc.* from public.product_cards pc
    join public.products p on p.id = pc.id
    left join public.categories cat on cat.id = pc.category_id
   where pc.moderation_status = 'published' and pc.store_status = 'active'
     and (v_q is null or (v_ts is not null and p.search @@ v_ts) or similarity(p.title, v_q) > 0.25)
     and (p_category is null or pc.category_slug = p_category
          or cat.parent_id = (select id from public.categories where slug = p_category))
     and (p_store is null or pc.store_slug = p_store)
     and (p_collection is null or exists (
          select 1 from public.collection_products cp join public.collections co on co.id = cp.collection_id
           where co.slug = p_collection and co.active and cp.product_id = pc.id))
     and (p_availability is null or pc.availability = any (p_availability))
     and (p_min_price is null or pc.price_usd >= p_min_price)
     and (p_max_price is null or pc.price_usd <= p_max_price)
   order by
     case when pc.availability in ('sold_out', 'unavailable') then 1 else 0 end,
     case when p_sort = 'price_asc' then pc.price_usd end asc nulls last,
     case when p_sort = 'price_desc' then pc.price_usd end desc nulls last,
     case when p_sort = 'newest' then pc.published_at end desc nulls last,
     case when p_sort = 'relevance' and v_q is not null then ts_rank(p.search, v_ts) + similarity(p.title, v_q) end desc nulls last,
     pc.popularity desc, pc.id
   limit least(greatest(p_limit, 1), 60) offset greatest(p_offset, 0);
end $$;

create or replace function public.product_detail(p_id uuid) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare v_card public.product_cards; v_p public.products; v_result jsonb; v_fav boolean := false; v_alert boolean := false;
begin
  select * into v_card from public.product_cards where id = p_id;
  if not found then return null; end if;
  select * into v_p from public.products where id = p_id;
  -- separate statements: anon has no privileges on these tables at all (not just no rows)
  if auth.uid() is not null then
    v_fav := exists (select 1 from public.favorites where user_id = auth.uid() and product_id = p_id);
    v_alert := exists (select 1 from public.stock_alerts where user_id = auth.uid() and product_id = p_id);
  end if;
  select to_jsonb(v_card) || jsonb_build_object(
    'description', v_p.description, 'highlights', v_p.highlights, 'option_names', v_p.option_names,
    'max_per_order', v_p.max_per_order, 'weight_kg', v_p.weight_kg,
    'images', coalesce((select jsonb_agg(jsonb_build_object('path', path, 'alt', alt, 'width', width, 'height', height) order by sort)
                          from public.product_images where product_id = p_id), '[]'::jsonb),
    'variants', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'options', options, 'price_usd', price_usd,
                                  'stock', stock, 'active', active) order by sort, price_usd)
                            from public.product_variants where product_id = p_id and active), '[]'::jsonb),
    'store', (select jsonb_build_object('id', id, 'name', name, 'slug', slug, 'logo_path', logo_path, 'accent', accent, 'kind', kind,
                       'shipping_info', shipping_info, 'rating_avg', rating_avg, 'rating_count', rating_count)
                from public.stores where id = v_p.store_id),
    'is_favorite', v_fav,
    'alert_requested', v_alert,
    'related', coalesce((select jsonb_agg(to_jsonb(r)) from (
        select * from public.product_cards
         where category_id = v_p.category_id and id <> p_id and moderation_status = 'published' and store_status = 'active'
           and availability not in ('unavailable')
         order by popularity desc limit 10) r), '[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;

-- ---------- events (privacy aware) ----------
create or replace function public.track_event(
  p_kind public.user_event_kind, p_product_id uuid default null, p_category_id uuid default null,
  p_store_id uuid default null, p_query text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return; end if;
  if not coalesce((select personalization_enabled from public.profiles where id = v_user), true) then return; end if;
  perform public.check_rate_limit('track', 300, 60);
  insert into public.user_events (user_id, kind, product_id, category_id, store_id, query)
  values (v_user, p_kind, p_product_id, p_category_id, p_store_id, left(nullif(trim(p_query), ''), 120));
end $$;

create or replace function public.clear_my_activity() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.user_events where user_id = public.require_user();
end $$;

-- ---------- recommendations ----------
-- score = w.affinity * category_affinity + w.popularity * normalized_popularity + w.fresh * freshness
--       + w.available * ready_to_ship + w.editorial * in_active_collection - w.seen * recently_viewed
-- Diversity: at most N per category and M per store, configured in app_settings 'ranking'.
create or replace function public.recommended_products(p_limit int default 20, p_exclude uuid[] default '{}')
returns setof public.product_cards language plpgsql stable security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_cfg jsonb := public.setting('ranking', '{}'::jsonb);
  w_aff numeric := coalesce((v_cfg ->> 'affinity')::numeric, 3);
  w_pop numeric := coalesce((v_cfg ->> 'popularity')::numeric, 1.5);
  w_new numeric := coalesce((v_cfg ->> 'freshness')::numeric, 0.8);
  w_avail numeric := coalesce((v_cfg ->> 'available')::numeric, 0.6);
  w_edit numeric := coalesce((v_cfg ->> 'editorial')::numeric, 0.7);
  w_seen numeric := coalesce((v_cfg ->> 'seen_penalty')::numeric, 0.5);
  v_per_cat int := coalesce((v_cfg ->> 'max_per_category')::int, 4);
  v_per_store int := coalesce((v_cfg ->> 'max_per_store')::int, 5);
  v_personal boolean := v_user is not null and coalesce((select personalization_enabled from public.profiles where id = v_user), true);
begin
  return query
  with aff as (
    select coalesce(e.category_id, p.category_id) as category_id,
           sum(case e.kind when 'purchase' then 5 when 'add_to_cart' then 4 when 'favorite' then 3 when 'search' then 1.5 else 1 end
               * exp(-extract(epoch from now() - e.created_at) / (86400 * 21))) as w
      from public.user_events e left join public.products p on p.id = e.product_id
     where v_personal and e.user_id = v_user and e.created_at > now() - interval '90 days'
     group by 1
  ), aff_norm as (
    select category_id, w / nullif(max(w) over (), 0) as a from aff
  ), seen as (
    select product_id, count(*) as n from public.user_events
     where v_personal and user_id = v_user and kind = 'view' and created_at > now() - interval '3 days' group by 1
  ), bought as (
    select distinct product_id from public.user_events where v_personal and user_id = v_user and kind = 'purchase'
  ), pop as (select max(popularity) as m from public.products where moderation_status = 'published'),
  scored as (
    select pc.*,
           w_aff * coalesce(an.a, 0)
           + w_pop * coalesce(pc.popularity / nullif((select m from pop), 0), 0)
           + w_new * greatest(0, 1 - extract(epoch from now() - coalesce(pc.published_at, now())) / (86400 * 45))
           + w_avail * (pc.availability = 'available')::int
           + w_edit * exists (select 1 from public.collection_products cp join public.collections c on c.id = cp.collection_id
                               where cp.product_id = pc.id and c.active)::int
           - w_seen * least(coalesce(s.n, 0), 3) / 3.0 as score
      from public.product_cards pc
      left join aff_norm an on an.category_id = pc.category_id
      left join seen s on s.product_id = pc.id
     where pc.moderation_status = 'published' and pc.store_status = 'active'
       and pc.availability not in ('sold_out', 'unavailable')
       and not (pc.id = any (coalesce(p_exclude, '{}')))
       and pc.id not in (select product_id from bought)
  ), diversified as (
    select sc.*, row_number() over (partition by sc.category_id order by sc.score desc) as rc,
                 row_number() over (partition by sc.store_id order by sc.score desc) as rs
      from scored sc
  )
  select d.id, d.slug, d.title, d.subtitle, d.store_id, d.store_name, d.store_slug, d.store_kind, d.category_id, d.category_slug,
         d.category_name, d.tone, d.brand_name, d.availability, d.origin, d.price_usd, d.compare_at_usd, d.image_path, d.stock_total,
         d.lead_min_days, d.lead_max_days, d.popularity, d.published_at, d.is_demo, d.moderation_status, d.store_status
    from diversified d
   where d.rc <= v_per_cat and d.rs <= v_per_store
   order by d.score desc, d.id
   limit least(greatest(p_limit, 1), 40);
end $$;

create or replace function public.recently_viewed(p_limit int default 12) returns setof public.product_cards
language sql stable security definer set search_path = public as $$
  select pc.* from (
    select product_id, max(created_at) as at from public.user_events
     where user_id = auth.uid() and kind = 'view' and product_id is not null
     group by product_id order by at desc limit least(p_limit, 30)
  ) v join public.product_cards pc on pc.id = v.product_id
  where pc.moderation_status = 'published' and pc.store_status = 'active'
  order by v.at desc;
$$;

-- popularity: decayed purchases/carts/favorites/views over 30 days (scheduled)
create or replace function public.refresh_popularity() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.products p set popularity = coalesce(s.score, 0)
    from (select pr.id, sum(case e.kind when 'purchase' then 8 when 'add_to_cart' then 3 when 'favorite' then 2 else 0.5 end
                             * exp(-extract(epoch from now() - e.created_at) / (86400 * 10))) as score
            from public.products pr left join public.user_events e on e.product_id = pr.id and e.created_at > now() - interval '30 days'
           group by pr.id) s
   where s.id = p.id and p.is_demo = false;
end $$;

-- one round-trip home feed for fast first paint
create or replace function public.home_feed() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  return jsonb_build_object(
    'categories', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'slug', slug, 'name', name, 'icon', icon, 'tone', tone) order by sort), '[]')
                     from public.categories where active and parent_id is null),
    'collections', (select coalesce(jsonb_agg(jsonb_build_object(
                       'id', c.id, 'slug', c.slug, 'title', c.title, 'subtitle', c.subtitle, 'tone', c.tone, 'layout', c.layout, 'cover_path', c.cover_path,
                       'products', (select coalesce(jsonb_agg(to_jsonb(pc) order by cp.sort), '[]') from public.collection_products cp
                                      join public.product_cards pc on pc.id = cp.product_id and pc.moderation_status = 'published' and pc.store_status = 'active'
                                     where cp.collection_id = c.id)) order by c.sort), '[]')
                      from public.collections c
                     where c.active and (c.starts_at is null or c.starts_at <= now()) and (c.ends_at is null or c.ends_at > now())),
    'recommended', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.recommended_products(16) r),
    'recently_viewed', case when auth.uid() is null then '[]'::jsonb else
                        (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.recently_viewed(10) r) end,
    'stores', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'tagline', s.tagline,
                         'logo_path', s.logo_path, 'cover_path', s.cover_path, 'accent', s.accent, 'kind', s.kind) order by s.kind, s.name), '[]')
                 from public.stores s where s.status = 'active'),
    'personalized', auth.uid() is not null and exists (select 1 from public.user_events where user_id = auth.uid())
  );
end $$;

-- ---------- dashboards ----------
create or replace function public.admin_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'orders_today', (select count(*) from public.orders where placed_at >= date_trunc('day', now())),
    'orders_open', (select count(*) from public.orders where status in ('placed', 'in_progress')),
    'gmv_30d_usd', (select coalesce(sum(total_usd), 0) from public.orders where status <> 'cancelled' and placed_at > now() - interval '30 days'),
    'collected_30d_usd', (select coalesce(sum(usd_recognized), 0) from public.payments where status = 'confirmed' and verified_at > now() - interval '30 days'),
    'payments_pending', (select count(*) from public.payments where status = 'pending_verification'),
    'products_pending', (select count(*) from public.products where moderation_status in ('pending', 'in_review')),
    'claims_escalated', (select count(*) from public.claims where status = 'escalated'),
    'claims_open', (select count(*) from public.claims where status in ('open', 'seller_responded', 'escalated')),
    'overdue_installments', (select count(*) from public.payment_obligations where status in ('pending', 'partially_paid') and due_date < current_date),
    'refunds_due_usd', (select -coalesce(sum(amount_usd), 0) from public.ledger_entries where account = 'buyer_refund_payable'),
    'seller_payable_usd', (select -coalesce(sum(amount_usd), 0) from public.ledger_entries where account = 'seller_payable'),
    'platform_revenue_usd', (select -coalesce(sum(amount_usd), 0) from public.ledger_entries where account in ('commission_revenue', 'fee_revenue', 'sales_revenue')),
    'rate', public.rate_status('USD/VES'),
    'stores_pending', (select count(*) from public.stores where status = 'pending'),
    'deletion_requests', (select count(*) from public.account_deletion_requests where status = 'requested')
  );
end $$;

create or replace function public.seller_dashboard(p_store_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_store_member(p_store_id);
  return jsonb_build_object(
    'balance', public.seller_balance(p_store_id),
    'to_prepare', (select count(*) from public.fulfillments f where f.store_id = p_store_id and f.status in ('received', 'confirmed', 'preparing')),
    'in_transit', (select count(*) from public.fulfillments f where f.store_id = p_store_id and f.status in ('dispatched', 'in_transit')),
    'sales_30d_usd', (select coalesce(sum(i.line_total_usd - i.refunded_usd), 0) from public.order_items i join public.orders o on o.id = i.order_id
                       where i.store_id = p_store_id and o.status <> 'cancelled' and o.placed_at > now() - interval '30 days'),
    'units_30d', (select coalesce(sum(i.quantity - i.refunded_qty), 0) from public.order_items i join public.orders o on o.id = i.order_id
                   where i.store_id = p_store_id and o.status <> 'cancelled' and o.placed_at > now() - interval '30 days'),
    'products', (select jsonb_object_agg(moderation_status, n) from (select moderation_status, count(*) n from public.products where store_id = p_store_id group by 1) x),
    'low_stock', (select count(*) from public.product_variants v join public.products p on p.id = v.product_id
                   where p.store_id = p_store_id and v.active and v.stock is not null and v.stock <= 3),
    'claims_open', (select count(*) from public.claims where store_id = p_store_id and status in ('open', 'escalated'))
  );
end $$;

-- restock notifications ("Avisarme")
create or replace function public.notify_back_in_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if old.availability in ('sold_out', 'unavailable') and new.availability not in ('sold_out', 'unavailable') and new.moderation_status = 'published' then
    for r in select user_id from public.stock_alerts where product_id = new.id and notified_at is null loop
      perform public.notify(r.user_id, 'back_in_stock', 'Volvió: ' || new.title, 'Ya puedes comprarlo de nuevo.', jsonb_build_object('product_id', new.id));
    end loop;
    update public.stock_alerts set notified_at = now() where product_id = new.id and notified_at is null;
  end if;
  return null;
end $$;
create trigger products_back_in_stock after update of availability on public.products
  for each row execute function public.notify_back_in_stock();

-- ===================== 20261009001000_default_config.sql =====================
-- =====================================================================
-- Default configuration (safe for every environment) and storage buckets.
-- Business values here are starting points editable from the admin panel.
-- Payment methods ship DISABLED: receiving details must be entered by an admin.
-- =====================================================================

-- ---------- logistics flows (brief §16) ----------
insert into public.fulfillment_steps (flow, code, seq, label, buyer_label, buyer_description, requires_payment, notify_buyer, is_terminal, seller_can_set) values
  ('import_order', 'confirmed',             1, 'Pedido confirmado',            'Pedido confirmado',              'Esperando tu anticipo.', null, false, false, false),
  ('import_order', 'deposit_verified',      2, 'Anticipo verificado',          'Anticipo verificado',            'Vamos a comprar tu producto.', 'down_payment', true, false, false),
  ('import_order', 'purchased',             3, 'Compra realizada',             'Compra realizada',               'Compramos tu producto al proveedor.', 'down_payment', true, false, false),
  ('import_order', 'to_locker',             4, 'En tránsito al casillero',     'Camino a nuestro casillero',     null, 'down_payment', true, false, false),
  ('import_order', 'at_locker',             5, 'Recibido en casillero',        'Recibido en el casillero',       null, 'down_payment', true, false, false),
  ('import_order', 'international_transit', 6, 'En tránsito internacional',    'Viajando a Venezuela',           null, 'down_payment', true, false, false),
  ('import_order', 'customs',               7, 'Proceso aduanero',             'En aduana',                      'Los tiempos de aduana pueden variar.', 'down_payment', true, false, false),
  ('import_order', 'available_in_ve',       8, 'Disponible en Venezuela',      'Llegó a Venezuela',              'Completa tu saldo para coordinar la entrega.', 'down_payment', true, false, false),
  ('import_order', 'out_for_delivery',      9, 'En distribución',              'En camino a ti',                 null, 'full', true, false, false),
  ('import_order', 'delivered',            10, 'Entregado',                    'Entregado',                      null, 'full', true, true, false),
  ('import_order', 'cancelled',            99, 'Cancelado',                    'Entrega cancelada',              null, null, true, true, false),

  ('seller_shipping', 'received',           1, 'Pedido recibido',              'Pedido recibido',                'Esperando confirmación del pago.', null, false, false, false),
  ('seller_shipping', 'confirmed',          2, 'Confirmado',                   'Confirmado por la tienda',       null, 'full', true, false, true),
  ('seller_shipping', 'preparing',          3, 'Preparando',                   'Preparando tu pedido',           null, 'full', true, false, true),
  ('seller_shipping', 'dispatched',         4, 'Despachado',                   'Despachado',                     null, 'full', true, false, true),
  ('seller_shipping', 'in_transit',         5, 'En tránsito',                  'En tránsito',                    null, 'full', true, false, true),
  ('seller_shipping', 'delivered',          6, 'Entregado',                    'Entregado',                      null, 'full', true, true, true),
  ('seller_shipping', 'cancelled',         99, 'Cancelado',                    'Entrega cancelada',              null, null, true, true, false),

  ('local_stock', 'received',               1, 'Pedido recibido',              'Pedido recibido',                'Esperando confirmación del pago.', null, false, false, false),
  ('local_stock', 'preparing',              2, 'Preparando',                   'Preparando tu pedido',           null, 'down_payment', true, false, false),
  ('local_stock', 'ready',                  3, 'Listo para despacho o retiro', 'Listo para entrega',             null, 'full', true, false, false),
  ('local_stock', 'dispatched',             4, 'Despachado',                   'Despachado',                     null, 'full', true, false, false),
  ('local_stock', 'delivered',              5, 'Entregado',                    'Entregado',                      null, 'full', true, true, false),
  ('local_stock', 'cancelled',             99, 'Cancelado',                    'Entrega cancelada',              null, null, true, true, false);

-- ---------- installment plans ----------
insert into public.installment_plans (code, name, description, down_payment_pct, installments, interval_days, surcharge_pct, min_order_usd, allowed_flows, sort) values
  ('full',        'Pago completo',  'Pagas el total ahora.',                                   100, 0, 30, 0, 0,   '{local_stock,import_order,seller_shipping}', 1),
  ('deposit_50',  'Anticipo 50%',   'Pagas la mitad ahora y el resto cuando llegue tu pedido.', 50, 1, 30, 0, 40,  '{local_stock,import_order}', 2),
  ('three_parts', '3 cuotas',       'Tres pagos iguales cada 15 días. La primera hoy.',          0,  3, 15, 0, 60,  '{local_stock,import_order}', 3);

-- ---------- lead times (initial estimates, editable) ----------
insert into public.lead_time_rules (availability, origin, min_days, max_days, label) values
  ('available',  null,     0,  1, 'Stock local'),
  ('available',  'seller', 1,  2, 'Preparación del vendedor'),
  ('in_transit', null,     7, 21, 'Mercancía en camino'),
  ('reservable', null,    15, 30, 'Próximo lote'),
  ('on_order',   'import',18, 30, 'Compra internacional por encargo'),
  ('on_order',   null,     5, 10, 'Bajo pedido local');

-- ---------- exchange rate sources & policies ----------
insert into public.exchange_rate_sources (code, name, pair, kind, adapter, enabled, docs_url, notes) values
  ('bcv_official', 'BCV (publicación oficial)', 'USD/VES', 'official', 'bcv_html', true, 'https://www.bcv.org.ve/',
    'El BCV publica la tasa en su portal; no ofrece una API oficial documentada. El adaptador lee la publicación y valida el valor.'),
  ('dolarapi_oficial', 'DolarApi · oficial (agregador)', 'USD/VES', 'official', 'dolarapi', true, 'https://ve.dolarapi.com/',
    'Agregador de terceros que replica la tasa oficial. Usado solo como respaldo.'),
  ('binance_p2p', 'Binance P2P · referencia USDT/VES', 'USDT/VES', 'market_reference', 'binance_p2p', true, 'https://p2p.binance.com/',
    'Referencia de mercado P2P (mediana de anuncios). No es una tasa oficial ni universal; no se usa para cobrar salvo configuración explícita.'),
  ('kraken_usdt', 'Kraken · USDT/USD', 'USD/USDT', 'market_reference', 'kraken_ticker', true, 'https://docs.kraken.com/api/docs/rest-api/get-ticker-information',
    'Precio público de mercado de USDT en USD (invertido a USDT por USD).'),
  ('manual', 'Tasa manual (administración)', '*', 'manual', 'manual', true, null, 'Ingresada por un administrador, con nota y vigencia.');

insert into public.rate_policies (pair, primary_source, fallback_sources, margin_pct, max_age_minutes, rounding_decimals) values
  ('USD/VES',  'bcv_official', '{dolarapi_oficial}', 0, 4320, 2),
  ('USD/USDT', 'kraken_usdt',  '{}',                 0,  180, 4),
  ('USDT/VES', 'binance_p2p',  '{}',                 0,  120, 2);

-- ---------- payment methods (disabled until an admin configures receiving details) ----------
insert into public.payment_methods (code, name, rail, currency, kind, integration_status, enabled, quote_ttl_minutes, requires_reference, requires_proof, reference_pattern, description, sort, instructions) values
  ('pago_movil', 'Pago Móvil', 'pago_movil', 'VES', 'manual', 'live', false, 30, true, false, '^[0-9]{4,20}$',
    'Monto exacto en bolívares calculado con la tasa del momento.', 1, '{}'),
  ('transferencia_ves', 'Transferencia bancaria', 'bank_transfer_ve', 'VES', 'manual', 'live', false, 60, true, true, '^[0-9]{4,24}$',
    'Transferencia desde un banco venezolano.', 2, '{}'),
  ('zelle', 'Zelle', 'zelle', 'USD', 'manual', 'live', false, 1440, true, true, null,
    'Verificación manual. Zelle no ofrece una API pública de cobro para comercios.', 3, '{}'),
  ('usdt_trc20', 'USDT (TRC-20)', 'usdt_trc20', 'USDT', 'manual', 'live', false, 45, true, false, '^[0-9a-fA-F]{64}$',
    'Envío a dirección TRON. La referencia es el hash de la transacción.', 4, '{}'),
  ('binance_pay', 'Binance Pay', 'binance_pay', 'USDT', 'automated', 'pending_credentials', false, 30, false, false, null,
    'Requiere cuenta de comercio aprobada por Binance.', 5, '{}'),
  ('paypal', 'PayPal', 'paypal', 'USD', 'automated', 'pending_credentials', false, 60, false, false, null,
    'Requiere cuenta Business y aprobación de PayPal para marketplace.', 6, '{}'),
  ('efectivo_usd', 'Efectivo en punto de retiro', 'cash', 'USD', 'manual', 'live', false, 2880, false, false, null,
    'Pago en efectivo al retirar en oficina.', 7, '{}');

-- ---------- settings ----------
insert into public.app_settings (key, value, description, is_public) values
  ('orders.number_prefix', '"P"', 'Prefijo de número de pedido', false),
  ('orders.unpaid_expiry_hours', '48', 'Horas antes de cancelar pedidos sin pago y liberar inventario', false),
  ('commission.default_pct', '10', 'Comisión por defecto a vendedores externos (%)', false),
  ('claims.seller_response_hours', '48', 'Horas que tiene el vendedor para responder antes de que el comprador pueda escalar', true),
  ('ranking', '{"affinity":3,"popularity":1.5,"freshness":0.8,"available":0.6,"editorial":0.7,"seen_penalty":0.5,"max_per_category":4,"max_per_store":5}',
    'Pesos del ranking de recomendaciones', false),
  ('pricing.import', '{"markup_pct":30,"per_kg_usd":0,"fixed_usd":0,"round_to":0.99,"configured":false}',
    'Regla de precio comercial para productos importados por URL. Valores de ejemplo: configurar antes de publicar.', false),
  ('support', '{"email":"soporte@example.com","hours":"Lun a Vie, 9:00 a 18:00"}', 'Contacto de soporte (provisional)', true),
  ('checkout', '{"show_rate_source":true}', 'Opciones de presentación del checkout', true);

-- ---------- storage buckets & policies ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('catalog', 'catalog', true, 5242880, '{image/jpeg,image/png,image/webp}'),
  ('stores', 'stores', true, 5242880, '{image/jpeg,image/png,image/webp}'),
  ('payment-proofs', 'payment-proofs', false, 5242880, '{image/jpeg,image/png,image/webp,application/pdf}'),
  ('claims', 'claims', false, 5242880, '{image/jpeg,image/png,image/webp,application/pdf}')
on conflict (id) do nothing;

create policy "proofs: owner uploads in own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "proofs: owner or admin reads" on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "claims: owner uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'claims' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "claims: owner or admin reads" on storage.objects for select to authenticated
  using (bucket_id = 'claims' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "catalog: store members upload to their store folder" on storage.objects for insert to authenticated
  with check (bucket_id in ('catalog', 'stores') and (public.is_admin() or (
    (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and public.is_store_member(((storage.foldername(name))[1])::uuid))));
create policy "catalog: public read" on storage.objects for select using (bucket_id in ('catalog', 'stores'));

-- ===================== 20261009001100_function_privileges.sql =====================
-- =====================================================================
-- Function privileges. Postgres grants EXECUTE to PUBLIC by default and Supabase adds default
-- grants for anon/authenticated, so every internal helper would be callable through /rest/v1/rpc.
-- Internal helpers, trigger functions and job entry points are revoked here and reachable only from
-- other SECURITY DEFINER functions, the service role (edge functions, cron) or migrations.
-- A test (tests/db-tests/test/db/privileges.test.ts) keeps the exposed surface equal to an allowlist.
-- =====================================================================
do $$
declare
  r record;
  internal text[] := array[
    -- helpers used only inside SECURITY DEFINER functions
    '_group_label', '_order_payment_level', '_outstanding', '_plan_schedule', 'flow_for', 'commission_pct',
    'audit', 'check_rate_limit', 'notify', 'notify_store', 'require_store_member', 'require_admin', 'require_user',
    'is_service_role', 'setting',
    -- trigger functions
    'addresses_single_default', 'audit_trigger', 'enforce_product_moderation', 'guard_store_fields', 'handle_new_user',
    'ledger_group_balanced', 'ledger_immutable', 'notify_back_in_stock', 'products_search_vector',
    'sync_product_price', 'sync_product_stock_state', 'touch_updated_at',
    -- jobs and provider plumbing (service role only)
    'refresh_popularity', 'expire_unpaid_orders', 'record_provider_event', 'attach_provider_payment',
    'custom_access_token_hook'
  ];
begin
  for r in
    select p.oid::regprocedure as sig, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = any (internal)
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    if r.proname <> 'custom_access_token_hook' then
      execute format('grant execute on function %s to service_role', r.sig);
    end if;
  end loop;
end $$;


-- The catalog view is read-only for API roles (default privileges granted writes on it too).
revoke insert, update, delete, truncate on public.product_cards from anon, authenticated;

-- ===================== 20261009001200_admin_tools.sql =====================
-- Admin tools for the web panel: user lookup, role management, store membership by email and
-- processing of account deletion requests. Every function authorizes itself and writes to the audit log.

-- ---------- user directory (admins) ----------
create or replace function public.admin_users(p_query text default null, p_limit int default 50)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_q text := nullif(trim(coalesce(p_query, '')), '');
begin
  perform public.require_admin();
  return coalesce((
    select jsonb_agg(row_to_json(x) order by x.created_at desc)
      from (
        select u.id, u.email, p.full_name, p.phone, u.created_at, u.last_sign_in_at,
               (u.banned_until is not null and u.banned_until > now()) as blocked,
               coalesce((select array_agg(r.role::text order by r.role) from public.user_roles r where r.user_id = u.id), '{}') as roles,
               coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'role', m.role))
                           from public.store_members m join public.stores s on s.id = m.store_id where m.user_id = u.id), '[]'::jsonb) as stores,
               (select d.status from public.account_deletion_requests d where d.user_id = u.id order by d.requested_at desc limit 1) as deletion_status
          from auth.users u
          left join public.profiles p on p.id = u.id
         where v_q is null
            or u.email ilike '%' || v_q || '%'
            or p.full_name ilike '%' || v_q || '%'
            or u.id::text = v_q
         order by u.created_at desc
         limit least(greatest(coalesce(p_limit, 50), 1), 200)
      ) x), '[]'::jsonb);
end $$;

-- ---------- platform roles (superadmin only) ----------
create or replace function public.set_user_role(p_user_id uuid, p_role public.app_role, p_grant boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_superadmin() then
    raise exception 'superadmin required' using errcode = '42501', hint = 'superadmin_required';
  end if;
  if p_user_id = auth.uid() and not p_grant then
    raise exception 'you cannot remove your own roles' using errcode = 'P0001', hint = 'self_role_change';
  end if;
  if p_grant then
    insert into public.user_roles (user_id, role, granted_by) values (p_user_id, p_role, auth.uid())
    on conflict do nothing;
  else
    delete from public.user_roles where user_id = p_user_id and role = p_role;
  end if;
  perform public.audit(case when p_grant then 'grant_role' else 'revoke_role' end, 'user', p_user_id::text,
                       jsonb_build_object('role', p_role));
end $$;

-- ---------- store team (admins add people by e-mail) ----------
create or replace function public.add_store_member(p_store_id uuid, p_email text, p_role public.store_member_role default 'staff')
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare
  v_user uuid;
begin
  perform public.require_admin();
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'no account with that e-mail' using errcode = 'P0002', hint = 'user_not_found';
  end if;
  if not exists (select 1 from public.stores where id = p_store_id) then
    raise exception 'store not found' using errcode = 'P0002';
  end if;
  insert into public.store_members (store_id, user_id, role) values (p_store_id, v_user, coalesce(p_role, 'staff'))
  on conflict (store_id, user_id) do update set role = excluded.role;
  perform public.audit('add_member', 'store', p_store_id::text, jsonb_build_object('user_id', v_user, 'role', p_role));
  return v_user;
end $$;

-- ---------- account deletion ----------
-- Approving anonymizes personal data and blocks the login. Orders, payments and ledger entries are kept
-- because accounting and tax records must survive; their delivery addresses are reduced to region and city.
create or replace function public.process_account_deletion(p_request_id uuid, p_approve boolean, p_notes text default null)
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_req public.account_deletion_requests%rowtype;
begin
  perform public.require_admin();
  select * into v_req from public.account_deletion_requests where id = p_request_id for update;
  if not found then raise exception 'request not found' using errcode = 'P0002'; end if;
  if v_req.status not in ('requested', 'in_review') then
    raise exception 'request already processed' using errcode = 'P0001', hint = 'already_processed';
  end if;
  if not p_approve and coalesce(trim(p_notes), '') = '' then
    raise exception 'a note is required to decline' using errcode = '22023', hint = 'note_required';
  end if;
  if p_approve and exists (
      select 1 from public.orders o
       where o.buyer_id = v_req.user_id and o.status in ('placed', 'in_progress')) then
    raise exception 'the account has open orders' using errcode = 'P0001', hint = 'open_orders';
  end if;
  if p_approve and exists (select 1 from public.user_roles where user_id = v_req.user_id)
     or p_approve and exists (select 1 from public.store_members where user_id = v_req.user_id) then
    raise exception 'remove staff roles and store access first' using errcode = 'P0001', hint = 'has_roles';
  end if;

  if p_approve then
    update public.profiles
       set full_name = null, phone = null, avatar_path = null, preferences = '{}'::jsonb,
           personalization_enabled = false, marketing_opt_in = false
     where id = v_req.user_id;
    delete from public.addresses where user_id = v_req.user_id;
    delete from public.favorites where user_id = v_req.user_id;
    delete from public.stock_alerts where user_id = v_req.user_id;
    delete from public.user_events where user_id = v_req.user_id;
    delete from public.cart_items where user_id = v_req.user_id;
    delete from public.push_tokens where user_id = v_req.user_id;
    update public.orders
       set ship_to = jsonb_build_object('region_code', ship_to ->> 'region_code', 'city', ship_to ->> 'city', 'anonymized', true)
     where buyer_id = v_req.user_id;
    update public.fulfillments f
       set ship_to = jsonb_build_object('region_code', f.ship_to ->> 'region_code', 'city', f.ship_to ->> 'city', 'anonymized', true)
     where f.order_id in (select id from public.orders where buyer_id = v_req.user_id);
    update public.payments set payer_name = null, payer_phone = null where buyer_id = v_req.user_id;
    update auth.users
       set email = 'eliminado+' || id || '@example.invalid',
           phone = null,
           raw_user_meta_data = '{}'::jsonb,
           banned_until = 'infinity'
     where id = v_req.user_id;
    delete from auth.sessions where user_id = v_req.user_id;
    delete from auth.refresh_tokens where user_id = v_req.user_id::text;
  end if;

  update public.account_deletion_requests
     set status = case when p_approve then 'completed' else 'rejected' end,
         processed_at = now(), processed_by = auth.uid(), notes = p_notes
   where id = p_request_id;
  perform public.audit(case when p_approve then 'account_deleted' else 'deletion_declined' end, 'user', v_req.user_id::text,
                       jsonb_build_object('request_id', p_request_id));
end $$;

-- ===================== 20261009001300_catalog_authoring.sql =====================
-- Catalog authoring: slugs are generated in the database (sellers and admins never have to invent one),
-- and a reviewed URL import becomes a product in one transaction.

alter table public.url_imports alter column created_by set default auth.uid();

create or replace function public.slugify(p text) returns text language sql stable set search_path = public as $$
  select trim(both '-' from regexp_replace(lower(extensions.unaccent(coalesce(p, ''))), '[^a-z0-9]+', '-', 'g'))
$$;

-- Fills an empty slug from the title, unique within the store (checked across all of the store's products,
-- including ones the caller cannot see).
create or replace function public.fill_product_slug() returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_base text;
  v_slug text;
  n int := 1;
begin
  if coalesce(trim(new.slug), '') = '' then
    v_base := coalesce(nullif(left(public.slugify(new.title), 80), ''), 'producto');
    v_slug := v_base;
    while exists (select 1 from public.products where store_id = new.store_id and slug = v_slug) loop
      n := n + 1;
      v_slug := v_base || '-' || n;
    end loop;
    new.slug := v_slug;
  end if;
  return new;
end $$;
create trigger products_slug before insert on public.products for each row execute function public.fill_product_slug();

-- ---------- URL import -> product (admins) ----------
-- The route handler has already copied the images the admin confirmed into the catalog bucket. Each
-- image must carry rights_confirmed = true; the product always enters moderation as pending.
create or replace function public.publish_import(p_import_id uuid, p_product jsonb, p_variants jsonb default '[]'::jsonb, p_images jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_imp public.url_imports%rowtype;
  v_store uuid := (p_product ->> 'store_id')::uuid;
  v_price numeric := nullif(p_product ->> 'base_price_usd', '')::numeric;
  v_id uuid;
  v jsonb;
  n int := 0;
begin
  perform public.require_admin();
  select * into v_imp from public.url_imports where id = p_import_id for update;
  if not found then raise exception 'import not found' using errcode = 'P0002'; end if;
  if v_imp.status = 'published' then
    raise exception 'import already published' using errcode = 'P0001', hint = 'already_processed';
  end if;
  if v_price is null or v_price <= 0 or v_price <> round(v_price, 2) then
    raise exception 'invalid price' using errcode = '22023', hint = 'invalid_amount';
  end if;
  if exists (select 1 from jsonb_array_elements(p_images) i where coalesce((i ->> 'rights_confirmed')::boolean, false) is not true) then
    raise exception 'image rights must be confirmed' using errcode = '22023', hint = 'image_rights_required';
  end if;
  if exists (select 1 from jsonb_array_elements(p_images) i where (i ->> 'path') is null or (i ->> 'path') not like v_store::text || '/%') then
    raise exception 'images must live in the store folder' using errcode = '22023', hint = 'invalid_state';
  end if;

  insert into public.products (store_id, category_id, title, subtitle, description, origin, availability, moderation_status,
                               base_price_usd, compare_at_usd, weight_kg, source_url, source_provider)
  values (v_store, (p_product ->> 'category_id')::uuid, trim(p_product ->> 'title'), nullif(trim(p_product ->> 'subtitle'), ''),
          nullif(trim(p_product ->> 'description'), ''), 'import',
          coalesce(nullif(p_product ->> 'availability', '')::public.availability, 'on_order'), 'pending', v_price,
          nullif(p_product ->> 'compare_at_usd', '')::numeric, coalesce(nullif(p_product ->> 'weight_kg', '')::numeric, 0.5),
          v_imp.url, v_imp.provider)
  returning id into v_id;

  if jsonb_array_length(coalesce(p_variants, '[]'::jsonb)) = 0 then
    insert into public.product_variants (product_id, title, price_usd) values (v_id, 'Única', v_price);
  else
    for v in select * from jsonb_array_elements(p_variants) loop
      insert into public.product_variants (product_id, title, sku, price_usd, stock, sort)
      values (v_id, coalesce(nullif(trim(v ->> 'title'), ''), 'Única'), nullif(trim(v ->> 'sku'), ''),
              coalesce(nullif(v ->> 'price_usd', '')::numeric, v_price), nullif(v ->> 'stock', '')::int, n);
      n := n + 1;
    end loop;
  end if;

  n := 0;
  for v in select * from jsonb_array_elements(p_images) loop
    insert into public.product_images (product_id, path, alt, sort) values (v_id, v ->> 'path', nullif(v ->> 'alt', ''), n);
    n := n + 1;
  end loop;

  update public.url_imports set status = 'published', product_id = v_id where id = p_import_id;
  perform public.audit('publish_import', 'product', v_id::text,
                       jsonb_build_object('import_id', p_import_id, 'source_url', v_imp.url, 'images_rights_confirmed', jsonb_array_length(p_images)));
  return v_id;
end $$;

revoke execute on function public.fill_product_slug() from public, anon, authenticated;
revoke execute on function public.slugify(text) from public, anon, authenticated;
grant execute on function public.fill_product_slug() to service_role;
grant execute on function public.slugify(text) to service_role;

-- ===================== 20261009001400_config_guards.sql =====================
-- Guards for commercial configuration edited from the admin panel.

-- Deletions of tables keyed by something other than "id" (payment_methods.code, app_settings.key) were
-- audited without an entity id.
create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_id text;
  v_data jsonb;
begin
  if tg_op = 'DELETE' then
    v_id := (to_jsonb(old) ->> coalesce(tg_argv[0], 'id'));
    v_data := jsonb_build_object('old', to_jsonb(old));
  elsif tg_op = 'UPDATE' then
    v_id := (to_jsonb(new) ->> coalesce(tg_argv[0], 'id'));
    select jsonb_object_agg(n.key, jsonb_build_object('from', o.value, 'to', n.value))
      into v_data
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o using (key)
     where n.value is distinct from o.value and n.key not in ('updated_at', 'updated_by', 'search');
    if v_data is null then return new; end if;
  else
    v_id := (to_jsonb(new) ->> coalesce(tg_argv[0], 'id'));
    v_data := jsonb_build_object('new', to_jsonb(new));
  end if;
  perform public.audit(lower(tg_op), tg_table_name, v_id, v_data);
  return coalesce(new, old);
end $$;

-- ---------- payment methods ----------
-- integration_status says whether a provider integration has real credentials behind it. Only the
-- deployment (service role) changes it; admins can't flip a provider to "live" from the panel. An
-- automated method can only be offered while its integration is live or in sandbox, and a manual method
-- needs payment instructions (account, phone, address...) before buyers can see it.
create or replace function public.guard_payment_method() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_service_role() then
    if new.integration_status is distinct from old.integration_status then
      raise exception 'integration status is managed by the deployment' using errcode = '42501', hint = 'integration_managed';
    end if;
    new.code := old.code; new.kind := old.kind; new.rail := old.rail; new.currency := old.currency;
  end if;
  if new.enabled and not old.enabled then
    if new.kind = 'automated' and new.integration_status not in ('live', 'sandbox') then
      raise exception 'integration is not configured' using errcode = 'P0001', hint = 'integration_not_ready';
    end if;
    if new.kind = 'manual' and new.instructions = '{}'::jsonb then
      raise exception 'payment instructions are required' using errcode = '22023', hint = 'instructions_required';
    end if;
  end if;
  return new;
end $$;
create trigger payment_methods_guard before update on public.payment_methods for each row execute function public.guard_payment_method();

-- ---------- settings: who changed what (audited since the foundation migration) ----------
create or replace function public.touch_setting() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
create trigger app_settings_touch before update on public.app_settings for each row execute function public.touch_setting();

create trigger shipping_rates_audit after insert or update or delete on public.shipping_rates for each row execute function public.audit_trigger();

revoke execute on function public.guard_payment_method() from public, anon, authenticated;
revoke execute on function public.touch_setting() from public, anon, authenticated;
grant execute on function public.guard_payment_method() to service_role;
grant execute on function public.touch_setting() to service_role;

-- ===================== 20261009001500_seller_tools.sql =====================
-- Seller panel reads. Sellers can't read orders (they belong to the buyer), so these functions return
-- only what a store needs to prepare and account for its own deliveries: the order number, whether the
-- payment that unlocks shipping is confirmed, the delivery address and the store's own lines.

create or replace function public.seller_fulfillments(p_store_id uuid, p_scope text default 'open')
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_store_member(p_store_id);
  return coalesce((
    select jsonb_agg(x order by x.placed_at desc)
      from (
        select f.id, f.order_id, f.seq, f.store_id, f.flow, f.status, f.shipping_method_name, f.shipping_kind, f.shipping_usd,
               f.eta_min_date, f.eta_max_date, f.carrier_name, f.tracking_number, f.cargo_batch_id, f.delivered_at, f.created_at, f.ship_to,
               o.number as order_number, o.placed_at, o.status as order_status,
               public._order_payment_level(o.id) as payment_level,
               (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'title', i.title, 'variant_title', i.variant_title, 'image_path', i.image_path,
                                                             'quantity', i.quantity, 'refunded_qty', i.refunded_qty, 'unit_price_usd', i.unit_price_usd,
                                                             'line_total_usd', i.line_total_usd, 'commission_usd', i.commission_usd) order by i.title), '[]')
                  from public.order_items i where i.fulfillment_id = f.id) as items,
               (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'step_code', e.step_code, 'note', e.note, 'source', e.source,
                                                             'visible_to_buyer', e.visible_to_buyer, 'created_at', e.created_at) order by e.id), '[]')
                  from public.fulfillment_events e where e.fulfillment_id = f.id) as fulfillment_events
          from public.fulfillments f
          join public.orders o on o.id = f.order_id
         where f.store_id = p_store_id
           and case coalesce(p_scope, 'open')
                 when 'open' then f.status not in ('delivered', 'cancelled') and o.status <> 'cancelled'
                 when 'done' then (f.status in ('delivered', 'cancelled') or o.status = 'cancelled') and f.created_at > now() - interval '180 days'
                 else true end
         order by o.placed_at desc
         limit 200
      ) x), '[]'::jsonb);
end $$;

-- Sales ledger for the store: one row per line, with the commission fixed when the order was placed.
create or replace function public.seller_sales(p_store_id uuid, p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_store_member(p_store_id);
  return coalesce((
    select jsonb_agg(x order by x.placed_at desc)
      from (
        select i.id, o.number as order_number, o.placed_at, o.status as order_status, o.payment_status, f.status as fulfillment_status, f.flow,
               i.title, i.variant_title, i.quantity, i.refunded_qty, i.unit_price_usd, i.line_total_usd, i.refunded_usd,
               i.commission_pct, i.commission_usd,
               (i.line_total_usd - i.refunded_usd - i.commission_usd) as net_usd
          from public.order_items i
          join public.orders o on o.id = i.order_id
          join public.fulfillments f on f.id = i.fulfillment_id
         where i.store_id = p_store_id
           and o.placed_at > now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 366))
         order by o.placed_at desc
         limit 500
      ) x), '[]'::jsonb);
end $$;

-- Sellers manage only rates for deliveries they ship themselves, and those are real rates.
drop policy if exists rates_seller on public.shipping_rates;
create policy rates_seller on public.shipping_rates for all
  using (store_id is not null and public.is_store_member(store_id))
  with check (store_id is not null and public.is_store_member(store_id) and flows <@ '{seller_shipping}'::public.fulfillment_flow[] and not is_demo);

-- ===================== 20261009001600_server_functions.sql =====================
-- Plumbing for the edge functions in supabase/functions (payments-start, provider webhooks, push-dispatch,
-- rates-sync) and the scheduled jobs. Everything here is service-role only.

-- ---------- provider payments ----------
-- Where the buyer finishes paying (PayPal approval page / Binance Pay checkout). Kept so a retried
-- "Pagar" returns the same checkout instead of opening a second provider order.
alter table public.payments add column if not exists provider_checkout_url text;

drop function if exists public.attach_provider_payment(uuid, text);
create or replace function public.attach_provider_payment(p_payment_id uuid, p_provider_payment_id text, p_checkout_url text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.payments
     set provider_payment_id = p_provider_payment_id, provider_checkout_url = coalesce(p_checkout_url, provider_checkout_url)
   where id = p_payment_id and status = 'processing';
end $$;

-- The provider refused to create the order (bad credentials, limits, outage). The payment never reached the
-- provider, so it fails cleanly and the buyer can quote again; nothing is credited.
create or replace function public.fail_provider_start(p_payment_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.payments set status = 'failed', rejection_reason = left(coalesce(p_reason, 'provider error'), 300)
   where id = p_payment_id and status = 'processing' and provider_payment_id is null;
end $$;

-- An event with an invalid signature is stored for the audit trail under a synthetic id, so a forged event
-- can never occupy the id of the genuine one (the unique key would otherwise turn the real event into a
-- "duplicate"). The edge functions reject unsigned events before reaching this point; this is the second line.
create or replace function public.record_provider_event(
  p_provider text, p_event_id text, p_event_type text, p_provider_payment_id text, p_outcome text,
  p_amount numeric, p_currency text, p_signature_valid boolean, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_event_id bigint; v_p public.payments;
begin
  if not public.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not p_signature_valid then
    insert into public.payment_events (provider, provider_event_id, event_type, signature_valid, payload, processed, error)
    values (p_provider, 'unsigned:' || coalesce(p_event_id, '') || ':' || gen_random_uuid(), coalesce(p_event_type, ''), false,
            coalesce(p_payload, '{}'::jsonb), true, 'invalid signature');
    return jsonb_build_object('status', 'rejected_signature');
  end if;
  insert into public.payment_events (provider, provider_event_id, event_type, signature_valid, payload)
  values (p_provider, p_event_id, p_event_type, true, p_payload)
  on conflict (provider, provider_event_id) do nothing
  returning id into v_event_id;
  if v_event_id is null then return jsonb_build_object('status', 'duplicate'); end if;
  select * into v_p from public.payments where provider = p_provider and provider_payment_id = p_provider_payment_id for update;
  if not found then
    update public.payment_events set error = 'unknown payment' where id = v_event_id;
    return jsonb_build_object('status', 'unknown_payment');
  end if;
  update public.payment_events set payment_id = v_p.id where id = v_event_id;
  if p_outcome = 'succeeded' then
    if v_p.status = 'failed' then
      -- money arrived after the attempt was cancelled or timed out: never lost, never auto-credited twice
      update public.payments set status = 'pending_verification', amount_received = p_amount,
             rejection_reason = 'Pago confirmado por el proveedor después de cancelar o vencer el intento: revisar.'
       where id = v_p.id;
      update public.payment_events set processed = true, error = 'late success: manual review' where id = v_event_id;
      return jsonb_build_object('status', 'needs_review');
    end if;
    if v_p.status <> 'processing' then
      update public.payment_events set processed = true, error = 'payment not processing' where id = v_event_id;
      return jsonb_build_object('status', 'ignored');
    end if;
    if p_currency is distinct from v_p.currency or p_amount is null or p_amount < v_p.amount then
      update public.payments set status = 'pending_verification', amount_received = p_amount where id = v_p.id;
      update public.payment_events set processed = true, error = 'amount/currency mismatch: manual review' where id = v_event_id;
      return jsonb_build_object('status', 'needs_review');
    end if;
    update public.payments set amount_received = p_amount where id = v_p.id;
    perform public._apply_payment(v_p.id, v_p.base_usd, v_p.fee_usd, p_provider || ' event ' || p_event_id);
  elsif p_outcome in ('failed', 'cancelled', 'expired') then
    update public.payments set status = 'failed', rejection_reason = p_event_type where id = v_p.id and status = 'processing';
  end if;
  update public.payment_events set processed = true where id = v_event_id;
  return jsonb_build_object('status', 'processed');
end $$;

-- The buyer gives up on an online attempt (closed the provider page, wants another method). If the provider
-- still confirms it later, record_provider_event sends it to manual review instead of losing it.
create or replace function public.cancel_provider_payment(p_payment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := public.require_user();
begin
  update public.payments set status = 'failed', rejection_reason = 'Intento en línea cancelado por el comprador'
   where id = p_payment_id and buyer_id = v_user and status = 'processing' and provider is not null;
  if not found then raise exception 'payment not cancellable' using errcode = 'P0001', hint = 'invalid_state'; end if;
end $$;

insert into public.app_settings (key, value, description, is_public) values
  ('payments.provider_expiry_minutes', '180', 'Minutos que un pago en línea (Binance Pay, PayPal) espera la confirmación del proveedor antes de liberar el pedido', false)
on conflict (key) do nothing;

-- Online attempts nobody confirmed (buyer abandoned the provider page) stop blocking the order after
-- payments.provider_expiry_minutes; unpaid orders then expire as before.
create or replace function public.expire_unpaid_orders() returns int
language plpgsql security definer set search_path = public as $$
declare v_o record; v_n int := 0; v_hours int := (public.setting('orders.unpaid_expiry_hours', '48'))::int;
        v_provider_minutes int := (public.setting('payments.provider_expiry_minutes', '180'))::int;
begin
  if not public.is_service_role() and not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.payments set status = 'failed', rejection_reason = 'Sin confirmación del proveedor a tiempo'
   where status = 'processing' and provider is not null and created_at < now() - make_interval(mins => v_provider_minutes);
  for v_o in select o.id from public.orders o
              where o.status = 'placed' and o.payment_status = 'unpaid' and o.placed_at < now() - make_interval(hours => v_hours)
                and not exists (select 1 from public.payments p where p.order_id = o.id and p.status in ('pending_verification', 'processing'))
  loop
    perform public.cancel_order(v_o.id, 'Sin pago dentro de ' || v_hours || ' horas');
    v_n := v_n + 1;
  end loop;
  update public.payment_quotes set status = 'expired' where status = 'open' and expires_at < now();
  return v_n;
end $$;

-- ---------- push notifications ----------
-- 'sending' marks a batch claimed by one dispatcher, so two runs never push the same notification twice.
alter table public.notifications drop constraint if exists notifications_push_status_check;
alter table public.notifications add constraint notifications_push_status_check
  check (push_status in ('pending', 'sending', 'sent', 'skipped', 'failed'));
alter table public.notifications
  add column if not exists push_attempts int not null default 0,
  add column if not exists push_claimed_at timestamptz,
  add column if not exists push_error text;

-- Returns up to p_limit notifications with their device tokens and marks them 'sending'. Test notifications
-- are never pushed, and a notification older than a day is skipped: a late "tu pedido salió" is misleading.
create or replace function public.claim_push_batch(p_limit int default 100, p_ids uuid[] default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_out jsonb;
begin
  if not public.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.notifications set push_status = 'skipped', push_error = 'test notification'
   where push_status = 'pending' and is_test and (p_ids is null or id = any (p_ids));
  update public.notifications set push_status = 'skipped', push_error = 'expired before delivery'
   where push_status in ('pending', 'sending') and created_at < now() - interval '24 hours' and (p_ids is null or id = any (p_ids));
  with c as (
    select id from public.notifications
     where not is_test and push_attempts < 3
       and (push_status = 'pending' or (push_status = 'sending' and push_claimed_at < now() - interval '10 minutes'))
       and (p_ids is null or id = any (p_ids))
     order by created_at
     limit least(greatest(coalesce(p_limit, 100), 1), 500)
     for update skip locked
  ), u as (
    update public.notifications n
       set push_status = 'sending', push_claimed_at = now(), push_attempts = n.push_attempts + 1
      from c where n.id = c.id
    returning n.id, n.user_id, n.kind, n.title, n.body, n.data
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', u.id, 'kind', u.kind, 'title', u.title, 'body', u.body, 'data', u.data,
           'tokens', (select coalesce(jsonb_agg(t.token), '[]'::jsonb) from public.push_tokens t where t.user_id = u.user_id))), '[]'::jsonb)
    into v_out from u;
  return v_out;
end $$;

-- p_results: [{ "id": uuid, "status": "sent" | "skipped" | "failed" | "retry", "error": text }]. Tokens Expo reports as
-- no longer registered are removed so they are not tried again.
create or replace function public.complete_push(p_results jsonb, p_dead_tokens text[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.notifications n
     set push_status = case r.status when 'sent' then 'sent'
                                     when 'skipped' then 'skipped'
                                     when 'retry' then case when n.push_attempts < 3 then 'pending' else 'failed' end
                                     else 'failed' end,
         push_error = left(r.error, 300)
    from jsonb_to_recordset(coalesce(p_results, '[]'::jsonb)) as r(id uuid, status text, error text)
   where n.id = r.id and n.push_status = 'sending';
  delete from public.push_tokens where token = any (coalesce(p_dead_tokens, '{}'));
end $$;

-- ---------- scheduled jobs ----------
-- Calls an edge function with the service role key kept in Supabase Vault. Missing secrets make it a
-- no-op with a notice (a fresh project keeps working until an operator stores them).
create or replace function public.invoke_edge_function(p_name text, p_body jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_url text; v_key text;
begin
  if not public.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_name !~ '^[a-z0-9-]{1,40}$' then raise exception 'invalid function name' using errcode = '22023'; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'kora_project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'kora_service_role_key';
  if v_url is null or v_key is null then
    raise notice 'edge function % not called: vault secrets kora_project_url / kora_service_role_key are missing', p_name;
    return null;
  end if;
  return net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/' || p_name,
    headers := jsonb_build_object('content-type', 'application/json', 'authorization', 'Bearer ' || v_key),
    body := coalesce(p_body, '{}'::jsonb),
    timeout_milliseconds := 30000);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'expire_unpaid_orders()', 'attach_provider_payment(uuid, text, text)', 'fail_provider_start(uuid, text)',
    'record_provider_event(text, text, text, text, text, numeric, text, boolean, jsonb)',
    'claim_push_batch(int, uuid[])', 'complete_push(jsonb, text[])', 'invoke_edge_function(text, jsonb)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- pg_cron + pg_net exist on hosted Supabase (enable them in Database > Extensions if this notice appears).
-- Local Postgres without them skips scheduling; the jobs can still be run by hand.
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron')
     or not exists (select 1 from pg_available_extensions where name = 'pg_net') then
    raise notice 'pg_cron/pg_net not available: scheduled jobs not created';
    return;
  end if;
  create extension if not exists pg_cron;
  create extension if not exists pg_net with schema extensions;
  perform cron.schedule('kora-expire-unpaid-orders', '*/10 * * * *', 'select public.expire_unpaid_orders()');
  perform cron.schedule('kora-refresh-popularity', '17 * * * *', 'select public.refresh_popularity()');
  perform cron.schedule('kora-rates-sync', '*/30 * * * *', $job$select public.invoke_edge_function('rates-sync')$job$);
  perform cron.schedule('kora-push-dispatch', '* * * * *', $job$select public.invoke_edge_function('push-dispatch')$job$);
end $$;

-- ===================== 20261009001700_reviews_engagement.sql =====================
-- =====================================================================
-- Reviews from verified purchases, store profiles, installment reminders and
-- recommendation measurement.
--   * A review exists only for a delivered order item, written by its buyer.
--     Ratings shown on products and stores are aggregates of published reviews.
--   * Installment reminders: one notice a few days before the due date and one
--     after it, never repeated, never for demo orders.
--   * Recommendation impressions and clicks per slot, so ranking changes can be
--     measured (CTR, add to cart and purchases after a click).
-- =====================================================================

-- ---------- demo data stays recognizable ----------
-- Orders placed by demo accounts are demo orders, whatever path created them.
create or replace function public.flag_demo_order() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.is_demo := new.is_demo or coalesce((select is_demo from public.profiles where id = new.buyer_id), false);
  return new;
end $$;
create trigger orders_flag_demo before insert on public.orders for each row execute function public.flag_demo_order();
update public.orders o set is_demo = true from public.profiles p where p.id = o.buyer_id and p.is_demo and not o.is_demo;

-- ---------- reviews ----------
alter table public.products add column rating_avg numeric(3, 2), add column rating_count integer not null default 0;

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null unique references public.order_items (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text check (body is null or char_length(body) between 1 and 1000),
  status text not null default 'published' check (status in ('published', 'hidden')),
  hidden_reason text check (hidden_reason is null or char_length(hidden_reason) <= 300),
  reply_body text check (reply_body is null or char_length(reply_body) between 1 and 1000),
  reply_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reviews_product_idx on public.reviews (product_id, created_at desc) where status = 'published';
create index reviews_store_idx on public.reviews (store_id, created_at desc);
create index reviews_user_idx on public.reviews (user_id);
create trigger reviews_touch before update on public.reviews for each row execute function public.touch_updated_at();

alter table public.reviews enable row level security;
-- written only through submit_review / reply_review / moderate_review
create policy reviews_read on public.reviews for select
  using (status = 'published' or user_id = auth.uid() or public.is_admin() or public.is_store_member(store_id));

create or replace function public._refresh_ratings(p_product uuid, p_store uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.products p set
    rating_count = x.n, rating_avg = case when x.n > 0 then round(x.avg, 2) end
  from (select count(*) n, avg(rating) avg from public.reviews where product_id = p_product and status = 'published') x
  where p.id = p_product;
  update public.stores s set
    rating_count = x.n, rating_avg = case when x.n > 0 then round(x.avg, 2) end
  from (select count(*) n, avg(rating) avg from public.reviews where store_id = p_store and status = 'published') x
  where s.id = p_store;
end $$;

-- Ratings are derived data. Whoever updates a product or store (a seller editing a listing, a buyer's review
-- refreshing the aggregate), the stored rating is recomputed from published reviews, so it can never be forged.
create or replace function public.guard_rating_fields() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_n int; v_avg numeric;
begin
  if tg_op = 'INSERT' then
    new.rating_count := 0;
    new.rating_avg := null;
    return new;
  end if;
  if (new.rating_avg, new.rating_count) is not distinct from (old.rating_avg, old.rating_count) then
    return new;
  end if;
  if tg_table_name = 'products' then
    select count(*), round(avg(rating), 2) into v_n, v_avg from public.reviews where product_id = new.id and status = 'published';
  else
    select count(*), round(avg(rating), 2) into v_n, v_avg from public.reviews where store_id = new.id and status = 'published';
  end if;
  new.rating_count := v_n;
  new.rating_avg := v_avg;
  return new;
end $$;
create trigger products_rating_guard before insert or update on public.products for each row execute function public.guard_rating_fields();
create trigger stores_rating_guard before insert or update on public.stores for each row execute function public.guard_rating_fields();

-- the store guard no longer freezes ratings (the trigger above owns them); everything else is unchanged
create or replace function public.guard_store_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.is_service_role()) then
    new.status := old.status; new.kind := old.kind; new.slug := old.slug; new.is_demo := old.is_demo;
  end if;
  return new;
end $$;

-- rating refreshes are routine, not changes worth an audit entry
create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_id text;
  v_data jsonb;
begin
  if tg_op = 'DELETE' then
    v_id := (to_jsonb(old) ->> 'id');
    v_data := jsonb_build_object('old', to_jsonb(old));
  elsif tg_op = 'UPDATE' then
    v_id := (to_jsonb(new) ->> coalesce(tg_argv[0], 'id'));
    select jsonb_object_agg(n.key, jsonb_build_object('from', o.value, 'to', n.value))
      into v_data
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o using (key)
     where n.value is distinct from o.value and n.key not in ('updated_at', 'search', 'rating_avg', 'rating_count');
    if v_data is null then return new; end if;
  else
    v_id := (to_jsonb(new) ->> coalesce(tg_argv[0], 'id'));
    v_data := jsonb_build_object('new', to_jsonb(new));
  end if;
  perform public.audit(lower(tg_op), tg_table_name, v_id, v_data);
  return coalesce(new, old);
end $$;

/** "Ana Pérez" -> "Ana P." so reviews show a person without exposing a full name. */
create or replace function public._public_name(p_full text) returns text
language sql immutable set search_path = public as $$
  select case
    when p_full is null or btrim(p_full) = '' then 'Comprador verificado'
    when position(' ' in btrim(p_full)) = 0 then initcap(btrim(p_full))
    else initcap(split_part(btrim(p_full), ' ', 1)) || ' ' || upper(left(split_part(btrim(p_full), ' ', 2), 1)) || '.'
  end
$$;

create or replace function public.submit_review(p_order_item_id uuid, p_rating int, p_body text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := public.require_user();
  v_item record;
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_review public.reviews;
begin
  perform public.check_rate_limit('review', 30, 3600);
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'rating must be 1..5' using errcode = 'P0001', hint = 'invalid_input';
  end if;
  if v_body is not null and char_length(v_body) > 1000 then
    raise exception 'review too long' using errcode = 'P0001', hint = 'invalid_input';
  end if;

  select i.id, i.product_id, i.store_id, o.buyer_id, o.is_demo, f.status, f.delivered_at
    into v_item
    from public.order_items i
    join public.orders o on o.id = i.order_id
    join public.fulfillments f on f.id = i.fulfillment_id
   where i.id = p_order_item_id;
  if not found or v_item.buyer_id <> v_user then
    raise exception 'order item not found' using errcode = 'P0001', hint = 'not_found';
  end if;
  if v_item.status <> 'delivered' and v_item.delivered_at is null then
    raise exception 'only delivered purchases can be reviewed' using errcode = 'P0001', hint = 'not_reviewable';
  end if;

  insert into public.reviews (order_item_id, product_id, store_id, user_id, rating, body, is_demo)
  values (v_item.id, v_item.product_id, v_item.store_id, v_user, p_rating, v_body, v_item.is_demo)
  on conflict (order_item_id) do update
     set rating = excluded.rating, body = excluded.body
   where reviews.user_id = v_user and reviews.created_at > now() - interval '60 days'
  returning * into v_review;
  if v_review.id is null then
    raise exception 'review can no longer be edited' using errcode = 'P0001', hint = 'review_locked';
  end if;

  perform public._refresh_ratings(v_item.product_id, v_item.store_id);
  return to_jsonb(v_review);
end $$;

create or replace function public.reply_review(p_review_id uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_review public.reviews;
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
begin
  select * into v_review from public.reviews where id = p_review_id;
  if not found then
    raise exception 'review not found' using errcode = 'P0001', hint = 'not_found';
  end if;
  perform public.require_store_member(v_review.store_id);
  if v_body is null or char_length(v_body) > 1000 then
    raise exception 'reply must be 1..1000 characters' using errcode = 'P0001', hint = 'invalid_input';
  end if;
  update public.reviews set reply_body = v_body, reply_at = now() where id = p_review_id returning * into v_review;
  perform public.audit('review.reply', 'reviews', p_review_id::text, jsonb_build_object('store_id', v_review.store_id));
  if v_review.status = 'published' then
    perform public.notify(v_review.user_id, 'system', 'La tienda respondió tu opinión',
      left(v_body, 140), jsonb_build_object('product_id', v_review.product_id, 'review_id', v_review.id));
  end if;
  return to_jsonb(v_review);
end $$;

create or replace function public.moderate_review(p_review_id uuid, p_hide boolean, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_review public.reviews;
begin
  perform public.require_admin();
  if p_hide and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'a reason is required to hide a review' using errcode = 'P0001', hint = 'invalid_input';
  end if;
  update public.reviews
     set status = case when p_hide then 'hidden' else 'published' end,
         hidden_reason = case when p_hide then btrim(p_reason) end
   where id = p_review_id
  returning * into v_review;
  if not found then
    raise exception 'review not found' using errcode = 'P0001', hint = 'not_found';
  end if;
  perform public._refresh_ratings(v_review.product_id, v_review.store_id);
  perform public.audit(case when p_hide then 'review.hide' else 'review.publish' end, 'reviews', p_review_id::text,
    jsonb_build_object('reason', p_reason));
  return to_jsonb(v_review);
end $$;

/** Published reviews of a product with a summary (average, count, distribution). */
create or replace function public.product_reviews(p_product_id uuid, p_limit int default 10, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  return jsonb_build_object(
    'summary', (select jsonb_build_object(
                  'count', count(*),
                  'avg', round(avg(rating), 2),
                  'distribution', jsonb_build_object(
                     '5', count(*) filter (where rating = 5), '4', count(*) filter (where rating = 4),
                     '3', count(*) filter (where rating = 3), '2', count(*) filter (where rating = 2),
                     '1', count(*) filter (where rating = 1)))
                  from public.reviews where product_id = p_product_id and status = 'published'),
    'items', coalesce((select jsonb_agg(x order by x.created_at desc) from (
                select r.id, r.rating, r.body, r.created_at, r.reply_body, r.reply_at, r.is_demo,
                       public._public_name(pr.full_name) as author, i.variant_title,
                       coalesce(r.user_id = auth.uid(), false) as mine
                  from public.reviews r
                  join public.order_items i on i.id = r.order_item_id
                  left join public.profiles pr on pr.id = r.user_id
                 where r.product_id = p_product_id and r.status = 'published'
                 order by r.created_at desc
                 limit least(greatest(coalesce(p_limit, 10), 1), 50) offset greatest(coalesce(p_offset, 0), 0)) x), '[]'::jsonb)
  );
end $$;

-- cards carry the rating aggregate (columns appended, so functions returning setof product_cards keep working)
create or replace view public.product_cards with (security_invoker = true) as
select p.id, p.slug, p.title, p.subtitle, p.store_id,
       s.name as store_name, s.slug as store_slug, s.kind as store_kind,
       p.category_id, c.slug as category_slug, c.name as category_name, c.tone,
       b.name as brand_name, p.availability, p.origin,
       p.base_price_usd as price_usd, p.compare_at_usd,
       (select i.path from public.product_images i where i.product_id = p.id order by i.sort limit 1) as image_path,
       (select sum(v.stock) from public.product_variants v where v.product_id = p.id and v.active) as stock_total,
       lt.min_days as lead_min_days, lt.max_days as lead_max_days,
       p.popularity, p.published_at, p.is_demo, p.moderation_status, s.status as store_status,
       p.rating_avg, p.rating_count
  from public.products p
  join public.stores s on s.id = p.store_id
  join public.categories c on c.id = p.category_id
  left join public.brands b on b.id = p.brand_id
  left join lateral public.lead_time(p.id) lt(min_days, max_days) on true;
revoke insert, update, delete, truncate on public.product_cards from anon, authenticated;

-- ---------- store profile ----------
/** Public store page data: profile, categories it sells in, rating summary and latest reviews. */
create or replace function public.store_profile(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_store public.stores;
begin
  select * into v_store from public.stores where slug = p_slug;
  if not found or (v_store.status <> 'active' and not (public.is_admin() or public.is_store_member(v_store.id))) then
    return null;
  end if;
  return jsonb_build_object(
    'id', v_store.id, 'slug', v_store.slug, 'name', v_store.name, 'tagline', v_store.tagline,
    'description', v_store.description, 'logo_path', v_store.logo_path, 'cover_path', v_store.cover_path,
    'accent', v_store.accent, 'kind', v_store.kind, 'status', v_store.status, 'shipping_info', v_store.shipping_info,
    'policies', v_store.policies, 'rating_avg', v_store.rating_avg, 'rating_count', v_store.rating_count,
    'is_demo', v_store.is_demo, 'since', v_store.created_at,
    'product_count', (select count(*) from public.products p
                       where p.store_id = v_store.id and p.moderation_status = 'published'),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('slug', x.slug, 'name', x.name, 'count', x.n) order by x.n desc, x.name)
                     from (select top.slug, top.name, count(*) n
                             from public.products p
                             join public.categories c on c.id = p.category_id
                             join public.categories top on top.id = coalesce(c.parent_id, c.id)
                            where p.store_id = v_store.id and p.moderation_status = 'published'
                            group by top.slug, top.name) x), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(x order by x.created_at desc) from (
                  select r.id, r.rating, r.body, r.created_at, public._public_name(pr.full_name) as author, p.title as product_title
                    from public.reviews r
                    join public.products p on p.id = r.product_id
                    left join public.profiles pr on pr.id = r.user_id
                   where r.store_id = v_store.id and r.status = 'published' and r.body is not null
                   order by r.created_at desc limit 3) x), '[]'::jsonb)
  );
end $$;

-- ---------- installment reminders ----------
alter table public.payment_obligations add column reminded_stage smallint not null default 0
  check (reminded_stage between 0 and 2);

insert into public.app_settings (key, value, description)
values ('payments.reminder_days_before', '3'::jsonb, 'Días antes del vencimiento en que se avisa de una cuota pendiente.')
on conflict (key) do nothing;

/**
 * Daily job: one reminder a few days before an installment is due and one when it is overdue.
 * Demo orders are skipped so test data never produces notices that look like real debts.
 */
create or replace function public.remind_installments() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_days int := coalesce((public.setting('payments.reminder_days_before', '3'::jsonb))::text::int, 3);
  r record;
  v_sent int := 0;
  v_left numeric;
begin
  if not public.is_service_role() then
    raise exception 'service role only' using errcode = '42501';
  end if;
  for r in
    select ob.id, ob.seq, ob.amount_usd, ob.paid_usd, ob.waived_usd, ob.due_date, ob.reminded_stage, o.id as order_id, o.number, o.buyer_id,
           (select count(*) from public.payment_obligations x where x.order_id = o.id) as total_parts
      from public.payment_obligations ob
      join public.orders o on o.id = ob.order_id
     where ob.status in ('pending', 'partially_paid')
       and ob.due_date is not null
       and ob.seq > 1
       and not o.is_demo
       and o.status in ('placed', 'in_progress')
       and ((ob.reminded_stage < 1 and ob.due_date between current_date and current_date + v_days)
         or (ob.reminded_stage < 2 and ob.due_date < current_date))
     for update of ob skip locked
  loop
    v_left := r.amount_usd - r.paid_usd - r.waived_usd;
    if r.due_date < current_date then
      perform public.notify(r.buyer_id, 'installment_due', 'Tienes una cuota vencida',
        format('La cuota %s de %s del pedido %s venció el %s. Saldo: %s. Puedes pagarla desde el pedido.',
               r.seq, r.total_parts, r.number, to_char(r.due_date, 'DD/MM'), public._fmt_usd(v_left)),
        jsonb_build_object('order_id', r.order_id, 'obligation_id', r.id));
      update public.payment_obligations set reminded_stage = 2 where id = r.id;
    else
      perform public.notify(r.buyer_id, 'installment_due', 'Tu próxima cuota vence pronto',
        format('La cuota %s de %s del pedido %s vence el %s: %s.',
               r.seq, r.total_parts, r.number, to_char(r.due_date, 'DD/MM'), public._fmt_usd(v_left)),
        jsonb_build_object('order_id', r.order_id, 'obligation_id', r.id));
      update public.payment_obligations set reminded_stage = 1 where id = r.id;
    end if;
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end $$;

-- ---------- recommendation measurement ----------
create table public.rec_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  slot text not null check (slot ~ '^[a-z0-9_:-]{2,60}$'),
  kind text not null check (kind in ('impression', 'click')),
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index rec_events_slot_idx on public.rec_events (slot, kind, created_at desc);
create index rec_events_user_idx on public.rec_events (user_id, product_id, created_at desc);
alter table public.rec_events enable row level security;
create policy rec_events_read on public.rec_events for select using (user_id = auth.uid() or public.is_admin());
create policy rec_events_delete_own on public.rec_events for delete using (user_id = auth.uid());

/** Batched impressions or a click from a recommendation slot. Best effort; honors the personalization switch. */
create or replace function public.track_recommendation(p_slot text, p_kind text, p_product_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null or p_product_ids is null or cardinality(p_product_ids) = 0 then return; end if;
  if not coalesce((select personalization_enabled from public.profiles where id = v_user), true) then return; end if;
  if p_kind not in ('impression', 'click') or p_slot !~ '^[a-z0-9_:-]{2,60}$' or cardinality(p_product_ids) > 40 then
    raise exception 'invalid recommendation event' using errcode = 'P0001', hint = 'invalid_input';
  end if;
  perform public.check_rate_limit('rec', 240, 60);
  -- an impression counts once per user, slot and product per hour so re-renders do not inflate it
  insert into public.rec_events (user_id, slot, kind, product_id)
  select v_user, p_slot, p_kind, pid
    from unnest(p_product_ids) pid
   where exists (select 1 from public.products where id = pid)
     and (p_kind = 'click' or not exists (
           select 1 from public.rec_events e
            where e.user_id = v_user and e.slot = p_slot and e.kind = 'impression' and e.product_id = pid
              and e.created_at > now() - interval '1 hour'));
end $$;

/** Per slot: impressions, clicks, CTR, and add-to-cart / purchases within 7 days after a click. */
create or replace function public.recommendation_metrics(p_days int default 14) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_from timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 14), 1), 90));
begin
  perform public.require_admin();
  return jsonb_build_object(
    'from', v_from,
    'ranking', public.setting('ranking', '{}'::jsonb),
    -- events from demo accounts are measured too, so the panel can say how much of the sample is not real traffic
    'events', (select count(*) from public.rec_events e where e.created_at >= v_from),
    'demo_events', (select count(*) from public.rec_events e join public.profiles pr on pr.id = e.user_id
                     where e.created_at >= v_from and pr.is_demo),
    'slots', coalesce((select jsonb_agg(x order by x.impressions desc) from (
      select e.slot,
             count(*) filter (where e.kind = 'impression') as impressions,
             count(*) filter (where e.kind = 'click') as clicks,
             case when count(*) filter (where e.kind = 'impression') > 0
                  then round(100.0 * count(*) filter (where e.kind = 'click') / count(*) filter (where e.kind = 'impression'), 2) end as ctr_pct,
             count(distinct e.user_id) as users,
             (select count(distinct (c.user_id, c.product_id)) from public.rec_events c
               where c.slot = e.slot and c.kind = 'click' and c.created_at >= v_from
                 and exists (select 1 from public.user_events u where u.user_id = c.user_id and u.product_id = c.product_id
                              and u.kind = 'add_to_cart' and u.created_at between c.created_at and c.created_at + interval '7 days')) as added_to_cart,
             (select count(distinct (c.user_id, c.product_id)) from public.rec_events c
               where c.slot = e.slot and c.kind = 'click' and c.created_at >= v_from
                 and exists (select 1 from public.order_items i join public.orders o on o.id = i.order_id
                              where o.buyer_id = c.user_id and i.product_id = c.product_id and o.status <> 'cancelled'
                                and o.placed_at between c.created_at and c.created_at + interval '7 days')) as purchased
        from public.rec_events e
       where e.created_at >= v_from
       group by e.slot) x), '[]'::jsonb),
    'top_clicked', coalesce((select jsonb_agg(x order by x.clicks desc) from (
      select p.id, p.title, count(*) as clicks
        from public.rec_events e join public.products p on p.id = e.product_id
       where e.kind = 'click' and e.created_at >= v_from
       group by p.id, p.title order by count(*) desc limit 10) x), '[]'::jsonb)
  );
end $$;

-- ---------- retention of behavioral data ----------
insert into public.app_settings (key, value, description)
values ('privacy.event_retention_days', '180'::jsonb, 'Días que se conservan las señales de navegación y de recomendaciones.')
on conflict (key) do nothing;

create or replace function public.prune_activity() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_days int := greatest(coalesce((public.setting('privacy.event_retention_days', '180'::jsonb))::text::int, 180), 30);
  v_a int; v_b int;
begin
  if not public.is_service_role() then
    raise exception 'service role only' using errcode = '42501';
  end if;
  delete from public.user_events where created_at < now() - make_interval(days => v_days);
  get diagnostics v_a = row_count;
  delete from public.rec_events where created_at < now() - make_interval(days => v_days);
  get diagnostics v_b = row_count;
  delete from public.rate_limits where window_start < now() - interval '2 days';
  return v_a + v_b;
end $$;

-- clearing my activity also clears recommendation measurements
create or replace function public.clear_my_activity() returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid := public.require_user();
begin
  delete from public.user_events where user_id = v_user;
  delete from public.rec_events where user_id = v_user;
end $$;

-- ---------- notifications: demo safety and deep links ----------
-- several notices can come from one transaction (payment confirmed, then delivery prepared); clock time keeps their order
alter table public.notifications alter column created_at set default clock_timestamp();

-- Anything about demo data is a test notification: it is labeled in the app and never pushed to a device.
-- Claim notices also carry the order and delivery so the app can open the right screen, and notices sent to a
-- store's team say so, because their actions live in the seller panel rather than in the buyer app.
create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_prefs jsonb;
  v_push boolean;
  v_test boolean;
  v_data jsonb := coalesce(p_data, '{}'::jsonb);
  v_extra jsonb;
begin
  select preferences, is_demo into v_prefs, v_test from public.profiles where id = p_user;
  if v_data ? 'claim_id' and not v_data ? 'order_id' then
    select jsonb_build_object('order_id', c.order_id, 'fulfillment_id', c.fulfillment_id) into v_extra
      from public.claims c where c.id = (v_data ->> 'claim_id')::uuid;
    v_data := v_data || coalesce(v_extra, '{}'::jsonb);
  end if;
  v_test := coalesce(v_test, false)
    or exists (select 1 from public.orders o where o.id = (v_data ->> 'order_id')::uuid and o.is_demo)
    or exists (select 1 from public.products p where p.id = (v_data ->> 'product_id')::uuid and p.is_demo);
  v_push := coalesce((v_prefs -> 'notifications' ->> p_kind)::boolean, (v_prefs -> 'notifications' ->> 'push')::boolean, true);
  insert into public.notifications (user_id, kind, title, body, data, is_test, push_status)
  values (p_user, p_kind, p_title, p_body, v_data, v_test,
          case when not v_test and v_push and exists (select 1 from public.push_tokens where user_id = p_user) then 'pending' else 'skipped' end)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.notify_store(p_store uuid, p_kind text, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select user_id from public.store_members where store_id = p_store loop
    perform public.notify(r.user_id, p_kind, p_title, p_body, coalesce(p_data, '{}'::jsonb) || jsonb_build_object('audience', 'store', 'store_id', p_store));
  end loop;
end $$;

-- escalation tells the store, so it is never surprised by the platform stepping in
create or replace function public.escalate_claim(p_claim_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid := public.require_user(); v_c public.claims;
begin
  select * into v_c from public.claims where id = p_claim_id for update;
  if not found or v_c.buyer_id <> v_user then raise exception 'not found' using errcode = 'P0002'; end if;
  if v_c.status not in ('open', 'seller_responded') then raise exception 'cannot escalate' using errcode = 'P0001', hint = 'invalid_state'; end if;
  -- buyers may escalate after the seller answered, or after the configured response window
  if v_c.status = 'open' and v_c.created_at > now() - make_interval(hours => (public.setting('claims.seller_response_hours', '48'))::int) then
    raise exception 'seller response window still open' using errcode = 'P0001', hint = 'too_early';
  end if;
  update public.claims set status = 'escalated' where id = p_claim_id;
  insert into public.claim_messages (claim_id, author_id, author_role, body)
  values (p_claim_id, v_user, 'buyer', 'Pedí que el equipo de la plataforma revise este reclamo.');
  perform public.notify_store(v_c.store_id, 'claim_update', 'Reclamo ' || v_c.number || ' escalado',
    'El comprador pidió la intervención de la plataforma. Comparte tu versión en el reclamo.', jsonb_build_object('claim_id', p_claim_id));
end $$;

-- ---------- privileges ----------
do $$
declare
  r record;
  internal text[] := array['_fmt_usd', '_refresh_ratings', '_public_name', 'remind_installments', 'prune_activity', 'flag_demo_order', 'guard_rating_fields'];
begin
  for r in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = any (internal)
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;
revoke insert, update, delete on public.reviews from anon, authenticated;
revoke insert, update on public.rec_events from anon, authenticated;

-- ---------- schedules (only where pg_cron exists) ----------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('kora-remind-installments', '0 13 * * *', 'select public.remind_installments()');
    perform cron.schedule('kora-prune-activity', '30 4 * * *', 'select public.prune_activity()');
  end if;
end $$;

-- recommended_products lists its columns explicitly, so it follows the view's new columns
create or replace function public.recommended_products(p_limit int default 20, p_exclude uuid[] default '{}')
returns setof public.product_cards language plpgsql stable security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_cfg jsonb := public.setting('ranking', '{}'::jsonb);
  w_aff numeric := coalesce((v_cfg ->> 'affinity')::numeric, 3);
  w_pop numeric := coalesce((v_cfg ->> 'popularity')::numeric, 1.5);
  w_new numeric := coalesce((v_cfg ->> 'freshness')::numeric, 0.8);
  w_avail numeric := coalesce((v_cfg ->> 'available')::numeric, 0.6);
  w_edit numeric := coalesce((v_cfg ->> 'editorial')::numeric, 0.7);
  w_seen numeric := coalesce((v_cfg ->> 'seen_penalty')::numeric, 0.5);
  v_per_cat int := coalesce((v_cfg ->> 'max_per_category')::int, 4);
  v_per_store int := coalesce((v_cfg ->> 'max_per_store')::int, 5);
  v_personal boolean := v_user is not null and coalesce((select personalization_enabled from public.profiles where id = v_user), true);
begin
  return query
  with aff as (
    select coalesce(e.category_id, p.category_id) as category_id,
           sum(case e.kind when 'purchase' then 5 when 'add_to_cart' then 4 when 'favorite' then 3 when 'search' then 1.5 else 1 end
               * exp(-extract(epoch from now() - e.created_at) / (86400 * 21))) as w
      from public.user_events e left join public.products p on p.id = e.product_id
     where v_personal and e.user_id = v_user and e.created_at > now() - interval '90 days'
     group by 1
  ), aff_norm as (
    select category_id, w / nullif(max(w) over (), 0) as a from aff
  ), seen as (
    select product_id, count(*) as n from public.user_events
     where v_personal and user_id = v_user and kind = 'view' and created_at > now() - interval '3 days' group by 1
  ), bought as (
    select distinct product_id from public.user_events where v_personal and user_id = v_user and kind = 'purchase'
  ), pop as (select max(popularity) as m from public.products where moderation_status = 'published'),
  scored as (
    select pc.*,
           w_aff * coalesce(an.a, 0)
           + w_pop * coalesce(pc.popularity / nullif((select m from pop), 0), 0)
           + w_new * greatest(0, 1 - extract(epoch from now() - coalesce(pc.published_at, now())) / (86400 * 45))
           + w_avail * (pc.availability = 'available')::int
           + w_edit * exists (select 1 from public.collection_products cp join public.collections c on c.id = cp.collection_id
                               where cp.product_id = pc.id and c.active)::int
           - w_seen * least(coalesce(s.n, 0), 3) / 3.0 as score
      from public.product_cards pc
      left join aff_norm an on an.category_id = pc.category_id
      left join seen s on s.product_id = pc.id
     where pc.moderation_status = 'published' and pc.store_status = 'active'
       and pc.availability not in ('sold_out', 'unavailable')
       and not (pc.id = any (coalesce(p_exclude, '{}')))
       and pc.id not in (select product_id from bought)
  ), diversified as (
    select sc.*, row_number() over (partition by sc.category_id order by sc.score desc) as rc,
                 row_number() over (partition by sc.store_id order by sc.score desc) as rs
      from scored sc
  )
  select d.id, d.slug, d.title, d.subtitle, d.store_id, d.store_name, d.store_slug, d.store_kind, d.category_id, d.category_slug,
         d.category_name, d.tone, d.brand_name, d.availability, d.origin, d.price_usd, d.compare_at_usd, d.image_path, d.stock_total,
         d.lead_min_days, d.lead_max_days, d.popularity, d.published_at, d.is_demo, d.moderation_status, d.store_status,
         d.rating_avg, d.rating_count
    from diversified d
   where d.rc <= v_per_cat and d.rs <= v_per_store
   order by d.score desc, d.id
   limit least(greatest(p_limit, 1), 40);
end $$;

-- ---------- home: categories carry a representative product photo ----------
create or replace function public.home_feed() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  return jsonb_build_object(
    'categories', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'slug', c.slug, 'name', c.name, 'icon', c.icon, 'tone', c.tone,
                     'image_path', (select pc.image_path from public.product_cards pc
                                     join public.categories cc on cc.id = pc.category_id
                                    where (cc.id = c.id or cc.parent_id = c.id)
                                      and pc.moderation_status = 'published' and pc.store_status = 'active' and pc.image_path is not null
                                    order by pc.popularity desc, pc.published_at desc nulls last limit 1)) order by c.sort), '[]')
                     from public.categories c where c.active and c.parent_id is null),
    'collections', (select coalesce(jsonb_agg(jsonb_build_object(
                       'id', c.id, 'slug', c.slug, 'title', c.title, 'subtitle', c.subtitle, 'tone', c.tone, 'layout', c.layout, 'cover_path', c.cover_path,
                       'products', (select coalesce(jsonb_agg(to_jsonb(pc) order by cp.sort), '[]') from public.collection_products cp
                                      join public.product_cards pc on pc.id = cp.product_id and pc.moderation_status = 'published' and pc.store_status = 'active'
                                     where cp.collection_id = c.id)) order by c.sort), '[]')
                      from public.collections c
                     where c.active and (c.starts_at is null or c.starts_at <= now()) and (c.ends_at is null or c.ends_at > now())),
    'recommended', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.recommended_products(16) r),
    'recently_viewed', case when auth.uid() is null then '[]'::jsonb else
                        (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.recently_viewed(10) r) end,
    'stores', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'tagline', s.tagline,
                         'logo_path', s.logo_path, 'cover_path', s.cover_path, 'accent', s.accent, 'kind', s.kind,
                         'rating_avg', s.rating_avg, 'rating_count', s.rating_count) order by s.kind, s.name), '[]')
                 from public.stores s where s.status = 'active'),
    'personalized', auth.uid() is not null and exists (select 1 from public.user_events where user_id = auth.uid())
  );
end $$;

-- ===================== 20261009001800_setting_validation.sql =====================
-- Settings that database functions cast and compute with are validated when they are written.
-- Without this, an admin typing "48 horas" in the generic JSON editor would make checkout, payment
-- expiry or the recommendations feed fail for every buyer the next time they run.
-- Errors carry hint 'invalid_setting' and a Spanish detail the panel shows as is.

create or replace function public._setting_number(p_key text, p_value jsonb, p_min numeric, p_max numeric, p_integer boolean, p_label text)
returns void language plpgsql immutable set search_path = public as $$
declare v numeric;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'number' then
    raise exception 'invalid setting %', p_key using errcode = '22023', hint = 'invalid_setting',
      detail = format('%s debe ser un número, sin texto ni comillas.', p_label);
  end if;
  v := (p_value #>> '{}')::numeric;
  if p_integer and v <> trunc(v) then
    raise exception 'invalid setting %', p_key using errcode = '22023', hint = 'invalid_setting',
      detail = format('%s debe ser un número entero.', p_label);
  end if;
  if v < p_min or v > p_max then
    raise exception 'invalid setting %', p_key using errcode = '22023', hint = 'invalid_setting',
      detail = format('%s debe estar entre %s y %s.', p_label, replace(p_min::text, '.', ','), replace(p_max::text, '.', ','));
  end if;
end $$;

create or replace function public.guard_setting_value() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v jsonb := new.value;
  k text;
  weights constant text[] := array['affinity', 'popularity', 'freshness', 'available', 'editorial', 'seen_penalty'];
  caps constant text[] := array['max_per_category', 'max_per_store'];
  pricing constant text[] := array['markup_pct', 'per_kg_usd', 'fixed_usd', 'round_to', 'configured'];
begin
  case new.key
    when 'orders.unpaid_expiry_hours' then perform public._setting_number(new.key, v, 1, 720, true, 'El plazo para cancelar pedidos sin pago (horas)');
    when 'claims.seller_response_hours' then perform public._setting_number(new.key, v, 1, 720, true, 'El plazo de respuesta del vendedor (horas)');
    when 'payments.provider_expiry_minutes' then perform public._setting_number(new.key, v, 5, 10080, true, 'La vigencia del pago (minutos)');
    when 'payments.reminder_days_before' then perform public._setting_number(new.key, v, 0, 30, true, 'El aviso antes de una cuota (días)');
    when 'privacy.event_retention_days' then perform public._setting_number(new.key, v, 30, 730, true, 'La conservación de la actividad (días)');
    when 'commission.default_pct' then perform public._setting_number(new.key, v, 0, 50, false, 'La comisión por defecto (%)');
    when 'orders.number_prefix' then
      if jsonb_typeof(v) <> 'string' or (v #>> '{}') !~ '^[A-Z]{1,4}$' then
        raise exception 'invalid setting %', new.key using errcode = '22023', hint = 'invalid_setting',
          detail = 'El prefijo de pedido son de 1 a 4 letras mayúsculas entre comillas, por ejemplo "P".';
      end if;
    when 'ranking' then
      if jsonb_typeof(v) <> 'object' then
        raise exception 'invalid setting %', new.key using errcode = '22023', hint = 'invalid_setting',
          detail = 'El ranking es un objeto con pesos, por ejemplo {"affinity": 3}.';
      end if;
      for k in select jsonb_object_keys(v) loop
        if k = any (weights) then
          perform public._setting_number(new.key, v -> k, 0, 10, false, format('El peso «%s»', k));
        elsif k = any (caps) then
          perform public._setting_number(new.key, v -> k, 1, 40, true, format('El límite «%s»', k));
        else
          raise exception 'invalid setting %', new.key using errcode = '22023', hint = 'invalid_setting',
            detail = format('«%s» no es un parámetro del ranking. Usa: %s.', k, array_to_string(weights || caps, ', '));
        end if;
      end loop;
    when 'pricing.import' then
      if jsonb_typeof(v) <> 'object' then
        raise exception 'invalid setting %', new.key using errcode = '22023', hint = 'invalid_setting',
          detail = 'La regla de precio de importación es un objeto, por ejemplo {"markup_pct": 30}.';
      end if;
      for k in select jsonb_object_keys(v) loop
        if not k = any (pricing) then
          raise exception 'invalid setting %', new.key using errcode = '22023', hint = 'invalid_setting',
            detail = format('«%s» no es parte de la regla de precio. Usa: %s.', k, array_to_string(pricing, ', '));
        end if;
      end loop;
      perform public._setting_number(new.key, v -> 'markup_pct', 0, 500, false, 'El margen (markup_pct)');
      perform public._setting_number(new.key, v -> 'per_kg_usd', 0, 200, false, 'El flete por kilo (per_kg_usd)');
      perform public._setting_number(new.key, v -> 'fixed_usd', 0, 1000, false, 'El cargo fijo (fixed_usd)');
      if v ? 'round_to' and jsonb_typeof(v -> 'round_to') <> 'null' then
        perform public._setting_number(new.key, v -> 'round_to', 0, 0.99, false, 'El redondeo (round_to)');
      end if;
      if v ? 'configured' and jsonb_typeof(v -> 'configured') <> 'boolean' then
        raise exception 'invalid setting %', new.key using errcode = '22023', hint = 'invalid_setting',
          detail = '«configured» es true o false, sin comillas.';
      end if;
    else null;
  end case;
  return new;
end $$;

create trigger app_settings_validate before insert or update on public.app_settings
  for each row execute function public.guard_setting_value();

-- the settings above are read by functions every buyer runs, so they can't be deleted either
create or replace function public.guard_setting_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.key in ('orders.unpaid_expiry_hours', 'claims.seller_response_hours', 'payments.provider_expiry_minutes',
                 'payments.reminder_days_before', 'privacy.event_retention_days', 'commission.default_pct',
                 'orders.number_prefix', 'ranking', 'pricing.import') and not public.is_service_role() then
    raise exception 'setting % is required', old.key using errcode = '22023', hint = 'invalid_setting',
      detail = 'Este parámetro lo usa la plataforma y no se puede eliminar. Cambia su valor en su lugar.';
  end if;
  return old;
end $$;

create trigger app_settings_keep before delete on public.app_settings
  for each row execute function public.guard_setting_delete();

revoke execute on function public._setting_number(text, jsonb, numeric, numeric, boolean, text) from public, anon, authenticated;
revoke execute on function public.guard_setting_value() from public, anon, authenticated;
revoke execute on function public.guard_setting_delete() from public, anon, authenticated;
grant execute on function public._setting_number(text, jsonb, numeric, numeric, boolean, text) to service_role;
grant execute on function public.guard_setting_value() to service_role;
grant execute on function public.guard_setting_delete() to service_role;

-- ===================== 20261009001900_address_default.sql =====================
-- Deleting the main address leaves the buyer with addresses but none marked as main, so checkout would
-- open with nothing selected. The most recently added remaining address becomes the main one.
create or replace function public.addresses_promote_default() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.is_default then
    update public.addresses set is_default = true
     where id = (select id from public.addresses where user_id = old.user_id order by created_at desc, id limit 1);
  end if;
  return old;
end $$;
create trigger addresses_promote after delete on public.addresses
  for each row execute function public.addresses_promote_default();

revoke execute on function public.addresses_promote_default() from public, anon, authenticated;
grant execute on function public.addresses_promote_default() to service_role;

-- ===================== 20261009002000_push_receipts.sql =====================
-- =====================================================================
-- Push delivery receipts (second phase of Expo push).
-- A ticket from Expo only means the message was accepted; whether Apple or Google delivered it is reported later
-- by a receipt (ready after about 15 minutes, kept by Expo for 24 hours). The dispatcher stores every ticket, asks
-- for its receipt once it is due, drops devices that no longer exist and marks a notification failed when no
-- device received it. Operators see the health of the channel on the admin dashboard.
-- =====================================================================

create table public.push_tickets (
  ticket_id text primary key check (char_length(ticket_id) between 1 and 100),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  -- cleared when the device is removed (dead device, sign-out, account deletion), so no token outlives its owner
  token text references public.push_tokens (token) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'ok', 'error', 'expired')),
  error text,
  created_at timestamptz not null default now(),
  checked_at timestamptz
);
create index push_tickets_due_idx on public.push_tickets (created_at) where status = 'pending';
create index push_tickets_notification_idx on public.push_tickets (notification_id);
create index push_tickets_token_idx on public.push_tickets (token);

alter table public.push_tickets enable row level security;
revoke all on public.push_tickets from public, anon, authenticated;

-- p_tickets: [{ "ticket_id": text, "notification_id": uuid, "token": text }] for every ticket Expo accepted.
drop function if exists public.complete_push(jsonb, text[]);
create or replace function public.complete_push(p_results jsonb, p_dead_tokens text[] default '{}', p_tickets jsonb default '[]')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.notifications n
     set push_status = case r.status when 'sent' then 'sent'
                                     when 'skipped' then 'skipped'
                                     when 'retry' then case when n.push_attempts < 3 then 'pending' else 'failed' end
                                     else 'failed' end,
         push_error = left(r.error, 300)
    from jsonb_to_recordset(coalesce(p_results, '[]'::jsonb)) as r(id uuid, status text, error text)
   where n.id = r.id and n.push_status = 'sending';
  insert into public.push_tickets (ticket_id, notification_id, token)
  select t.ticket_id, t.notification_id, (select pt.token from public.push_tokens pt where pt.token = t.token)
    from jsonb_to_recordset(coalesce(p_tickets, '[]'::jsonb)) as t(ticket_id text, notification_id uuid, token text)
   where t.ticket_id is not null and exists (select 1 from public.notifications n where n.id = t.notification_id)
  on conflict (ticket_id) do nothing;
  delete from public.push_tokens where token = any (coalesce(p_dead_tokens, '{}'));
end $$;

-- Returns up to p_limit ticket ids whose receipt is due: at least 15 minutes old, not asked about in the last
-- 10 minutes (Expo answers nothing until the receipt is ready). Tickets past Expo's 24 hours are closed as
-- 'expired' and finished tickets are kept for a week.
create or replace function public.claim_push_receipts(p_limit int default 1000, p_ids uuid[] default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_out jsonb;
begin
  if not public.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.push_tickets set status = 'expired', checked_at = now()
   where status = 'pending' and created_at < now() - interval '24 hours';
  delete from public.push_tickets where status <> 'pending' and created_at < now() - interval '7 days';
  with c as (
    select ticket_id from public.push_tickets
     where status = 'pending' and created_at <= now() - interval '15 minutes'
       and (checked_at is null or checked_at < now() - interval '10 minutes')
       and (p_ids is null or notification_id = any (p_ids))
     order by created_at
     limit least(greatest(coalesce(p_limit, 1000), 1), 1000)
     for update skip locked
  ), u as (
    update public.push_tickets t set checked_at = now() from c where t.ticket_id = c.ticket_id returning t.ticket_id
  )
  select coalesce(jsonb_agg(u.ticket_id), '[]'::jsonb) into v_out from u;
  return v_out;
end $$;

-- p_receipts: [{ "ticket_id": text, "status": "ok" | "error", "error": text }]. A device Apple or Google no longer
-- knows is removed; a notification whose every ticket failed is marked failed with the reason.
create or replace function public.complete_push_receipts(p_receipts jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ids text[]; v_ok int; v_err int; v_dead int; v_failed int;
begin
  if not public.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  with u as (
    update public.push_tickets t set status = r.status, error = left(r.error, 300), checked_at = now()
      from jsonb_to_recordset(coalesce(p_receipts, '[]'::jsonb)) as r(ticket_id text, status text, error text)
     where t.ticket_id = r.ticket_id and t.status = 'pending' and r.status in ('ok', 'error')
    returning t.ticket_id, t.status
  ) select coalesce(array_agg(ticket_id), '{}'), count(*) filter (where status = 'ok'), count(*) filter (where status = 'error')
      into v_ids, v_ok, v_err from u;

  with marked as (
    update public.notifications n
       set push_status = 'failed',
           push_error = left('Sin entregar: ' || (select string_agg(distinct coalesce(t.error, 'error'), ', ') from public.push_tickets t where t.notification_id = n.id), 300)
     where n.push_status = 'sent'
       and n.id in (select t.notification_id from public.push_tickets t where t.ticket_id = any (v_ids) and t.status = 'error')
       and not exists (select 1 from public.push_tickets t where t.notification_id = n.id and t.status <> 'error')
    returning 1
  ) select count(*) into v_failed from marked;

  with gone as (
    delete from public.push_tokens pt
     where pt.token in (select t.token from public.push_tickets t where t.ticket_id = any (v_ids) and t.error = 'DeviceNotRegistered')
    returning 1
  ) select count(*) into v_dead from gone;

  return jsonb_build_object('ok', v_ok, 'error', v_err, 'notifications_failed', v_failed, 'devices_removed', v_dead);
end $$;

do $$
declare f text;
begin
  foreach f in array array['complete_push(jsonb, text[], jsonb)', 'claim_push_receipts(int, uuid[])', 'complete_push_receipts(jsonb)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- ---------- admin dashboard: health of the push channel ----------
create or replace function public.push_health() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'devices', (select count(*) from public.push_tokens),
    'sent_24h', (select count(*) from public.notifications where push_status = 'sent' and created_at > now() - interval '24 hours'),
    'failed_24h', (select count(*) from public.notifications where push_status = 'failed' and created_at > now() - interval '24 hours'),
    'confirmed_24h', (select count(*) from public.push_tickets where status = 'ok' and created_at > now() - interval '24 hours'),
    'rejected_24h', (select count(*) from public.push_tickets where status = 'error' and created_at > now() - interval '24 hours'),
    -- waiting longer than the dispatcher's one-minute schedule allows: the job or its Vault secrets are missing
    'stuck', (select count(*) from public.notifications
               where push_status in ('pending', 'sending') and not is_test and created_at < now() - interval '10 minutes'
                 and created_at > now() - interval '24 hours'),
    -- Expo, Apple or Google refusing our credentials: no device receives anything until an operator fixes it
    'credentials_error', (
      select max(at) from (
        select checked_at as at from public.push_tickets
         where status = 'error' and error in ('InvalidCredentials', 'MismatchSenderId') and checked_at > now() - interval '24 hours'
        union all
        select created_at from public.notifications
         where push_error ~ '(InvalidCredentials|MismatchSenderId)' and created_at > now() - interval '24 hours'
      ) x)
  );
end $$;
revoke execute on function public.push_health() from public, anon;
grant execute on function public.push_health() to authenticated;

-- ===================== 20261009002100_support_contact.sql =====================
-- The support contact is now what the app shows in Cuenta › Ayuda, so it is validated like the other settings
-- the platform depends on. The unused "checkout" presentation flag is removed: the rate source is always shown
-- to the buyer, and a switch that changes nothing would mislead the operator.

create or replace function public.guard_support_setting() returns trigger
language plpgsql security definer set search_path = public as $$
declare v jsonb := new.value; k text;
begin
  if jsonb_typeof(v) <> 'object' then
    raise exception 'invalid setting %', new.key using errcode = '22023', hint = 'invalid_setting',
      detail = 'El contacto de soporte es un objeto, por ejemplo {"email": "soporte@tutienda.com", "hours": "Lun a Vie, 9:00 a 18:00"}.';
  end if;
  for k in select jsonb_object_keys(v) loop
    if k not in ('email', 'hours') then
      raise exception 'invalid setting %', new.key using errcode = '22023', hint = 'invalid_setting',
        detail = format('«%s» no es parte del contacto de soporte. Usa: email, hours.', k);
    end if;
  end loop;
  if jsonb_typeof(v -> 'email') is distinct from 'string' or (v ->> 'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' then
    raise exception 'invalid setting %', new.key using errcode = '22023', hint = 'invalid_setting',
      detail = 'El correo de soporte no es válido.';
  end if;
  if jsonb_typeof(v -> 'hours') is distinct from 'string' or char_length(btrim(v ->> 'hours')) not between 1 and 80 then
    raise exception 'invalid setting %', new.key using errcode = '22023', hint = 'invalid_setting',
      detail = 'El horario de atención es un texto de 1 a 80 caracteres.';
  end if;
  return new;
end $$;

create trigger app_settings_validate_support before insert or update on public.app_settings
  for each row when (new.key = 'support') execute function public.guard_support_setting();

revoke execute on function public.guard_support_setting() from public, anon, authenticated;
grant execute on function public.guard_support_setting() to service_role;

update public.app_settings set description = 'Contacto de soporte que la app muestra en Cuenta › Ayuda' where key = 'support';
delete from public.app_settings where key = 'checkout';

-- ===================== historial de migraciones =====================
-- Mismas versiones que los archivos del repositorio, para que `supabase db push` siga coherente.
update supabase_migrations.schema_migrations set version = '20261009000100' where version = '20261009120356';
update supabase_migrations.schema_migrations set version = '20261009000200' where version = '20261009120455';
update supabase_migrations.schema_migrations set version = '20261009000300' where version = '20261009120537';
update supabase_migrations.schema_migrations set version = '20261009000400' where version = '20261009120607';
update supabase_migrations.schema_migrations set version = '20261009000500' where version = '20261009120731';
update supabase_migrations.schema_migrations set version = '20261009000600' where version = '20261009120818';
insert into supabase_migrations.schema_migrations (version, name) values
  ('20261009000700', 'checkout'),
  ('20261009000800', 'payments'),
  ('20261009000900', 'discovery'),
  ('20261009001000', 'default_config'),
  ('20261009001100', 'function_privileges'),
  ('20261009001200', 'admin_tools'),
  ('20261009001300', 'catalog_authoring'),
  ('20261009001400', 'config_guards'),
  ('20261009001500', 'seller_tools'),
  ('20261009001600', 'server_functions'),
  ('20261009001700', 'reviews_engagement'),
  ('20261009001800', 'setting_validation'),
  ('20261009001900', 'address_default'),
  ('20261009002000', 'push_receipts'),
  ('20261009002100', 'support_contact');

commit;
