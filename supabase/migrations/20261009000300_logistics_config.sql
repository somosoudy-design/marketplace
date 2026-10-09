-- =====================================================================
-- Geography (Venezuela first, country-aware for expansion), addresses,
-- carriers, zones, shipping rates, pickup points, lead-time rules.
-- =====================================================================

create table public.regions (
  country_code text not null default 'VE' check (country_code ~ '^[A-Z]{2}$'),
  code text not null,
  name text not null,
  sort int not null default 0,
  primary key (country_code, code)
);
comment on table public.regions is 'First-level administrative divisions (estados in VE). Country-aware for future expansion.';

create table public.cities (
  id serial primary key,
  country_code text not null default 'VE',
  region_code text not null,
  name text not null,
  is_capital boolean not null default false,
  foreign key (country_code, region_code) references public.regions (country_code, code),
  unique (country_code, region_code, name)
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null default 'Casa' check (char_length(label) between 1 and 40),
  recipient text not null check (char_length(recipient) between 3 and 120),
  phone text not null check (phone ~ '^\+?[0-9 ()-]{7,20}$'),
  country_code text not null default 'VE',
  region_code text not null,
  city text not null check (char_length(city) between 2 and 80),
  municipality text check (municipality is null or char_length(municipality) <= 80),
  line1 text not null check (char_length(line1) between 5 and 200),
  reference text check (reference is null or char_length(reference) <= 200),
  id_document text check (id_document is null or id_document ~ '^[VEJGP]-?[0-9]{5,10}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (country_code, region_code) references public.regions (country_code, code)
);
create index addresses_user_idx on public.addresses (user_id);
create unique index addresses_one_default on public.addresses (user_id) where is_default;
create trigger addresses_touch before update on public.addresses for each row execute function public.touch_updated_at();

create or replace function public.addresses_single_default() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_default then
    update public.addresses set is_default = false where user_id = new.user_id and id <> new.id and is_default;
  elsif tg_op = 'INSERT' and not exists (select 1 from public.addresses where user_id = new.user_id and is_default) then
    -- the first address of a user becomes the default
    new.is_default := true;
  end if;
  return new;
end $$;
create trigger addresses_default before insert or update of is_default on public.addresses
  for each row execute function public.addresses_single_default();

-- ---------- carriers & rates ----------
create type public.shipping_kind as enum ('home_delivery', 'office_pickup', 'store_pickup');
create type public.fulfillment_flow as enum ('local_stock', 'import_order', 'seller_shipping');

create table public.carriers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  tracking_url_template text,
  active boolean not null default true,
  is_demo boolean not null default false
);

create table public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  country_code text not null default 'VE',
  region_codes text[] not null
);

create table public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid references public.carriers (id),
  code text not null unique,
  name text not null,
  kind public.shipping_kind not null,
  description text,
  active boolean not null default true,
  sort int not null default 0
);

create table public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  method_id uuid not null references public.shipping_methods (id) on delete cascade,
  zone_id uuid not null references public.shipping_zones (id) on delete cascade,
  store_id uuid references public.stores (id) on delete cascade,
  flows public.fulfillment_flow[] not null default '{local_stock,import_order,seller_shipping}',
  base_usd numeric(10,2) not null check (base_usd >= 0),
  per_kg_usd numeric(10,2) not null default 0 check (per_kg_usd >= 0),
  free_over_usd numeric(10,2),
  min_days int not null check (min_days >= 0),
  max_days int not null,
  max_weight_kg numeric(8,2),
  active boolean not null default true,
  is_demo boolean not null default false,
  check (max_days >= min_days)
);
comment on column public.shipping_rates.store_id is 'null = platform logistics rate. Seller-specific rows override platform rows for that seller.';
create index shipping_rates_lookup on public.shipping_rates (zone_id, store_id) where active;

create table public.pickup_points (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references public.carriers (id),
  region_code text not null,
  country_code text not null default 'VE',
  city text not null,
  name text not null,
  address text not null,
  active boolean not null default true,
  is_demo boolean not null default false
);

-- ---------- lead time rules (no hardcoded delivery promises in code) ----------
create table public.lead_time_rules (
  id uuid primary key default gen_random_uuid(),
  availability public.availability not null,
  origin public.product_origin,
  store_id uuid references public.stores (id) on delete cascade,
  category_id uuid references public.categories (id) on delete cascade,
  min_days int not null check (min_days >= 0),
  max_days int not null,
  label text,
  active boolean not null default true,
  check (max_days >= min_days)
);
comment on table public.lead_time_rules is 'Days until the item is ready to ship (before carrier transit). Most specific active rule wins: store > category > origin > availability.';

create or replace function public.lead_time(p_product_id uuid)
returns table (min_days int, max_days int)
language sql stable security definer set search_path = public as $$
  select r.min_days, r.max_days
    from public.products p
    join public.lead_time_rules r
      on r.active
     and r.availability = p.availability
     and (r.origin is null or r.origin = p.origin)
     and (r.store_id is null or r.store_id = p.store_id)
     and (r.category_id is null or r.category_id = p.category_id)
   where p.id = p_product_id
   order by (r.store_id is not null) desc, (r.category_id is not null) desc, (r.origin is not null) desc
   limit 1;
$$;

create or replace function public.flow_for(p_origin public.product_origin, p_store_kind public.store_kind)
returns public.fulfillment_flow language sql immutable as $$
  select case
    when p_store_kind = 'seller' then 'seller_shipping'::public.fulfillment_flow
    when p_origin = 'import' then 'import_order'::public.fulfillment_flow
    else 'local_stock'::public.fulfillment_flow
  end;
$$;

-- shipping options for a delivery group
create or replace function public.shipping_options(
  p_store_id uuid, p_flow public.fulfillment_flow, p_region_code text, p_weight_kg numeric, p_subtotal_usd numeric,
  p_country_code text default 'VE'
) returns table (
  method_id uuid, method_code text, method_name text, kind public.shipping_kind, carrier_name text,
  cost_usd numeric, min_days int, max_days int, is_demo boolean
) language sql stable security definer set search_path = public as $$
  with zone as (
    select id from public.shipping_zones
     where country_code = p_country_code and p_region_code = any (region_codes)
     limit 1
  ), candidates as (
    select r.*, m.code, m.name, m.kind, m.sort, c.name as carrier_name,
           rank() over (partition by r.method_id order by (r.store_id is not null) desc) as rk
      from public.shipping_rates r
      join public.shipping_methods m on m.id = r.method_id and m.active
      left join public.carriers c on c.id = m.carrier_id
     where r.active
       and r.zone_id = (select id from zone)
       and p_flow = any (r.flows)
       and (r.store_id = p_store_id or r.store_id is null)
       and (r.max_weight_kg is null or p_weight_kg <= r.max_weight_kg)
  ), has_own as (
    select exists (select 1 from candidates where store_id = p_store_id) as v
  )
  select c.method_id, c.code, c.name, c.kind, c.carrier_name,
         case when c.free_over_usd is not null and p_subtotal_usd >= c.free_over_usd then 0::numeric
              else round(c.base_usd + c.per_kg_usd * greatest(ceil(p_weight_kg) - 1, 0), 2) end,
         c.min_days, c.max_days, c.is_demo
    from candidates c, has_own
   where c.rk = 1
     -- sellers that configured their own rates only offer their own methods
     and (not has_own.v or c.store_id = p_store_id)
   order by c.sort, 6;
$$;

-- ---------- RLS ----------
alter table public.regions enable row level security;
alter table public.cities enable row level security;
alter table public.addresses enable row level security;
alter table public.carriers enable row level security;
alter table public.shipping_zones enable row level security;
alter table public.shipping_methods enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.pickup_points enable row level security;
alter table public.lead_time_rules enable row level security;

create policy regions_read on public.regions for select using (true);
create policy cities_read on public.cities for select using (true);
create policy addresses_own on public.addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy addresses_admin_read on public.addresses for select using (public.is_admin());
create policy carriers_read on public.carriers for select using (active or public.is_admin());
create policy zones_read on public.shipping_zones for select using (true);
create policy methods_read on public.shipping_methods for select using (active or public.is_admin());
create policy rates_read on public.shipping_rates for select using (active or public.is_admin() or public.is_store_member(store_id));
create policy pickup_read on public.pickup_points for select using (active or public.is_admin());
create policy lead_read on public.lead_time_rules for select using (true);

create policy carriers_admin on public.carriers for all using (public.is_admin()) with check (public.is_admin());
create policy zones_admin on public.shipping_zones for all using (public.is_admin()) with check (public.is_admin());
create policy methods_admin on public.shipping_methods for all using (public.is_admin()) with check (public.is_admin());
create policy rates_admin on public.shipping_rates for all using (public.is_admin()) with check (public.is_admin());
create policy rates_seller on public.shipping_rates for all
  using (store_id is not null and public.is_store_member(store_id))
  with check (store_id is not null and public.is_store_member(store_id));
create policy pickup_admin on public.pickup_points for all using (public.is_admin()) with check (public.is_admin());
create policy lead_admin on public.lead_time_rules for all using (public.is_admin()) with check (public.is_admin());
create policy regions_admin on public.regions for all using (public.is_admin()) with check (public.is_admin());
create policy cities_admin on public.cities for all using (public.is_admin()) with check (public.is_admin());

revoke all on public.addresses from anon;
revoke insert, update, delete on public.regions, public.cities, public.carriers, public.shipping_zones, public.shipping_methods,
  public.shipping_rates, public.pickup_points, public.lead_time_rules from anon;

-- ---------- reference data: Venezuela (ISO 3166-2:VE) ----------
insert into public.regions (country_code, code, name, sort) values
  ('VE','A','Distrito Capital',1),('VE','B','Anzoátegui',2),('VE','C','Apure',3),('VE','D','Aragua',4),
  ('VE','E','Barinas',5),('VE','F','Bolívar',6),('VE','G','Carabobo',7),('VE','H','Cojedes',8),
  ('VE','I','Falcón',9),('VE','J','Guárico',10),('VE','X','La Guaira',11),('VE','K','Lara',12),
  ('VE','L','Mérida',13),('VE','M','Miranda',14),('VE','N','Monagas',15),('VE','O','Nueva Esparta',16),
  ('VE','P','Portuguesa',17),('VE','R','Sucre',18),('VE','S','Táchira',19),('VE','T','Trujillo',20),
  ('VE','U','Yaracuy',21),('VE','V','Zulia',22),('VE','Y','Delta Amacuro',23),('VE','Z','Amazonas',24);

insert into public.cities (region_code, name, is_capital) values
  ('A','Caracas',true),
  ('B','Barcelona',true),('B','Puerto La Cruz',false),('B','Lechería',false),('B','El Tigre',false),
  ('C','San Fernando de Apure',true),
  ('D','Maracay',true),('D','Turmero',false),('D','La Victoria',false),
  ('E','Barinas',true),
  ('F','Ciudad Bolívar',true),('F','Puerto Ordaz',false),('F','San Félix',false),
  ('G','Valencia',true),('G','Puerto Cabello',false),('G','Naguanagua',false),('G','San Diego',false),
  ('H','San Carlos',true),
  ('I','Coro',true),('I','Punto Fijo',false),
  ('J','San Juan de los Morros',true),('J','Calabozo',false),('J','Valle de la Pascua',false),
  ('X','La Guaira',true),('X','Catia La Mar',false),
  ('K','Barquisimeto',true),('K','Cabudare',false),('K','Carora',false),
  ('L','Mérida',true),('L','El Vigía',false),
  ('M','Los Teques',true),('M','Guarenas',false),('M','Guatire',false),('M','Petare',false),('M','Charallave',false),('M','Ocumare del Tuy',false),('M','San Antonio de los Altos',false),
  ('N','Maturín',true),
  ('O','La Asunción',true),('O','Porlamar',false),('O','Pampatar',false),
  ('P','Guanare',true),('P','Acarigua',false),('P','Araure',false),
  ('R','Cumaná',true),('R','Carúpano',false),
  ('S','San Cristóbal',true),('S','Táriba',false),
  ('T','Trujillo',true),('T','Valera',false),
  ('U','San Felipe',true),
  ('V','Maracaibo',true),('V','Cabimas',false),('V','Ciudad Ojeda',false),('V','San Francisco',false),
  ('Y','Tucupita',true),
  ('Z','Puerto Ayacucho',true);
