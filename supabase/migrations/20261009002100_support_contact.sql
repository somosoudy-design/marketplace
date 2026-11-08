-- The support contact is now what the app shows in Cuenta › Ayuda, so it is validated like the other settings
-- the platform depends on. The unused "checkout" presentation flag is removed: the rate source is always shown
-- to the buyer, and a switch that changes nothing would mislead the operator.

create or replace function public.guard_support_setting() returns trigger
language plpgsql security definer set search_path = public as $$
declare v jsonb := new.value; k text;
begin
  if jsonb_typeof(v) <> 'object' then
    raise exception 'invalid setting %', new.key using errcode = '22023', hint = 'invalid_setting',
      detail = 'El contacto de soporte es un objeto, por ejemplo {"email": "soporte@tutienda.com", "hours": "Lun a Vie, 9:00 a 18:00"}.';
  end if;
  for k in select jsonb_object_keys(v) loop
    if k not in ('email', 'hours') then
      raise exception 'invalid setting %', new.key using errcode = '22023', hint = 'invalid_setting',
        detail = format('«%s» no es parte del contacto de soporte. Usa: email, hours.', k);
    end if;
  end loop;
  if jsonb_typeof(v -> 'email') is distinct from 'string' or (v ->> 'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' then
    raise exception 'invalid setting %', new.key using errcode = '22023', hint = 'invalid_setting',
      detail = 'El correo de soporte no es válido.';
  end if;
  if jsonb_typeof(v -> 'hours') is distinct from 'string' or char_length(btrim(v ->> 'hours')) not between 1 and 80 then
    raise exception 'invalid setting %', new.key using errcode = '22023', hint = 'invalid_setting',
      detail = 'El horario de atención es un texto de 1 a 80 caracteres.';
  end if;
  return new;
end $$;

create trigger app_settings_validate_support before insert or update on public.app_settings
  for each row when (new.key = 'support') execute function public.guard_support_setting();

revoke execute on function public.guard_support_setting() from public, anon, authenticated;
grant execute on function public.guard_support_setting() to service_role;

update public.app_settings set description = 'Contacto de soporte que la app muestra en Cuenta › Ayuda' where key = 'support';
delete from public.app_settings where key = 'checkout';
