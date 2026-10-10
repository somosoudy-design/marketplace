
-- =====================================================================
-- Scenarios: orders in different states, created through the SAME RPCs
-- the apps use, impersonating each demo user with RLS enforced.
-- =====================================================================

-- helper: pick a variant id by product slug + variant title
create or replace function pg_temp.vid(p_slug text, p_title text default null) returns uuid language sql as $$
  select v.id from public.product_variants v join public.products p on p.id = v.product_id
   where p.slug = p_slug and (p_title is null or v.title = p_title) order by v.sort limit 1;
$$;
-- helper: choose a preferred shipping method per delivery group from a checkout preview
create or replace function pg_temp.pick_shipping(p_preview jsonb, p_prefer text[]) returns jsonb language plpgsql as $$
declare g jsonb; o jsonb; v_out jsonb := '{}'; v_pref text;
begin
  for g in select * from jsonb_array_elements(p_preview -> 'groups') loop
    o := null;
    foreach v_pref in array p_prefer loop
      select e into o from jsonb_array_elements(g -> 'shipping_options') e where e ->> 'code' = v_pref limit 1;
      exit when o is not null;
    end loop;
    if o is not null then v_out := v_out || jsonb_build_object(g ->> 'key', o ->> 'method_id'); end if;
  end loop;
  return v_out;
end $$;
grant execute on function pg_temp.vid(text, text) to authenticated;
grant execute on function pg_temp.pick_shipping(jsonb, text[]) to authenticated;

-- ---------- buyer: addresses, browsing signals, favorites ----------
select set_config('request.jwt.claims', '{"sub":"{{buyer}}","role":"authenticated"}', true);
set local role authenticated;
insert into public.addresses (user_id, label, recipient, phone, region_code, city, municipality, line1, reference, id_document, is_default)
values ('{{buyer}}', 'Casa', 'Comprador Demo', '+58 412 000 0001', 'A', 'Caracas', 'Libertador', 'Av. Demostración, Edif. Prueba, piso 3, apto 3-B', 'Frente a la plaza (demo)', 'V-00000001', true),
       ('{{buyer}}', 'Oficina', 'Comprador Demo', '+58 412 000 0001', 'M', 'Chacao', 'Chacao', 'Calle Ficticia 123, Torre Demo, piso 8', null, 'V-00000001', false);
select public.track_event('view', id) from public.products where slug in ('sheglam-labial-liquido-mate', 'sheglam-brillo-labial', 'audifonos-anc-over-ear', 'ugreen-nexode-65w');
select public.track_event('search', null, null, null, 'cargador');
insert into public.favorites (user_id, product_id) select '{{buyer}}', id from public.products where slug in ('lampara-mesa-lino', 'sheglam-paleta-sombras');
insert into public.stock_alerts (user_id, product_id) select '{{buyer}}', id from public.products where slug = 'audifonos-deportivos';
reset role;

-- ---------- Order A: local + seller, paid in full via Pago Móvil ----------
select set_config('request.jwt.claims', '{"sub":"{{buyer}}","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_addr uuid; v_prev jsonb; v_res jsonb; v_q jsonb;
begin
  select id into v_addr from public.addresses where user_id = auth.uid() and is_default;
  perform public.cart_add(pg_temp.vid('ugreen-nexode-65w', 'Blanco'), 1);
  perform public.cart_add(pg_temp.vid('ugreen-cable-usb-c-100w', '1 m'), 2);
  perform public.cart_add(pg_temp.vid('vela-aromatica-vaso', 'Vainilla'), 1);
  v_prev := public.checkout_preview(v_addr, '{}', 'full');
  v_res := public.place_order(v_addr, pg_temp.pick_shipping(v_prev, '{moto_caracas,mrw_domicilio}'), 'full', 'seed-order-a-000001');
  v_q := public.create_payment_quote((v_res ->> 'order_id')::uuid, 'pago_movil');
  perform public.submit_payment((v_q ->> 'id')::uuid, '00451234', null, '{"name":"Comprador Demo","bank":"Banco Demo","phone":"0412-0000001"}', 'seed-pay-a-000001');
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"{{admin}}","role":"authenticated"}', true);
set local role authenticated;
select public.review_payment(id, true) from public.payments where idempotency_key = 'seed-pay-a-000001';
select public.advance_fulfillment(f.id, s.step) from public.fulfillments f
  join public.orders o on o.id = f.order_id and o.idempotency_key = 'seed-order-a-000001'
  cross join (values (1, 'preparing'), (2, 'ready'), (3, 'dispatched')) s(n, step)
 where f.flow = 'local_stock' order by s.n;
reset role;
select set_config('seed.order', (select id::text from public.orders where idempotency_key = 'seed-order-a-000001'), true);
select set_config('request.jwt.claims', '{"sub":"{{seller2}}","role":"authenticated"}', true);
set local role authenticated;
select public.advance_fulfillment(f.id, s.step) from public.fulfillments f
  cross join (values (1, 'confirmed'), (2, 'preparing')) s(n, step)
 where f.order_id = current_setting('seed.order')::uuid and f.flow = 'seller_shipping' order by s.n;
reset role;

-- ---------- Order B: import by order with 50% deposit (Zelle), consolidated cargo ----------
select set_config('request.jwt.claims', '{"sub":"{{buyer}}","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_addr uuid; v_prev jsonb; v_res jsonb; v_q jsonb;
begin
  select id into v_addr from public.addresses where user_id = auth.uid() and is_default;
  perform public.cart_add(pg_temp.vid('audifonos-anc-over-ear', 'Salvia'), 1);
  perform public.cart_add(pg_temp.vid('teclado-mecanico-compacto', 'Crema'), 1);
  v_prev := public.checkout_preview(v_addr, '{}', 'deposit_50');
  v_res := public.place_order(v_addr, pg_temp.pick_shipping(v_prev, '{moto_caracas}'), 'deposit_50', 'seed-order-b-000001');
  v_q := public.create_payment_quote((v_res ->> 'order_id')::uuid, 'zelle');
  perform public.submit_payment((v_q ->> 'id')::uuid, 'ZL-DEMO-77810', '{{buyer}}/demo-comprobante.webp', '{"name":"Comprador Demo"}', 'seed-pay-b-000001');
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"{{admin}}","role":"authenticated"}', true);
set local role authenticated;
select public.review_payment(id, true) from public.payments where idempotency_key = 'seed-pay-b-000001';
insert into public.cargo_batches (code, step_code, description, carrier, created_by)
values ('LOTE-DEMO-01', 'purchased', 'Consolidado aéreo Miami → Caracas (demostración)', 'Courier de demostración', '{{admin}}');
select public.assign_to_batch((select id from public.cargo_batches where code = 'LOTE-DEMO-01'),
  array(select f.id from public.fulfillments f join public.orders o on o.id = f.order_id where o.idempotency_key = 'seed-order-b-000001'));
select public.update_cargo_batch((select id from public.cargo_batches where code = 'LOTE-DEMO-01'), s.step, s.note)
  from (values (1, 'purchased', null), (2, 'to_locker', null), (3, 'at_locker', 'Recibido en casillero (demo)'), (4, 'international_transit', null)) s(n, step, note) order by s.n;
reset role;

-- ---------- Order C: 3 installments, paid with different methods (VES then USDT) ----------
select set_config('request.jwt.claims', '{"sub":"{{buyer}}","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_addr uuid; v_prev jsonb; v_res jsonb; v_q jsonb; v_order uuid;
begin
  select id into v_addr from public.addresses where user_id = auth.uid() and is_default;
  perform public.cart_add(pg_temp.vid('ugreen-power-bank-20000'), 1);
  perform public.cart_add(pg_temp.vid('parlante-portatil', 'Turquesa'), 1);
  v_prev := public.checkout_preview(v_addr, '{}', 'three_parts');
  v_res := public.place_order(v_addr, pg_temp.pick_shipping(v_prev, '{retiro_oficina_kora}'), 'three_parts', 'seed-order-c-000001');
  v_order := (v_res ->> 'order_id')::uuid;
  v_q := public.create_payment_quote(v_order, 'pago_movil');
  perform public.submit_payment((v_q ->> 'id')::uuid, '00459876', null, '{"name":"Comprador Demo","bank":"Banco Demo"}', 'seed-pay-c-000001');
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"{{admin}}","role":"authenticated"}', true);
set local role authenticated;
select public.review_payment(id, true) from public.payments where idempotency_key = 'seed-pay-c-000001';
reset role;
select set_config('request.jwt.claims', '{"sub":"{{buyer}}","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_order uuid; v_q jsonb;
begin
  select id into v_order from public.orders where idempotency_key = 'seed-order-c-000001';
  v_q := public.create_payment_quote(v_order, 'usdt_trc20');
  perform public.submit_payment((v_q ->> 'id')::uuid, 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90', null, '{"name":"Comprador Demo"}', 'seed-pay-c-000002');
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"{{admin}}","role":"authenticated"}', true);
set local role authenticated;
select public.review_payment(id, true) from public.payments where idempotency_key = 'seed-pay-c-000002';
select public.advance_fulfillment(f.id, 'preparing') from public.fulfillments f
  join public.orders o on o.id = f.order_id where o.idempotency_key = 'seed-order-c-000001';
reset role;

-- ---------- Order D: payment waiting for admin verification ----------
select set_config('request.jwt.claims', '{"sub":"{{buyer}}","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_addr uuid; v_prev jsonb; v_res jsonb; v_q jsonb;
begin
  select id into v_addr from public.addresses where user_id = auth.uid() and is_default;
  perform public.cart_add(pg_temp.vid('sheglam-labial-liquido-mate', 'Terracota'), 2);
  perform public.cart_add(pg_temp.vid('sheglam-brillo-labial', 'Rosado'), 1);
  v_prev := public.checkout_preview(v_addr, '{}', 'full');
  v_res := public.place_order(v_addr, pg_temp.pick_shipping(v_prev, '{moto_caracas}'), 'full', 'seed-order-d-000001');
  v_q := public.create_payment_quote((v_res ->> 'order_id')::uuid, 'pago_movil');
  perform public.submit_payment((v_q ->> 'id')::uuid, '00460011', null, '{"name":"Comprador Demo","bank":"Banco Demo"}', 'seed-pay-d-000001');
  -- leave something in the cart for the demo
  perform public.cart_add(pg_temp.vid('sheglam-rubor-liquido'), 1);
  perform public.cart_add(pg_temp.vid('lampara-mesa-lino'), 1);
end $$;
reset role;

-- ---------- buyer 2 (Valencia): seller order delivered + claim; another with partial refund ----------
select set_config('request.jwt.claims', '{"sub":"{{buyer2}}","role":"authenticated"}', true);
set local role authenticated;
insert into public.addresses (user_id, label, recipient, phone, region_code, city, municipality, line1, reference, id_document, is_default)
values ('{{buyer2}}', 'Consultorio', 'Compradora Demo', '+58 414 000 0002', 'G', 'Valencia', 'Valencia', 'Av. Bolívar Norte, C.C. Demostración, local 12', 'Planta baja (demo)', 'V-00000002', true);
do $$
declare v_addr uuid; v_prev jsonb; v_res jsonb; v_q jsonb;
begin
  select id into v_addr from public.addresses where user_id = auth.uid() and is_default;
  perform public.cart_add(pg_temp.vid('guantes-nitrilo-x100', 'M'), 2);
  perform public.cart_add(pg_temp.vid('espejos-bucales-x12'), 1);
  v_prev := public.checkout_preview(v_addr, '{}', 'full');
  v_res := public.place_order(v_addr, pg_temp.pick_shipping(v_prev, '{mrw_domicilio}'), 'full', 'seed-order-e-000001');
  v_q := public.create_payment_quote((v_res ->> 'order_id')::uuid, 'transferencia_ves');
  perform public.submit_payment((v_q ->> 'id')::uuid, '000123456789', '{{buyer2}}/demo-comprobante.webp', '{"name":"Compradora Demo","bank":"Banco Demo"}', 'seed-pay-e-000001');

  perform public.cart_add(pg_temp.vid('cama-ovalada-mascotas', 'M'), 1);
  perform public.cart_add(pg_temp.vid('comedero-doble-acero'), 2);
  v_prev := public.checkout_preview(v_addr, '{}', 'full');
  v_res := public.place_order(v_addr, pg_temp.pick_shipping(v_prev, '{zoom_oficina}'), 'full', 'seed-order-f-000001');
  v_q := public.create_payment_quote((v_res ->> 'order_id')::uuid, 'zelle');
  perform public.submit_payment((v_q ->> 'id')::uuid, 'ZL-DEMO-90210', '{{buyer2}}/demo-comprobante.webp', '{"name":"Compradora Demo"}', 'seed-pay-f-000001');
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"{{admin}}","role":"authenticated"}', true);
set local role authenticated;
select public.review_payment(id, true) from public.payments where idempotency_key in ('seed-pay-e-000001', 'seed-pay-f-000001');
reset role;
-- OdontoPro processes and delivers
select set_config('seed.order', (select id::text from public.orders where idempotency_key = 'seed-order-e-000001'), true);
select set_config('request.jwt.claims', '{"sub":"{{seller}}","role":"authenticated"}', true);
set local role authenticated;
select public.advance_fulfillment(f.id, s.step, null, s.tracking) from public.fulfillments f
  cross join (values (1, 'confirmed', null), (2, 'preparing', null), (3, 'dispatched', 'MRW-DEMO-0042'), (4, 'in_transit', null), (5, 'delivered', null)) s(n, step, tracking)
 where f.order_id = current_setting('seed.order')::uuid order by s.n;
reset role;
-- Patitas delivers too
select set_config('seed.order', (select id::text from public.orders where idempotency_key = 'seed-order-f-000001'), true);
select set_config('request.jwt.claims', '{"sub":"{{seller2}}","role":"authenticated"}', true);
set local role authenticated;
select public.advance_fulfillment(f.id, s.step, null, s.tracking) from public.fulfillments f
  cross join (values (1, 'confirmed', null), (2, 'preparing', null), (3, 'dispatched', 'ZOOM-DEMO-1188'), (4, 'delivered', null)) s(n, step, tracking)
 where f.order_id = current_setting('seed.order')::uuid order by s.n;
reset role;
-- claim from buyer 2 on the dental order
select set_config('request.jwt.claims', '{"sub":"{{buyer2}}","role":"authenticated"}', true);
set local role authenticated;
select public.open_claim(f.id, 'missing_parts', 'La caja de guantes llegó con menos unidades de las indicadas (reclamo de demostración).')
  from public.fulfillments f join public.orders o on o.id = f.order_id where o.idempotency_key = 'seed-order-e-000001';
reset role;
select set_config('seed.order', (select id::text from public.orders where idempotency_key = 'seed-order-e-000001'), true);
select set_config('request.jwt.claims', '{"sub":"{{seller}}","role":"authenticated"}', true);
set local role authenticated;
select public.post_claim_message(c.id, 'Lamentamos el inconveniente. Enviaremos una caja de reposición con el próximo despacho (respuesta de demostración).')
  from public.claims c where c.order_id = current_setting('seed.order')::uuid;
reset role;
-- buyer 2 reviews what was delivered (through the same RPC as the app; demo orders make demo reviews)
select set_config('request.jwt.claims', '{"sub":"{{buyer2}}","role":"authenticated"}', true);
set local role authenticated;
select public.submit_review(i.id, r.rating, r.body)
  from public.order_items i join public.orders o on o.id = i.order_id join public.products p on p.id = i.product_id
  join (values
    ('guantes-nitrilo-x100', 4, 'Buena talla y no se rompen al ponerlos. Faltaron unidades en la caja, pero la tienda respondió rápido (opinión de demostración).'),
    ('espejos-bucales-x12', 5, 'Vinieron bien protegidos y la imagen es nítida (opinión de demostración).'),
    ('cama-ovalada-mascotas', 5, 'Mi perra no se baja de ella. La tela se siente resistente (opinión de demostración).'),
    ('comedero-doble-acero', 3, 'Uno llegó abollado; me reembolsaron esa unidad (opinión de demostración).')
  ) r(slug, rating, body) on r.slug = p.slug
 where o.buyer_id = auth.uid();
reset role;
select set_config('request.jwt.claims', '{"sub":"{{seller}}","role":"authenticated"}', true);
set local role authenticated;
select public.reply_review(r.id, 'Gracias por contarnos. La reposición ya va en camino (respuesta de demostración).')
  from public.reviews r join public.products p on p.id = r.product_id where p.slug = 'guantes-nitrilo-x100';
reset role;

-- admin: partial refund on the pet order (one bowl arrived damaged) + payout draft for OdontoPro
select set_config('request.jwt.claims', '{"sub":"{{admin}}","role":"authenticated"}', true);
set local role authenticated;
select public.refund_item(i.id, 1, 'Unidad llegó abollada (demo)', false)
  from public.order_items i join public.orders o on o.id = i.order_id
  join public.products p on p.id = i.product_id
 where o.idempotency_key = 'seed-order-f-000001' and p.slug = 'comedero-doble-acero';
select public.create_payout((select id from public.stores where slug = 'odontopro'), 20.00, 'Liquidación de demostración');
reset role;

-- one clearly-marked test notification (never generated by real operations)
insert into public.notifications (user_id, kind, title, body, is_test, push_status)
values ('{{buyer}}', 'system', 'Bienvenido al entorno de demostración', 'Los pedidos, pagos y tasas que ves aquí son datos de prueba.', true, 'skipped');

select public.refresh_popularity();
-- keep curated demo popularity (refresh_popularity skips is_demo rows)
