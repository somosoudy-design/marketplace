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
