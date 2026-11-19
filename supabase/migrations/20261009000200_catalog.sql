-- =====================================================================
-- Catalog: categories, brands, stores (multi-vendor), products, variants,
-- images, moderation, collections, favorites, discovery signals.
-- =====================================================================

create type public.store_kind as enum ('platform', 'seller');
create type public.store_status as enum ('pending', 'active', 'suspended');
create type public.risk_level as enum ('low', 'restricted', 'regulated');
create type public.product_origin as enum ('local', 'import', 'seller');
create type public.availability as enum ('available', 'on_order', 'in_transit', 'reservable', 'sold_out', 'unavailable');
create type public.moderation_status as enum ('pending', 'published', 'in_review', 'rejected', 'suspended');

-- ---------- categories ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null check (char_length(name) between 2 and 60),
  icon text,
  tone text not null default 'sand',
  sort int not null default 0,
  risk_level public.risk_level not null default 'low',
  requires_review boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
comment on column public.categories.tone is 'Design-system photo backdrop token (sand, sage, blush, mist, clay, night).';
comment on column public.categories.requires_review is 'When true, products in this category always go to manual moderation before publication.';

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  official_url text,
  created_at timestamptz not null default now()
);

-- ---------- stores ----------
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  name text not null check (char_length(name) between 2 and 60),
  tagline text check (tagline is null or char_length(tagline) <= 90),
  description text check (description is null or char_length(description) <= 2000),
  logo_path text,
  cover_path text,
  accent text not null default 'jade' check (accent in ('jade', 'amber', 'coral', 'plum', 'ink', 'sky')),
  kind public.store_kind not null default 'seller',
  status public.store_status not null default 'pending',
  shipping_info text,
  policies jsonb not null default '{}'::jsonb,
  contact_email text,
  rating_avg numeric(3,2),
  rating_count int not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.stores.accent is 'Seller personalization is limited to a curated accent palette to keep the app consistent.';
comment on column public.stores.rating_avg is 'Only computed from real verified reviews; null until data exists.';
create trigger stores_touch before update on public.stores for each row execute function public.touch_updated_at();

create table public.store_members (
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.store_member_role not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);
create index store_members_user_idx on public.store_members (user_id);

create or replace function public.is_store_member(p_store_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.store_members where store_id = p_store_id and user_id = auth.uid());
$$;

create or replace function public.require_store_member(p_store_id uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_store_member(p_store_id) or public.is_admin() or public.is_service_role()) then
    raise exception 'forbidden' using errcode = '42501', hint = 'store_access_denied';
  end if;
end $$;

-- ---------- products ----------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  category_id uuid not null references public.categories (id),
  brand_id uuid references public.brands (id),
  slug text not null,
  title text not null check (char_length(title) between 3 and 140),
  subtitle text check (subtitle is null or char_length(subtitle) <= 140),
  description text check (description is null or char_length(description) <= 8000),
  highlights text[] not null default '{}',
  option_names text[] not null default '{}',
  origin public.product_origin not null default 'local',
  availability public.availability not null default 'available',
  moderation_status public.moderation_status not null default 'pending',
  moderation_note text,
  base_price_usd numeric(12,2) not null default 0 check (base_price_usd >= 0),
  compare_at_usd numeric(12,2) check (compare_at_usd is null or compare_at_usd > 0),
  weight_kg numeric(8,3) not null default 0.5 check (weight_kg >= 0),
  max_per_order int not null default 10 check (max_per_order between 1 and 100),
  source_url text,
  source_provider text,
  is_demo boolean not null default false,
  popularity numeric(12,4) not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector,
  unique (store_id, slug)
);
comment on column public.products.base_price_usd is 'Denormalized lowest active variant price (maintained by trigger). Never trusted from clients at checkout.';
comment on column public.products.is_demo is 'Development/demo data. Must never be shown as real offers in production.';
create index products_store_idx on public.products (store_id);
create index products_category_idx on public.products (category_id);
create index products_public_idx on public.products (moderation_status, availability, popularity desc);
create index products_search_idx on public.products using gin (search);
create index products_title_trgm on public.products using gin (title extensions.gin_trgm_ops);
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();

create or replace function public.products_search_vector() returns trigger
language plpgsql as $$
declare v_brand text; v_cat text;
begin
  select name into v_brand from public.brands where id = new.brand_id;
  select name into v_cat from public.categories where id = new.category_id;
  new.search :=
    setweight(to_tsvector('simple', extensions.unaccent(coalesce(new.title, ''))), 'A') ||
    setweight(to_tsvector('simple', extensions.unaccent(coalesce(v_brand, ''))), 'A') ||
    setweight(to_tsvector('simple', extensions.unaccent(coalesce(v_cat, ''))), 'B') ||
    setweight(to_tsvector('simple', extensions.unaccent(coalesce(new.subtitle, ''))), 'B') ||
    setweight(to_tsvector('simple', extensions.unaccent(coalesce(new.description, ''))), 'C');
  return new;
end $$;
create trigger products_search before insert or update of title, subtitle, description, brand_id, category_id
  on public.products for each row execute function public.products_search_vector();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  path text not null,
  alt text,
  sort int not null default 0,
  width int,
  height int,
  is_demo_asset boolean not null default false,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, sort);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text,
  title text not null default 'Única',
  options jsonb not null default '{}'::jsonb,
  price_usd numeric(12,2) not null check (price_usd > 0),
  stock int check (stock is null or stock >= 0),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.product_variants.stock is
  'Allocable units. available/in_transit/reservable: hard limit decremented atomically at checkout. on_order: null = unlimited, number = cap.';
create index product_variants_product_idx on public.product_variants (product_id);
create unique index product_variants_sku_idx on public.product_variants (sku) where sku is not null;
create trigger variants_touch before update on public.product_variants for each row execute function public.touch_updated_at();

-- keep products.base_price_usd in sync with lowest active variant price
create or replace function public.sync_product_price() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pid uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
     set base_price_usd = coalesce((select min(price_usd) from public.product_variants where product_id = v_pid and active), 0)
   where p.id = v_pid;
  return null;
end $$;
create trigger variants_sync_price after insert or update of price_usd, active or delete on public.product_variants
  for each row execute function public.sync_product_price();

-- automatic stock-driven availability transitions (only between available <-> sold_out)
create or replace function public.sync_product_stock_state() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid := coalesce(new.product_id, old.product_id);
  v_avail public.availability;
  v_units bigint;
begin
  select availability into v_avail from public.products where id = v_pid;
  select coalesce(sum(stock), 0) into v_units from public.product_variants where product_id = v_pid and active;
  if v_avail = 'available' and v_units = 0 then
    update public.products set availability = 'sold_out' where id = v_pid;
  elsif v_avail = 'sold_out' and v_units > 0 then
    update public.products set availability = 'available' where id = v_pid;
  end if;
  return null;
end $$;
create trigger variants_sync_stock after insert or update of stock, active on public.product_variants
  for each row execute function public.sync_product_stock_state();

-- ---------- moderation ----------
create table public.moderation_events (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products (id) on delete cascade deferrable initially deferred,
  from_status public.moderation_status,
  to_status public.moderation_status not null,
  note text,
  actor_id uuid,
  automatic boolean not null default false,
  created_at timestamptz not null default now()
);
create index moderation_events_product_idx on public.moderation_events (product_id, created_at desc);

-- Sellers can never set moderation status themselves. On insert/update by a non-admin:
--  * low-risk categories from active stores are auto-published,
--  * restricted/regulated categories (dental, health...) go to 'pending' for manual review,
--  * suspended products stay suspended,
--  * editing a published product in a review-required category sends it back to review.
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
create trigger products_moderation before insert or update on public.products
  for each row execute function public.enforce_product_moderation();


create or replace function public.moderate_product(p_product_id uuid, p_status public.moderation_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if p_status in ('rejected', 'suspended') and coalesce(trim(p_note), '') = '' then
    raise exception 'a note is required to reject or suspend' using errcode = '22023', hint = 'note_required';
  end if;
  update public.products set moderation_status = p_status, moderation_note = p_note where id = p_product_id;
  if not found then raise exception 'product not found' using errcode = 'P0002'; end if;
  update public.moderation_events set note = coalesce(p_note, note)
   where id = (select max(id) from public.moderation_events where product_id = p_product_id);
  perform public.audit('moderate', 'product', p_product_id::text, jsonb_build_object('status', p_status, 'note', p_note));
end $$;

-- ---------- collections (editorial curation) ----------
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  cover_path text,
  tone text not null default 'sand',
  layout text not null default 'rail' check (layout in ('rail', 'feature', 'grid')),
  sort int not null default 0,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.collection_products (
  collection_id uuid not null references public.collections (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  sort int not null default 0,
  primary key (collection_id, product_id)
);

-- ---------- favorites, stock alerts, discovery signals ----------
create table public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create table public.stock_alerts (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  primary key (user_id, product_id)
);

create type public.user_event_kind as enum ('view', 'search', 'favorite', 'add_to_cart', 'purchase', 'category_view', 'store_view');
create table public.user_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.user_event_kind not null,
  product_id uuid references public.products (id) on delete cascade,
  category_id uuid references public.categories (id) on delete cascade,
  store_id uuid references public.stores (id) on delete cascade,
  query text check (query is null or char_length(query) <= 120),
  created_at timestamptz not null default now()
);
create index user_events_user_idx on public.user_events (user_id, created_at desc);
create index user_events_product_idx on public.user_events (product_id, created_at desc);

-- ---------- URL import tool ----------
create table public.url_imports (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  provider text,
  status text not null default 'pending' check (status in ('pending', 'extracted', 'manual_required', 'failed', 'published')),
  extracted jsonb,
  message text,
  product_id uuid references public.products (id) on delete set null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

-- ---------- RLS ----------
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.moderation_events enable row level security;
alter table public.collections enable row level security;
alter table public.collection_products enable row level security;
alter table public.favorites enable row level security;
alter table public.stock_alerts enable row level security;
alter table public.user_events enable row level security;
alter table public.url_imports enable row level security;

create policy categories_read on public.categories for select using (active or public.is_admin());
create policy categories_admin on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy brands_read on public.brands for select using (true);
create policy brands_admin on public.brands for all using (public.is_admin()) with check (public.is_admin());

create policy stores_read on public.stores for select
  using (status = 'active' or public.is_store_member(id) or public.is_admin());
create policy stores_member_update on public.stores for update
  using (public.is_store_member(id) or public.is_admin())
  with check (public.is_store_member(id) or public.is_admin());
create policy stores_admin_insert on public.stores for insert with check (public.is_admin());

-- sellers can't change their own status/kind/rating: guard trigger
create or replace function public.guard_store_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.is_service_role()) then
    new.status := old.status; new.kind := old.kind; new.slug := old.slug;
    new.rating_avg := old.rating_avg; new.rating_count := old.rating_count; new.is_demo := old.is_demo;
  end if;
  return new;
end $$;
create trigger stores_guard before update on public.stores for each row execute function public.guard_store_fields();
create trigger stores_audit after insert or update or delete on public.stores for each row execute function public.audit_trigger();

create policy store_members_read on public.store_members for select
  using (user_id = auth.uid() or public.is_store_member(store_id) or public.is_admin());
create policy store_members_admin on public.store_members for all using (public.is_admin()) with check (public.is_admin());

create policy products_read on public.products for select using (
  (moderation_status = 'published' and exists (select 1 from public.stores s where s.id = store_id and s.status = 'active'))
  or public.is_store_member(store_id) or public.is_admin()
);
create policy products_member_insert on public.products for insert with check (public.is_store_member(store_id) or public.is_admin());
create policy products_member_update on public.products for update
  using (public.is_store_member(store_id) or public.is_admin())
  with check (public.is_store_member(store_id) or public.is_admin());
create trigger products_audit after update of moderation_status, store_id, availability on public.products
  for each row execute function public.audit_trigger();

create policy images_read on public.product_images for select using (
  exists (select 1 from public.products p where p.id = product_id)
);
create policy images_member_write on public.product_images for all using (
  exists (select 1 from public.products p where p.id = product_id and (public.is_store_member(p.store_id) or public.is_admin()))
) with check (
  exists (select 1 from public.products p where p.id = product_id and (public.is_store_member(p.store_id) or public.is_admin()))
);

create policy variants_read on public.product_variants for select using (
  exists (select 1 from public.products p where p.id = product_id)
);
create policy variants_member_write on public.product_variants for all using (
  exists (select 1 from public.products p where p.id = product_id and (public.is_store_member(p.store_id) or public.is_admin()))
) with check (
  exists (select 1 from public.products p where p.id = product_id and (public.is_store_member(p.store_id) or public.is_admin()))
);
create trigger variants_audit after update of price_usd, stock on public.product_variants
  for each row execute function public.audit_trigger();

create policy moderation_events_read on public.moderation_events for select using (
  public.is_admin() or exists (select 1 from public.products p where p.id = product_id and public.is_store_member(p.store_id))
);

create policy collections_read on public.collections for select using (
  (active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())) or public.is_admin()
);
create policy collections_admin on public.collections for all using (public.is_admin()) with check (public.is_admin());
create policy collection_products_read on public.collection_products for select using (true);
create policy collection_products_admin on public.collection_products for all using (public.is_admin()) with check (public.is_admin());

create policy favorites_own on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy stock_alerts_own on public.stock_alerts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_events_insert_own on public.user_events for insert with check (user_id = auth.uid());
create policy user_events_read_own on public.user_events for select using (user_id = auth.uid() or public.is_admin());
create policy user_events_delete_own on public.user_events for delete using (user_id = auth.uid());

create policy url_imports_admin on public.url_imports for all using (public.is_admin()) with check (public.is_admin());

revoke all on public.moderation_events from anon;
revoke insert, update, delete on public.moderation_events from authenticated;
revoke insert, update, delete on public.categories, public.brands, public.collections, public.collection_products from anon;
revoke all on public.favorites, public.stock_alerts, public.user_events, public.url_imports, public.store_members from anon;
revoke insert, update, delete on public.stores, public.products, public.product_variants, public.product_images from anon;
revoke delete on public.products, public.stores from authenticated;
