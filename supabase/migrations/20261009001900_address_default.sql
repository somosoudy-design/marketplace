-- Deleting the main address leaves the buyer with addresses but none marked as main, so checkout would
-- open with nothing selected. The most recently added remaining address becomes the main one.
create or replace function public.addresses_promote_default() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.is_default then
    update public.addresses set is_default = true
     where id = (select id from public.addresses where user_id = old.user_id order by created_at desc, id limit 1);
  end if;
  return old;
end $$;
create trigger addresses_promote after delete on public.addresses
  for each row execute function public.addresses_promote_default();

revoke execute on function public.addresses_promote_default() from public, anon, authenticated;
grant execute on function public.addresses_promote_default() to service_role;
