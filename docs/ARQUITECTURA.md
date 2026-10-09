# Arquitectura de Kora

## Piezas

| Pieza | Tecnología | Dónde |
|---|---|---|
| Monorepo | pnpm 10.28, Node 22, TypeScript 5.9 (la app, 6.0), vitest 3 | raíz (`apps/*`, `packages/*`, `tests/*`, `tools/*`) |
| App de compradores | Expo SDK 57, React Native 0.86, expo-router, React Query 5, Reanimated 4 | `apps/mobile` (también exporta a web para las pruebas) |
| Panel web (admin + vendedor) | Next.js 16 (App Router), Tailwind v4, React Query | `apps/admin` (puerto 3100; `/admin` y `/vendedor`) |
| Backend | Supabase: Postgres, Auth (GoTrue), PostgREST, Storage, Edge Functions (Deno) | `supabase/migrations`, `supabase/functions` |
| Lógica compartida | dinero exacto, planes, tasas, pagos, sesión, errores en español, importador | `packages/core` |
| Cliente tipado | supabase-js + tipos generados de la base | `packages/api` |
| Diseño | tokens únicos para app, panel y generadores de imágenes | `packages/design-tokens` |
| Datos demo | generador de catálogo, imágenes, logos y `seed.sql` | `tools/demo-assets` |
| Stack local sin Docker | Postgres + GoTrue + PostgREST + gateway Node + funciones Deno + buzón de correo | `tools/local-stack` |
| Compilación y revisión de APK | scripts usados por los workflows de GitHub | `tools/eas`, `.github/workflows` |
| Pruebas | vitest (base, API, núcleo, panel), Deno (funciones), Playwright (app web y panel) | `tests/db-tests`, `tests/app-e2e`, `supabase/functions/tests` |

```
apps/mobile/src/app          pantallas (expo-router): (tabs), product, cart, checkout, pay, orders, claim…
apps/mobile/src/components   ui/ (Text, Button, Badge, Card, States, Bars…), catalog/, checkout/
apps/mobile/src/lib          auth, supabase, query (caché y modo sin conexión), session-storage, hooks
apps/admin/src/app           rutas del panel; components/ con ui.tsx, Shell, Crud, Settings…
supabase/migrations          23 migraciones (`20261009000100` … `20261009154233`)
supabase/functions           rates-sync, push-dispatch, payments-start, binance-pay-webhook, paypal-webhook
supabase/remote-demo         catálogo demo para el proyecto remoto y el script para quitarlo
tools/supabase-remote        archivos SQL para el SQL Editor cuando el conector no sirve
```

## Funcionalidades implementadas

Verificadas = cubiertas por pruebas que se ejecutaron en verde en local (`docs/PRUEBAS.md`). En el APK real
se ha probado menos; lo comprobado allí está en `docs/ESTADO_ACTUAL.md`.

- **Catálogo y descubrimiento:** home editorial en una sola llamada, búsqueda, filtros, orden, paginación,
  detalle para visitantes y compradores, recomendaciones diversas que respetan exclusión y compras previas,
  colecciones editoriales, tiendas suspendidas ocultas.
- **Multi-vendedor:** aislamiento estricto (un vendedor no toca otra tienda, sus productos, precios ni
  stock), moderación (productos sensibles quedan en revisión; el vendedor no puede autopublicarlos ni tocar
  campos de moderación), suspensión de productos por admin visible para el vendedor.
- **Carrito y checkout:** carrito de invitado que se conserva, división en entregas por vendedor/modalidad,
  precios del servidor, idempotencia ante doble toque y reintentos, carrera por la última unidad (stock nunca
  negativo), agotado durante el checkout bloquea con motivo claro, métodos de envío válidos por entrega,
  planes de cuotas restringidos a donde aplican.
- **Motor financiero:** ejemplo del brief (120 USD, 50% inicial en VES, saldo en USD re-cotizado), cotización
  abierta conserva su tasa hasta vencer, cotización vencida rechazada, tasa vencida nunca usada en silencio,
  pagos duplicados bloqueados, verificación pendiente no desbloquea logística, rechazo mantiene la deuda,
  cuotas con métodos distintos, recepción parcial proporcional, reembolso parcial que ajusta comisión y
  saldo del vendedor, liquidaciones que nunca exceden el disponible, rate limiting en envío de pagos.
- **Pagos automáticos (preparados):** eventos de proveedor exigen firma válida, son idempotentes y comparan
  monto; proveedores deshabilitados no se pueden cotizar.
- **Logística:** flujo de importación de 10 pasos con lotes de carga que respetan el pago, flujo del vendedor
  (despacho exige guía, la entrega liquida el libro), cancelación de no pagados repone stock, reclamos
  (abrir, responder, escalar, resolver).
- **Cuentas:** registro, inicio de sesión, recuperación, direcciones, notificaciones en la app, solicitud de
  eliminación de cuenta (anonimiza, conserva pedidos, espera si hay pedidos abiertos).
- **Panel de administración** (`/admin/*`): resumen, pedidos y detalle, pagos (verificar/rechazar/reembolsar),
  productos y moderación, inventario, categorías, tiendas, usuarios y roles (solo superadmin), importar por
  URL con confirmación de derechos de imagen, contenido/colecciones, envíos y tarifas (tarifas, métodos,
  transportistas, zonas, puntos de retiro, preparación), tasas (consultar ahora, carga manual, forzar valor
  revisado), cuotas, liquidaciones, reclamos, configuración comercial (métodos de pago con instrucciones,
  planes, comisiones, ajustes con autor del cambio) y auditoría.
- **Panel del vendedor** (`/vendedor/*`): resumen, pedidos (abiertos/terminados, nivel de pago, avance de
  pasos solo si el pago lo permite), ventas con comisión y neto, balance y liquidaciones (sin transferencias
  automáticas), envíos propios (solo tarifas reales de entregas que despacha), perfil de tienda con logo,
  portada y acento, productos con editor completo (variantes, fotos, inventario, historial de moderación).
- **Seguridad del panel:** la app rechaza una service role key; el panel solo usa anon key + sesión.
- **Opiniones:** calificar desde el pedido entregado (hoja con estrellas y comentario, editable), resumen y
  lista en la ficha, perfil de tienda con su nota; calificaciones derivadas a prueba de manipulación;
  moderación con motivo (`/admin/opiniones`) y respuesta de la tienda con filtro "sin responder"
  (`/vendedor/opiniones`).
- **Reclamos en la app:** formulario por motivo, conversación con la tienda, estado y plazo visibles,
  escalado con confirmación, decisión final visible; el pedido muestra el reclamo en lugar del botón.
- **Notificaciones:** centro por día, marcadas como leídas al verlas, enlace al pedido o al reclamo,
  avisos demo rotulados y nunca enviados por push.
- **Inicio, tasa y carrito:** inicio editorial con feed continuo y medición de impresiones; píldora y hoja de
  la tasa; carrito vacío con sugerencias medidas; relacionados medidos en la ficha.
- **Recomendaciones en el panel** (`/admin/recomendaciones`): rendimiento por espacio y período, productos
  más tocados, aviso de tráfico demo o muestra pequeña, editor de pesos validado igual que en la base.
- **Parámetros validados:** un valor inválido en Configuración se rechaza con el motivo exacto.
- **Pago en verificación:** tras reportar un pago, la pantalla de pago muestra una tarjeta "Estamos verificando
  tu pago" (método, monto, equivalente, referencia) y oculta el selector hasta que el admin decida.
- **Direcciones:** lista de filas con insignia "Principal", edición, eliminación con confirmación y promoción
  automática de otra principal.
- **Sin conexión:** pedidos, detalle con pasos de entrega, direcciones, favoritos, avisos e inicio se abren
  sin red; una pantalla nunca cargada lo explica; si una actualización falla sobre datos guardados se avisa.
- **Push confiable y visible:** recibos de entrega, limpieza de dispositivos y tarjeta de salud en el panel.
- **Importador:** protegido contra DNS rebinding; sugiere el precio de venta con la regla comercial
  (costo, peso, margen, redondeo) y deja usarlo con un toque.
- **Parámetros del panel** (`/admin/configuracion?tab=settings`): formularios propios por grupo (pedidos,
  vendedores, privacidad, soporte, precios de importación) con validación igual a la de la base y vista previa
  del precio; las claves sin formulario siguen en "Otros parámetros".
- **Contacto de soporte:** correo y horario editables en el panel (validados en la base, `002100`) y
  mostrados en Cuenta › Ayuda de la app.

## Decisiones técnicas

La sesión del comprador en el teléfono se guarda cifrada: AES-256-GCM con una clave creada en el aparato y
guardada en el Keystore / Keychain (`apps/mobile/src/lib/session-storage.ts`); en Android `fromCombined`
recibe bytes, no base64 (`sealedPlaintext` en `packages/core/src/auth.ts`). Si el servidor responde «inicia
sesión» mientras la app muestra una cuenta, la app vuelve al modo visitante (`lib/auth.tsx`).


- **La base de datos es la autoridad.** Toda escritura sensible pasa por RPC `security definer` que validan
  rol, pertenencia a tienda, estado y montos. Las tablas tienen RLS. La lista de funciones ejecutables por
  `anon`/`authenticated` es una allowlist verificada por `tests/db-tests/test/db/privileges.test.ts`
  (si agregas una RPC pública, agrégala ahí a `EXPOSED`).
- **Errores:** las RPC lanzan `hint` con un código (`invalid_amount`, `quote_expired`, …) que
  `packages/core/src/errors.ts` (`ERROR_MESSAGES`, `toAppError`) traduce a español.
- **Roles y tiendas en el JWT:** un custom access token hook agrega `app_metadata.roles` y
  `app_metadata.stores`. `is_service_role()` es verdadero para JWT service_role o sesión postgres.
- **Dinero:** `numeric` en Postgres y decimales exactos en TS (`packages/core/src/money.ts`). Referencia en
  USD; se cobra en USD, USDT o VES; planes completo / inicial / cuotas; el saldo pendiente siempre en USD y se
  re-cotiza a la tasa vigente.
- **Idempotencia:** `place_order`, `submit_payment`, eventos de proveedor y pagos llevan clave de
  idempotencia + advisory locks; doble toque = un solo pedido/pago.
- **Tasas:** fuentes en `exchange_rate_sources` (BCV, DolarApi, Binance P2P referencial, Kraken USD/USDT,
  manual). `ingest_rate` rechaza saltos > 25% salvo que un admin fuerce un valor revisado. Las cotizaciones
  (`payment_quotes`) congelan tasa con vencimiento; si la tasa está vencida no se cotiza.
- **Pagos manuales** (Pago Móvil, transferencia VES, Zelle, USDT TRC-20, efectivo): instrucciones
  configurables, referencia y comprobante, verificación por admin. **Automáticos** (Binance Pay, PayPal):
  `integration_status = pending_credentials`; el admin no puede cambiar ese estado ni habilitarlos sin
  integración (trigger `guard_payment_method`). Flujo en línea: la app llama a la función `payments-start`
  (crea la orden con secretos del servidor y devuelve el enlace); solo el webhook firmado acredita
  (`record_provider_event`). Un evento sin firma se guarda con id sintético para no bloquear al legítimo;
  un éxito que llega tras cancelar o vencer el intento va a revisión manual; los intentos sin confirmar
  vencen a los `payments.provider_expiry_minutes` (180).
- **Funciones del servidor** (`supabase/functions/<nombre>/handler.ts` exporta `createHandler(deps)` para
  poder probarlas con dobles; `index.ts` solo hace `Deno.serve`). `_shared/core/*.ts` es una copia generada
  de `packages/core` (`pnpm edge:sync`; las pruebas fallan si está desactualizada). Hablan con PostgREST por
  HTTP (`_shared/rest.ts`). `rates-sync` y `push-dispatch` aceptan la service role key o la clave de tareas de Vault; los webhooks verifican
  la firma del proveedor. El cron (migración `001600`) se programa solo si existen `pg_cron` y `pg_net`, y
  llama a las funciones con secretos de Vault: `kora_project_url` (la pone el operador) y `kora_job_token` (la crea la migración `20261009154233`; las funciones la validan con `job_token_valid`).
- **Push:** `claim_push_batch` marca lotes como `sending` (dos ejecuciones nunca envían dos veces),
  `complete_push` registra el resultado, reintenta hasta 3 veces y borra tokens `DeviceNotRegistered`.
- **Pedidos multi-vendedor:** el carrito se divide en entregas (`fulfillments`) por tienda/modalidad, cada una
  con su envío y su flujo (importación en 10 pasos, envío del vendedor, retiro). Los pasos que requieren pago
  se bloquean hasta que el nivel de pago lo permite (`_order_payment_level`).
- **Panel web:** todas las páginas son cliente (`'use client'`) con la anon key y la sesión del usuario. Los
  route handlers (`app/api/*`) actúan como el usuario que llama (Bearer + `requireAdmin`), nunca con service
  role. El importador por URL (`/api/import`) usa `safe-fetch.ts` con protección SSRF (IPv4/IPv6 privadas,
  redirecciones re-validadas, tamaño máximo). Contra DNS rebinding, cada petición va por `importerAgent`
  (undici) cuyo `guardedLookup` vuelve a resolver y rechaza respuestas privadas en el momento de conectar
  (`EPRIVATEADDR` → "Dirección no permitida."); una IP literal se valida antes y no pasa por DNS.
- **Opiniones verificadas** (migración `001700`): solo opina quien compró y recibió (`submit_review` por
  línea de pedido, editable). La tienda responde en público (`reply_review`); la plataforma oculta con un
  motivo que ve el autor (`moderate_review`). `rating_avg`/`rating_count` de productos y tiendas son datos
  derivados: los recalcula `_refresh_ratings` y el trigger `guard_rating_fields` impide escribirlos a mano
  (ni un vendedor ni un admin pueden inflar su nota).
- **Recomendaciones medidas:** `track_recommendation(slot, kind, ids)` guarda impresiones (una por persona,
  espacio y producto por hora) y clics en `rec_events`, con límite de frecuencia; respeta
  `personalization_enabled`. `recommendation_metrics(días)` (solo admin) da por espacio impresiones, clics,
  CTR, personas, agregados al carrito y compras dentro de 7 días tras el clic, los productos más tocados y
  `demo_events`/`events` para avisar cuando la muestra es de cuentas demo. Retención:
  `privacy.event_retention_days` (180) con `prune_activity()` (cron si existe pg_cron); `clear_my_activity`
  también borra estas mediciones. Pesos del ranking en el ajuste `ranking`.
- **Medición en la app:** `apps/mobile/src/lib/impressions.tsx`. `useViewportTracking()` + `ImpressionScope`
  envuelven el scroll; `TrackedSection` (hijo directo del contenido del scroll) registra las tarjetas visibles
  sin deslizar la primera vez que entra en pantalla; `ProductRail` registra las que se descubren deslizando y
  el clic en la tarjeta. Espacios: `home_for_you`, `home_featured`, `home_popular`, `home_recent`,
  `collection:<slug>`, `cart_empty`, `related`.
- **Parámetros validados** (migración `001800`): el trigger `guard_setting_value` valida al escribir los
  ajustes con los que calculan las funciones (horas de vencimiento, plazo del vendedor, comisión, prefijo de
  pedido, `ranking`, `pricing.import`); `guard_setting_delete` impide borrarlos. El error lleva
  `hint = invalid_setting` y un `detail` en español que `toAppError` muestra tal cual (lista `DETAILED`).
- **Notificaciones:** `notify()` marca `is_test` si el destinatario es una cuenta demo o el pedido/producto
  es demo, y esas nunca se envían por push (`push_status = skipped`). Los avisos de reclamo llevan
  `order_id` y `fulfillment_id` para abrir la conversación; `notify_store` marca `audience: 'store'` (la app
  no los abre: se gestionan en el panel). Montos con `_fmt_usd` ("$1.234,56").
- **Push en dos fases** (migración `002000`): `push-dispatch` envía (fase 1, tickets) y en la misma corrida
  pide los recibos vencidos (fase 2). `push_tickets` guarda cada ticket aceptado (el token se borra solo
  cuando se borra el dispositivo: `on delete set null`). `claim_push_receipts` entrega los que tienen ≥15 min,
  con 10 min de espera si Expo aún no tiene el recibo, cierra como `expired` los de más de 24 h y borra los
  terminados tras 7 días. `complete_push_receipts` borra dispositivos `DeviceNotRegistered` y marca el aviso
  `failed` ("Sin entregar: …") solo si ningún dispositivo lo recibió. `push_health()` (admin) alimenta la
  tarjeta "Avisos al teléfono" del resumen: dispositivos, enviados, entregas confirmadas, sin entregar, y
  alertas de avisos atascados (falta el cron o los secretos del Vault) o credenciales rechazadas.
- **Direcciones** (migración `001900`): al borrar la principal, la agregada más recientemente pasa a ser la
  principal (trigger `addresses_promote`, por `created_at`: `updated_at` cambia con cada edición). Los pedidos
  guardan copia de la dirección, así que borrarla no altera pedidos.
- **App sin conexión** (`apps/mobile/src/lib/query.ts`): React Query persiste en AsyncStorage
  (`kora-offline-v1`, 1 día, `buster` a subir si cambia la forma de una respuesta) solo estas claves:
  `home`, `categories`, `orders`, `order`, `fulfillment-steps`, `addresses`, `favorites`, `notifications`,
  `profile`, `claims`. Nunca la tasa, métodos de pago, cotizaciones, carrito ni checkout (solo valen como
  los da el servidor en ese momento). `clearAccountCache()` borra todo al cerrar sesión o cambiar de cuenta
  (`lib/auth.tsx`). El estado en línea viene de NetInfo sin sondeo a terceros, más los eventos
  `online`/`offline` del navegador en web (NetInfo web solo mira `navigator.connection`). Las mutaciones usan
  `networkMode: 'always'` para fallar con "sin conexión" en vez de quedar en espera. Los reintentos son de
  una sola capa: el cliente se crea con `retryReads: false` (supabase-js reintentaba lecturas 1-2-4 s debajo
  de React Query y una conexión caída tardaba ~1 min en mostrarse). Piezas de UI: `OfflineFrame` (franja bajo
  la barra de estado que empuja las pantallas, con 1,2 s de margen para cortes breves; anula el inset
  superior para que los encabezados no lo dupliquen), `OfflineState`, `waitingForNetwork(q)` y `StaleNotice`.
- **Confirmaciones:** `ConfirmSheet` (hoja inferior, funciona igual en web, iOS y Android) para cancelar un
  pedido, eliminar una dirección y pedir la eliminación de la cuenta; `Alert.alert` no funciona en web.
- **Reclamos:** conversación comprador–tienda; el comprador puede escalar cuando la tienda respondió o pasó
  `claims.seller_response_hours` (48) sin respuesta; escalar deja un mensaje en la conversación y avisa a la
  tienda. Un solo reclamo abierto por entrega.
- **Storage:** buckets públicos `catalog` y `stores` (ruta `<store_id>/...`, solo jpeg/png/webp) y privados
  `payment-proofs` y `claims` (carpeta del usuario; jpeg/png/webp/pdf). En el cliente sube siempre `await file.arrayBuffer()` con `contentType`
  (el shim local rechaza multipart).

## Convenciones de código


- Nueva migración: `supabase/migrations/<timestamp>_<nombre>.sql`. Si la aplicas a mano en la base de
  desarrollo, registra la versión en `supabase_migrations.schema_migrations` y ejecuta
  `notify pgrst, 'reload schema'`.
- Nueva RPC expuesta: agrégala a `EXPOSED` en `privileges.test.ts` y su error a `packages/core/src/errors.ts`.
- `supabase/seed.sql` es generado: edita `tools/demo-assets/*` y corre `pnpm seed:build`.
- Cambiaste `packages/core/src/rates` o `payments`: corre `pnpm edge:sync`.
- Tras una migración: `pnpm db:types` regenera `packages/api/src/database.types.ts`.
- Las funciones locales corren en :54331 (las arranca `stack:start`; log en `.local/logs/functions.log`).
- La app usa ESLint con `eslint-config-expo` y el panel con `eslint-config-next`; efectos que solo fijan
  estado se reemplazan por estado derivado (regla `react-hooks/set-state-in-effect`).
- Gateway local: no uses `pkill -f` con un patrón que aparezca en tu propia línea de comandos; usa el pid
  de `.local/gateway.pid`.
- El servidor de desarrollo de Next a veces entra en bucle de recarga; reinícialo.
- En Playwright los tabs del panel son `role="tab"`; usa `exact: true` con etiquetas que se solapan.
- Datos para pruebas de UI que la interfaz no alcanza rápido (pedido pagado y entregado, opinión, eventos de
  recomendación): `tests/app-e2e/tests/support/db.ts` (`deliveredOrderFor`, `reviewAs`,
  `browseRecommendations`). Solo corre contra la base local y usa las mismas funciones que la app.
- `tiendas@example.com` administra dos tiendas (Casa Lumen y Patitas & Co.); el selector "Tienda" del panel
  decide cuál se ve. Los pedidos de `deliveredOrderFor` son de Patitas & Co.
- Lint de la app (compilador de React): no leer ni escribir refs durante el render, nada impuro en el render
  (`Date.now()` va en `useState(() => Date.now())`); refs se actualizan en efectos.
- `pnpm test:ui` reconstruye la build web; para correr un solo spec de la app, reconstruye antes
  (`pnpm --filter @kora/app-e2e build:web`) y luego
  `cd tests/app-e2e && npx playwright test --project=app tests/<spec>.ts`. `offline.spec.ts` tarda ~40 s a
  propósito: espera el refresco de 30 s del pedido para comprobar el aviso de datos desactualizados.
- Consulta nueva que deba abrirse sin red: agrega su primera clave a `PERSISTED` en `lib/query.ts`; si cambias
  la forma de una respuesta persistida, sube `buster`. Nunca persistas tasas, cotizaciones, carrito ni checkout.
- Hojas de confirmación: `ConfirmSheet` con `testID`; el botón de confirmar es `<testID>-confirm`.
- Fixtures de push para el panel: `pushTrouble()` en `tests/app-e2e/tests/support/db.ts` (devuelve su limpieza).
- Ajuste nuevo que una función de la base convierta a número: agrégalo a `guard_setting_value` (migración
  `001800`) y su prueba en `config-guards.test.ts`.
- Formulario de un ajuste nuevo en el panel: agrega su `Spec` al grupo en `apps/admin/src/components/Settings.tsx`
  (la validación `check()` debe coincidir con la guarda de la base) y su caso en `panel/settings.spec.ts`.
- Migración nueva para el proyecto remoto: mientras el conector pida confirmaciones que Oliver no ve, genera un
  archivo para el SQL Editor siguiendo `tools/supabase-remote/build.py` y ensáyalo antes en una base de
  prueba local (copia de `auth`/`extensions`/`storage` con `pg_dump -s`, migraciones previas y el archivo).
- APK, actualización y emulador: se piden cambiando archivos de `.github/` (ver `docs/ENTORNO.md`). El icono, el
  splash y el color de notificación forman parte del APK: cambiarlos rompe las actualizaciones al APK instalado
  (constante `NATIVE_IDENTITY` de `apps/mobile/app.config.ts`).
