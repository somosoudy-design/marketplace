-- Settings that database functions cast and compute with are validated when they are written.
-- Without this, an admin typing "48 horas" in the generic JSON editor would make checkout, payment
-- expiry or the recommendations feed fail for every buyer the next time they run.
-- Errors carry hint 'invalid_setting' and a Spanish detail the panel shows as is.

create or replace function public._setting_number(p_key text, p_value jsonb, p_min numeric, p_max numeric, p_integer boolean, p_label text)
returns void language plpgsql immutable set search_path = public as $$
declare v numeric;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'number' then
    raise exception 'invalid setting %', p_key using errcode = '22023', hint = 'invalid_setting',
      detail = format('%s debe ser un número, sin texto ni comillas.', p_label);
  end if;
  v := (p_value #>> '{}')::numeric;
  if p_integer and v <> trunc(v) then
    raise exception 'invalid setting %', p_key using errcode = '22023', hint = 'invalid_setting',
      detail = format('%s debe ser un número entero.', p_label);
  end if;
  if v < p_min or v > p_max then
    raise exception 'invalid setting %', p_key using errcode = '22023', hint = 'invalid_setting',
      detail = format('%s debe estar entre %s y %s.', p_label, replace(p_min::text, '.', ','), replace(p_max::text, '.', ','));
  end if;
end $$;

create or replace function public.guard_setting_value() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v jsonb := new.value;
  k text;
  weights constant text[] := array['affinity', 'popularity', 'freshness', 'available', 'editorial', 'seen_penalty'];
  caps constant text[] := array['max_per_category', 'max_per_store'];
  pricing constant text[] := array['markup_pct', 'per_kg_usd', 'fixed_usd', 'round_to', 'configured'];
begin
  case new.key
    when 'orders.unpaid_expiry_hours' then perform public._setting_number(new.key, v, 1, 720, true, 'El plazo para cancelar pedidos sin pago (horas)');
    when 'claims.seller_response_hours' then perform public._setting_number(new.key, v, 1, 720, true, 'El plazo de respuesta del vendedor (horas)');
    when 'payments.provider_expiry_minutes' then perform public._setting_number(new.key, v, 5, 10080, true, 'La vigencia del pago (minutos)');
    when 'payments.reminder_days_before' then perform public._setting_number(new.key, v, 0, 30, true, 'El aviso antes de una cuota (días)');
    when 'privacy.event_retention_days' then perform public._setting_number(new.key, v, 30, 730, true, 'La conservación de la actividad (días)');
    when 'commission.default_pct' then perform public._setting_number(new.key, v, 0, 50, false, 'La comisión por defecto (%)');
    when 'orders.number_prefix' then
      if jsonb_typeof(v) <> 'string' or (v #>> '{}') !~ '^[A-Z]{1,4}$' then
        raise exception 'invalid setting %', new.key using errcode = '22023', hint = 'invalid_setting',
          detail = 'El prefijo de pedido son de 1 a 4 letras mayúsculas entre comillas, por ejemplo "P".';
      end if;
    when 'ranking' then
      if jsonb_typeof(v) <> 'object' then
        raise exception 'invalid setting %', new.key using errcode = '22023', hint = 'invalid_setting',
          detail = 'El ranking es un objeto con pesos, por ejemplo {"affinity": 3}.';
      end if;
      for k in select jsonb_object_keys(v) loop
        if k = any (weights) then
          perform public._setting_number(new.key, v -> k, 0, 10, false, format('El peso «%s»', k));
        elsif k = any (caps) then
          perform public._setting_number(new.key, v -> k, 1, 40, true, format('El límite «%s»', k));
        else
          raise exception 'invalid setting %', new.key using errcode = '22023', hint = 'invalid_setting',
            detail = format('«%s» no es un parámetro del ranking. Usa: %s.', k, array_to_string(weights || caps, ', '));
        end if;
      end loop;
    when 'pricing.import' then
      if jsonb_typeof(v) <> 'object' then
        raise exception 'invalid setting %', new.key using errcode = '22023', hint = 'invalid_setting',
          detail = 'La regla de precio de importación es un objeto, por ejemplo {"markup_pct": 30}.';
      end if;
      for k in select jsonb_object_keys(v) loop
        if not k = any (pricing) then
          raise exception 'invalid setting %', new.key using errcode = '22023', hint = 'invalid_setting',
            detail = format('«%s» no es parte de la regla de precio. Usa: %s.', k, array_to_string(pricing, ', '));
        end if;
      end loop;
      perform public._setting_number(new.key, v -> 'markup_pct', 0, 500, false, 'El margen (markup_pct)');
      perform public._setting_number(new.key, v -> 'per_kg_usd', 0, 200, false, 'El flete por kilo (per_kg_usd)');
      perform public._setting_number(new.key, v -> 'fixed_usd', 0, 1000, false, 'El cargo fijo (fixed_usd)');
      if v ? 'round_to' and jsonb_typeof(v -> 'round_to') <> 'null' then
        perform public._setting_number(new.key, v -> 'round_to', 0, 0.99, false, 'El redondeo (round_to)');
      end if;
      if v ? 'configured' and jsonb_typeof(v -> 'configured') <> 'boolean' then
        raise exception 'invalid setting %', new.key using errcode = '22023', hint = 'invalid_setting',
          detail = '«configured» es true o false, sin comillas.';
      end if;
    else null;
  end case;
  return new;
end $$;

create trigger app_settings_validate before insert or update on public.app_settings
  for each row execute function public.guard_setting_value();

-- the settings above are read by functions every buyer runs, so they can't be deleted either
create or replace function public.guard_setting_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.key in ('orders.unpaid_expiry_hours', 'claims.seller_response_hours', 'payments.provider_expiry_minutes',
                 'payments.reminder_days_before', 'privacy.event_retention_days', 'commission.default_pct',
                 'orders.number_prefix', 'ranking', 'pricing.import') and not public.is_service_role() then
    raise exception 'setting % is required', old.key using errcode = '22023', hint = 'invalid_setting',
      detail = 'Este parámetro lo usa la plataforma y no se puede eliminar. Cambia su valor en su lugar.';
  end if;
  return old;
end $$;

create trigger app_settings_keep before delete on public.app_settings
  for each row execute function public.guard_setting_delete();

revoke execute on function public._setting_number(text, jsonb, numeric, numeric, boolean, text) from public, anon, authenticated;
revoke execute on function public.guard_setting_value() from public, anon, authenticated;
revoke execute on function public.guard_setting_delete() from public, anon, authenticated;
grant execute on function public._setting_number(text, jsonb, numeric, numeric, boolean, text) to service_role;
grant execute on function public.guard_setting_value() to service_role;
grant execute on function public.guard_setting_delete() to service_role;
