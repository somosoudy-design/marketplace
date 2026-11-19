-- Durable receipts for guest favorites. Existing favorites permissions, toggles and cart/checkout remain intact.
begin;

do $guard$
begin
  if to_regnamespace('favorites_private') is not null
     or to_regprocedure('public.favorites_merge_intent(uuid[],text)') is not null then
    raise exception 'Proposed favorites objects already exist; review before applying again';
  end if;
  if to_regclass('public.favorites') is null
     or to_regprocedure('public.require_user()') is null
     or to_regprocedure('public.check_rate_limit(text,integer,integer)') is null then
    raise exception 'Required existing favorites/auth/rate-limit support is absent';
  end if;
end
$guard$;

create schema favorites_private;
revoke all on schema favorites_private from public, anon, authenticated, service_role;

create table favorites_private.merge_journal (
  buyer_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 80),
  product_ids uuid[] not null check (cardinality(product_ids) between 1 and 100),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  primary key (buyer_id, idempotency_key),
  check (array_position(product_ids, null) is null)
);
alter table favorites_private.merge_journal enable row level security;
-- No caller, including the owner-buyer, can read/write a receipt directly.
revoke all on favorites_private.merge_journal from public, anon, authenticated, service_role;
comment on table favorites_private.merge_journal is
  'Historical favorite-merge receipts. Do not expire or delete blindly: replay after a later unfavorite must not reinsert. Account deletion cascades only its own receipts.';

create function public.favorites_merge_intent(p_product_ids uuid[], p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_user uuid := public.require_user();
  v_ids uuid[];
  v_existing favorites_private.merge_journal%rowtype;
  v_inserted integer;
  v_result jsonb;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 80 then
    raise exception 'idempotency key required' using errcode = '22023', hint = 'idempotency_required';
  end if;
  -- Bound the raw request before DISTINCT too; duplicate flooding is not free.
  if p_product_ids is null or cardinality(p_product_ids) not between 1 and 100
     or array_ndims(p_product_ids) <> 1 then
    raise exception 'one to one hundred product IDs are required' using errcode = '22023', hint = 'invalid_input';
  end if;
  if array_position(p_product_ids, null) is not null then
    raise exception 'null product IDs are not allowed' using errcode = '22023', hint = 'invalid_input';
  end if;
  select array_agg(ids.product_id order by ids.product_id)
    into v_ids
    from (select distinct unnest(p_product_ids) as product_id) ids;

  -- Separate namespace from cart/checkout. Concurrent migrations for this buyer
  -- serialize; other buyers neither share receipts nor receive another result.
  perform pg_advisory_xact_lock(hashtextextended('favorites-merge:' || v_user::text, 0));
  select j.* into v_existing
    from favorites_private.merge_journal j
   where j.buyer_id = v_user and j.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.product_ids <> v_ids then
      raise exception 'idempotency key reused for different favorites'
        using errcode = '22023', hint = 'idempotency_conflict';
    end if;
    -- Historical result only: a later normal unfavorite remains removed.
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;

  -- Reuse the existing limiter only for new receipts, not response recovery.
  perform public.check_rate_limit('favorites_merge_intent', 120, 60);
  -- Same owner-bound INSERT/PK/FK operation already available to this buyer.
  -- No SELECT on products, no broader catalog visibility, no price/stock access.
  insert into public.favorites(user_id, product_id)
    select v_user, ids.product_id from unnest(v_ids) as ids(product_id)
    on conflict (user_id, product_id) do nothing;
  get diagnostics v_inserted = row_count;
  v_result := jsonb_build_object(
    'accepted', cardinality(v_ids),
    'inserted', v_inserted,
    'product_ids', to_jsonb(v_ids)
  );
  insert into favorites_private.merge_journal(buyer_id, idempotency_key, product_ids, result)
    values (v_user, p_idempotency_key, v_ids, v_result);
  return v_result || jsonb_build_object('replayed', false);
end
$function$;

revoke all on function public.favorites_merge_intent(uuid[], text)
  from public, anon, authenticated, service_role;
grant execute on function public.favorites_merge_intent(uuid[], text) to authenticated;
comment on function public.favorites_merge_intent(uuid[], text) is
  'Actor-bound additive guest-favorites migration, at most 100 input IDs. UUID-set normalization and historical receipts make lost-response retries non-mutating. Existing favorites and timestamps are preserved; invalid FKs roll back the entire new operation.';

notify pgrst, 'reload schema';
commit;
