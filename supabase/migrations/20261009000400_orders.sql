-- =====================================================================
-- Cart, orders, fulfillments ("entregas"), configurable logistics flows,
-- cargo batches.
-- =====================================================================

-- ---------- cart (server-side, persistent; prices are never stored here) ----------
create table public.cart_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  quantity int not null check (quantity between 1 and 100),
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, variant_id)
);
create trigger cart_items_touch before update on public.cart_items for each row execute function public.touch_updated_at();

-- ---------- configurable logistics flows ----------
create table public.fulfillment_steps (
  flow public.fulfillment_flow not null,
  code text not null check (code ~ '^[a-z_]{3,40}$'),
  seq int not null,
  label text not null,
  buyer_label text not null,
  buyer_description text,
  requires_payment text check (requires_payment in ('down_payment', 'full')),
  notify_buyer boolean not null default true,
  is_terminal boolean not null default false,
  seller_can_set boolean not null default false,
  primary key (flow, code),
  unique (flow, seq)
);
comment on table public.fulfillment_steps is 'Ordered logistics states per flow. Editable from admin; codes are referenced by data, labels by UI.';

-- ---------- cargo batches (consolidated import shipments) ----------
create table public.cargo_batches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  step_code text not null default 'purchased',
  description text,
  carrier text,
  tracking_number text,
  departed_at timestamptz,
  arrived_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger cargo_batches_touch before update on public.cargo_batches for each row execute function public.touch_updated_at();

-- ---------- orders ----------
create type public.order_status as enum ('placed', 'in_progress', 'completed', 'cancelled');
create type public.order_payment_status as enum ('unpaid', 'partially_paid', 'paid', 'refund_due', 'refunded');

create sequence public.order_number_seq start 100100;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  buyer_id uuid not null references auth.users (id) on delete restrict,
  status public.order_status not null default 'placed',
  payment_status public.order_payment_status not null default 'unpaid',
  currency text not null default 'USD' check (currency = 'USD'),
  items_usd numeric(14,2) not null check (items_usd >= 0),
  shipping_usd numeric(14,2) not null default 0 check (shipping_usd >= 0),
  discount_usd numeric(14,2) not null default 0 check (discount_usd >= 0),
  financing_usd numeric(14,2) not null default 0 check (financing_usd >= 0),
  refunded_usd numeric(14,2) not null default 0 check (refunded_usd >= 0),
  total_usd numeric(14,2) not null check (total_usd >= 0),
  paid_usd numeric(14,2) not null default 0 check (paid_usd >= 0),
  plan_code text not null,
  ship_to jsonb not null,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 80),
  notes text,
  cancel_reason text,
  is_demo boolean not null default false,
  placed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (buyer_id, idempotency_key)
);
comment on column public.orders.total_usd is 'items + shipping + financing - discount - refunded. Obligations always sum to the original total; refunds reduce what is owed via refund handling.';
create index orders_buyer_idx on public.orders (buyer_id, placed_at desc);
create index orders_status_idx on public.orders (status, payment_status);
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

create table public.fulfillments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  seq int not null,
  store_id uuid not null references public.stores (id),
  flow public.fulfillment_flow not null,
  group_key text not null,
  status text not null,
  shipping_method_id uuid references public.shipping_methods (id),
  shipping_method_name text,
  shipping_kind public.shipping_kind,
  shipping_usd numeric(12,2) not null default 0 check (shipping_usd >= 0),
  ready_min_days int not null default 0,
  ready_max_days int not null default 0,
  eta_min_date date,
  eta_max_date date,
  ship_to jsonb not null,
  carrier_name text,
  tracking_number text,
  cargo_batch_id uuid references public.cargo_batches (id) on delete set null,
  delivered_at timestamptz,
  settled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, seq),
  foreign key (flow, status) references public.fulfillment_steps (flow, code) on update cascade
);
comment on column public.fulfillments.eta_min_date is 'Estimate only (lead time + carrier transit). Never presented as guaranteed.';
create index fulfillments_store_idx on public.fulfillments (store_id, created_at desc);
create index fulfillments_order_idx on public.fulfillments (order_id);
create index fulfillments_batch_idx on public.fulfillments (cargo_batch_id);
create trigger fulfillments_touch before update on public.fulfillments for each row execute function public.touch_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  fulfillment_id uuid not null references public.fulfillments (id) on delete cascade,
  store_id uuid not null references public.stores (id),
  product_id uuid not null references public.products (id),
  variant_id uuid not null references public.product_variants (id),
  title text not null,
  variant_title text,
  image_path text,
  availability public.availability not null,
  unit_price_usd numeric(12,2) not null check (unit_price_usd > 0),
  quantity int not null check (quantity > 0),
  line_total_usd numeric(14,2) not null,
  commission_pct numeric(6,3) not null default 0,
  commission_usd numeric(14,2) not null default 0,
  refunded_qty int not null default 0 check (refunded_qty >= 0),
  refunded_usd numeric(14,2) not null default 0 check (refunded_usd >= 0),
  check (line_total_usd = unit_price_usd * quantity),
  check (refunded_qty <= quantity)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_fulfillment_idx on public.order_items (fulfillment_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.fulfillment_events (
  id bigint generated always as identity primary key,
  fulfillment_id uuid not null references public.fulfillments (id) on delete cascade,
  step_code text not null,
  note text,
  source text not null check (source in ('system', 'admin', 'seller', 'carrier', 'batch')),
  actor_id uuid,
  visible_to_buyer boolean not null default true,
  created_at timestamptz not null default now()
);
create index fulfillment_events_idx on public.fulfillment_events (fulfillment_id, created_at);

-- ---------- RLS ----------
alter table public.cart_items enable row level security;
alter table public.fulfillment_steps enable row level security;
alter table public.cargo_batches enable row level security;
alter table public.orders enable row level security;
alter table public.fulfillments enable row level security;
alter table public.order_items enable row level security;
alter table public.fulfillment_events enable row level security;

create policy cart_own on public.cart_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy steps_read on public.fulfillment_steps for select using (true);
create policy steps_admin on public.fulfillment_steps for all using (public.is_admin()) with check (public.is_admin());
create policy batches_admin on public.cargo_batches for all using (public.is_admin()) with check (public.is_admin());

-- buyers see their orders; sellers never read orders directly (they contain other sellers' totals)
create policy orders_buyer on public.orders for select using (buyer_id = auth.uid() or public.is_admin());

create policy fulfillments_read on public.fulfillments for select using (
  public.is_admin()
  or public.is_store_member(store_id)
  or exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid())
);
create policy order_items_read on public.order_items for select using (
  public.is_admin()
  or public.is_store_member(store_id)
  or exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid())
);
create policy fulfillment_events_read on public.fulfillment_events for select using (
  exists (
    select 1 from public.fulfillments f
     where f.id = fulfillment_id
       and (public.is_admin() or public.is_store_member(f.store_id)
            or (visible_to_buyer and exists (select 1 from public.orders o where o.id = f.order_id and o.buyer_id = auth.uid())))
  )
);

-- All writes to orders/fulfillments/items/events go through SECURITY DEFINER functions.
revoke all on public.orders, public.fulfillments, public.order_items, public.fulfillment_events, public.cargo_batches from anon;
revoke insert, update, delete on public.orders, public.fulfillments, public.order_items, public.fulfillment_events from authenticated;
revoke all on public.cart_items from anon;
revoke insert, update, delete on public.fulfillment_steps from anon;
