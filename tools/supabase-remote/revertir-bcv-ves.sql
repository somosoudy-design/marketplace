-- Roll back BCV calendar/future-ingestion feature only, in Marketplace.
-- Preserve TLS, strict date parsing and exclusion of future rates/snapshots.
-- Keep calendar/history and every observation/quote/payment; no destructive changes or rates invented.
-- Future official publications already ingested remain stored but inactive until their value date.
begin;
select pg_advisory_xact_lock(hashtextextended('hayazgo:bcv-ves',0));
do $bcv_rollback_guard$
declare v_url text;
begin
  select decrypted_secret into strict v_url from vault.decrypted_secrets where name='kora_project_url';
  if rtrim(v_url,'/') is distinct from 'https://mimnotafmfasvwrclxan.supabase.co' then
    raise exception 'Wrong project; nothing reverted.';
  end if;
  if md5(pg_get_functiondef('public.current_rate(text)'::regprocedure)) is distinct from 'ec69de556081f8abe6fb974302f582e8'
     or md5(pg_get_functiondef('public.ingest_rate(text,text,numeric,timestamptz,jsonb,boolean)'::regprocedure)) is distinct from 'f2e8c00fc79b715375872f97ad42ea15' then
    raise exception 'Unexpected BCV financial definition; nothing reverted.';
  end if;
end $bcv_rollback_guard$;
create or replace function public.current_rate(p_pair text)
returns table (rate_base numeric, rate_applied numeric, source_code text, observed_at timestamptz, is_fallback boolean, is_manual boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  v_pol public.rate_policies;
  v_src text;
  v_rate public.exchange_rates;
  v_idx int := 0;
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
     where r.source_code = v_src and r.pair = p_pair and r.observed_at <= now()
     order by r.observed_at desc, r.id desc limit 1;
    if found and v_rate.observed_at >= now() - make_interval(mins => v_pol.max_age_minutes) then
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
  if p_observed_at > now() + interval '10 minutes' then raise exception 'observed_at in the future' using errcode = '22023'; end if;
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


notify pgrst, 'reload schema';
commit;
select public.rate_status('USD/VES');
