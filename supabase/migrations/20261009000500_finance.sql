-- =====================================================================
-- Financial engine: exchange rates (pluggable sources), installment plans,
-- obligations, payment methods, quotes, payments, allocations, provider
-- events, double-entry ledger, commissions, refunds, seller payouts.
--
-- Conventions
--  * USD is the unit of account. Amounts: numeric(14,2). Rates: numeric(20,8).
--  * USD (fiat), USDT and VES are distinct currencies. USD/USDT is a rate pair like any other.
--  * Debts are never frozen in VES: every VES amount comes from a short-lived quote.
--  * Ledger: amount > 0 = debit, amount < 0 = credit. Every entry group sums to zero.
-- =====================================================================

-- ---------- exchange rates ----------
create type public.rate_source_kind as enum ('official', 'market_reference', 'manual');

create table public.exchange_rate_sources (
  code text primary key check (code ~ '^[a-z0-9_]{2,40}$'),
  name text not null,
  pair text not null check (pair = '*' or pair ~ '^[A-Z]{3,4}/[A-Z]{3,4}$'),
  kind public.rate_source_kind not null,
  adapter text not null,
  enabled boolean not null default true,
  docs_url text,
  notes text
);
comment on table public.exchange_rate_sources is 'Registered providers. Adapters live in the rates-sync edge function; market references (e.g. Binance P2P) are never presented as official.';

create table public.exchange_rates (
  id bigint generated always as identity primary key,
  source_code text not null references public.exchange_rate_sources (code),
  pair text not null,
  rate numeric(20,8) not null check (rate > 0),
  observed_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  raw jsonb,
  created_by uuid references auth.users (id)
);
create index exchange_rates_lookup on public.exchange_rates (source_code, pair, observed_at desc);

create table public.rate_policies (
  pair text primary key,
  primary_source text not null references public.exchange_rate_sources (code),
  fallback_sources text[] not null default '{}',
  margin_pct numeric(6,3) not null default 0 check (margin_pct between -20 and 50),
  max_age_minutes int not null default 1440 check (max_age_minutes > 0),
  rounding_decimals int not null default 2 check (rounding_decimals between 0 and 8),
  manual_rate numeric(20,8) check (manual_rate is null or manual_rate > 0),
  manual_valid_until timestamptz,
  manual_note text,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);
comment on column public.rate_policies.max_age_minutes is 'Rates older than this are stale. Stale rates are NEVER used silently: quoting fails with rate_unavailable until a fresh/manual rate exists.';
create trigger rate_policies_touch before update on public.rate_policies for each row execute function public.touch_updated_at();
create trigger rate_policies_audit after insert or update or delete on public.rate_policies for each row execute function public.audit_trigger('pair');

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
     where r.source_code = v_src and r.pair = p_pair
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

-- public, non-throwing status for UI/admin
create or replace function public.rate_status(p_pair text default 'USD/VES') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r record;
begin
  begin
    select * into r from public.current_rate(p_pair);
    return jsonb_build_object('pair', p_pair, 'available', true, 'rate', r.rate_applied, 'base', r.rate_base,
      'source', r.source_code, 'observed_at', r.observed_at, 'is_fallback', r.is_fallback, 'is_manual', r.is_manual);
  exception when others then
    return jsonb_build_object('pair', p_pair, 'available', false, 'reason', 'stale_or_missing',
      'last', (select jsonb_build_object('rate', rate, 'source', source_code, 'observed_at', observed_at)
                 from public.exchange_rates where pair = p_pair order by observed_at desc limit 1));
  end;
end $$;

-- ingestion from the rates-sync edge function (service role) or admins
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

create or replace function public.set_manual_rate(p_pair text, p_rate numeric, p_valid_minutes int, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if p_rate is not null and p_rate <= 0 then raise exception 'invalid rate' using errcode = '22023'; end if;
  if p_rate is not null and coalesce(trim(p_note), '') = '' then raise exception 'note required' using errcode = '22023', hint = 'note_required'; end if;
  update public.rate_policies
     set manual_rate = p_rate,
         manual_valid_until = case when p_rate is null then null else now() + make_interval(mins => greatest(p_valid_minutes, 5)) end,
         manual_note = p_note, updated_by = auth.uid()
   where pair = p_pair;
  if p_rate is not null then
    insert into public.exchange_rates (source_code, pair, rate, observed_at, raw, created_by)
    values ('manual', p_pair, p_rate, now(), jsonb_build_object('note', p_note), auth.uid());
  end if;
end $$;

-- ---------- installment plans ----------
create table public.installment_plans (
  code text primary key check (code ~ '^[a-z0-9_]{2,40}$'),
  name text not null,
  description text,
  down_payment_pct numeric(5,2) not null check (down_payment_pct between 0 and 100),
  installments int not null default 0 check (installments between 0 and 24),
  interval_days int not null default 30 check (interval_days between 1 and 120),
  surcharge_pct numeric(5,2) not null default 0 check (surcharge_pct between 0 and 100),
  min_order_usd numeric(12,2) not null default 0,
  allowed_flows public.fulfillment_flow[] not null default '{local_stock,import_order,seller_shipping}',
  active boolean not null default true,
  sort int not null default 0,
  check (down_payment_pct = 100 and installments = 0 or down_payment_pct < 100 and installments >= 1)
);
comment on table public.installment_plans is 'full: 100/0. Deposit 50%: 50/1. 3 cuotas: 0/3 or a down payment + N. Surcharge is applied to the financed total and shown up front.';
create trigger installment_plans_audit after insert or update or delete on public.installment_plans for each row execute function public.audit_trigger('code');

create type public.obligation_kind as enum ('full', 'down_payment', 'installment');
create type public.obligation_status as enum ('pending', 'partially_paid', 'paid', 'cancelled');

create table public.payment_obligations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  seq int not null,
  kind public.obligation_kind not null,
  amount_usd numeric(14,2) not null check (amount_usd > 0),
  paid_usd numeric(14,2) not null default 0 check (paid_usd >= 0),
  waived_usd numeric(14,2) not null default 0 check (waived_usd >= 0),
  due_date date,
  status public.obligation_status not null default 'pending',
  updated_at timestamptz not null default now(),
  unique (order_id, seq),
  check (paid_usd + waived_usd <= amount_usd)
);
create trigger obligations_touch before update on public.payment_obligations for each row execute function public.touch_updated_at();

-- ---------- payment methods ----------
create type public.payment_kind as enum ('manual', 'automated');
create type public.integration_status as enum ('live', 'sandbox', 'pending_credentials', 'disabled');

create table public.payment_methods (
  code text primary key check (code ~ '^[a-z0-9_]{2,40}$'),
  name text not null,
  rail text not null,
  currency text not null check (currency in ('USD', 'VES', 'USDT')),
  kind public.payment_kind not null,
  integration_status public.integration_status not null default 'disabled',
  enabled boolean not null default false,
  fee_pct numeric(6,3) not null default 0 check (fee_pct between 0 and 20),
  fee_fixed_usd numeric(10,2) not null default 0 check (fee_fixed_usd >= 0),
  min_usd numeric(12,2) not null default 0,
  max_usd numeric(12,2),
  quote_ttl_minutes int not null default 30 check (quote_ttl_minutes between 5 and 4320),
  requires_reference boolean not null default true,
  requires_proof boolean not null default false,
  reference_pattern text,
  instructions jsonb not null default '{}'::jsonb,
  description text,
  sort int not null default 0
);
comment on column public.payment_methods.instructions is 'Receiving account details shown to buyers. Seeded values are FICTITIOUS placeholders until replaced by admins.';
create trigger payment_methods_audit after insert or update or delete on public.payment_methods for each row execute function public.audit_trigger('code');

-- ---------- quotes ----------
create type public.quote_status as enum ('open', 'used', 'expired', 'cancelled');

create table public.payment_quotes (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users (id),
  order_id uuid not null references public.orders (id) on delete cascade,
  method_code text not null references public.payment_methods (code),
  obligation_ids uuid[] not null,
  base_usd numeric(14,2) not null check (base_usd > 0),
  fee_usd numeric(14,2) not null default 0 check (fee_usd >= 0),
  currency text not null,
  rate_pair text not null,
  rate_base numeric(20,8) not null,
  rate_applied numeric(20,8) not null,
  rate_source text not null,
  rate_observed_at timestamptz not null,
  amount_due numeric(16,2) not null check (amount_due > 0),
  status public.quote_status not null default 'open',
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
comment on table public.payment_quotes is 'Immutable price promise: base USD + fee converted at a recorded rate, valid until expires_at.';
create index payment_quotes_order_idx on public.payment_quotes (order_id, issued_at desc);

-- ---------- payments ----------
create type public.payment_status as enum ('pending_verification', 'processing', 'confirmed', 'rejected', 'refunded', 'failed');
create sequence public.payment_number_seq start 500100;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  order_id uuid not null references public.orders (id) on delete restrict,
  buyer_id uuid not null references auth.users (id),
  quote_id uuid not null unique references public.payment_quotes (id),
  method_code text not null references public.payment_methods (code),
  currency text not null,
  amount numeric(16,2) not null check (amount > 0),
  amount_received numeric(16,2),
  rate_applied numeric(20,8) not null,
  base_usd numeric(14,2) not null,
  fee_usd numeric(14,2) not null default 0,
  usd_recognized numeric(14,2),
  reference text,
  reference_normalized text,
  proof_path text,
  payer_name text,
  payer_bank text,
  payer_phone text,
  declared_paid_at timestamptz,
  status public.payment_status not null default 'pending_verification',
  idempotency_key text not null,
  provider text,
  provider_payment_id text,
  verified_at timestamptz,
  verified_by uuid references auth.users (id),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (buyer_id, idempotency_key),
  check (status <> 'confirmed' or usd_recognized is not null)
);
comment on column public.payments.usd_recognized is 'USD credited to the buyer obligations, set only by verification (admin or signed provider webhook).';
create unique index payments_reference_unique on public.payments (method_code, reference_normalized)
  where reference_normalized is not null and status in ('pending_verification', 'processing', 'confirmed');
create unique index payments_provider_unique on public.payments (provider, provider_payment_id) where provider_payment_id is not null;
create index payments_status_idx on public.payments (status, created_at);
create index payments_order_idx on public.payments (order_id);
create trigger payments_touch before update on public.payments for each row execute function public.touch_updated_at();
create trigger payments_audit after update of status, usd_recognized on public.payments for each row execute function public.audit_trigger();

create table public.payment_allocations (
  id bigint generated always as identity primary key,
  payment_id uuid not null references public.payments (id),
  obligation_id uuid not null references public.payment_obligations (id),
  amount_usd numeric(14,2) not null check (amount_usd <> 0),
  created_at timestamptz not null default now()
);
create index payment_allocations_payment_idx on public.payment_allocations (payment_id);

create table public.payment_events (
  id bigint generated always as identity primary key,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payment_id uuid references public.payments (id),
  signature_valid boolean not null,
  payload jsonb not null,
  processed boolean not null default false,
  error text,
  received_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

-- ---------- ledger ----------
create type public.ledger_account as enum (
  'buyer_receivable', 'deferred_revenue', 'cash_clearing', 'fee_revenue', 'sales_revenue',
  'commission_revenue', 'seller_payable', 'buyer_refund_payable', 'adjustments'
);

create table public.ledger_entries (
  id bigint generated always as identity primary key,
  entry_group uuid not null,
  account public.ledger_account not null,
  amount_usd numeric(14,2) not null check (amount_usd <> 0),
  store_id uuid references public.stores (id),
  order_id uuid references public.orders (id),
  payment_id uuid references public.payments (id),
  fulfillment_id uuid references public.fulfillments (id),
  payout_id uuid,
  event text not null,
  memo text,
  created_by uuid,
  created_at timestamptz not null default now(),
  check (account <> 'seller_payable' or store_id is not null)
);
comment on table public.ledger_entries is 'Append-only double-entry ledger in USD. Buyer obligations, platform revenue and seller payables are separate accounts.';
create index ledger_group_idx on public.ledger_entries (entry_group);
create index ledger_store_idx on public.ledger_entries (store_id, account) where store_id is not null;
create index ledger_order_idx on public.ledger_entries (order_id);

create or replace function public.ledger_group_balanced() returns trigger
language plpgsql as $$
declare v_sum numeric;
begin
  select coalesce(sum(amount_usd), 0) into v_sum from public.ledger_entries where entry_group = new.entry_group;
  if v_sum <> 0 then
    raise exception 'unbalanced ledger group % (sum %)', new.entry_group, v_sum using errcode = 'P0001', hint = 'ledger_unbalanced';
  end if;
  return null;
end $$;
create constraint trigger ledger_balanced after insert on public.ledger_entries
  deferrable initially deferred for each row execute function public.ledger_group_balanced();

create or replace function public.ledger_immutable() returns trigger language plpgsql as $$
begin raise exception 'ledger entries are immutable; post a compensating entry' using errcode = 'P0001'; end $$;
create trigger ledger_no_update before update or delete on public.ledger_entries for each row execute function public.ledger_immutable();

-- helper: post a set of legs [{account, amount, store_id?}] atomically
create or replace function public.ledger_post(
  p_event text, p_legs jsonb, p_order_id uuid default null, p_payment_id uuid default null,
  p_fulfillment_id uuid default null, p_payout_id uuid default null, p_memo text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_group uuid := gen_random_uuid(); v_leg jsonb;
begin
  for v_leg in select * from jsonb_array_elements(p_legs) loop
    if (v_leg ->> 'amount')::numeric = 0 then continue; end if;
    insert into public.ledger_entries (entry_group, account, amount_usd, store_id, order_id, payment_id, fulfillment_id, payout_id, event, memo, created_by)
    values (v_group, (v_leg ->> 'account')::public.ledger_account, (v_leg ->> 'amount')::numeric,
            nullif(v_leg ->> 'store_id', '')::uuid, p_order_id, p_payment_id, p_fulfillment_id, p_payout_id, p_event, p_memo, auth.uid());
  end loop;
  return v_group;
end $$;
revoke execute on function public.ledger_post(text, jsonb, uuid, uuid, uuid, uuid, text) from public, anon, authenticated;

-- ---------- commissions ----------
create table public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores (id) on delete cascade,
  category_id uuid references public.categories (id) on delete cascade,
  rate_pct numeric(6,3) not null check (rate_pct between 0 and 60),
  active boolean not null default true,
  note text
);
create trigger commission_rules_audit after insert or update or delete on public.commission_rules for each row execute function public.audit_trigger();

create or replace function public.commission_pct(p_store_id uuid, p_category_id uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select case when (select kind from public.stores where id = p_store_id) = 'platform' then 0 else coalesce((
    select rate_pct from public.commission_rules
     where active
       and (store_id is null or store_id = p_store_id)
       and (category_id is null or category_id = p_category_id)
     order by (store_id is not null) desc, (category_id is not null) desc
     limit 1), (public.setting('commission.default_pct', '10'))::numeric) end;
$$;

-- ---------- refunds & payouts ----------
create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  order_item_id uuid references public.order_items (id),
  quantity int not null default 0 check (quantity >= 0),
  amount_usd numeric(14,2) not null check (amount_usd > 0),
  reason text not null,
  restock boolean not null default false,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.buyer_refund_payouts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  amount_usd numeric(14,2) not null check (amount_usd > 0),
  method text not null,
  reference text not null,
  paid_by uuid references auth.users (id),
  paid_at timestamptz not null default now()
);

create type public.payout_status as enum ('draft', 'paid', 'cancelled');
create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  amount_usd numeric(14,2) not null check (amount_usd > 0),
  status public.payout_status not null default 'draft',
  method text,
  reference text,
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  paid_by uuid references auth.users (id)
);
create trigger payouts_audit after insert or update on public.payouts for each row execute function public.audit_trigger();

-- ---------- RLS ----------
alter table public.exchange_rate_sources enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.rate_policies enable row level security;
alter table public.installment_plans enable row level security;
alter table public.payment_obligations enable row level security;
alter table public.payment_methods enable row level security;
alter table public.payment_quotes enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.payment_events enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.commission_rules enable row level security;
alter table public.refunds enable row level security;
alter table public.buyer_refund_payouts enable row level security;
alter table public.payouts enable row level security;

create policy rate_sources_read on public.exchange_rate_sources for select using (true);
create policy rate_sources_admin on public.exchange_rate_sources for all using (public.is_admin()) with check (public.is_admin());
create policy rates_read_admin on public.exchange_rates for select using (public.is_admin());
create policy rate_policies_admin on public.rate_policies for all using (public.is_admin()) with check (public.is_admin());
create policy plans_read on public.installment_plans for select using (active or public.is_admin());
create policy plans_admin on public.installment_plans for all using (public.is_admin()) with check (public.is_admin());
create policy obligations_read on public.payment_obligations for select using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid())
);
create policy methods_pay_read on public.payment_methods for select using (enabled or public.is_admin());
create policy methods_pay_admin on public.payment_methods for update using (public.is_admin()) with check (public.is_admin());
create policy quotes_read on public.payment_quotes for select using (buyer_id = auth.uid() or public.is_admin());
create policy payments_read on public.payments for select using (buyer_id = auth.uid() or public.is_admin());
create policy allocations_read on public.payment_allocations for select using (
  public.is_admin() or exists (select 1 from public.payments p where p.id = payment_id and p.buyer_id = auth.uid())
);
create policy payment_events_admin on public.payment_events for select using (public.is_admin());
create policy ledger_admin on public.ledger_entries for select using (public.is_admin());
create policy commission_read on public.commission_rules for select using (public.is_admin() or (store_id is not null and public.is_store_member(store_id)));
create policy commission_admin on public.commission_rules for all using (public.is_admin()) with check (public.is_admin());
create policy refunds_read on public.refunds for select using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid())
);
create policy refund_payouts_read on public.buyer_refund_payouts for select using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid())
);
create policy payouts_read on public.payouts for select using (public.is_admin() or public.is_store_member(store_id));

-- Financial tables are written exclusively through SECURITY DEFINER functions.
revoke all on public.exchange_rates, public.rate_policies, public.payment_obligations, public.payment_quotes, public.payments,
  public.payment_allocations, public.payment_events, public.ledger_entries, public.commission_rules, public.refunds,
  public.buyer_refund_payouts, public.payouts from anon;
revoke insert, update, delete on public.exchange_rates, public.payment_obligations, public.payment_quotes, public.payments,
  public.payment_allocations, public.payment_events, public.ledger_entries, public.refunds, public.buyer_refund_payouts,
  public.payouts from authenticated;
revoke insert, delete on public.payment_methods from authenticated;
revoke insert, update, delete on public.payment_methods, public.installment_plans, public.exchange_rate_sources from anon;
