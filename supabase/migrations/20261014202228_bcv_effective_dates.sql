-- BCV/VES validity fix. No rates, policy values, price formulas, quotes or business data are rewritten.
-- observed_at is the provider's effective date for BCV/DolarAPI; fetched_at remains the retrieval time.
-- Calendar: SUDEBAN 2026 circular, cross-checked with Asociación Bancaria de Venezuela:
-- https://iusdata.com/wp-content/uploads/2025/11/Calendario-Bancario-2026.pdf
-- https://asobanca.com.ve/wp-content/uploads/2025/11/calendario-bancario-asobanca-6.pdf
-- Load the next VERIFIED annual calendar before 2027. Unknown dates fail closed for official rates.
create table public.bcv_banking_calendar (
  day date primary key,
  is_business_day boolean not null,
  reference_url text not null check (reference_url ~ '^https://')
);
alter table public.bcv_banking_calendar enable row level security;
revoke all on public.bcv_banking_calendar from public, anon, authenticated, service_role;
grant select on public.bcv_banking_calendar to authenticated;
create policy bcv_calendar_admin_read on public.bcv_banking_calendar for select to authenticated
  using ((select public.is_admin()));
grant select, insert, update, delete on public.bcv_banking_calendar to service_role;
create policy bcv_calendar_service on public.bcv_banking_calendar for all to service_role
  using ((select public.is_service_role())) with check ((select public.is_service_role()));

insert into public.bcv_banking_calendar(day, is_business_day, reference_url)
select d::date, extract(isodow from d) < 6 and d::date <> all(array[
  '2026-01-01', '2026-01-12', '2026-01-19', '2026-02-16', '2026-02-17', '2026-03-19',
  '2026-04-02', '2026-04-03', '2026-05-01', '2026-05-18', '2026-06-08', '2026-06-24',
  '2026-06-29', '2026-07-24', '2026-09-14', '2026-10-12', '2026-10-26', '2026-11-23',
  '2026-12-14', '2026-12-24', '2026-12-25', '2026-12-31'
]::date[]), 'https://asobanca.com.ve/wp-content/uploads/2025/11/calendario-bancario-asobanca-6.pdf'
from generate_series(date '2026-01-01', date '2026-12-31', interval '1 day') d;

-- INVOKER helpers are private to the existing DEFINER rate functions. No user-supplied quote clock.
create function public._bcv_business_day(p_at timestamptz) returns date
language sql stable set search_path = public as $$
  select max(day) from public.bcv_banking_calendar
   where day <= (p_at at time zone 'America/Caracas')::date and is_business_day
     and exists (select 1 from public.bcv_banking_calendar where day = (p_at at time zone 'America/Caracas')::date);
$$;
create function public._bcv_next_business_day(p_at timestamptz) returns date
language sql stable set search_path = public as $$
  select min(day) from public.bcv_banking_calendar
   where day > (p_at at time zone 'America/Caracas')::date and is_business_day
     and exists (select 1 from public.bcv_banking_calendar where day = (p_at at time zone 'America/Caracas')::date);
$$;
revoke execute on function public._bcv_business_day(timestamptz), public._bcv_next_business_day(timestamptz)
  from public, anon, authenticated, service_role;

comment on column public.rate_policies.max_age_minutes is
  'Elapsed-time freshness for market/manual/demo observations. Official BCV/DolarAPI USD/VES uses the verified banking calendar and provider effective date; future dates are never selected.';
comment on column public.exchange_rates.observed_at is
  'Provider observation timestamp; for BCV/DolarAPI USD/VES, the provider effective timestamp (Fecha Valor). fetched_at is retrieval time; re-fetching does not renew validity.';

create or replace function public.current_rate(p_pair text)
returns table (rate_base numeric, rate_applied numeric, source_code text, observed_at timestamptz, is_fallback boolean, is_manual boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  v_pol public.rate_policies;
  v_src text;
  v_rate public.exchange_rates;
  v_idx int := 0;
  v_bcv_day date := public._bcv_business_day(now());
  v_sources text[];
begin
  if p_pair in ('USD/USD', 'USDT/USDT', 'VES/VES') then
    return query select 1::numeric, 1::numeric, 'identity'::text, now(), false, false; return;
  end if;
  select * into v_pol from public.rate_policies where pair = p_pair and enabled;
  if not found then
    raise exception 'no rate policy for %', p_pair using errcode = 'P0001', hint = 'rate_unavailable';
  end if;
  if v_pol.manual_rate is not null and v_pol.manual_valid_until > now() then
    return query select v_pol.manual_rate,
      round(v_pol.manual_rate * (1 + v_pol.margin_pct / 100), v_pol.rounding_decimals),
      'manual'::text, coalesce(v_pol.updated_at, now()), false, true;
    return;
  end if;
  v_sources := array[v_pol.primary_source] || v_pol.fallback_sources;
  foreach v_src in array v_sources loop
    v_idx := v_idx + 1;
    select r.* into v_rate
      from public.exchange_rates r
      join public.exchange_rate_sources s on s.code = r.source_code and s.enabled
     where r.source_code = v_src and r.pair = p_pair
       and r.observed_at <= now()
       and case when p_pair = 'USD/VES' and v_src in ('bcv_official', 'dolarapi_oficial')
                then (r.observed_at at time zone 'America/Caracas')::date >= v_bcv_day
                else r.observed_at >= now() - make_interval(mins => v_pol.max_age_minutes) end
     order by r.observed_at desc, r.id desc limit 1;
    if found then
      return query select v_rate.rate,
        round(v_rate.rate * (1 + v_pol.margin_pct / 100), v_pol.rounding_decimals),
        v_src, v_rate.observed_at, v_idx > 1, false;
      return;
    end if;
  end loop;
  raise exception 'no fresh rate for % (all sources stale or missing)', p_pair using errcode = 'P0001', hint = 'rate_unavailable';
end $$;


create or replace function public.ingest_rate(p_source text, p_pair text, p_rate numeric, p_observed_at timestamptz, p_raw jsonb default null, p_force boolean default false)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_last numeric;
begin
  perform public.require_admin();
  if p_rate is null or p_rate <= 0 then raise exception 'invalid rate' using errcode = '22023'; end if;
  if p_observed_at is null or not isfinite(p_observed_at) then
    raise exception 'invalid observed_at' using errcode = '22023';
  end if;
  -- BCV Fecha Valor is an EFFECTIVE date, not the time we fetched the publication.
  -- Retain the next banking day's publication ahead of time; current_rate excludes it until midnight.
  -- The exception is narrow: exact registered official USD/VES sources, known next banking date,
  -- at Caracas midnight. Market sources keep the existing ingestion tolerance.
  if p_observed_at > now() + interval '10 minutes' and not coalesce(
    p_pair = 'USD/VES' and p_source in ('bcv_official', 'dolarapi_oficial')
    and exists (select 1 from public.exchange_rate_sources where code = p_source and pair = p_pair
                and kind = 'official' and adapter in ('bcv_html', 'dolarapi'))
    and p_observed_at = public._bcv_next_business_day(now())::timestamp at time zone 'America/Caracas', false)
  then raise exception 'observed_at in the future' using errcode = '22023'; end if;
  -- sanity guard: reject jumps > 25% vs the last value of the same source (likely a parser error or a bad
  -- publication). Automated ingestion never bypasses it; an admin can force a value after checking it by hand.
  select rate into v_last from public.exchange_rates where source_code = p_source and pair = p_pair order by observed_at desc limit 1;
  if v_last is not null and abs(p_rate - v_last) / v_last > 0.25 and not (p_force and public.is_admin()) then
    raise exception 'rate jump exceeds sanity threshold' using errcode = 'P0001', hint = 'rate_anomaly';
  end if;
  -- idempotent on (source, pair, observed_at)
  select id into v_id from public.exchange_rates where source_code = p_source and pair = p_pair and observed_at = p_observed_at;
  if v_id is not null then return v_id; end if;
  insert into public.exchange_rates (source_code, pair, rate, observed_at, raw, created_by)
  values (p_source, p_pair, p_rate, p_observed_at, p_raw, auth.uid()) returning id into v_id;
  return v_id;
end $$;


-- Existing snapshot arithmetic/expiry stays intact; a future snapshot must not apply prematurely.
create or replace function public.pricing_snapshot_current() returns public.pricing_snapshots
language sql stable security definer set search_path = public as $$
  select * from public.pricing_snapshots where taken_at <= now() and valid_until > now()
   order by taken_at desc, id desc limit 1;
$$;
