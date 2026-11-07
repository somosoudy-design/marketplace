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
