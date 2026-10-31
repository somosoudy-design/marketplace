-- Commercial price engine (docs/PRECIOS.md; the same formulas live in packages/core/src/pricing.ts for previews).
--
--   landed      = cost (Amazon) + freight (editable; weight × USD/kg) + logistics per unit
--   divisas     = landed × (1 + margin)                  what has to come in as real dollars
--   gap         = USDT/VES (P2P) ÷ USD/VES (BCV) − 1     taken once a day into pricing_snapshots, never negative
--   main price  = ending(divisas × (1 + gap))            dollars at the BCV rate: product_variants.price_usd
--   Pago Móvil  = main × BCV                             unchanged: bolívares at the official rate
--   Zelle/USDT  = main × BCV ÷ P2P (÷ USDT per dollar)    the gap is undone once, as the quote's conversion rate
--
-- Orders and obligations stay in dollars at the BCV rate. A Zelle or USDT quote converts them with the snapshot's
-- factor, and verification credits the full base in BCV dollars, so the discount is the gap itself: real (the
-- business receives what the product must bring) and verifiable (snapshot, rates and factor are on the quote).
-- Without a valid snapshot nothing old is used: Zelle/USDT are quoted at the main price, with no discount, and the
-- app stops showing the special price at the same moment (pricing_today).

-- ---------- settings ----------
insert into public.app_settings (key, value, description, is_public) values
  ('pricing.gap', '{"divisas_prices": true, "refresh_hours": 24, "valid_hours": 30, "max_gap_pct": 150}',
   'Brecha BCV/USDT del día: precio especial en divisas (Zelle, USDT), cada cuántas horas se toma, cuánto vale y el máximo aceptado.', false)
on conflict (key) do nothing;

create or replace function public.guard_pricing_gap_setting() returns trigger
language plpgsql security definer set search_path = public as $$
declare v jsonb := new.value; k text;
begin
  if new.key <> 'pricing.gap' then return new; end if;
  if jsonb_typeof(v) <> 'object' then
    raise exception 'invalid setting %', new.key using errcode = '22023', hint = 'invalid_setting',
      detail = 'La brecha del día es un objeto, por ejemplo {"divisas_prices": true, "refresh_hours": 24}.';
  end if;
  for k in select jsonb_object_keys(v) loop
    if k not in ('divisas_prices', 'refresh_hours', 'valid_hours', 'max_gap_pct') then
      raise exception 'invalid setting %', new.key using errcode = '22023', hint = 'invalid_setting',
        detail = format('«%s» no es parte de la brecha del día. Usa: divisas_prices, refresh_hours, valid_hours, max_gap_pct.', k);
    end if;
  end loop;
  if jsonb_typeof(v -> 'divisas_prices') is distinct from 'boolean' then
    raise exception 'invalid setting %', new.key using errcode = '22023', hint = 'invalid_setting',
      detail = '«divisas_prices» es true o false, sin comillas.';
  end if;
  perform public._setting_number(new.key, v -> 'refresh_hours', 1, 72, true, 'Cada cuántas horas se toma la brecha (refresh_hours)');
  perform public._setting_number(new.key, v -> 'valid_hours', 2, 96, true, 'Cuántas horas vale la brecha (valid_hours)');
  perform public._setting_number(new.key, v -> 'max_gap_pct', 1, 1000, false, 'La brecha máxima aceptada (max_gap_pct)');
  if (v ->> 'valid_hours')::int <= (v ->> 'refresh_hours')::int then
    raise exception 'invalid setting %', new.key using errcode = '22023', hint = 'invalid_setting',
      detail = 'La brecha debe valer más horas de las que pasan entre una toma y la siguiente (valid_hours > refresh_hours).';
  end if;
  return new;
end $$;
create trigger app_settings_validate_pricing_gap before insert or update on public.app_settings
  for each row execute function public.guard_pricing_gap_setting();

create or replace function public.guard_pricing_gap_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.key = 'pricing.gap' and not public.is_service_role() then
    raise exception 'setting % is required', old.key using errcode = '22023', hint = 'invalid_setting',
      detail = 'Este parámetro lo usa la plataforma y no se puede eliminar. Cambia su valor en su lugar.';
  end if;
  return old;
end $$;
create trigger app_settings_keep_pricing_gap before delete on public.app_settings
  for each row execute function public.guard_pricing_gap_delete();

-- ---------- which methods take the divisas price ----------
alter table public.payment_methods
  add column price_basis text not null default 'bcv' check (price_basis in ('bcv', 'divisas')),
  add column basis_adjust_pct numeric(5,2) not null default 0 check (basis_adjust_pct between -20 and 20),
  add constraint payment_methods_divisas_currency check (price_basis = 'bcv' or currency in ('USD', 'USDT'));
comment on column public.payment_methods.price_basis is
  'bcv: the order''s dollars converted at the method''s rate (bolívares at BCV). divisas: converted with the day''s gap (pricing_snapshots), the special price for real dollars and USDT.';
comment on column public.payment_methods.basis_adjust_pct is
  'Adjustment on the divisas price for this method (e.g. +1 to cover the cost of receiving it). 0 = exactly the gap.';
update public.payment_methods set price_basis = 'divisas' where currency in ('USD', 'USDT');

-- ---------- the day's gap ----------
create table public.pricing_snapshots (
  id bigint generated always as identity primary key,
  taken_at timestamptz not null default now(),
  valid_until timestamptz not null,
  bcv_rate numeric(20,8) not null check (bcv_rate > 0),
  bcv_source text not null,
  bcv_observed_at timestamptz not null,
  usdt_ves_rate numeric(20,8) not null check (usdt_ves_rate > 0),
  usdt_source text not null,
  usdt_observed_at timestamptz not null,
  usd_usdt_rate numeric(20,8) not null check (usd_usdt_rate > 0),
  usd_usdt_source text not null,
  gap_pct numeric(10,4) not null check (gap_pct >= 0),
  taken_by uuid references auth.users (id),
  note text check (note is null or char_length(note) <= 300),
  check (valid_until > taken_at)
);
comment on table public.pricing_snapshots is
  'Rates the prices of a day are built with: BCV, Binance P2P and USDT per dollar, and the resulting gap. Read by quotes and by the app (pricing_today).';
alter table public.pricing_snapshots enable row level security;
create policy pricing_snapshots_admin_read on public.pricing_snapshots for select using (public.is_admin());
revoke insert, update, delete on public.pricing_snapshots from anon, authenticated;

/** The snapshot in force, or null when the last one expired. */
create or replace function public.pricing_snapshot_current() returns public.pricing_snapshots
language sql stable security definer set search_path = public as $$
  select * from public.pricing_snapshots where valid_until > now() order by taken_at desc, id desc limit 1;
$$;

/** Bolívares-at-BCV dollars -> what a divisas method collects (USDT, or real dollars through USDT per dollar). */
create or replace function public._divisas_factor(p_snap public.pricing_snapshots, p_currency text, p_adjust_pct numeric default 0)
returns numeric language sql immutable set search_path = public as $$
  select (case when p_snap.usdt_ves_rate > p_snap.bcv_rate then p_snap.bcv_rate / p_snap.usdt_ves_rate else 1 end)
         / (case when p_currency = 'USD' then p_snap.usd_usdt_rate else 1 end)
         * (1 + coalesce(p_adjust_pct, 0) / 100);
$$;

/** 41.37 with 0.99 -> 41.99; 41.995 -> 42.99; null keeps cents. Never below the computed price. */
create or replace function public._apply_ending(p_price numeric, p_round_to numeric) returns numeric
language plpgsql immutable set search_path = public as $$
declare c numeric;
begin
  if p_round_to is null then return round(p_price, 2); end if;
  c := trunc(p_price) + p_round_to;
  if c < p_price then c := c + 1; end if;
  return round(c, 2);
end $$;

/** Breakdown of one price from its cost; mirrors priceFromCost in packages/core. Null snapshot = no gap known. */
create or replace function public._price_from_cost(
  p_cost numeric, p_weight numeric, p_freight numeric, p_logistics numeric, p_margin_pct numeric,
  p_rule jsonb, p_snap public.pricing_snapshots
) returns jsonb language plpgsql stable set search_path = public as $$
declare
  v_freight numeric := round(coalesce(p_freight, coalesce(p_weight, 0) * coalesce((p_rule ->> 'per_kg_usd')::numeric, 0)), 2);
  v_logistics numeric := round(coalesce(p_logistics, coalesce((p_rule ->> 'fixed_usd')::numeric, 0)), 2);
  v_landed numeric;
  v_margin_pct numeric := coalesce(p_margin_pct, coalesce((p_rule ->> 'markup_pct')::numeric, 0));
  v_margin numeric;
  v_target numeric;
  v_gap numeric;
  v_price numeric;
  v_divisas numeric;
begin
  if p_cost is null or p_cost <= 0 then raise exception 'cost must be positive' using errcode = '22023', hint = 'invalid_amount'; end if;
  v_landed := p_cost + v_freight + v_logistics;
  v_margin := round(v_landed * v_margin_pct / 100, 2);
  v_target := v_landed + v_margin;
  v_gap := case when p_snap.id is null then null else greatest(p_snap.usdt_ves_rate / p_snap.bcv_rate - 1, 0) end;
  v_price := case when v_gap is null then null
                  else public._apply_ending(v_target * (1 + v_gap), nullif(p_rule ->> 'round_to', '')::numeric) end;
  v_divisas := case when v_price is null then null else round(v_price * public._divisas_factor(p_snap, 'USDT', 0), 2) end;
  return jsonb_build_object(
    'cost_usd', round(p_cost, 2), 'freight_usd', v_freight, 'logistics_usd', v_logistics, 'landed_usd', round(v_landed, 2),
    'margin_pct', round(v_margin_pct, 2), 'margin_usd', v_margin, 'target_divisas_usd', round(v_target, 2),
    'gap_pct', case when v_gap is null then null else round(v_gap * 100, 2) end,
    'price_usd', v_price,
    'price_ves', case when v_price is null then null else round(v_price * p_snap.bcv_rate, 2) end,
    'price_divisas_usd', v_divisas,
    'divisas_discount_pct', case when v_price is null or v_price = 0 then null else round((1 - v_divisas / v_price) * 100, 2) end,
    'profit_usd', case when v_divisas is null then null else round(v_divisas - v_landed, 2) end,
    'profit_pct', case when v_divisas is null or v_divisas = 0 then null else round((v_divisas - v_landed) / v_divisas * 100, 2) end);
end $$;

-- ---------- costs (only the store and admins see them) ----------
create table public.product_costs (
  product_id uuid primary key references public.products (id) on delete cascade,
  source text not null default 'amazon' check (source in ('amazon', 'proveedor', 'propio', 'otro')),
  source_url text check (source_url is null or source_url ~ '^https?://'),
  freight_usd numeric(10,2) check (freight_usd >= 0),
  logistics_usd numeric(10,2) check (logistics_usd >= 0),
  margin_pct numeric(6,2) check (margin_pct between 0 and 500),
  auto_price boolean not null default true,
  notes text check (notes is null or char_length(notes) <= 500),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);
comment on table public.product_costs is
  'Cost structure of a product: where it is bought, per-unit freight and logistics when they differ from the rule, its margin, and whether its price follows the cost and the day''s gap.';

create table public.variant_costs (
  variant_id uuid primary key references public.product_variants (id) on delete cascade,
  cost_usd numeric(12,2) not null check (cost_usd > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);
comment on table public.variant_costs is 'Purchase cost of one unit of a variant in real dollars (e.g. the Amazon price with tax and shipping to the forwarder).';

alter table public.product_costs enable row level security;
alter table public.variant_costs enable row level security;
create policy product_costs_read on public.product_costs for select
  using (public.is_admin() or public.is_store_member((select p.store_id from public.products p where p.id = product_id)));
create policy variant_costs_read on public.variant_costs for select
  using (public.is_admin() or public.is_store_member((select p.store_id from public.product_variants v join public.products p on p.id = v.product_id where v.id = variant_id)));
revoke insert, update, delete on public.product_costs, public.variant_costs from anon, authenticated;
create trigger product_costs_audit after insert or update or delete on public.product_costs for each row execute function public.audit_trigger('product_id');
create trigger variant_costs_audit after insert or update or delete on public.variant_costs for each row execute function public.audit_trigger('variant_id');

/**
 * Sets the price of every variant that has a cost (and whose product follows its cost) from the cost, the rule
 * (pricing.import) and the snapshot in force. Without a snapshot nothing changes. Returns how many prices moved.
 */
create or replace function public._reprice_from_costs(p_product_id uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_snap public.pricing_snapshots := public.pricing_snapshot_current();
  v_rule jsonb := public.setting('pricing.import', '{}'::jsonb);
  r record;
  v_new numeric;
  n int := 0;
begin
  if v_snap.id is null then return 0; end if;
  for r in
    select v.id, v.price_usd, vc.cost_usd, p.weight_kg, pc.freight_usd, pc.logistics_usd, pc.margin_pct
      from public.variant_costs vc
      join public.product_variants v on v.id = vc.variant_id
      join public.products p on p.id = v.product_id
      join public.product_costs pc on pc.product_id = p.id and pc.auto_price
     where p_product_id is null or p.id = p_product_id
     for update of v
  loop
    v_new := (public._price_from_cost(r.cost_usd, r.weight_kg, r.freight_usd, r.logistics_usd, r.margin_pct, v_rule, v_snap) ->> 'price_usd')::numeric;
    if v_new is not null and v_new <> r.price_usd then
      update public.product_variants set price_usd = v_new where id = r.id;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

/**
 * Takes the day's gap from the rates in force (BCV, Binance P2P, USDT per dollar) and reprices the products that
 * follow their cost. Refuses when a rate is stale (rate_unavailable) or the gap is beyond pricing.gap.max_gap_pct
 * (rate_anomaly): a doubtful P2P reading never reaches the prices.
 */
create or replace function public.take_pricing_snapshot(p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cfg jsonb := public.setting('pricing.gap', '{}'::jsonb);
  v_bcv record; v_p2p record; v_usdt record;
  v_gap numeric;
  v_snap public.pricing_snapshots;
  v_moved int;
begin
  perform public.require_admin();
  select * into v_bcv from public.current_rate('USD/VES');
  select * into v_p2p from public.current_rate('USDT/VES');
  select * into v_usdt from public.current_rate('USD/USDT');
  v_gap := greatest(v_p2p.rate_applied / v_bcv.rate_applied - 1, 0) * 100;
  if v_gap > coalesce((v_cfg ->> 'max_gap_pct')::numeric, 150) then
    raise exception 'gap % beyond the accepted maximum', round(v_gap, 2) using errcode = 'P0001', hint = 'rate_anomaly',
      detail = format('La brecha calculada (%s %%) supera el máximo aceptado (%s %%). Revisa las tasas antes de usarla.', round(v_gap, 2), v_cfg ->> 'max_gap_pct');
  end if;
  insert into public.pricing_snapshots (valid_until, bcv_rate, bcv_source, bcv_observed_at, usdt_ves_rate, usdt_source, usdt_observed_at,
                                        usd_usdt_rate, usd_usdt_source, gap_pct, taken_by, note)
  values (now() + make_interval(hours => coalesce((v_cfg ->> 'valid_hours')::int, 30)),
          v_bcv.rate_applied, v_bcv.source_code, v_bcv.observed_at, v_p2p.rate_applied, v_p2p.source_code, v_p2p.observed_at,
          v_usdt.rate_applied, v_usdt.source_code, round(v_gap, 4), auth.uid(), nullif(trim(p_note), ''))
  returning * into v_snap;
  v_moved := public._reprice_from_costs(null);
  return to_jsonb(v_snap) || jsonb_build_object('repriced', v_moved);
end $$;

/** Hourly job: a new snapshot when the last is older than pricing.gap.refresh_hours (failures stay in the log). */
create or replace function public.ensure_pricing_snapshot() returns text
language plpgsql security definer set search_path = public as $$
declare
  v_cfg jsonb := public.setting('pricing.gap', '{}'::jsonb);
  v_last timestamptz;
begin
  select max(taken_at) into v_last from public.pricing_snapshots;
  if v_last is not null and v_last > now() - make_interval(hours => coalesce((v_cfg ->> 'refresh_hours')::int, 24)) then
    return 'vigente';
  end if;
  begin
    perform public.take_pricing_snapshot('automática');
    return 'tomada';
  exception when others then
    raise warning 'pricing snapshot not taken: %', sqlerrm;
    return 'sin tomar: ' || sqlerrm;
  end;
end $$;

/** What the app shows: the gap in force and the factor of each divisas method (display only; quotes decide). */
create or replace function public.pricing_today() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_snap public.pricing_snapshots := public.pricing_snapshot_current();
  v_on boolean := coalesce((public.setting('pricing.gap', '{}'::jsonb) ->> 'divisas_prices')::boolean, false);
begin
  if v_snap.id is null or not v_on then
    return jsonb_build_object('available', false, 'reason', case when not v_on then 'disabled' else 'no_snapshot' end);
  end if;
  return jsonb_build_object(
    'available', true,
    'snapshot', jsonb_build_object('id', v_snap.id, 'taken_at', v_snap.taken_at, 'valid_until', v_snap.valid_until,
      'bcv_rate', v_snap.bcv_rate, 'bcv_source', v_snap.bcv_source, 'usdt_ves_rate', v_snap.usdt_ves_rate,
      'usdt_source', v_snap.usdt_source, 'usd_usdt_rate', v_snap.usd_usdt_rate, 'gap_pct', v_snap.gap_pct),
    'methods', coalesce((
      select jsonb_agg(jsonb_build_object('code', m.code, 'name', m.name, 'currency', m.currency,
                                          'factor', round(public._divisas_factor(v_snap, m.currency, m.basis_adjust_pct), 8)) order by m.sort)
        from public.payment_methods m
       where m.enabled and m.price_basis = 'divisas'
         and (m.kind = 'manual' or m.integration_status in ('live', 'sandbox'))), '[]'::jsonb));
end $$;

-- ---------- what the panel uses ----------
/** Cost structure, rule, snapshot and the breakdown of every variant of a product (its store or an admin). */
create or replace function public.product_pricing(p_product_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_product public.products;
  v_costs public.product_costs;
  v_snap public.pricing_snapshots := public.pricing_snapshot_current();
  v_rule jsonb := public.setting('pricing.import', '{}'::jsonb);
begin
  select * into v_product from public.products where id = p_product_id;
  if not found then raise exception 'product not found' using errcode = 'P0002', hint = 'not_found'; end if;
  perform public.require_store_member(v_product.store_id);
  select * into v_costs from public.product_costs where product_id = p_product_id;
  return jsonb_build_object(
    'product_id', p_product_id, 'weight_kg', v_product.weight_kg,
    'costs', case when v_costs.product_id is null then null else to_jsonb(v_costs) end,
    'rule', v_rule,
    'snapshot', case when v_snap.id is null then null else to_jsonb(v_snap) end,
    'variants', coalesce((
      select jsonb_agg(jsonb_build_object('variant_id', v.id, 'title', v.title, 'price_usd', v.price_usd, 'cost_usd', vc.cost_usd,
               'breakdown', case when vc.cost_usd is null then null
                                 else public._price_from_cost(vc.cost_usd, v_product.weight_kg, v_costs.freight_usd, v_costs.logistics_usd, v_costs.margin_pct, v_rule, v_snap) end)
             order by v.sort, v.created_at)
        from public.product_variants v left join public.variant_costs vc on vc.variant_id = v.id
       where v.product_id = p_product_id), '[]'::jsonb));
end $$;

/**
 * Saves the cost structure of a product: p_costs = {source, source_url, freight_usd, logistics_usd, margin_pct,
 * auto_price, notes} (null fields = the rule's default), p_variant_costs = [{variant_id, cost_usd}] (cost null
 * removes it). When the product follows its cost, its prices are set right away from the snapshot in force.
 */
create or replace function public.set_product_costs(p_product_id uuid, p_costs jsonb, p_variant_costs jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_product public.products;
  v jsonb;
  v_num numeric;
begin
  select * into v_product from public.products where id = p_product_id;
  if not found then raise exception 'product not found' using errcode = 'P0002', hint = 'not_found'; end if;
  perform public.require_store_member(v_product.store_id);
  if jsonb_typeof(coalesce(p_costs, '{}'::jsonb)) <> 'object' or jsonb_typeof(coalesce(p_variant_costs, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid costs' using errcode = '22023', hint = 'invalid_input';
  end if;

  insert into public.product_costs (product_id, source, source_url, freight_usd, logistics_usd, margin_pct, auto_price, notes, updated_at, updated_by)
  values (p_product_id, coalesce(nullif(p_costs ->> 'source', ''), 'amazon'), nullif(trim(p_costs ->> 'source_url'), ''),
          nullif(p_costs ->> 'freight_usd', '')::numeric, nullif(p_costs ->> 'logistics_usd', '')::numeric,
          nullif(p_costs ->> 'margin_pct', '')::numeric, coalesce((p_costs ->> 'auto_price')::boolean, true),
          nullif(trim(p_costs ->> 'notes'), ''), now(), auth.uid())
  on conflict (product_id) do update set source = excluded.source, source_url = excluded.source_url, freight_usd = excluded.freight_usd,
    logistics_usd = excluded.logistics_usd, margin_pct = excluded.margin_pct, auto_price = excluded.auto_price, notes = excluded.notes,
    updated_at = now(), updated_by = auth.uid();

  for v in select * from jsonb_array_elements(coalesce(p_variant_costs, '[]'::jsonb)) loop
    if not exists (select 1 from public.product_variants where id = (v ->> 'variant_id')::uuid and product_id = p_product_id) then
      raise exception 'variant not in product' using errcode = '22023', hint = 'invalid_input';
    end if;
    v_num := nullif(v ->> 'cost_usd', '')::numeric;
    if v_num is null then
      delete from public.variant_costs where variant_id = (v ->> 'variant_id')::uuid;
    elsif v_num <= 0 or v_num > 1000000 then
      raise exception 'invalid cost' using errcode = '22023', hint = 'invalid_amount';
    else
      insert into public.variant_costs (variant_id, cost_usd, updated_at, updated_by) values ((v ->> 'variant_id')::uuid, round(v_num, 2), now(), auth.uid())
      on conflict (variant_id) do update set cost_usd = excluded.cost_usd, updated_at = now(), updated_by = auth.uid();
    end if;
  end loop;

  perform public._reprice_from_costs(p_product_id);
  return public.product_pricing(p_product_id);
end $$;

-- ---------- quotes: divisas methods take the snapshot's factor ----------
alter table public.payment_quotes
  add column price_basis text not null default 'bcv',
  add column pricing_snapshot_id bigint references public.pricing_snapshots (id),
  add column gap_pct numeric(10,4);
comment on column public.payment_quotes.pricing_snapshot_id is
  'Day''s gap a divisas quote was converted with: amount_due = (base + fee) × rate_applied, rate_applied = BCV ÷ P2P (÷ USDT per dollar for USD) × (1 + method adjustment).';

create or replace function public.create_payment_quote(p_order_id uuid, p_method_code text, p_obligation_ids uuid[] default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := public.require_user();
  v_order public.orders;
  v_method public.payment_methods;
  v_obs uuid[];
  v_first_seq int;
  v_base numeric;
  v_fee numeric;
  v_rate record;
  v_snap public.pricing_snapshots;
  v_divisas boolean := false;
  v_quote public.payment_quotes;
begin
  perform public.check_rate_limit('quote', 30, 600);
  select * into v_order from public.orders where id = p_order_id and buyer_id = v_user;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if v_order.status = 'cancelled' then raise exception 'order cancelled' using errcode = 'P0001', hint = 'order_cancelled'; end if;

  select * into v_method from public.payment_methods where code = p_method_code and enabled;
  if not found then raise exception 'payment method unavailable' using errcode = 'P0001', hint = 'method_unavailable'; end if;
  if v_method.kind = 'automated' and v_method.integration_status not in ('live', 'sandbox') then
    raise exception 'payment method not configured' using errcode = 'P0001', hint = 'method_unavailable';
  end if;

  if exists (
    select 1 from public.payments p join public.payment_quotes q on q.id = p.quote_id
     where p.order_id = p_order_id and p.status in ('pending_verification', 'processing')
       and (p_obligation_ids is null or q.obligation_ids && p_obligation_ids)
  ) then
    raise exception 'a payment for this amount is being verified' using errcode = 'P0001', hint = 'payment_pending_verification';
  end if;

  select min(seq) into v_first_seq from public.payment_obligations o
   where o.order_id = p_order_id and o.status in ('pending', 'partially_paid');
  if v_first_seq is null then raise exception 'nothing to pay' using errcode = 'P0001', hint = 'nothing_due'; end if;

  if p_obligation_ids is null or cardinality(p_obligation_ids) = 0 then
    select array_agg(id) into v_obs from public.payment_obligations where order_id = p_order_id and seq = v_first_seq;
  else
    select array_agg(id order by seq) into v_obs from public.payment_obligations
     where order_id = p_order_id and id = any (p_obligation_ids) and status in ('pending', 'partially_paid');
    if v_obs is null or cardinality(v_obs) <> cardinality(p_obligation_ids) then
      raise exception 'invalid obligations' using errcode = 'P0001', hint = 'obligations_invalid';
    end if;
    if not exists (select 1 from public.payment_obligations where id = any (v_obs) and seq = v_first_seq) then
      raise exception 'pay the earliest installment first' using errcode = 'P0001', hint = 'obligations_order';
    end if;
  end if;

  select sum(public._outstanding(o)) into v_base from public.payment_obligations o where o.id = any (v_obs);
  if v_base < v_method.min_usd or (v_method.max_usd is not null and v_base > v_method.max_usd) then
    raise exception 'amount outside method limits' using errcode = 'P0001', hint = 'method_limits';
  end if;
  v_fee := round(v_base * v_method.fee_pct / 100 + v_method.fee_fixed_usd, 2);

  -- divisas methods: the order's BCV dollars converted once through the day's gap (never an expired one)
  if v_method.price_basis = 'divisas' and coalesce((public.setting('pricing.gap', '{}'::jsonb) ->> 'divisas_prices')::boolean, false) then
    v_snap := public.pricing_snapshot_current();
    v_divisas := v_snap.id is not null;
  end if;
  if v_divisas then
    select public._divisas_factor(v_snap, v_method.currency, 0) as rate_base,
           round(public._divisas_factor(v_snap, v_method.currency, v_method.basis_adjust_pct), 8) as rate_applied,
           'brecha_del_dia'::text as source_code, v_snap.taken_at as observed_at
      into v_rate;
  else
    select * into v_rate from public.current_rate('USD/' || v_method.currency); -- raises rate_unavailable when stale
  end if;

  update public.payment_quotes set status = 'cancelled' where order_id = p_order_id and buyer_id = v_user and status = 'open';

  insert into public.payment_quotes (buyer_id, order_id, method_code, obligation_ids, base_usd, fee_usd, currency, rate_pair,
                                     rate_base, rate_applied, rate_source, rate_observed_at, amount_due, expires_at,
                                     price_basis, pricing_snapshot_id, gap_pct)
  values (v_user, p_order_id, p_method_code, v_obs, v_base, v_fee, v_method.currency, 'USD/' || v_method.currency,
          v_rate.rate_base, v_rate.rate_applied, v_rate.source_code, v_rate.observed_at,
          round((v_base + v_fee) * v_rate.rate_applied, 2),
          case when v_divisas then least(now() + make_interval(mins => v_method.quote_ttl_minutes), v_snap.valid_until)
               else now() + make_interval(mins => v_method.quote_ttl_minutes) end,
          case when v_divisas then 'divisas' else 'bcv' end, v_snap.id, v_snap.gap_pct)
  returning * into v_quote;

  return to_jsonb(v_quote) || jsonb_build_object(
    'method', jsonb_build_object('code', v_method.code, 'name', v_method.name, 'kind', v_method.kind, 'rail', v_method.rail,
      'requires_reference', v_method.requires_reference, 'requires_proof', v_method.requires_proof,
      'instructions', v_method.instructions, 'integration_status', v_method.integration_status),
    'divisas', case when v_divisas then jsonb_build_object('gap_pct', v_snap.gap_pct, 'bcv_rate', v_snap.bcv_rate,
      'usdt_ves_rate', v_snap.usdt_ves_rate, 'usd_usdt_rate', v_snap.usd_usdt_rate, 'taken_at', v_snap.taken_at,
      'main_usd', v_base + v_fee) else null end);
end $$;

-- ---------- privileges ----------
revoke execute on function public.guard_pricing_gap_setting(), public.guard_pricing_gap_delete(),
  public._divisas_factor(public.pricing_snapshots, text, numeric), public._apply_ending(numeric, numeric),
  public._price_from_cost(numeric, numeric, numeric, numeric, numeric, jsonb, public.pricing_snapshots),
  public._reprice_from_costs(uuid), public.ensure_pricing_snapshot(), public.pricing_snapshot_current()
  from public, anon, authenticated;
grant execute on function public.guard_pricing_gap_setting(), public.guard_pricing_gap_delete(),
  public._divisas_factor(public.pricing_snapshots, text, numeric), public._apply_ending(numeric, numeric),
  public._price_from_cost(numeric, numeric, numeric, numeric, numeric, jsonb, public.pricing_snapshots),
  public._reprice_from_costs(uuid), public.ensure_pricing_snapshot(), public.pricing_snapshot_current()
  to service_role;
revoke execute on function public.take_pricing_snapshot(text), public.product_pricing(uuid),
  public.set_product_costs(uuid, jsonb, jsonb), public.pricing_today() from public, anon, authenticated;
grant execute on function public.pricing_today() to anon, authenticated, service_role;
grant execute on function public.take_pricing_snapshot(text), public.product_pricing(uuid),
  public.set_product_costs(uuid, jsonb, jsonb) to authenticated, service_role;

-- ---------- schedule (only where pg_cron exists) ----------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('kora-pricing-snapshot', '40 * * * *', 'select public.ensure_pricing_snapshot()');
  end if;
end $$;
