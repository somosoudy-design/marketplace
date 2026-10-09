-- Guards for commercial configuration edited from the admin panel.

-- Deletions of tables keyed by something other than "id" (payment_methods.code, app_settings.key) were
-- audited without an entity id.
create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_id text;
  v_data jsonb;
begin
  if tg_op = 'DELETE' then
    v_id := (to_jsonb(old) ->> coalesce(tg_argv[0], 'id'));
    v_data := jsonb_build_object('old', to_jsonb(old));
  elsif tg_op = 'UPDATE' then
    v_id := (to_jsonb(new) ->> coalesce(tg_argv[0], 'id'));
    select jsonb_object_agg(n.key, jsonb_build_object('from', o.value, 'to', n.value))
      into v_data
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o using (key)
     where n.value is distinct from o.value and n.key not in ('updated_at', 'updated_by', 'search');
    if v_data is null then return new; end if;
  else
    v_id := (to_jsonb(new) ->> coalesce(tg_argv[0], 'id'));
    v_data := jsonb_build_object('new', to_jsonb(new));
  end if;
  perform public.audit(lower(tg_op), tg_table_name, v_id, v_data);
  return coalesce(new, old);
end $$;

-- ---------- payment methods ----------
-- integration_status says whether a provider integration has real credentials behind it. Only the
-- deployment (service role) changes it; admins can't flip a provider to "live" from the panel. An
-- automated method can only be offered while its integration is live or in sandbox, and a manual method
-- needs payment instructions (account, phone, address...) before buyers can see it.
create or replace function public.guard_payment_method() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_service_role() then
    if new.integration_status is distinct from old.integration_status then
      raise exception 'integration status is managed by the deployment' using errcode = '42501', hint = 'integration_managed';
    end if;
    new.code := old.code; new.kind := old.kind; new.rail := old.rail; new.currency := old.currency;
  end if;
  if new.enabled and not old.enabled then
    if new.kind = 'automated' and new.integration_status not in ('live', 'sandbox') then
      raise exception 'integration is not configured' using errcode = 'P0001', hint = 'integration_not_ready';
    end if;
    if new.kind = 'manual' and new.instructions = '{}'::jsonb then
      raise exception 'payment instructions are required' using errcode = '22023', hint = 'instructions_required';
    end if;
  end if;
  return new;
end $$;
create trigger payment_methods_guard before update on public.payment_methods for each row execute function public.guard_payment_method();

-- ---------- settings: who changed what (audited since the foundation migration) ----------
create or replace function public.touch_setting() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
create trigger app_settings_touch before update on public.app_settings for each row execute function public.touch_setting();

create trigger shipping_rates_audit after insert or update or delete on public.shipping_rates for each row execute function public.audit_trigger();

revoke execute on function public.guard_payment_method() from public, anon, authenticated;
revoke execute on function public.touch_setting() from public, anon, authenticated;
grant execute on function public.guard_payment_method() to service_role;
grant execute on function public.touch_setting() to service_role;
