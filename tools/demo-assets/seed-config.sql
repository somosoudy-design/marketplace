
-- ---------- DEMO exchange rates (clearly labelled, never real) ----------
insert into public.exchange_rate_sources (code, name, pair, kind, adapter, enabled, notes)
values ('demo', 'Tasa de demostración (no real)', '*', 'manual', 'manual', true, 'Solo desarrollo. Nunca habilitar en producción.');
update public.rate_policies set fallback_sources = fallback_sources || '{demo}' where pair in ('USD/VES', 'USD/USDT', 'USDT/VES');
insert into public.exchange_rates (source_code, pair, rate, observed_at, raw) values
  ('demo', 'USD/VES', 100.00, now(), '{"note":"DEMO"}'),
  ('demo', 'USD/USDT', 1.0010, now(), '{"note":"DEMO"}'),
  ('demo', 'USDT/VES', 101.50, now(), '{"note":"DEMO"}');

-- Dev helper: refresh demo rates (they go stale by design; run: select public.dev_refresh_demo_rates();)
create or replace function public.dev_refresh_demo_rates() returns void language sql security definer set search_path = public as $$
  insert into public.exchange_rates (source_code, pair, rate, observed_at, raw)
  select 'demo', pair, rate, now(), '{"note":"DEMO refresh"}'::jsonb
    from (select distinct on (pair) pair, rate from public.exchange_rates where source_code = 'demo' order by pair, observed_at desc) d;
$$;
revoke execute on function public.dev_refresh_demo_rates() from anon, authenticated, public;

-- ---------- payment methods: FICTITIOUS receiving details for development ----------
update public.payment_methods set enabled = true, instructions = '{"banco":"Banco de Demostración (0000)","telefono":"0412-000-0000","documento":"J-00000000-0","titular":"DEMO MARKETPLACE C.A.","nota":"Datos ficticios de desarrollo. No transferir."}' where code = 'pago_movil';
update public.payment_methods set enabled = true, instructions = '{"banco":"Banco de Demostración (0000)","cuenta":"0000-0000-00-0000000000","documento":"J-00000000-0","titular":"DEMO MARKETPLACE C.A.","nota":"Datos ficticios de desarrollo. No transferir."}' where code = 'transferencia_ves';
update public.payment_methods set enabled = true, instructions = '{"correo":"pagos-demo@example.com","titular":"Demo Marketplace LLC","nota":"Datos ficticios de desarrollo. No enviar dinero."}' where code = 'zelle';
update public.payment_methods set enabled = true, instructions = '{"red":"TRON (TRC-20)","direccion":"TDEMO000000000000000000000000000000","nota":"Dirección ficticia de desarrollo. No enviar fondos."}' where code = 'usdt_trc20';
update public.payment_methods set enabled = true, instructions = '{"donde":"Al retirar en la oficina de demostración o al recibir con el motorizado","nota":"Datos ficticios de desarrollo. Lleva el monto exacto."}' where code = 'efectivo_usd';
-- binance_pay / paypal stay disabled: pending merchant credentials

-- ---------- logistics (DEMO tariffs: not commercial rates) ----------
insert into public.carriers (code, name, tracking_url_template, is_demo) values
  ('kora_moto', 'Entrega propia (motorizado)', null, true),
  ('zoom', 'Zoom', 'https://www.zoom.red/tracking-de-envios-personas/?nro-guia={tracking}', true),
  ('mrw', 'MRW', 'https://www.mrwve.com/', true),
  ('tealca', 'Tealca', 'https://www.tealca.com/', true),
  ('retiro', 'Retiro', null, true);

insert into public.shipping_zones (code, name, region_codes) values
  ('caracas', 'Gran Caracas', '{A,M,X}'),
  ('centro', 'Centro', '{D,G,H,U,J}'),
  ('occidente', 'Occidente', '{K,I,P,E,T,V}'),
  ('andes', 'Andes', '{L,S}'),
  ('oriente', 'Oriente', '{B,N,R,O}'),
  ('sur', 'Sur', '{F,C,Z,Y}');

insert into public.shipping_methods (carrier_id, code, name, kind, description, sort) values
  ((select id from public.carriers where code = 'kora_moto'), 'moto_caracas', 'Entrega a domicilio en Caracas', 'home_delivery', 'Motorizado propio', 1),
  ((select id from public.carriers where code = 'retiro'), 'retiro_oficina_kora', 'Retiro en oficina Kora (Chacao)', 'store_pickup', 'Sin costo', 2),
  ((select id from public.carriers where code = 'zoom'), 'zoom_oficina', 'Zoom · retiro en oficina', 'office_pickup', null, 3),
  ((select id from public.carriers where code = 'mrw'), 'mrw_domicilio', 'MRW · a domicilio', 'home_delivery', null, 4),
  ((select id from public.carriers where code = 'tealca'), 'tealca_oficina', 'Tealca · retiro en oficina', 'office_pickup', null, 5);

-- platform rates (all flows)
insert into public.shipping_rates (method_id, zone_id, base_usd, per_kg_usd, free_over_usd, min_days, max_days, is_demo)
select m.id, z.id, r.base, r.per_kg, r.free_over, r.min_d, r.max_d, true
  from (values
    ('moto_caracas', 'caracas', 3.00, 0.50, 60.00, 0, 1),
    ('retiro_oficina_kora', 'caracas', 0.00, 0.00, null, 0, 1),
    ('zoom_oficina', 'caracas', 4.00, 0.80, null, 1, 2),
    ('zoom_oficina', 'centro', 5.50, 1.00, null, 1, 3),
    ('zoom_oficina', 'occidente', 6.50, 1.20, null, 2, 4),
    ('zoom_oficina', 'andes', 7.00, 1.20, null, 2, 5),
    ('zoom_oficina', 'oriente', 6.50, 1.20, null, 2, 4),
    ('zoom_oficina', 'sur', 8.00, 1.50, null, 3, 6),
    ('mrw_domicilio', 'centro', 8.00, 1.20, null, 2, 4),
    ('mrw_domicilio', 'occidente', 9.50, 1.40, null, 2, 5),
    ('mrw_domicilio', 'andes', 10.00, 1.40, null, 3, 6),
    ('mrw_domicilio', 'oriente', 9.50, 1.40, null, 2, 5),
    ('mrw_domicilio', 'sur', 11.00, 1.60, null, 3, 7),
    ('tealca_oficina', 'centro', 5.00, 1.00, null, 2, 4),
    ('tealca_oficina', 'occidente', 6.00, 1.10, null, 2, 5)
  ) as r(method, zone, base, per_kg, free_over, min_d, max_d)
  join public.shipping_methods m on m.code = r.method
  join public.shipping_zones z on z.code = r.zone;

-- Casa Lumen ships with its own carrier agreements from Valencia (seller-specific rates override platform rates)
insert into public.shipping_rates (method_id, zone_id, store_id, flows, base_usd, per_kg_usd, min_days, max_days, is_demo)
select m.id, z.id, (select id from public.stores where slug = 'casa-lumen'), '{seller_shipping}', r.base, r.per_kg, r.min_d, r.max_d, true
  from (values
    ('mrw_domicilio', 'caracas', 6.00, 1.00, 1, 3), ('mrw_domicilio', 'centro', 4.00, 0.80, 1, 2),
    ('mrw_domicilio', 'occidente', 7.00, 1.00, 2, 4), ('mrw_domicilio', 'andes', 8.00, 1.00, 2, 5),
    ('mrw_domicilio', 'oriente', 7.50, 1.00, 2, 4), ('mrw_domicilio', 'sur', 9.00, 1.20, 3, 6),
    ('zoom_oficina', 'caracas', 4.50, 0.80, 1, 3), ('zoom_oficina', 'centro', 3.00, 0.60, 1, 2),
    ('zoom_oficina', 'occidente', 5.00, 0.80, 2, 4), ('zoom_oficina', 'andes', 5.50, 0.80, 2, 5),
    ('zoom_oficina', 'oriente', 5.00, 0.80, 2, 4), ('zoom_oficina', 'sur', 6.50, 1.00, 3, 6)
  ) as r(method, zone, base, per_kg, min_d, max_d)
  join public.shipping_methods m on m.code = r.method
  join public.shipping_zones z on z.code = r.zone;

insert into public.pickup_points (carrier_id, region_code, city, name, address, is_demo) values
  ((select id from public.carriers where code = 'retiro'), 'M', 'Chacao', 'Oficina Kora Chacao (demo)', 'Dirección de demostración', true),
  ((select id from public.carriers where code = 'zoom'), 'G', 'Valencia', 'Zoom Valencia Centro (demo)', 'Dirección de demostración', true),
  ((select id from public.carriers where code = 'zoom'), 'K', 'Barquisimeto', 'Zoom Barquisimeto (demo)', 'Dirección de demostración', true);

update public.app_settings set value = '"P"' where key = 'orders.number_prefix';
