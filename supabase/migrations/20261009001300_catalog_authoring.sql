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
