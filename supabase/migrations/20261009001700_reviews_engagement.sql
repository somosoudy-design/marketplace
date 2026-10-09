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

-- ---------- money formatting for notification copy ----------
create or replace function public._fmt_usd(p numeric) returns text
language sql immutable set search_path = public as $$
  select '$' || translate(to_char(round(p, 2), 'FM999,999,990.00'), ',.', '.,')
$$;

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
    raise exception 'review can no longer be edited' using errcode = 'P0001', hint = 'not_reviewable';
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
