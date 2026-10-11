-- Local preparation only: do not deploy without authorization.
-- Existing moderation history remains the authority; no new financial formulas or permissions.
create or replace function public.enforce_product_moderation() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_requires boolean;
  v_risk public.risk_level;
  v_store_status public.store_status;
  v_admin boolean := public.is_admin() or public.is_service_role();
  v_prev public.moderation_status := case when tg_op = 'UPDATE' then old.moderation_status else null end;
begin
  select requires_review or risk_level <> 'low', risk_level into v_requires, v_risk
    from public.categories where id = new.category_id;
  select status into v_store_status from public.stores where id = new.store_id;

  if not v_admin then
    if tg_op = 'UPDATE' and old.moderation_status in ('suspended', 'rejected') then
      -- edits after rejection resubmit for review; suspension can only be lifted by admins
      new.moderation_status := case when old.moderation_status = 'rejected' then 'pending' else 'suspended' end;
    elsif tg_op = 'UPDATE' and old.moderation_status in ('pending', 'in_review')
      and (select e.to_status from public.moderation_events e
           where e.product_id = old.id and not e.automatic order by e.id desc limit 1)
          in ('rejected', 'pending', 'in_review') then
      -- A subsequent variant/cost trigger must not auto-approve a resubmission or a manual review.
      new.moderation_status := old.moderation_status;
    elsif v_requires or v_store_status <> 'active' then
      if tg_op = 'INSERT'
         or new.title is distinct from old.title
         or new.description is distinct from old.description
         or new.category_id is distinct from old.category_id
         or old.moderation_status <> 'published' then
        new.moderation_status := 'pending';
      else
        new.moderation_status := old.moderation_status;
      end if;
    else
      new.moderation_status := 'published';
    end if;
    new.moderation_note := case when tg_op = 'UPDATE' then old.moderation_note else null end;
    new.is_demo := case when tg_op = 'UPDATE' then old.is_demo else false end;
    new.popularity := case when tg_op = 'UPDATE' then old.popularity else 0 end;
  end if;

  if new.moderation_status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  if v_prev is distinct from new.moderation_status then
    insert into public.moderation_events (product_id, from_status, to_status, note, actor_id, automatic)
    values (new.id, v_prev, new.moderation_status,
            case when not v_admin then case when new.moderation_status = 'published' then 'auto: low-risk category' else 'auto: requires review (' || v_risk || ')' end end,
            auth.uid(), not v_admin);
  end if;
  return new;
end $$;

-- One transaction for the same product, variant, image and optional cost operations as the panel.
-- SECURITY INVOKER keeps RLS and all existing triggers active. Never accepts approval/store reassignment.
create or replace function public.seller_save_product(p_store_id uuid, p_product_id uuid,
  p_fields jsonb, p_variants jsonb, p_images jsonb default '[]', p_costs jsonb default null,
  p_variant_costs jsonb default '[]') returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v jsonb; v_count int; v_existing public.products; v_kind public.store_kind;
begin
  perform public.require_store_member(p_store_id);
  if jsonb_typeof(p_fields) is distinct from 'object' or jsonb_typeof(p_variants) is distinct from 'array'
     or jsonb_typeof(p_images) is distinct from 'array' then
    raise exception 'invalid input' using errcode='22023', hint='invalid_input';
  end if;
  if jsonb_array_length(p_variants) not between 1 and 50 or jsonb_array_length(p_images)>10
     or not exists(select 1 from jsonb_array_elements(p_variants) x where (x->>'active')::boolean) then
    raise exception 'invalid variants' using errcode='22023', hint='invalid_input';
  end if;
  if (select count(distinct x->>'id') from jsonb_array_elements(p_variants) x) <> jsonb_array_length(p_variants)
     or (select count(distinct x->>'id') from jsonb_array_elements(p_images) x) <> jsonb_array_length(p_images) then
    raise exception 'duplicate ids' using errcode='22023', hint='invalid_input';
  end if;
  select * into v_existing from public.products where id=p_product_id for update;
  if found and v_existing.store_id <> p_store_id then
    raise exception 'wrong store' using errcode='42501', hint='store_access_denied';
  end if;
  select kind into v_kind from public.stores where id=p_store_id;
  if v_existing.id is null then
    insert into public.products(id,store_id,category_id,slug,title,origin)
    values(p_product_id,p_store_id,(p_fields->>'category_id')::uuid,'p-'||p_product_id::text,trim(p_fields->>'title'),
      case when v_kind='seller' then 'seller'::public.product_origin else 'local'::public.product_origin end)
    on conflict(id) do nothing;
  end if;
  update public.products set title=trim(p_fields->>'title'), subtitle=nullif(trim(p_fields->>'subtitle'),''),
    description=nullif(trim(p_fields->>'description'),''),
    highlights=array(select jsonb_array_elements_text(coalesce(p_fields->'highlights','[]'))),
    category_id=(p_fields->>'category_id')::uuid, availability=(p_fields->>'availability')::public.availability,
    compare_at_usd=nullif(p_fields->>'compare_at_usd','')::numeric, weight_kg=(p_fields->>'weight_kg')::numeric,
    max_per_order=(p_fields->>'max_per_order')::int
    where id=p_product_id and store_id=p_store_id;
  get diagnostics v_count=row_count;
  if v_count<>1 then raise exception 'not found' using errcode='P0002', hint='not_found'; end if;

  for v in select * from jsonb_array_elements(p_variants) loop
    if exists(select 1 from public.product_costs where product_id=p_product_id and auto_price)
       and coalesce((p_costs->>'auto_price')::boolean,true)
       and exists(select 1 from public.product_variants where id=(v->>'id')::uuid and price_usd<>(v->>'price_usd')::numeric) then
      raise exception 'automatic price follows cost' using errcode='22023', hint='invalid_input';
    end if;
    insert into public.product_variants(id,product_id,title,sku,price_usd,stock,active,sort)
      values((v->>'id')::uuid,p_product_id,trim(v->>'title'),nullif(trim(v->>'sku'),''),
        (v->>'price_usd')::numeric,nullif(v->>'stock','')::int,(v->>'active')::boolean,(v->>'sort')::int)
    on conflict(id) do update set title=excluded.title,sku=excluded.sku,price_usd=excluded.price_usd,
      stock=excluded.stock,active=excluded.active,sort=excluded.sort
      where product_variants.product_id=p_product_id;
    get diagnostics v_count=row_count;
    if v_count<>1 then raise exception 'variant not in product' using errcode='22023', hint='invalid_input'; end if;
  end loop;
  for v in select * from jsonb_array_elements(p_images) loop
    if not (v->>'path' like p_store_id::text||'/'||p_product_id::text||'/%')
       and not exists(select 1 from public.product_images where id=(v->>'id')::uuid and product_id=p_product_id and path=v->>'path') then
      raise exception 'image outside store' using errcode='42501', hint='store_access_denied';
    end if;
    insert into public.product_images(id,product_id,path,alt,sort)
      values((v->>'id')::uuid,p_product_id,v->>'path',trim(p_fields->>'title'),(v->>'sort')::int)
    on conflict(id) do update set path=excluded.path,alt=excluded.alt,sort=excluded.sort
      where product_images.product_id=p_product_id;
    get diagnostics v_count=row_count;
    if v_count<>1 then raise exception 'image not in product' using errcode='22023', hint='invalid_input'; end if;
  end loop;
  if p_costs is not null then
    perform public.set_product_costs(p_product_id,p_costs,p_variant_costs);
  end if;
  return p_product_id;
end $$;

create or replace function public.seller_editor_ready() returns boolean
language sql stable security invoker set search_path=public as $$ select true $$;
revoke all on function public.seller_save_product(uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb), public.seller_editor_ready() from public,anon;
grant execute on function public.seller_save_product(uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb), public.seller_editor_ready() to authenticated,service_role;
