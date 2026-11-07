-- Compatible catalog/cart/checkout/seller release; payment function and policy excluded.
-- PROPOSAL ONLY. NOT EXECUTED. Target project must be mimnotafmfasvwrclxan.
-- Uses existing reviewed SQL01-04, excluding the ENTIRE SQL01 payment block.
-- No paid services; no payment-method/config data edits; no product or stock backfill.
-- Requires a clean preflight: new objects absent, expected base present, owners/ACL reviewed.
-- Not blindly repeatable. Any error must stop and roll back the transaction.

-- SOURCE: docs/propuestas/integridad-funcional-2026-11-06/sql/01-functional-integrity.sql
-- LOCAL REVIEW CANDIDATE ONLY. No remote execution or privilege grants.
-- Existing RPC signatures and financial calculations remain unchanged.
create or replace function public.track_event(
  p_kind public.user_event_kind, p_product_id uuid default null, p_category_id uuid default null,
  p_store_id uuid default null, p_query text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if p_kind = 'purchase' then
    raise exception 'purchase events are written by checkout only' using errcode='42501', hint='forbidden';
  end if;
  if v_user is null then return; end if;
  if not coalesce((select personalization_enabled from public.profiles where id = v_user), true) then return; end if;
  perform public.check_rate_limit('track', 300, 60);
  insert into public.user_events (user_id, kind, product_id, category_id, store_id, query)
  values (v_user, p_kind, p_product_id, p_category_id, p_store_id, left(nullif(trim(p_query), ''), 120));
end $$;

-- Keep ownership and personalise preferences enforced even for direct REST INSERTs.
-- Trusted checkout runs under its existing definer; it is the only purchase writer.
alter policy user_events_insert_own on public.user_events
  with check (user_id=auth.uid() and kind<>'purchase'
    and coalesce((select personalization_enabled from public.profiles where id=auth.uid()),true));

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
      if coalesce((select personalization_enabled from public.profiles where id=v_user),true) then
      insert into public.user_events (user_id, kind, product_id) values (v_user, 'purchase', v_line.product_id);
      end if;
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

-- PAYMENT BLOCK INTENTIONALLY EXCLUDED: preserve existing submit_payment and payment schema.
-- D3 is a separate commercial decision and does not gate metadata/cart/checkout/seller compatibility.

create or replace function public.moderate_product(p_product_id uuid, p_status public.moderation_status, p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_product public.products; v_last_event bigint;
begin
  perform public.require_admin();
  if p_status in ('rejected','suspended') and coalesce(trim(p_note),'')='' then
    raise exception 'a note is required to reject or suspend' using errcode='22023',hint='note_required';
  end if;
  select * into v_product from public.products where id=p_product_id for update;
  if not found then raise exception 'product not found' using errcode='P0002';end if;
  if v_product.moderation_status is not distinct from p_status and v_product.moderation_note is not distinct from p_note then return;end if;
  select coalesce(max(id),0) into v_last_event from public.moderation_events where product_id=p_product_id;
  update public.products set moderation_status=p_status,moderation_note=p_note where id=p_product_id;
  if v_product.moderation_status is distinct from p_status then
    -- Only annotate the event this transition just created; never rewrite an earlier moderator.
    update public.moderation_events set note=coalesce(p_note,note) where product_id=p_product_id and id>v_last_event;
  else
    insert into public.moderation_events(product_id,from_status,to_status,note,actor_id,automatic)
      values(p_product_id,v_product.moderation_status,p_status,p_note,auth.uid(),false);
  end if;
  perform public.audit('moderate','product',p_product_id::text,jsonb_build_object('status',p_status,'note',p_note));
end $$;


-- SOURCE: docs/propuestas/integridad-funcional-2026-11-06/sql/02-catalog-metadata.sql
-- PROPOSAL ONLY: no remote execution or automatic deployment authorized.
-- Additive, opt-in metadata contract. Existing catalog/search/payment APIs stay unchanged.
-- All amounts/stock below are read from their existing variant row; no financial formulas.

alter table public.products add column condition text;
alter table public.products add constraint products_condition_allowed
  check (condition is null or condition in ('new', 'refurbished'));
comment on column public.products.condition is
  'Explicit physical condition. NULL is unknown legacy, never implicitly new/refurbished; independent of availability.';

alter table public.order_items add column product_condition text;
alter table public.order_items add constraint order_items_product_condition_allowed
  check (product_condition is null or product_condition in ('new','refurbished'));
comment on column public.order_items.product_condition is 'Physical condition accepted at checkout. NULL preserves unclassified historical items; never backfilled.';

alter table public.product_variants add column media_classified boolean not null default false;
comment on column public.product_variants.media_classified is
  'False = legacy/unclassified. True with no links = explicitly no assigned photos. Never infer from photo order or title.';
alter table public.product_variants add constraint product_variants_id_product_unique unique (id, product_id);
alter table public.product_images add constraint product_images_id_product_unique unique (id, product_id);

create table public.product_variant_images (
  product_id uuid not null,
  variant_id uuid not null,
  image_id uuid not null,
  sort integer not null check (sort between 0 and 99),
  primary key (variant_id, image_id),
  unique (variant_id, sort),
  constraint product_variant_images_variant_product_fk foreign key (variant_id, product_id)
    references public.product_variants (id, product_id) on delete cascade,
  constraint product_variant_images_image_product_fk foreign key (image_id, product_id)
    references public.product_images (id, product_id) on delete cascade
);
create index product_variant_images_product_idx on public.product_variant_images (product_id, variant_id, sort);
comment on table public.product_variant_images is
  'Explicit ordered image assignment. One image may belong to several variants of the same product. No Storage writes.';
alter table public.product_variant_images enable row level security;
create policy product_variant_images_visible on public.product_variant_images for select using (
  exists (select 1 from public.products p where p.id = product_id)
);
-- No direct client write policy or grant; only checked SECURITY DEFINER entry points below.
revoke all on public.product_variant_images from public, anon, authenticated, service_role;
grant select on public.product_variant_images to anon, authenticated;

-- Explicit color attribute only. Normalize the KEY, preserve the original label/value.
-- Conflicting Color/color aliases are unknown instead of selecting one silently.
create function public._catalog_option_color(p_options jsonb) returns text
language sql immutable security invoker set search_path = public, pg_temp as $$
  -- ECMAScript trim whitespace, shared with the TypeScript reader; labels are returned intact.
  with trim_chars as (select chr(9)||chr(10)||chr(11)||chr(12)||chr(13)||chr(32)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279) as chars)
  select case when count(distinct label)=1 then min(label) else null end
  from (
    select value #>> '{}' as label
    from jsonb_each(case when jsonb_typeof(p_options)='object' then p_options else '{}'::jsonb end) cross join trim_chars
    where lower(btrim(key,chars))='color' and jsonb_typeof(value)='string'
      and nullif(btrim(value #>> '{}',chars),'') is not null
  ) explicit_colors;
$$;
revoke all on function public._catalog_option_color(jsonb) from public, anon, authenticated, service_role;
grant execute on function public._catalog_option_color(jsonb) to anon, authenticated;

create function public.catalog_metadata(p_ids uuid[], p_condition text default null)
returns jsonb language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare v_result jsonb;
begin
  if p_ids is null or cardinality(p_ids) > 100 or array_position(p_ids, null) is not null
     or (p_condition is not null and p_condition not in ('new', 'refurbished')) then
    raise exception 'invalid catalog metadata input' using errcode='22023', hint='invalid_input';
  end if;
  with requested as (
    select id, min(ordinality) as position from unnest(p_ids) with ordinality ids(id, ordinality) group by id
  )
  select coalesce(jsonb_agg(row_data order by position), '[]'::jsonb) into v_result
  from (
    select r.position, jsonb_build_object(
      'product_id', p.id, 'condition', p.condition, 'updated_at', p.updated_at,
      'general_images', coalesce((
        select jsonb_agg(jsonb_build_object('id',i.id,'path',i.path,'alt',i.alt,'width',i.width,'height',i.height,'sort',i.sort) order by i.sort,i.id)
        from public.product_images i where i.product_id=p.id
          and not exists(select 1 from public.product_variant_images m where m.image_id=i.id and m.product_id=p.id)
      ),'[]'::jsonb),
      'colors', coalesce((
        select jsonb_agg(label order by label) from (
          select distinct public._catalog_option_color(v.options) as label
          from public.product_variants v
          where v.product_id=p.id and v.active
            and public._catalog_option_color(v.options) is not null
        ) colors
      ), '[]'::jsonb),
      'variants', coalesce((
        select jsonb_agg(jsonb_build_object(
          'variant_id', v.id, 'title', v.title, 'options', v.options, 'sku', v.sku,
          'price_usd', v.price_usd, 'stock', v.stock, 'active', v.active, 'updated_at', v.updated_at,
          'color', public._catalog_option_color(v.options),
          'media_classified', v.media_classified,
          'media_state', case when not v.media_classified then 'unknown'
            when exists(select 1 from public.product_variant_images m where m.variant_id=v.id and m.product_id=p.id) then 'mapped'
            else 'none' end,
          'images', case when not v.media_classified then '[]'::jsonb else coalesce((
            select jsonb_agg(jsonb_build_object('id', i.id, 'path', i.path, 'alt', i.alt,
              'width', i.width, 'height', i.height, 'sort', m.sort) order by m.sort, i.id)
            from public.product_variant_images m join public.product_images i on i.id=m.image_id and i.product_id=m.product_id
            where m.variant_id=v.id and m.product_id=p.id
          ), '[]'::jsonb) end
        ) order by v.sort, v.id)
        from public.product_variants v where v.product_id=p.id
          and (v.active or public.is_admin() or public.is_store_member(p.store_id))
      ), '[]'::jsonb)
    ) as row_data
    from requested r join public.products p on p.id=r.id
    where p_condition is null or p.condition=p_condition
  ) metadata_rows;
  return v_result;
end $$;
revoke all on function public.catalog_metadata(uuid[],text) from public, anon, authenticated, service_role;
grant execute on function public.catalog_metadata(uuid[],text) to anon, authenticated;
comment on function public.catalog_metadata(uuid[],text) is
  'RLS-bound metadata for up to 100 IDs, preserving first ID order. Condition filtering is batch-local, not global search/ranking.';

create function public.product_detail_commercial(p_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare v_detail jsonb; v_meta jsonb; v_variants jsonb; v_images jsonb; v_links jsonb;
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
  return v_detail || jsonb_build_object('condition',v_meta->'condition','available_colors',v_meta->'colors',
    'variants',v_variants,'images',v_images,'variant_image_links',v_links,'general_images',v_meta->'general_images',
    'catalog_metadata',v_meta);
end $$;
revoke all on function public.product_detail_commercial(uuid) from public, anon, authenticated, service_role;
grant execute on function public.product_detail_commercial(uuid) to anon, authenticated;
comment on function public.product_detail_commercial(uuid) is
  'Opt-in additive product detail, same snapshot and existing RLS. Unclassified legacy photos are not asserted to match a selected color.';

create function public.catalog_set_condition(
  p_store_id uuid, p_product_id uuid, p_condition text, p_expected_updated_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := public.require_user(); v_admin boolean := public.is_admin();
  v_product public.products; v_after public.products; v_sensitive boolean;
begin
  if p_store_id is null or p_product_id is null or p_expected_updated_at is null
     or (p_condition is not null and p_condition not in ('new','refurbished')) then
    raise exception 'invalid condition input' using errcode='22023', hint='invalid_input';
  end if;
  if not v_admin and not public.is_store_member(p_store_id) then
    raise exception 'store member or administrator required' using errcode='42501', hint='store_access_denied';
  end if;
  select * into v_product from public.products where id=p_product_id and store_id=p_store_id for update nowait;
  if not found then raise exception 'product not found' using errcode='P0002',hint='not_found'; end if;
  if v_product.updated_at is distinct from p_expected_updated_at then
    raise exception 'product metadata version changed' using errcode='40001',hint='catalog_version_conflict';
  end if;
  if v_product.condition is not distinct from p_condition then
    return jsonb_build_object('product_id',v_product.id,'condition',v_product.condition,'updated_at',v_product.updated_at);
  end if;
  select requires_review or risk_level<>'low' into v_sensitive from public.categories
    where id=v_product.category_id for share nowait;
  if not v_admin and v_product.moderation_status='published' and coalesce(v_sensitive,true) then
    raise exception 'published sensitive product requires administrative review' using errcode='42501',hint='catalog_sensitive_review_required';
  end if;
  update public.products set condition=p_condition where id=p_product_id returning * into v_after;
  -- Existing moderation triggers stay intact. Fail closed if this metadata-only edit would auto-publish,
  -- resubmit, or otherwise change commercial fields. The exception rolls back their events as well.
  if (to_jsonb(v_after)-array['condition','updated_at']) is distinct from
      (to_jsonb(v_product)-array['condition','updated_at']) then
    raise exception 'metadata edit requires a separate moderation operation' using errcode='42501',hint='catalog_metadata_review_required';
  end if;
  perform public.audit('update','products',p_product_id::text,
    jsonb_build_object('condition',jsonb_build_object('from',v_product.condition,'to',v_after.condition)));
  return jsonb_build_object('product_id',v_after.id,'condition',v_after.condition,'updated_at',v_after.updated_at);
exception when lock_not_available then
  raise exception 'product metadata is busy' using errcode='55P03',hint='product_busy';
end $$;
revoke all on function public.catalog_set_condition(uuid,uuid,text,timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.catalog_set_condition(uuid,uuid,text,timestamptz) to authenticated;

create function public.catalog_set_variant_media(
  p_store_id uuid, p_product_id uuid, p_variant_id uuid, p_image_ids uuid[], p_expected_updated_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := public.require_user(); v_admin boolean := public.is_admin();
  v_product public.products; v_variant public.product_variants; v_after public.product_variants;
  v_sensitive boolean; v_old_ids uuid[]; v_count integer;
begin
  if p_store_id is null or p_product_id is null or p_variant_id is null or p_expected_updated_at is null
     or p_image_ids is null or cardinality(p_image_ids)>100 or array_position(p_image_ids,null) is not null
     or (select count(distinct x) from unnest(p_image_ids) x) <> cardinality(p_image_ids) then
    raise exception 'invalid variant media input' using errcode='22023',hint='invalid_input';
  end if;
  if not v_admin and not public.is_store_member(p_store_id) then
    raise exception 'store member or administrator required' using errcode='42501',hint='store_access_denied';
  end if;
  -- Establish the authorized product/store before touching a variant. NOWAIT prevents cycles with
  -- checkout's variant-first locks; no transaction waits while holding the inverse authoring order.
  select * into v_product from public.products where id=p_product_id and store_id=p_store_id for update nowait;
  if not found then raise exception 'product not found' using errcode='P0002',hint='not_found'; end if;
  select * into v_variant from public.product_variants where id=p_variant_id and product_id=p_product_id for update nowait;
  if not found then raise exception 'variant not found' using errcode='P0002',hint='not_found'; end if;
  if v_variant.updated_at is distinct from p_expected_updated_at then
    raise exception 'variant metadata version changed' using errcode='40001',hint='catalog_version_conflict';
  end if;
  select requires_review or risk_level<>'low' into v_sensitive from public.categories
    where id=v_product.category_id for share nowait;
  if not v_admin and v_product.moderation_status='published' and coalesce(v_sensitive,true) then
    raise exception 'published sensitive product requires administrative review' using errcode='42501',hint='catalog_sensitive_review_required';
  end if;
  perform 1 from public.product_images where product_id=p_product_id and id=any(p_image_ids) order by id for update nowait;
  select count(*) into v_count from public.product_images where product_id=p_product_id and id=any(p_image_ids);
  if v_count<>cardinality(p_image_ids) then
    raise exception 'image does not belong to product' using errcode='22023',hint='invalid_input';
  end if;
  select coalesce(array_agg(image_id order by sort),'{}'::uuid[]) into v_old_ids
    from public.product_variant_images where variant_id=p_variant_id and product_id=p_product_id;
  if v_variant.media_classified and v_old_ids=p_image_ids then
    return jsonb_build_object('product_id',p_product_id,'variant_id',p_variant_id,'updated_at',v_variant.updated_at,
      'media_classified',true,'media_state',case when cardinality(p_image_ids)=0 then 'none' else 'mapped' end);
  end if;
  delete from public.product_variant_images where variant_id=p_variant_id and product_id=p_product_id;
  insert into public.product_variant_images(product_id,variant_id,image_id,sort)
    select p_product_id,p_variant_id,id,(ordinality-1)::integer from unnest(p_image_ids) with ordinality i(id,ordinality);
  update public.product_variants set media_classified=true where id=p_variant_id returning * into v_after;
  if (to_jsonb(v_after)-array['media_classified','updated_at']) is distinct from
      (to_jsonb(v_variant)-array['media_classified','updated_at']) then
    raise exception 'variant commercial fields changed' using errcode='42501',hint='catalog_metadata_review_required';
  end if;
  perform public.audit('update','product_variant_images',p_variant_id::text,
    jsonb_build_object('product_id',p_product_id,'media_classified',jsonb_build_object('from',v_variant.media_classified,'to',true),
      'image_ids',jsonb_build_object('from',to_jsonb(v_old_ids),'to',to_jsonb(p_image_ids))));
  return jsonb_build_object('product_id',p_product_id,'variant_id',p_variant_id,'updated_at',v_after.updated_at,
    'media_classified',true,'media_state',case when cardinality(p_image_ids)=0 then 'none' else 'mapped' end);
exception when lock_not_available then
  raise exception 'product metadata is busy' using errcode='55P03',hint='product_busy';
end $$;
revoke all on function public.catalog_set_variant_media(uuid,uuid,uuid,uuid[],timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.catalog_set_variant_media(uuid,uuid,uuid,uuid[],timestamptz) to authenticated;

-- Existing table UPDATE grants must not let direct REST writes bypass the new RPC's version/review checks.
-- This INVOKER trigger checks SQL execution identity of the trusted function owner, NOT JWT claims or a
-- client-settable flag. RPC authorization above still requires a real auth.uid and store-member/admin membership.
create function public.guard_catalog_metadata_columns() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_changed boolean; v_rpc_owner name;
begin
  if tg_table_name='products' then
    v_changed := case when tg_op='INSERT' then new.condition is not null else new.condition is distinct from old.condition end;
  elsif tg_table_name='product_variants' then
    v_changed := case when tg_op='INSERT' then new.media_classified else new.media_classified is distinct from old.media_classified end;
  else
    raise exception 'unexpected metadata guard target' using errcode='42501';
  end if;
  -- Default legacy INSERTs do not classify anything. Explicit UPDATEs of new columns must use the RPC,
  -- even when a submitted value is unchanged; old clients do not send these newly introduced fields.
  if tg_op='INSERT' and not v_changed then return new; end if;
  select pg_catalog.pg_get_userbyid(proowner) into v_rpc_owner from pg_catalog.pg_proc
    where oid='public.catalog_set_condition(uuid,uuid,text,timestamptz)'::regprocedure;
  if current_user is distinct from v_rpc_owner then
    raise exception 'use the versioned catalog metadata RPC' using errcode='42501',hint='catalog_metadata_guarded';
  end if;
  -- Runs alphabetically after the existing touch trigger. Preserve its behavior for all old columns,
  -- but make these explicit metadata writes monotonic even when several RPCs share one transaction.
  if tg_op='UPDATE' then
    new.updated_at := greatest(clock_timestamp(),old.updated_at+interval '1 microsecond');
  end if;
  return new;
end $$;
revoke all on function public.guard_catalog_metadata_columns() from public, anon, authenticated, service_role;
create trigger zz_products_catalog_condition_guard before insert or update of condition on public.products
  for each row execute function public.guard_catalog_metadata_columns();
create trigger zz_variants_catalog_media_guard before insert or update of media_classified on public.product_variants
  for each row execute function public.guard_catalog_metadata_columns();

-- No search_products signature/ranking changes. No condition backfill. No price/stock/availability writes.
-- Sensitive published seller edits are deliberately blocked pending an explicitly approved review flow.
-- No preorder value or purchase eligibility is added anywhere in this preparation.


-- SOURCE: docs/propuestas/integridad-funcional-2026-11-06/sql/03-checkout-intents.sql
-- REVIEW DRAFT ONLY. Apply only to the separately authorised isolated test database.
-- Requires 20261106000300_functional_integrity.sql. No remote execution by this draft.
-- Existing RPC signatures, cart RLS and all monetary calculations are preserved.
-- New RPCs are opt-in: clients must not use them against a backend not yet upgraded.

-- Protect direct REST DML too. The statement lock is acquired before row locks for
-- an authenticated buyer. Row locks cover trusted maintenance/cascades without a
-- request identity and owner changes; those maintenance transactions must retry
-- normal PostgreSQL deadlock/serialization errors if they touch several owners.
create or replace function public._lock_cart_statement() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is not null then
    perform pg_advisory_xact_lock(hashtextextended('checkout:' || v_user::text, 0));
  end if;
  return null;
end $$;
revoke all on function public._lock_cart_statement() from public, anon, authenticated, service_role;

create or replace function public._lock_cart_row() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_old uuid; v_new uuid; v_user uuid;
begin
  if tg_op <> 'INSERT' then v_old := old.user_id; end if;
  if tg_op <> 'DELETE' then v_new := new.user_id; end if;
  for v_user in select distinct id from unnest(array[v_old,v_new]) as owners(id) where id is not null order by id loop
    perform pg_advisory_xact_lock(hashtextextended('checkout:' || v_user::text, 0));
  end loop;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function public._lock_cart_row() from public, anon, authenticated, service_role;
create trigger cart_checkout_statement_lock before insert or update or delete on public.cart_items
  for each statement execute function public._lock_cart_statement();
create trigger cart_checkout_owner_lock before insert or update or delete on public.cart_items
  for each row execute function public._lock_cart_row();

create or replace function public.cart_set_quantity(p_variant_id uuid, p_quantity int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_user uuid := public.require_user(); v_max int; v_stock int; v_avail public.availability;
begin
  if p_variant_id is null or p_quantity is null then
    raise exception 'variant and quantity are required' using errcode='22023', hint='invalid_input';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('checkout:' || v_user::text, 0));
  perform public.check_rate_limit('cart',120,60);
  -- Removing an unavailable line must remain possible.
  if p_quantity <= 0 then
    delete from public.cart_items where user_id=v_user and variant_id=p_variant_id;
    return jsonb_build_object('variant_id',p_variant_id,'quantity',0);
  end if;
  select p.max_per_order,v.stock,p.availability into v_max,v_stock,v_avail
    from public.product_variants v join public.products p on p.id=v.product_id
    join public.stores s on s.id=p.store_id
   where v.id=p_variant_id and v.active and p.moderation_status='published' and s.status='active';
  if not found then raise exception 'product unavailable' using errcode='P0002',hint='unavailable'; end if;
  if v_avail in ('sold_out','unavailable') then
    raise exception 'sold out' using errcode='P0001',hint='sold_out';
  end if;
  p_quantity := least(p_quantity,v_max,coalesce(v_stock,v_max));
  if p_quantity <= 0 then raise exception 'sold out' using errcode='P0001',hint='sold_out'; end if;
  insert into public.cart_items(user_id,variant_id,quantity) values(v_user,p_variant_id,p_quantity)
  on conflict(user_id,variant_id) do update set quantity=excluded.quantity;
  return jsonb_build_object('variant_id',p_variant_id,'quantity',p_quantity);
end $$;

create or replace function public.cart_add(p_variant_id uuid,p_quantity int default 1) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_user uuid := public.require_user(); v_current int;
begin
  if p_variant_id is null or p_quantity is null then
    raise exception 'variant and quantity are required' using errcode='22023',hint='invalid_input';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('checkout:' || v_user::text,0));
  select quantity into v_current from public.cart_items where user_id=v_user and variant_id=p_variant_id;
  -- Preserve legacy coercion (at least one) and the existing server stock/quantity
  -- cap; bigint avoids overflow before cart_set_quantity applies those limits.
  return public.cart_set_quantity(p_variant_id,least(2147483647::bigint,
    coalesce(v_current,0)::bigint+greatest(p_quantity,1)::bigint)::int);
end $$;

-- Preserve the existing client's partial guest-cart merge. Skip only known invalid/unavailable
-- lines; unexpected server errors and rate limits propagate instead of being hidden.
create or replace function public.cart_merge(p_lines jsonb) returns int
language plpgsql security definer set search_path=public as $$
declare v_user uuid:=public.require_user(); v_line jsonb; v_n int:=0; v_hint text;
begin
  perform pg_advisory_xact_lock(hashtextextended('checkout:' || v_user::text,0));
  for v_line in select value from jsonb_array_elements(coalesce(p_lines,'[]'::jsonb)) limit 50 loop
    begin
      if jsonb_typeof(v_line)<>'object' or jsonb_typeof(v_line->'variant_id') is distinct from 'string'
        or jsonb_typeof(v_line->'quantity') is distinct from 'number'
        or (v_line->>'quantity') !~ '^[0-9]+$' then
        raise exception 'invalid cart line' using errcode='22023',hint='invalid_input';
      end if;
      perform public.cart_add((v_line->>'variant_id')::uuid,greatest(1,least(100,(v_line->>'quantity')::int)));
      v_n:=v_n+1;
    exception
      when invalid_text_representation or numeric_value_out_of_range then null;
      when sqlstate 'P0001' or sqlstate 'P0002' or sqlstate '22023' then
        get stacked diagnostics v_hint=PG_EXCEPTION_HINT;
        if coalesce(v_hint,'') not in ('unavailable','sold_out','invalid_input') then raise; end if;
    end;
  end loop;
  return v_n;
end $$;

create or replace function public._cart_merge_atomic(p_lines jsonb) returns int
language plpgsql security definer set search_path=public as $$
declare v_user uuid := public.require_user(); v_line jsonb; v_n int:=0;
begin
  perform pg_advisory_xact_lock(hashtextextended('checkout:' || v_user::text,0));
  if p_lines is null or jsonb_typeof(p_lines)<>'array' then
    raise exception 'cart lines must be an array' using errcode='22023',hint='invalid_input';
  end if;
  if jsonb_array_length(p_lines)>50 then
    raise exception 'too many cart lines' using errcode='22023',hint='invalid_input';
  end if;
  -- Atomic intent mutation: a failed line rolls back the whole caller transaction.
  for v_line in select value from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(v_line)<>'object' or jsonb_typeof(v_line->'variant_id') is distinct from 'string'
       or jsonb_typeof(v_line->'quantity') is distinct from 'number'
       or (v_line->>'quantity') !~ '^[0-9]+$' then
      raise exception 'invalid cart line' using errcode='22023',hint='invalid_input';
    end if;
    perform public.cart_add((v_line->>'variant_id')::uuid,greatest(1,least(100,(v_line->>'quantity')::int)));
    v_n:=v_n+1;
  end loop;
  return v_n;
end $$;

revoke all on function public._cart_merge_atomic(jsonb) from public,anon,authenticated,service_role;

-- No API access to the journal, even when a caller owns the buyer account.
-- Its functions are SECURITY DEFINER and all replay decisions are server-side.
create schema if not exists checkout_private;
revoke all on schema checkout_private from public,anon,authenticated,service_role;
create table checkout_private.cart_intent_journal(
  buyer_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null check(char_length(idempotency_key) between 8 and 80),
  operation text not null check(operation in ('add','merge')),
  payload jsonb not null,
  result jsonb not null,
  state text not null default 'completed' check(state in ('completed','cancelled')),
  created_at timestamptz not null default now(),
  primary key(buyer_id,idempotency_key)
);
alter table checkout_private.cart_intent_journal enable row level security;
revoke all on checkout_private.cart_intent_journal from public,anon,authenticated,service_role;
comment on table checkout_private.cart_intent_journal is 'Completed mutations and terminal cancellations. Never delete or expire blindly: an old original or replay must not add units again.';

create or replace function public.cart_add_intent(p_variant_id uuid,p_quantity int,p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_user uuid:=public.require_user(); v_existing checkout_private.cart_intent_journal;
  v_payload jsonb; v_result jsonb;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 80 then
    raise exception 'idempotency key required' using errcode='22023',hint='idempotency_required';
  end if;
  if p_variant_id is null or p_quantity is null or p_quantity not between 1 and 100 then
    raise exception 'invalid cart line' using errcode='22023',hint='invalid_input';
  end if;
  v_payload:=jsonb_build_object('variant_id',p_variant_id,'quantity',p_quantity);
  perform pg_advisory_xact_lock(hashtextextended('checkout:' || v_user::text,0));
  select * into v_existing from checkout_private.cart_intent_journal where buyer_id=v_user and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.operation<>'add' or v_existing.payload<>v_payload then
      raise exception 'idempotency key reused for a different intent' using errcode='22023',hint='idempotency_conflict';
    end if;
    if v_existing.state='cancelled' then
      raise exception 'cart intent was cancelled' using errcode='P0001',hint='cart_intent_cancelled';
    end if;
    return v_existing.result || jsonb_build_object('replayed',true);
  end if;
  v_result:=public.cart_add(p_variant_id,p_quantity);
  insert into checkout_private.cart_intent_journal(buyer_id,idempotency_key,operation,payload,result)
    values(v_user,p_idempotency_key,'add',v_payload,v_result);
  return v_result || jsonb_build_object('replayed',false);
end $$;
revoke all on function public.cart_add_intent(uuid,int,text) from public,anon,authenticated,service_role;
grant execute on function public.cart_add_intent(uuid,int,text) to authenticated;

create or replace function public.cart_merge_intent(p_lines jsonb,p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_user uuid:=public.require_user(); v_existing checkout_private.cart_intent_journal;
  v_payload jsonb; v_result jsonb; v_line jsonb; v_variant uuid; v_quantity int;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 80 then
    raise exception 'idempotency key required' using errcode='22023',hint='idempotency_required';
  end if;
  if p_lines is null or jsonb_typeof(p_lines)<>'array' then
    raise exception 'cart lines must be an array' using errcode='22023',hint='invalid_input';
  end if;
  if jsonb_array_length(p_lines)>50 then
    raise exception 'too many cart lines' using errcode='22023',hint='invalid_input';
  end if;
  v_payload:='[]'::jsonb;
  -- Normalise to the supported contract; unknown fields cannot set prices or
  -- weaken binding. JSON object key order is irrelevant, array order is retained.
  for v_line in select value from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(v_line)<>'object' or jsonb_typeof(v_line->'variant_id') is distinct from 'string'
       or jsonb_typeof(v_line->'quantity') is distinct from 'number'
       or (v_line->>'quantity') !~ '^[0-9]+$' then
      raise exception 'invalid cart line' using errcode='22023',hint='invalid_input';
    end if;
    v_variant:=(v_line->>'variant_id')::uuid;
    v_quantity:=(v_line->>'quantity')::int;
    if v_variant is null or v_quantity not between 1 and 100 then
      raise exception 'invalid cart line' using errcode='22023',hint='invalid_input';
    end if;
    v_payload:=v_payload||jsonb_build_array(jsonb_build_object('variant_id',v_variant,'quantity',v_quantity));
  end loop;
  perform pg_advisory_xact_lock(hashtextextended('checkout:' || v_user::text,0));
  select * into v_existing from checkout_private.cart_intent_journal where buyer_id=v_user and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.operation<>'merge' or v_existing.payload<>v_payload then
      raise exception 'idempotency key reused for a different intent' using errcode='22023',hint='idempotency_conflict';
    end if;
    if v_existing.state='cancelled' then
      raise exception 'cart intent was cancelled' using errcode='P0001',hint='cart_intent_cancelled';
    end if;
    return v_existing.result||jsonb_build_object('replayed',true);
  end if;
  v_result:=jsonb_build_object('accepted',public._cart_merge_atomic(v_payload));
  insert into checkout_private.cart_intent_journal(buyer_id,idempotency_key,operation,payload,result)
    values(v_user,p_idempotency_key,'merge',v_payload,v_result);
  return v_result||jsonb_build_object('replayed',false);
end $$;
revoke all on function public.cart_merge_intent(jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.cart_merge_intent(jsonb,text) to authenticated;

-- Terminal cancellation is not deletion. A delayed original must find the tombstone.
-- Normalise exactly the same supported payload as cart_add_intent/cart_merge_intent.
create function checkout_private.cart_intent_payload(p_operation text,p_payload jsonb) returns jsonb
language plpgsql immutable security invoker set search_path=public,pg_temp as $$
declare v_line jsonb; v_variant uuid; v_quantity int; v_result jsonb:='[]'::jsonb;
begin
  if p_operation is null or p_operation not in ('add','merge') then
    raise exception 'invalid cart operation' using errcode='22023',hint='invalid_input';
  end if;
  if p_operation='add' then
    if jsonb_typeof(p_payload) is distinct from 'object' then
      raise exception 'invalid cart payload' using errcode='22023',hint='invalid_input';
    end if;
    p_payload:=jsonb_build_array(p_payload);
  elsif jsonb_typeof(p_payload) is distinct from 'array' then
    raise exception 'invalid cart payload' using errcode='22023',hint='invalid_input';
  end if;
  if jsonb_array_length(p_payload)>50 then
    raise exception 'invalid cart payload' using errcode='22023',hint='invalid_input';
  end if;
  for v_line in select value from jsonb_array_elements(p_payload) loop
    if jsonb_typeof(v_line) is distinct from 'object'
       or jsonb_typeof(v_line->'variant_id') is distinct from 'string'
       or jsonb_typeof(v_line->'quantity') is distinct from 'number'
       or (v_line->>'quantity') !~ '^[0-9]+$' then
      raise exception 'invalid cart line' using errcode='22023',hint='invalid_input';
    end if;
    v_variant:=(v_line->>'variant_id')::uuid;
    v_quantity:=(v_line->>'quantity')::int;
    if v_variant is null or v_quantity not between 1 and 100 then
      raise exception 'invalid cart line' using errcode='22023',hint='invalid_input';
    end if;
    v_result:=v_result||jsonb_build_array(jsonb_build_object('variant_id',v_variant,'quantity',v_quantity));
  end loop;
  return case when p_operation='add' then v_result->0 else v_result end;
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'invalid cart line' using errcode='22023',hint='invalid_input';
end $$;
revoke all on function checkout_private.cart_intent_payload(text,jsonb) from public,anon,authenticated,service_role;

create function public.cart_cancel_intent(p_operation text,p_payload jsonb,p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_user uuid:=public.require_user();
  v_payload jsonb; v_existing checkout_private.cart_intent_journal;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 80 then
    raise exception 'idempotency key required' using errcode='22023',hint='idempotency_required';
  end if;
  v_payload:=checkout_private.cart_intent_payload(p_operation,p_payload);
  -- Same actor lock as add, merge, direct cart DML and checkout. If the original
  -- owns it first, cancellation observes its committed result instead of undoing it.
  perform pg_advisory_xact_lock(hashtextextended('checkout:'||v_user::text,0));
  select * into v_existing from checkout_private.cart_intent_journal
    where buyer_id=v_user and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.operation<>p_operation or v_existing.payload<>v_payload then
      raise exception 'idempotency key reused for a different intent' using errcode='22023',hint='idempotency_conflict';
    end if;
    if v_existing.state='completed' then
      return jsonb_build_object('state','completed','operation',p_operation,'result',v_existing.result,'replayed',true);
    end if;
    return jsonb_build_object('state','cancelled','operation',p_operation,'replayed',true);
  end if;
  perform public.check_rate_limit('cart_cancel_intent',120,60);
  insert into checkout_private.cart_intent_journal(buyer_id,idempotency_key,operation,payload,result,state)
    values(v_user,p_idempotency_key,p_operation,v_payload,'{}'::jsonb,'cancelled');
  return jsonb_build_object('state','cancelled','operation',p_operation,'replayed',false);
end $$;
revoke all on function public.cart_cancel_intent(text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.cart_cancel_intent(text,jsonb,text) to authenticated;
comment on function public.cart_cancel_intent(text,jsonb,text) is
  'Terminal actor-scoped cancellation for a known exact cart intent. Returns a completed result or a durable tombstone; never undoes a successful mutation. Refresh the current cart before accepting another edit.';

-- Canonicalize collection order for the revision only. The selected shipping, actual
-- quantities, address, totals and schedule values remain intact; no amounts are computed here.
-- SQL aggregation order is not a commercial change (e.g. cart lines sharing added_at).
create or replace function public._checkout_review_token(p_preview jsonb) returns text
language plpgsql immutable strict security definer set search_path=public as $$
declare v_doc jsonb:=p_preview; v_groups jsonb; v_group jsonb; v_rows jsonb;
begin
  v_groups:='[]'::jsonb;
  for v_group in select value from jsonb_array_elements(coalesce(v_doc->'groups','[]'::jsonb)) loop
    select coalesce(jsonb_agg(value order by value->>'variant_id',value::text),'[]'::jsonb) into v_rows
      from jsonb_array_elements(coalesce(v_group->'lines','[]'::jsonb));
    v_group:=jsonb_set(v_group,'{lines}',v_rows);
    if jsonb_typeof(v_group->'shipping_options')='array' then
      select coalesce(jsonb_agg(value order by value->>'method_id',value->>'code',value::text),'[]'::jsonb) into v_rows
        from jsonb_array_elements(v_group->'shipping_options');
      v_group:=jsonb_set(v_group,'{shipping_options}',v_rows);
    end if;
    v_groups:=v_groups||jsonb_build_array(v_group);
  end loop;
  select coalesce(jsonb_agg(value order by value->>'key',value::text),'[]'::jsonb) into v_groups
    from jsonb_array_elements(v_groups);
  v_doc:=jsonb_set(v_doc,'{groups}',v_groups);
  select coalesce(jsonb_agg(value order by value->>'code',value::text),'[]'::jsonb) into v_rows
    from jsonb_array_elements(coalesce(v_doc->'plans','[]'::jsonb));
  v_doc:=jsonb_set(v_doc,'{plans}',v_rows);
  select coalesce(jsonb_agg(value order by value->>'seq',value::text),'[]'::jsonb) into v_rows
    from jsonb_array_elements(coalesce(v_doc->'schedule','[]'::jsonb));
  v_doc:=jsonb_set(v_doc,'{schedule}',v_rows);
  if jsonb_typeof(v_doc->'plan'->'allowed_flows')='array' then
    select coalesce(jsonb_agg(value order by value::text),'[]'::jsonb) into v_rows
      from jsonb_array_elements(v_doc->'plan'->'allowed_flows');
    v_doc:=jsonb_set(v_doc,'{plan,allowed_flows}',v_rows);
  end if;
  return encode(extensions.digest(convert_to(v_doc::text,'UTF8'),'sha256'),'hex');
end $$;
revoke all on function public._checkout_review_token(jsonb) from public,anon,authenticated,service_role;

-- Apply explicit catalogue metadata to commercial lines without recomputing amounts.
create or replace function public._reviewed_commercial_lines(p_doc jsonb)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_groups jsonb:='[]'::jsonb; v_group jsonb; v_lines jsonb;
begin
  for v_group in select value from jsonb_array_elements(coalesce(p_doc->'groups','[]'::jsonb)) loop
    select coalesce(jsonb_agg(l.value||jsonb_build_object('product_condition',case when v.id is null then null else p.condition end,'sku',v.sku,
      'image_path',case when v.id is null then null when v.media_classified then
        (select i.path from public.product_variant_images m join public.product_images i on i.id=m.image_id and i.product_id=m.product_id where m.variant_id=v.id and m.product_id=p.id order by m.sort,i.id limit 1)
        else (select i.path from public.product_images i where i.product_id=p.id and not exists(select 1 from public.product_variant_images m where m.image_id=i.id and m.product_id=p.id) order by i.sort,i.id limit 1) end,
      'image_scope',case when v.id is null or v.media_classified then 'variant' else 'general' end) order by l.ordinality),'[]'::jsonb)
      into v_lines from jsonb_array_elements(v_group->'lines') with ordinality l(value,ordinality)
      left join public.products p on p.id=(l.value->>'product_id')::uuid and p.moderation_status='published'
        and exists(select 1 from public.stores s where s.id=p.store_id and s.status='active')
      left join public.product_variants v on v.id=(l.value->>'variant_id')::uuid and v.product_id=p.id and v.active;
    v_groups:=v_groups||jsonb_build_array(v_group||jsonb_build_object('lines',v_lines));
  end loop;
  return p_doc||jsonb_build_object('groups',v_groups);
end $$;
revoke all on function public._reviewed_commercial_lines(jsonb) from public,anon,authenticated,service_role;

create or replace function public._build_checkout_reviewed(p_user uuid,p_address uuid,p_shipping jsonb,p_plan text)
returns jsonb language sql stable security definer set search_path=public as $$
  select public._reviewed_commercial_lines(public._build_checkout(p_user,p_address,p_shipping,p_plan))
$$;
revoke all on function public._build_checkout_reviewed(uuid,uuid,jsonb,text) from public,anon,authenticated,service_role;

create function public.cart_summary_reviewed(p_address_id uuid default null)
returns jsonb language sql stable security definer set search_path=public as $$
  select public._reviewed_commercial_lines(public.cart_summary(p_address_id))
$$;
revoke all on function public.cart_summary_reviewed(uuid) from public,anon,authenticated,service_role;
grant execute on function public.cart_summary_reviewed(uuid) to authenticated;

create or replace function public.checkout_preview_reviewed(
  p_address_id uuid,p_shipping jsonb default '{}'::jsonb,p_plan_code text default 'full'
) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_preview jsonb;
begin
  v_preview:=public._build_checkout_reviewed(public.require_user(),p_address_id,coalesce(p_shipping,'{}'::jsonb),p_plan_code);
  return v_preview||jsonb_build_object('review_token',public._checkout_review_token(v_preview));
end $$;
revoke all on function public.checkout_preview_reviewed(uuid,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.checkout_preview_reviewed(uuid,jsonb,text) to authenticated;

-- The following function is factored verbatim from the corrected place_order,
-- adding only the review argument/check. No monetary formula is copied elsewhere.

create or replace function public._place_order_checked(
  p_address_id uuid, p_shipping jsonb, p_plan_code text, p_idempotency_key text, p_review_token text
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

  -- Keep the physical condition stable from review validation through the order snapshot.
  perform 1 from public.products where id in (select v.product_id from public.product_variants v
    join public.cart_items c on c.variant_id=v.id where c.user_id=v_user) order by id for update nowait;
  v_preview := public._build_checkout_reviewed(v_user, p_address_id, coalesce(p_shipping, '{}'::jsonb), coalesce(p_plan_code, 'full'));

  -- The client sends an opaque revision, never an authoritative price or total.
  -- Check the exact server summary while holding the buyer and variant locks.
  if p_review_token is not null and p_review_token <> public._checkout_review_token(v_preview) then
    raise exception 'checkout changed since review' using errcode='P0001', hint='checkout_changed';
  end if;

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

  -- Freeze the exact delivery address reviewed with this summary; do not re-read a newer address.
  v_addr := jsonb_populate_record(null::public.addresses, v_preview -> 'address');
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
             (l ->> 'unit_price_usd')::numeric as price, (l ->> 'quantity')::int as qty, l->>'product_condition' as product_condition
        from jsonb_array_elements(v_group -> 'lines') l
    loop
      v_pct := public.commission_pct((v_group -> 'store' ->> 'id')::uuid, (select category_id from public.products where id = v_line.product_id));
      insert into public.order_items (order_id, fulfillment_id, store_id, product_id, variant_id, title, variant_title, image_path,
                                      availability, unit_price_usd, quantity, line_total_usd, commission_pct, commission_usd, product_condition)
      values (v_order_id, v_f_id, (v_group -> 'store' ->> 'id')::uuid, v_line.product_id, v_line.variant_id, v_line.title, v_line.variant_title,
              v_line.image_path, v_line.availability, v_line.price, v_line.qty, v_line.price * v_line.qty, v_pct,
              round(v_line.price * v_line.qty * v_pct / 100, 2),v_line.product_condition);
      -- atomic stock decrement; the guard makes concurrent last-unit purchases fail cleanly
      update public.product_variants set stock = stock - v_line.qty
       where id = v_line.variant_id and stock is not null;
      if exists (select 1 from public.product_variants where id = v_line.variant_id and stock is not null and stock < 0) then
        raise exception 'insufficient stock' using errcode = 'P0001', hint = 'insufficient_stock', detail = v_line.variant_id::text;
      end if;
      if coalesce((select personalization_enabled from public.profiles where id=v_user),true) then
      insert into public.user_events (user_id, kind, product_id) values (v_user, 'purchase', v_line.product_id);
      end if;
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
exception when lock_not_available or deadlock_detected then
  raise exception 'product is being updated' using errcode='55P03',hint='product_busy';
end $$;

revoke all on function public._place_order_checked(uuid,jsonb,text,text,text) from public,anon,authenticated,service_role;

-- CREATE OR REPLACE preserves the existing legacy signature and ACL.
create or replace function public.place_order(
  p_address_id uuid,p_shipping jsonb,p_plan_code text,p_idempotency_key text
) returns jsonb language sql security definer set search_path=public as $$
  select public._place_order_checked(p_address_id,p_shipping,p_plan_code,p_idempotency_key,null::text);
$$;

create or replace function public.place_order_reviewed(
  p_address_id uuid,p_shipping jsonb,p_plan_code text,p_idempotency_key text,p_review_token text
) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if p_review_token is null or p_review_token !~ '^[0-9a-f]{64}$' then
    raise exception 'a reviewed checkout token is required' using errcode='22023',hint='invalid_input';
  end if;
  return public._place_order_checked(p_address_id,p_shipping,p_plan_code,p_idempotency_key,p_review_token);
end $$;
revoke all on function public.place_order_reviewed(uuid,jsonb,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.place_order_reviewed(uuid,jsonb,text,text,text) to authenticated;


-- SOURCE: docs/propuestas/guardado-vendedor-2026-11-07/sql/04-seller-reviewed.sql
-- INACTIVE LOCAL REVIEW PROPOSAL. No remote execution or automatic migration authorized.
-- Existing products only. Legacy editor/write signatures and financial formulas are unchanged.
-- Test after the three proposals in integridad-funcional-2026-11-06; do not activate in isolation.
create schema authoring_private;
revoke all on schema authoring_private from public,anon,authenticated,service_role;
create table authoring_private.product_edit_intents (
  actor_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null check(char_length(idempotency_key) between 8 and 80),
  store_id uuid not null,
  product_id uuid not null,
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(actor_id,idempotency_key)
);
-- UUIDs retain historical identity without adding a new FK that would block safe product deletion.
alter table authoring_private.product_edit_intents enable row level security;
revoke all on authoring_private.product_edit_intents from public,anon,authenticated,service_role;
comment on table authoring_private.product_edit_intents is
  'Successful human editor intents only, atomic with save. Do not expire blindly: replays must never restore old inventory.';

create function authoring_private.product_state(p_product_id uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp set TimeZone='UTC' as $$
  select jsonb_build_object(
    'product',to_jsonb(p),
    'variants',coalesce((select jsonb_agg(to_jsonb(v) order by v.id) from public.product_variants v where v.product_id=p.id),'[]'::jsonb),
    'images',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.product_images i where i.product_id=p.id),'[]'::jsonb),
    'costs',(select to_jsonb(c) from public.product_costs c where c.product_id=p.id),
    'variant_costs',coalesce((select jsonb_agg(to_jsonb(c) order by c.variant_id) from public.variant_costs c
      join public.product_variants v on v.id=c.variant_id where v.product_id=p.id),'[]'::jsonb)
  ) from public.products p where p.id=p_product_id;
$$;
revoke all on function authoring_private.product_state(uuid) from public,anon,authenticated,service_role;

create function authoring_private.revision(p_state jsonb) returns text
language sql immutable strict security definer set search_path=public,pg_temp as $$
  select encode(extensions.digest(convert_to(p_state::text,'UTF8'),'sha256'),'hex');
$$;
revoke all on function authoring_private.revision(jsonb) from public,anon,authenticated,service_role;

create function public.seller_product_editor_reviewed(p_store_id uuid,p_product_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_user uuid:=public.require_user(); v_state jsonb; v_events jsonb;
begin
  if p_store_id is null or p_product_id is null then
    raise exception 'store and product required' using errcode='22023',hint='invalid_input';
  end if;
  if not (public.is_store_member(p_store_id) or public.is_admin()) then
    raise exception 'store access denied' using errcode='42501',hint='store_access_denied';
  end if;
  v_state:=authoring_private.product_state(p_product_id);
  if v_state is null or v_state->'product'->>'store_id'<>p_store_id::text then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'to_status',to_status,'note',note,
    'automatic',automatic,'created_at',created_at) order by id),'[]'::jsonb) into v_events
    from public.moderation_events where product_id=p_product_id;
  -- Both revision and editable fields come from the same STABLE statement snapshot.
  return jsonb_build_object('product',v_state->'product'||jsonb_build_object(
    'product_variants',v_state->'variants','product_images',v_state->'images','moderation_events',v_events),
    'revision',authoring_private.revision(v_state),'pricing',public.product_pricing(p_product_id));
end $$;
revoke all on function public.seller_product_editor_reviewed(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.seller_product_editor_reviewed(uuid,uuid) to authenticated;

create function public.seller_save_product_reviewed(
  p_store_id uuid,p_product_id uuid,p_expected_revision text,p_idempotency_key text,
  p_fields jsonb default '{}'::jsonb,p_variants jsonb default '[]'::jsonb,p_images jsonb default '[]'::jsonb,
  p_costs jsonb default null,p_variant_costs jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp set lock_timeout='1500ms' as $$
declare
  v_user uuid:=public.require_user(); v_admin boolean:=public.is_admin(); v_store uuid;
  v_state jsonb; v_after jsonb; v_payload jsonb; v_prior authoring_private.product_edit_intents; v_result jsonb;
  v_fields jsonb; v_variants jsonb; v_images jsonb:='[]'::jsonb; v_costs jsonb;
  v_removed_images uuid[]:='{}'::uuid[];
  v_patch jsonb; v_row jsonb; v_name jsonb; v_options jsonb; v_id uuid;
  v_previous jsonb; v_hint text;
  v_trim_chars constant text := chr(9)||chr(10)||chr(11)||chr(12)||chr(13)||chr(32)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279);
  v_effective_names jsonb; v_metadata_changed boolean:=false; v_sensitive boolean;
begin
  if p_store_id is null or p_product_id is null or p_expected_revision is null or p_expected_revision !~ '^[0-9a-f]{64}$' then
    raise exception 'an existing product review is required' using errcode='22023',hint='invalid_input';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 80 then
    raise exception 'idempotency key required' using errcode='22023',hint='idempotency_required';
  end if;
  if not (public.is_store_member(p_store_id) or v_admin) then
    raise exception 'store access denied' using errcode='42501',hint='store_access_denied';
  end if;
  if jsonb_typeof(p_fields) is distinct from 'object' or jsonb_typeof(p_variants) is distinct from 'array'
     or jsonb_typeof(p_images) is distinct from 'array' or jsonb_typeof(p_variant_costs) is distinct from 'array'
     or (p_costs is not null and jsonb_typeof(p_costs) is distinct from 'object') then
    raise exception 'invalid editor input' using errcode='22023',hint='invalid_input';
  end if;
  if jsonb_array_length(p_variants)>50 or jsonb_array_length(p_images)>20 or jsonb_array_length(p_variant_costs)>50
     or exists(select 1 from jsonb_object_keys(p_fields) k where k not in
       ('title','subtitle','description','category_id','availability','highlights','compare_at_usd','weight_kg','max_per_order','option_names'))
     or (p_costs is not null and exists(select 1 from jsonb_object_keys(p_costs) k where k not in
       ('source','source_url','freight_usd','logistics_usd','margin_pct','auto_price','notes')))
     or (p_costs is null and jsonb_array_length(p_variant_costs)>0) then
    raise exception 'unsupported editor fields' using errcode='22023',hint='invalid_input';
  end if;
  -- JSON numbers only: casting the text 'NaN' to PostgreSQL numeric would bypass ordinary >0 checks.
  if exists(select 1 from jsonb_each(p_fields) e where
      (e.key in ('title','category_id','availability') and jsonb_typeof(e.value)<>'string')
      or (e.key in ('subtitle','description') and jsonb_typeof(e.value) not in ('string','null'))
      or (e.key in ('weight_kg','max_per_order') and jsonb_typeof(e.value)<>'number')
      or (e.key='compare_at_usd' and jsonb_typeof(e.value) not in ('number','null'))
      or (e.key in ('highlights','option_names') and jsonb_typeof(e.value)<>'array'))
    or (p_fields ? 'highlights' and exists(select 1 from jsonb_array_elements(p_fields->'highlights') e where jsonb_typeof(e)<>'string')) then
    raise exception 'invalid product field types' using errcode='22023',hint='invalid_input';
  end if;
  if p_costs is not null and exists(select 1 from jsonb_each(p_costs) e where
      (e.key in ('freight_usd','logistics_usd','margin_pct') and jsonb_typeof(e.value) not in ('number','null'))
      or (e.key='auto_price' and jsonb_typeof(e.value)<>'boolean')
      or (e.key='source' and jsonb_typeof(e.value)<>'string')
      or (e.key in ('source_url','notes') and jsonb_typeof(e.value) not in ('string','null'))) then
    raise exception 'invalid cost field types' using errcode='22023',hint='invalid_input';
  end if;
  for v_patch in select value from jsonb_array_elements(p_variant_costs) loop
    if jsonb_typeof(v_patch) is distinct from 'object' or jsonb_typeof(v_patch->'variant_id') is distinct from 'string'
      or jsonb_typeof(v_patch->'cost_usd') is null or jsonb_typeof(v_patch->'cost_usd') not in ('number','null')
      or exists(select 1 from jsonb_object_keys(v_patch) k where k not in ('variant_id','cost_usd')) then
      raise exception 'invalid variant cost types' using errcode='22023',hint='invalid_input';
    end if;
  end loop;
  v_payload:=jsonb_build_object('store_id',p_store_id,'product_id',p_product_id,'expected_revision',p_expected_revision,
    'fields',p_fields,'variants',p_variants,'images',p_images,'costs',p_costs,'variant_costs',p_variant_costs);
  perform pg_advisory_xact_lock(hashtextextended('seller-edit:'||v_user::text||':'||p_idempotency_key,0));
  -- Permission may have been revoked while an identical intent held the advisory lock.
  -- Lock the actual authorizing row until commit; no caller-supplied role flag is trusted.
  v_admin:=public.is_admin();
  if v_admin then
    perform 1 from public.user_roles where user_id=v_user and role in ('admin','superadmin') for share nowait;
  else
    perform 1 from public.store_members where user_id=v_user and store_id=p_store_id for share nowait;
  end if;
  if not found then
    raise exception 'store access changed' using errcode='42501',hint='store_access_denied';
  end if;

  select store_id into v_store from public.products where id=p_product_id and store_id=p_store_id;
  if not found then raise exception 'product not found' using errcode='P0002',hint='not_found'; end if;
  select * into v_prior from authoring_private.product_edit_intents where actor_id=v_user and idempotency_key=p_idempotency_key;
  if found then
    if v_prior.payload<>v_payload then
      raise exception 'intent key reused with different input' using errcode='22023',hint='idempotency_conflict';
    end if;
    return v_prior.result||jsonb_build_object('replayed',true);
  end if;

  -- Match checkout's variant-first order. NOWAIT also breaks cycles with old product-first editors/repricing.
  perform 1 from public.product_variants where product_id=p_product_id order by id for update nowait;
  perform 1 from public.products where id=p_product_id and store_id=p_store_id for update nowait;
  if not found then raise exception 'product not found' using errcode='P0002',hint='not_found'; end if;
  -- Parent FOR UPDATE blocks new FK children. Cover any child committed between the first scan and parent lock.
  perform 1 from public.product_variants where product_id=p_product_id order by id for update nowait;
  perform 1 from public.product_images where product_id=p_product_id order by id for update nowait;
  perform 1 from public.product_costs where product_id=p_product_id for update nowait;
  perform 1 from public.variant_costs c join public.product_variants v on v.id=c.variant_id
    where v.product_id=p_product_id order by c.variant_id for update of c nowait;
  v_state:=authoring_private.product_state(p_product_id);
  if authoring_private.revision(v_state) is distinct from p_expected_revision then
    raise exception 'editor state changed' using errcode='40001',hint='seller_revision_conflict';
  end if;
  v_fields:=v_state->'product'||p_fields;
  v_effective_names:=v_fields->'option_names';
  if p_fields ? 'option_names' then
    if jsonb_typeof(v_effective_names) is distinct from 'array' or jsonb_array_length(v_effective_names)>10 then
      raise exception 'invalid option names' using errcode='22023',hint='invalid_input';
    end if;
    for v_name in select value from jsonb_array_elements(v_effective_names) loop
      if jsonb_typeof(v_name)<>'string' or char_length(v_name#>>'{}') not between 1 and 40
         or nullif(btrim(v_name#>>'{}',v_trim_chars),'') is null then
        raise exception 'invalid option name' using errcode='22023',hint='invalid_input';
      end if;
    end loop;
    if (select count(distinct lower(btrim(value#>>'{}',v_trim_chars))) from jsonb_array_elements(v_effective_names))<>jsonb_array_length(v_effective_names) then
      raise exception 'duplicate option names' using errcode='22023',hint='invalid_input';
    end if;
    v_metadata_changed:=v_effective_names is distinct from v_state->'product'->'option_names';
  end if;
  if exists(select 1 from jsonb_each(p_fields) e where e.key in ('subtitle','highlights') and e.value is distinct from v_state->'product'->e.key) then
    v_metadata_changed:=true;
  end if;

  -- The complete live variant set is retained. Incoming records are patches, never an implicit deletion.
  v_variants:=v_state->'variants';
  if (select count(distinct (value->>'id')::uuid) from jsonb_array_elements(p_variants))<>jsonb_array_length(p_variants) then
    raise exception 'duplicate variant ids' using errcode='22023',hint='invalid_input';
  end if;
  for v_patch in select value from jsonb_array_elements(p_variants) loop
    if jsonb_typeof(v_patch)<>'object' or jsonb_typeof(v_patch->'id') is distinct from 'string'
       or exists(select 1 from jsonb_object_keys(v_patch) k where k not in ('id','title','sku','price_usd','stock','active','sort','options')) then
      raise exception 'invalid variant patch' using errcode='22023',hint='invalid_input';
    end if;
    if exists(select 1 from jsonb_each(v_patch) e where
      (e.key in ('price_usd','sort') and jsonb_typeof(e.value)<>'number')
      or (e.key='stock' and jsonb_typeof(e.value) not in ('number','null'))
      or (e.key='active' and jsonb_typeof(e.value)<>'boolean')
      or (e.key='title' and jsonb_typeof(e.value)<>'string')
      or (e.key='sku' and jsonb_typeof(e.value) not in ('string','null'))) then
      raise exception 'invalid variant field types' using errcode='22023',hint='invalid_input';
    end if;
    v_id:=(v_patch->>'id')::uuid;
    v_patch:=jsonb_set(v_patch,'{id}',to_jsonb(v_id));
    if exists(select 1 from public.product_variants where id=v_id and product_id<>p_product_id) then
      raise exception 'variant not in product' using errcode='22023',hint='invalid_input';
    end if;
    select value into v_row from jsonb_array_elements(v_variants) where value->>'id'=v_id::text;
    if v_row is null then v_metadata_changed:=true; end if;
    if v_patch ? 'options' then
      v_options:=v_patch->'options';
      if jsonb_typeof(v_options) is distinct from 'object' or (select count(*) from jsonb_object_keys(v_options))>10 then
        raise exception 'invalid variant options' using errcode='22023',hint='invalid_input';
      end if;
      if exists(select 1 from jsonb_each(v_options) e where char_length(e.key) not between 1 and 40
        or nullif(btrim(e.key,v_trim_chars),'') is null or jsonb_typeof(e.value)<>'string'
        or char_length(e.value#>>'{}') not between 1 and 80 or nullif(btrim(e.value#>>'{}',v_trim_chars),'') is null)
        or (select count(distinct lower(btrim(k,v_trim_chars))) from jsonb_object_keys(v_options) k)<>(select count(*) from jsonb_object_keys(v_options)) then
        raise exception 'invalid variant options' using errcode='22023',hint='invalid_input';
      end if;
      if exists(select 1 from public.product_variant_images m where m.variant_id=v_id)
         and public._catalog_option_color(v_options) is distinct from public._catalog_option_color(v_row->'options') then
        raise exception 'review assigned photos before changing a color' using errcode='42501',hint='catalog_metadata_review_required';
      end if;
      if v_options is distinct from coalesce(v_row->'options','{}'::jsonb) then v_metadata_changed:=true; end if;
    end if;
    if v_patch ? 'title' and v_patch->'title' is distinct from v_row->'title' then v_metadata_changed:=true; end if;
    v_row:=coalesce(v_row,'{}'::jsonb)||v_patch;
    v_variants:=(select coalesce(jsonb_agg(value),'[]'::jsonb) from jsonb_array_elements(v_variants) where value->>'id'<>v_id::text)||jsonb_build_array(v_row);
  end loop;
  -- Validate the resulting option relation only when explicitly edited; legacy {} remains legitimate.
  for v_row in select value from jsonb_array_elements(v_variants) loop
    if p_fields ? 'option_names' or exists(select 1 from jsonb_array_elements(p_variants) v where (v->>'id')::uuid=(v_row->>'id')::uuid and v ? 'options') then
      if exists(select 1 from jsonb_object_keys(coalesce(v_row->'options','{}'::jsonb)) k where not exists
        (select 1 from jsonb_array_elements(v_effective_names) n where lower(btrim(n#>>'{}',v_trim_chars))=lower(btrim(k,v_trim_chars)))) then
        raise exception 'option key is not declared' using errcode='22023',hint='invalid_input';
      end if;
    end if;
  end loop;

  if (select count(distinct (value->>'id')::uuid) from jsonb_array_elements(p_images))<>jsonb_array_length(p_images) then
    raise exception 'duplicate image ids' using errcode='22023',hint='invalid_input';
  end if;
  for v_patch in select value from jsonb_array_elements(p_images) loop
    if jsonb_typeof(v_patch)<>'object' or jsonb_typeof(v_patch->'id') is distinct from 'string'
       or exists(select 1 from jsonb_object_keys(v_patch) k where k not in ('id','path','sort','alt','remove')) then
      raise exception 'invalid image patch' using errcode='22023',hint='invalid_input';
    end if;
    if exists(select 1 from jsonb_each(v_patch) e where
      (e.key='path' and jsonb_typeof(e.value)<>'string')
      or (e.key='sort' and jsonb_typeof(e.value)<>'number')
      or (e.key='alt' and jsonb_typeof(e.value) not in ('string','null'))) then
      raise exception 'invalid image field types' using errcode='22023',hint='invalid_input';
    end if;
    v_id:=(v_patch->>'id')::uuid;
    v_patch:=jsonb_set(v_patch,'{id}',to_jsonb(v_id));
    if exists(select 1 from public.product_images where id=v_id and product_id<>p_product_id) then
      raise exception 'image not in product' using errcode='22023',hint='invalid_input';
    end if;
    select value into v_row from jsonb_array_elements(v_state->'images') where value->>'id'=v_id::text;
    if v_patch ? 'remove' then
      if v_patch->'remove' is distinct from 'true'::jsonb or (select count(*) from jsonb_object_keys(v_patch))<>2 or v_row is null then
        raise exception 'invalid explicit image removal' using errcode='22023',hint='invalid_input';
      end if;
      if exists(select 1 from public.product_variant_images where image_id=v_id) then
        raise exception 'review variant photo associations before removing image' using errcode='42501',hint='catalog_metadata_review_required';
      end if;
      v_removed_images:=array_append(v_removed_images,v_id);
      v_metadata_changed:=true;
      continue;
    end if;
    if v_row is null then v_metadata_changed:=true; end if;
    if v_row is not null and v_patch ? 'path' and v_patch->'path' is distinct from v_row->'path' then
      raise exception 'use a new image id for a different immutable photo' using errcode='22023',hint='invalid_input';
    end if;
    if exists(select 1 from jsonb_each(v_patch) e where e.key<>'id' and e.value is distinct from v_row->e.key) then
      v_metadata_changed:=true;
    end if;
    v_images:=v_images||jsonb_build_array(coalesce(v_row,'{}'::jsonb)||v_patch);
  end loop;
  if jsonb_array_length(v_state->'images')-cardinality(v_removed_images)
      +(select count(*) from jsonb_array_elements(v_images) i where not exists(
        select 1 from jsonb_array_elements(v_state->'images') old where old->>'id'=i->>'id'))
      >greatest(10,jsonb_array_length(v_state->'images')) then
    raise exception 'too many product images' using errcode='22023',hint='invalid_input';
  end if;

  perform 1 from public.categories where id in ((v_state->'product'->>'category_id')::uuid,(v_fields->>'category_id')::uuid) order by id for share nowait;
  select coalesce(bool_or(requires_review or risk_level<>'low'),true) into v_sensitive from public.categories
    where id in ((v_state->'product'->>'category_id')::uuid,(v_fields->>'category_id')::uuid);
  if not v_admin and v_state->'product'->>'moderation_status'='published' and v_sensitive and v_metadata_changed then
    raise exception 'sensitive published metadata requires review' using errcode='42501',hint='catalog_sensitive_review_required';
  end if;
  if coalesce((v_state->'costs'->>'auto_price')::boolean,false)
     and v_fields->'weight_kg' is distinct from v_state->'product'->'weight_kg' and p_costs is null then
    raise exception 'weight edit requires explicit cost review in automatic pricing' using errcode='22023',hint='seller_price_review_required';
  end if;
  v_costs:=case when p_costs is null then null else coalesce(nullif(v_state->'costs','null'::jsonb),'{}'::jsonb)||p_costs end;

  if jsonb_array_length(v_variants) not between 1 and 50 or not exists(
      select 1 from jsonb_array_elements(v_variants) v where (v->>'active')::boolean) then
    raise exception 'at least one active variant required' using errcode='22023',hint='invalid_input';
  end if;
  -- Patch writes are explicitly scoped. Do not call the legacy whole-form upsert: it touches omitted variants.
  -- Existing moderation, price/stock, audit and cost procedures remain the authoritative operations.
  if exists(select 1 from jsonb_each(p_fields) e where e.value is distinct from v_state->'product'->e.key) then
    update public.products set title=case when p_fields ? 'title' then btrim(v_fields->>'title') else title end,
      subtitle=case when p_fields ? 'subtitle' then nullif(btrim(v_fields->>'subtitle'),'') else subtitle end,
      description=case when p_fields ? 'description' then nullif(btrim(v_fields->>'description'),'') else description end,
      highlights=array(select jsonb_array_elements_text(v_fields->'highlights')),
      option_names=array(select jsonb_array_elements_text(v_effective_names)),
      category_id=(v_fields->>'category_id')::uuid,availability=(v_fields->>'availability')::public.availability,
      compare_at_usd=(v_fields->>'compare_at_usd')::numeric,weight_kg=(v_fields->>'weight_kg')::numeric,
      max_per_order=(v_fields->>'max_per_order')::integer
      where id=p_product_id and store_id=p_store_id;
  end if;
  for v_patch in select value from jsonb_array_elements(p_variants) loop
    v_id:=(v_patch->>'id')::uuid;
    select value into v_row from jsonb_array_elements(v_variants) where value->>'id'=v_id::text;
    select value into v_previous from jsonb_array_elements(v_state->'variants') where value->>'id'=v_id::text;
    if coalesce((v_state->'costs'->>'auto_price')::boolean,false)
       and coalesce((v_costs->>'auto_price')::boolean,true)
       and v_previous is not null and v_previous->'price_usd' is distinct from v_row->'price_usd' then
      raise exception 'automatic price follows the existing cost procedure' using errcode='22023',hint='seller_price_review_required';
    end if;
    if v_previous is null then
      insert into public.product_variants(id,product_id,title,sku,price_usd,stock,active,sort,options)
        values(v_id,p_product_id,btrim(v_row->>'title'),nullif(btrim(v_row->>'sku'),''),
          (v_row->>'price_usd')::numeric,(v_row->>'stock')::integer,(v_row->>'active')::boolean,
          (v_row->>'sort')::integer,coalesce(v_row->'options','{}'::jsonb));
    else
      if exists(select 1 from jsonb_each(v_row) e where e.key in ('title','sku','price_usd','stock','active','sort')
        and e.value is distinct from v_previous->e.key) then
        update public.product_variants set title=case when v_patch ? 'title' then btrim(v_row->>'title') else title end,
          sku=case when v_patch ? 'sku' then nullif(btrim(v_row->>'sku'),'') else sku end,
          price_usd=(v_row->>'price_usd')::numeric,stock=(v_row->>'stock')::integer,
          active=(v_row->>'active')::boolean,sort=(v_row->>'sort')::integer
          where id=v_id and product_id=p_product_id;
      end if;
      if v_patch ? 'options' and v_patch->'options' is distinct from v_previous->'options' then
        update public.product_variants set options=v_patch->'options' where id=v_id and product_id=p_product_id;
      end if;
    end if;
  end loop;
  -- Delete only explicitly reviewed references. Original Storage objects are never deleted.
  delete from public.product_images where product_id=p_product_id and id=any(v_removed_images);
  for v_row in select value from jsonb_array_elements(v_images) loop
    v_id:=(v_row->>'id')::uuid;
    select value into v_previous from jsonb_array_elements(v_state->'images') where value->>'id'=v_id::text;
    if v_previous is null then
      if jsonb_typeof(v_row->'path') is distinct from 'string'
         or v_row->>'path' not like p_store_id::text||'/'||p_product_id::text||'/%' then
        raise exception 'image outside store' using errcode='42501',hint='store_access_denied';
      end if;
      insert into public.product_images(id,product_id,path,alt,sort)
        values(v_id,p_product_id,v_row->>'path',case when v_row ? 'alt' then v_row->>'alt' else v_fields->>'title' end,(v_row->>'sort')::integer);
    elsif v_row->'sort' is distinct from v_previous->'sort' or v_row->'alt' is distinct from v_previous->'alt' then
      update public.product_images set sort=(v_row->>'sort')::integer,alt=v_row->>'alt' where id=v_id and product_id=p_product_id;
    end if;
  end loop;
  if v_costs is not null then
    perform public.set_product_costs(p_product_id,v_costs,p_variant_costs);
  end if;
  v_after:=authoring_private.product_state(p_product_id);
  v_result:=jsonb_build_object('product_id',p_product_id,'revision',authoring_private.revision(v_after));
  insert into authoring_private.product_edit_intents(actor_id,idempotency_key,store_id,product_id,payload,result)
    values(v_user,p_idempotency_key,p_store_id,p_product_id,v_payload,v_result);
  return v_result||jsonb_build_object('replayed',false);
exception
  when lock_not_available or deadlock_detected then raise exception 'product is being updated' using errcode='55P03',hint='product_busy';
  when invalid_text_representation or numeric_value_out_of_range or unique_violation then
    raise exception 'invalid or duplicate editor values' using errcode='22023',hint='invalid_input';
  when invalid_parameter_value then
    get stacked diagnostics v_hint=PG_EXCEPTION_HINT;
    if nullif(v_hint,'') is not null then raise; end if;
    raise exception 'invalid editor values' using errcode='22023',hint='invalid_input';
end $$;
revoke all on function public.seller_save_product_reviewed(uuid,uuid,text,text,jsonb,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.seller_save_product_reviewed(uuid,uuid,text,text,jsonb,jsonb,jsonb,jsonb,jsonb) to authenticated;


notify pgrst, 'reload schema';
