-- =====================================================================
-- Default configuration (safe for every environment) and storage buckets.
-- Business values here are starting points editable from the admin panel.
-- Payment methods ship DISABLED: receiving details must be entered by an admin.
-- =====================================================================

-- ---------- logistics flows (brief §16) ----------
insert into public.fulfillment_steps (flow, code, seq, label, buyer_label, buyer_description, requires_payment, notify_buyer, is_terminal, seller_can_set) values
  ('import_order', 'confirmed',             1, 'Pedido confirmado',            'Pedido confirmado',              'Esperando tu anticipo.', null, false, false, false),
  ('import_order', 'deposit_verified',      2, 'Anticipo verificado',          'Anticipo verificado',            'Vamos a comprar tu producto.', 'down_payment', true, false, false),
  ('import_order', 'purchased',             3, 'Compra realizada',             'Compra realizada',               'Compramos tu producto al proveedor.', 'down_payment', true, false, false),
  ('import_order', 'to_locker',             4, 'En tránsito al casillero',     'Camino a nuestro casillero',     null, 'down_payment', true, false, false),
  ('import_order', 'at_locker',             5, 'Recibido en casillero',        'Recibido en el casillero',       null, 'down_payment', true, false, false),
  ('import_order', 'international_transit', 6, 'En tránsito internacional',    'Viajando a Venezuela',           null, 'down_payment', true, false, false),
  ('import_order', 'customs',               7, 'Proceso aduanero',             'En aduana',                      'Los tiempos de aduana pueden variar.', 'down_payment', true, false, false),
  ('import_order', 'available_in_ve',       8, 'Disponible en Venezuela',      'Llegó a Venezuela',              'Completa tu saldo para coordinar la entrega.', 'down_payment', true, false, false),
  ('import_order', 'out_for_delivery',      9, 'En distribución',              'En camino a ti',                 null, 'full', true, false, false),
  ('import_order', 'delivered',            10, 'Entregado',                    'Entregado',                      null, 'full', true, true, false),
  ('import_order', 'cancelled',            99, 'Cancelado',                    'Entrega cancelada',              null, null, true, true, false),

  ('seller_shipping', 'received',           1, 'Pedido recibido',              'Pedido recibido',                'Esperando confirmación del pago.', null, false, false, false),
  ('seller_shipping', 'confirmed',          2, 'Confirmado',                   'Confirmado por la tienda',       null, 'full', true, false, true),
  ('seller_shipping', 'preparing',          3, 'Preparando',                   'Preparando tu pedido',           null, 'full', true, false, true),
  ('seller_shipping', 'dispatched',         4, 'Despachado',                   'Despachado',                     null, 'full', true, false, true),
  ('seller_shipping', 'in_transit',         5, 'En tránsito',                  'En tránsito',                    null, 'full', true, false, true),
  ('seller_shipping', 'delivered',          6, 'Entregado',                    'Entregado',                      null, 'full', true, true, true),
  ('seller_shipping', 'cancelled',         99, 'Cancelado',                    'Entrega cancelada',              null, null, true, true, false),

  ('local_stock', 'received',               1, 'Pedido recibido',              'Pedido recibido',                'Esperando confirmación del pago.', null, false, false, false),
  ('local_stock', 'preparing',              2, 'Preparando',                   'Preparando tu pedido',           null, 'down_payment', true, false, false),
  ('local_stock', 'ready',                  3, 'Listo para despacho o retiro', 'Listo para entrega',             null, 'full', true, false, false),
  ('local_stock', 'dispatched',             4, 'Despachado',                   'Despachado',                     null, 'full', true, false, false),
  ('local_stock', 'delivered',              5, 'Entregado',                    'Entregado',                      null, 'full', true, true, false),
  ('local_stock', 'cancelled',             99, 'Cancelado',                    'Entrega cancelada',              null, null, true, true, false);

-- ---------- installment plans ----------
insert into public.installment_plans (code, name, description, down_payment_pct, installments, interval_days, surcharge_pct, min_order_usd, allowed_flows, sort) values
  ('full',        'Pago completo',  'Pagas el total ahora.',                                   100, 0, 30, 0, 0,   '{local_stock,import_order,seller_shipping}', 1),
  ('deposit_50',  'Anticipo 50%',   'Pagas la mitad ahora y el resto cuando llegue tu pedido.', 50, 1, 30, 0, 40,  '{local_stock,import_order}', 2),
  ('three_parts', '3 cuotas',       'Tres pagos iguales cada 15 días. La primera hoy.',          0,  3, 15, 0, 60,  '{local_stock,import_order}', 3);

-- ---------- lead times (initial estimates, editable) ----------
insert into public.lead_time_rules (availability, origin, min_days, max_days, label) values
  ('available',  null,     0,  1, 'Stock local'),
  ('available',  'seller', 1,  2, 'Preparación del vendedor'),
  ('in_transit', null,     7, 21, 'Mercancía en camino'),
  ('reservable', null,    15, 30, 'Próximo lote'),
  ('on_order',   'import',18, 30, 'Compra internacional por encargo'),
  ('on_order',   null,     5, 10, 'Bajo pedido local');

-- ---------- exchange rate sources & policies ----------
insert into public.exchange_rate_sources (code, name, pair, kind, adapter, enabled, docs_url, notes) values
  ('bcv_official', 'BCV (publicación oficial)', 'USD/VES', 'official', 'bcv_html', true, 'https://www.bcv.org.ve/',
    'El BCV publica la tasa en su portal; no ofrece una API oficial documentada. El adaptador lee la publicación y valida el valor.'),
  ('dolarapi_oficial', 'DolarApi · oficial (agregador)', 'USD/VES', 'official', 'dolarapi', true, 'https://ve.dolarapi.com/',
    'Agregador de terceros que replica la tasa oficial. Usado solo como respaldo.'),
  ('binance_p2p', 'Binance P2P · referencia USDT/VES', 'USDT/VES', 'market_reference', 'binance_p2p', true, 'https://p2p.binance.com/',
    'Referencia de mercado P2P (mediana de anuncios). No es una tasa oficial ni universal; no se usa para cobrar salvo configuración explícita.'),
  ('kraken_usdt', 'Kraken · USDT/USD', 'USD/USDT', 'market_reference', 'kraken_ticker', true, 'https://docs.kraken.com/api/docs/rest-api/get-ticker-information',
    'Precio público de mercado de USDT en USD (invertido a USDT por USD).'),
  ('manual', 'Tasa manual (administración)', '*', 'manual', 'manual', true, null, 'Ingresada por un administrador, con nota y vigencia.');

insert into public.rate_policies (pair, primary_source, fallback_sources, margin_pct, max_age_minutes, rounding_decimals) values
  ('USD/VES',  'bcv_official', '{dolarapi_oficial}', 0, 4320, 2),
  ('USD/USDT', 'kraken_usdt',  '{}',                 0,  180, 4),
  ('USDT/VES', 'binance_p2p',  '{}',                 0,  120, 2);

-- ---------- payment methods (disabled until an admin configures receiving details) ----------
insert into public.payment_methods (code, name, rail, currency, kind, integration_status, enabled, quote_ttl_minutes, requires_reference, requires_proof, reference_pattern, description, sort, instructions) values
  ('pago_movil', 'Pago Móvil', 'pago_movil', 'VES', 'manual', 'live', false, 30, true, false, '^[0-9]{4,20}$',
    'Monto exacto en bolívares calculado con la tasa del momento.', 1, '{}'),
  ('transferencia_ves', 'Transferencia bancaria', 'bank_transfer_ve', 'VES', 'manual', 'live', false, 60, true, true, '^[0-9]{4,24}$',
    'Transferencia desde un banco venezolano.', 2, '{}'),
  ('zelle', 'Zelle', 'zelle', 'USD', 'manual', 'live', false, 1440, true, true, null,
    'Verificación manual. Zelle no ofrece una API pública de cobro para comercios.', 3, '{}'),
  ('usdt_trc20', 'USDT (TRC-20)', 'usdt_trc20', 'USDT', 'manual', 'live', false, 45, true, false, '^[0-9a-fA-F]{64}$',
    'Envío a dirección TRON. La referencia es el hash de la transacción.', 4, '{}'),
  ('binance_pay', 'Binance Pay', 'binance_pay', 'USDT', 'automated', 'pending_credentials', false, 30, false, false, null,
    'Requiere cuenta de comercio aprobada por Binance.', 5, '{}'),
  ('paypal', 'PayPal', 'paypal', 'USD', 'automated', 'pending_credentials', false, 60, false, false, null,
    'Requiere cuenta Business y aprobación de PayPal para marketplace.', 6, '{}'),
  ('efectivo_usd', 'Efectivo en punto de retiro', 'cash', 'USD', 'manual', 'live', false, 2880, false, false, null,
    'Pago en efectivo al retirar en oficina.', 7, '{}');

-- ---------- settings ----------
insert into public.app_settings (key, value, description, is_public) values
  ('orders.number_prefix', '"P"', 'Prefijo de número de pedido', false),
  ('orders.unpaid_expiry_hours', '48', 'Horas antes de cancelar pedidos sin pago y liberar inventario', false),
  ('commission.default_pct', '10', 'Comisión por defecto a vendedores externos (%)', false),
  ('claims.seller_response_hours', '48', 'Horas que tiene el vendedor para responder antes de que el comprador pueda escalar', true),
  ('ranking', '{"affinity":3,"popularity":1.5,"freshness":0.8,"available":0.6,"editorial":0.7,"seen_penalty":0.5,"max_per_category":4,"max_per_store":5}',
    'Pesos del ranking de recomendaciones', false),
  ('pricing.import', '{"markup_pct":30,"per_kg_usd":0,"fixed_usd":0,"round_to":0.99,"configured":false}',
    'Regla de precio comercial para productos importados por URL. Valores de ejemplo: configurar antes de publicar.', false),
  ('support', '{"email":"soporte@example.com","hours":"Lun a Vie, 9:00 a 18:00"}', 'Contacto de soporte (provisional)', true),
  ('checkout', '{"show_rate_source":true}', 'Opciones de presentación del checkout', true);

-- ---------- storage buckets & policies ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('catalog', 'catalog', true, 5242880, '{image/jpeg,image/png,image/webp}'),
  ('stores', 'stores', true, 5242880, '{image/jpeg,image/png,image/webp}'),
  ('payment-proofs', 'payment-proofs', false, 5242880, '{image/jpeg,image/png,image/webp,application/pdf}'),
  ('claims', 'claims', false, 5242880, '{image/jpeg,image/png,image/webp,application/pdf}')
on conflict (id) do nothing;

create policy "proofs: owner uploads in own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "proofs: owner or admin reads" on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "claims: owner uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'claims' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "claims: owner or admin reads" on storage.objects for select to authenticated
  using (bucket_id = 'claims' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "catalog: store members upload to their store folder" on storage.objects for insert to authenticated
  with check (bucket_id in ('catalog', 'stores') and (public.is_admin() or (
    (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and public.is_store_member(((storage.foldername(name))[1])::uuid))));
create policy "catalog: public read" on storage.objects for select using (bucket_id in ('catalog', 'stores'));
