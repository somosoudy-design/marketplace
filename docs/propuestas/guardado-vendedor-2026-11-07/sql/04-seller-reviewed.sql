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
