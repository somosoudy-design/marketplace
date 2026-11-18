-- The official profile keeps its original database slug for installed clients.
-- Reserve its public address and historical spelling across all store statuses.
alter table public.stores add constraint stores_mayami_public_address
  check (slug not in ('mayami', 'cora') or id = '5afbabbf-0678-40ee-a5d8-540f53efe114'::uuid);
