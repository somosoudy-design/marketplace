-- Private follows belong to the buyer account and are removed with its other saved data.
create table public.store_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  primary key (user_id, store_id)
);
create index store_follows_store_id on public.store_follows (store_id);

alter table public.store_follows enable row level security;
revoke all on public.store_follows from public, anon, authenticated, service_role;
grant select, insert, delete on public.store_follows to authenticated;

create policy store_follows_read on public.store_follows
  for select to authenticated using (user_id = (select auth.uid()));
create policy store_follows_insert on public.store_follows
  for insert to authenticated with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.stores as store
      where store.id = store_follows.store_id and store.status = 'active'
    )
  );
create policy store_follows_delete on public.store_follows
  for delete to authenticated using (user_id = (select auth.uid()));
create policy account_open_only on public.store_follows
  as restrictive for all to authenticated
  using ((select account_private.session_open()))
  with check ((select account_private.session_open()));

create trigger account_00_open
  before insert or delete on public.store_follows
  for each statement execute function account_private.guard_write();

-- Auth uses soft deletion. Clean follows when the existing closure worker scrubs saved data.
create function account_private.clean_store_follows() returns trigger
language plpgsql security definer set search_path = pg_catalog
as $$
begin
  delete from public.store_follows where user_id = new.user_id;
  return new;
end
$$;
revoke all on function account_private.clean_store_follows() from public, anon, authenticated, service_role;
create trigger close_clean_store_follows
  after update of data_cleaned on account_private.close_jobs for each row
  when (not old.data_cleaned and new.data_cleaned)
  execute function account_private.clean_store_follows();
