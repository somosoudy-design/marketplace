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
