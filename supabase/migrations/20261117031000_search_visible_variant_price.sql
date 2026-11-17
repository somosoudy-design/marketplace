-- F07. Price filters and global ordering use the variant displayed by the catalogue.
-- Preserve the existing RLS-bound, security-invoker search contract.
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
  select pc.id, pc.slug, pc.title, pc.subtitle,
         pc.store_id, pc.store_name, pc.store_slug, pc.store_kind,
         pc.category_id, pc.category_slug, pc.category_name, pc.tone, pc.brand_name,
         pc.availability, pc.origin,
         -- Preserve the legacy numeric field for a card with no selectable variant.
         coalesce(preview.price_usd, pc.price_usd)::numeric(12,2),
         pc.compare_at_usd, pc.image_path, pc.stock_total,
         pc.lead_min_days, pc.lead_max_days, pc.popularity, pc.published_at,
         pc.is_demo, pc.moderation_status, pc.store_status, pc.rating_avg, pc.rating_count
    from public.product_cards pc
    join public.products p on p.id = pc.id
    left join public.categories cat on cat.id = pc.category_id
    left join lateral (
      -- Match resolveProductSelection and catalog_metadata's stable variant order.
      select case when v.price_usd > 0 and v.price_usd < 'Infinity'::numeric then v.price_usd end as price_usd
        from public.product_variants v
       where v.product_id = pc.id and v.active
       order by case when v.price_usd > 0 and v.price_usd < 'Infinity'::numeric
                          and (v.stock is null or v.stock > 0) then 0 else 1 end,
                v.sort, v.id
       limit 1
    ) preview on true
   where pc.moderation_status = 'published' and pc.store_status = 'active'
     and (v_q is null or (v_ts is not null and p.search @@ v_ts) or similarity(p.title, v_q) > 0.25)
     and (p_category is null or pc.category_slug = p_category
          or cat.parent_id = (select id from public.categories where slug = p_category))
     and (p_store is null or pc.store_slug = p_store)
     and (p_collection is null or exists (
          select 1 from public.collection_products cp join public.collections co on co.id = cp.collection_id
           where co.slug = p_collection and co.active and cp.product_id = pc.id))
     and (p_availability is null or pc.availability = any (p_availability))
     and (p_min_price is null or preview.price_usd >= p_min_price)
     and (p_max_price is null or preview.price_usd <= p_max_price)
   order by
     case when p_sort not in ('price_asc', 'price_desc') and pc.availability in ('sold_out', 'unavailable') then 1 else 0 end,
     case when p_sort = 'price_asc' then preview.price_usd end asc nulls last,
     case when p_sort = 'price_desc' then preview.price_usd end desc nulls last,
     case when p_sort = 'newest' then pc.published_at end desc nulls last,
     case when p_sort = 'relevance' and v_q is not null then ts_rank(p.search, v_ts) + similarity(p.title, v_q) end desc nulls last,
     case when p_sort not in ('price_asc', 'price_desc') then pc.popularity end desc, pc.id
   limit least(greatest(p_limit, 1), 60) offset greatest(p_offset, 0);
end $$;
