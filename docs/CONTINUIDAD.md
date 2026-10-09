# Documento de continuidad — Marketplace "Kora" v1

> Propósito: que cualquier sesión o persona continúe exactamente donde quedó el trabajo, sin rehacer nada
> ni perder las directrices originales. Actualízalo al cerrar cada hito (sección 8 = bitácora).
>
> Última actualización: 2026-10-09 (sin conexión, recibos de push, importador). Rama de trabajo: `claude/marketplace-v1`,
> subida a GitHub con PR en borrador: https://github.com/somosoudy-design/marketplace/pull/1

## 0. Estado en una línea

La v1 está construida, documentada y verificada en local: base de datos, motor financiero, app móvil, panel
de administración y de vendedor, funciones de servidor, y una ronda de profundidad (opiniones verificadas,
posventa como conversación, inicio editorial, tasa explicada, recomendaciones medidas con su panel,
parámetros validados), y una segunda ronda (pago en verificación, direcciones, app sin conexión, recibos de
entrega de push con su salud en el panel, importador protegido contra DNS rebinding, parámetros del panel con
formularios propios, precio sugerido en el importador, contacto de soporte configurable). 171 pruebas en verde
tras reconstruir la base desde cero, revisión visual en claro y oscuro de lo nuevo. La rama está en GitHub
(PR #1 en borrador). En curso: esquema en el proyecto Supabase «Marketplace» (6 de 21 migraciones; el resto
lo ejecuta Oliver con un archivo) y APK de prueba en EAS para marketplacebrand/marketplace (falta su token
de Expo en GitHub). Ver sección 5.

## 1. Directrices originales que no se pueden perder

Del brief "MARKETPLACE NATIVO PREMIUM v1.0" (Oliver). Son requisitos, no sugerencias:

- No inventar credenciales, no eludir verificaciones, no ejecutar transacciones reales sin autorización.
- Ninguna credencial administrativa ni clave privada en la app ni en el repositorio. La app y el panel solo
  llevan la anon key; la autorización la decide la base de datos (RLS + funciones `security definer`).
- El cliente nunca fija precio, tasa ni saldo. Totales, cotizaciones y saldos se calculan en el servidor.
- Un pago no se confirma porque el usuario pulsó un botón o subió una captura: queda `pending_verification`
  hasta que un administrador lo verifica, o hasta que llega un evento firmado del proveedor.
- No afirmar que Zelle tiene integración pública universal, ni que Binance Pay o PayPal aprobarán
  automáticamente un marketplace. Integraciones no habilitadas: preparadas y documentadas, nunca simulando
  éxito real.
- Tasas: nada hardcodeado como solución permanente; si las fuentes fallan, no usar en silencio una tasa
  vieja (hay estado `stale` y bloqueo de cotización); nada de scraping indiscriminado ni evadir protecciones.
- No inventar tarifas comerciales reales, especificaciones reales ni presentar precios ficticios como
  actuales. Todo dato de demostración lleva `is_demo`/`is_test` y se rotula como tal.
- No enviar notificaciones ficticias que aparenten operaciones reales (`is_test` no se envía por push).
- No custodiar ni transferir automáticamente fondos de terceros sin verificar requisitos legales: las
  liquidaciones a vendedores se registran y se pagan a mano.
- Correos de prueba siempre bajo `example.com`.
- No declarar como probado nada que no se haya ejecutado.
- Preguntar a Oliver solo por bloqueos reales: credenciales, cuentas externas, decisiones legales,
  operaciones financieras reales, costos, acciones irreversibles, publicación pública, borrado de datos.
- **Supabase:** nunca aplicar estas migraciones al proyecto existente `bfuggvbgttvcygbexqyn` (tiene datos de
  BingoCriollo/talvio/veyra). Crear un proyecto nuevo requiere autorización de Oliver (pedida, sin respuesta).
- Marca provisional "Kora": se cambia solo en `config/brand.json`.

## 2. Arquitectura y decisiones técnicas

| Pieza | Tecnología | Dónde |
|---|---|---|
| Monorepo | pnpm 10.28, Node 22, TypeScript 5.9, vitest 3 | raíz (`apps/*`, `packages/*`, `tests/*`, `tools/*`) |
| App de compradores | Expo + React Native + expo-router, React Query | `apps/mobile` (también compila a web para pruebas) |
| Panel web (admin + vendedor) | Next.js 16 (App Router, Turbopack), Tailwind v4, React Query | `apps/admin` (puerto 3100) |
| Backend | Supabase: Postgres 16, Auth (GoTrue), PostgREST, Storage | `supabase/migrations`, `supabase/seed.sql` |
| Lógica compartida | dinero exacto, planes, tasas, pagos, errores en español, importador | `packages/core` |
| Cliente tipado | supabase-js + tipos generados | `packages/api` |
| Diseño | tokens únicos para app, panel y assets | `packages/design-tokens` |
| Datos demo | generador de catálogo, imágenes y `seed.sql` | `tools/demo-assets` |
| Funciones del servidor | Deno (Supabase Edge Functions), sin dependencias npm | `supabase/functions` |
| Stack local sin Docker | Postgres + GoTrue + PostgREST + gateway Node + funciones Deno | `tools/local-stack` |

Decisiones clave:

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
  HTTP (`_shared/rest.ts`). `rates-sync` y `push-dispatch` exigen la service role key; los webhooks verifican
  la firma del proveedor. El cron (migración `001600`) se programa solo si existen `pg_cron` y `pg_net`, y
  llama a las funciones con secretos de Vault (`kora_project_url`, `kora_service_role_key`).
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

## 3. Filosofía de diseño y requisitos UX

- Dirección visual **"Arena y Jade"**: superficies arena cálidas, jade profundo como marca, ámbar para
  momentos de alegría, coral para urgencia; serif editorial para títulos y sans humanista para la interfaz.
  Nada de minimalismo blanco/negro ni pálido clínico. Fuente única: `packages/design-tokens/src/index.ts`.
- Cada foto de producto se presenta sobre el tono de su categoría (`photoTones`), para un catálogo coherente.
- Las tiendas personalizan con una paleta curada de acentos (`storeAccents`), no colores libres.
- Claridad antes que persuasión: cada estado de disponibilidad (en stock, por encargo, preventa, agotado…)
  tiene su llamado a la acción y su texto; la fecha estimada se muestra como rango ("Estimado entre … y …").
- Checkout progresivo, con direcciones venezolanas (estado, ciudad, municipio, punto de referencia, cédula/RIF),
  totales del servidor y explicación del plan de pago; nada de sorpresas en el monto.
- Estados vacíos, de carga (skeleton), error de red amable y sin pantallas en blanco.
- Accesibilidad: etiquetas reales, `aria-describedby` en ayudas y errores, foco visible, contraste AA.
- Mensajes siempre en español de Venezuela, sin jerga técnica hacia el usuario.
- Inicio con ritmo editorial: saludo, búsqueda (que se vuelve barra fija al bajar), píldora de la tasa,
  categorías con foto, vistos recientemente, colecciones que alternan banda destacada / cuadrícula / carrusel
  según su `layout`, tiendas, y un feed continuo "Para ti" que termina con un cierre, no con un corte.
- La tasa nunca es un número suelto: la píldora "BCV · 100,00 Bs. por USD" abre una hoja que explica fuente,
  hora, margen, que el precio de referencia es USD, que el monto en bolívares se fija al generar el pago y que
  USDT usa su propia tasa. Estados de demostración y "sin tasa" con su propio texto.
- Posventa como conversación: calificar desde el pedido, reportar un problema con motivos claros y seguir el
  reclamo como chat con estado, plazo de la tienda y escalado explicado antes de confirmarlo.
- Notificaciones agrupadas por día con icono y color por tipo; los avisos de demostración se anuncian una vez.
- Formularios por secciones con sugerencias (direcciones: "Quién recibe", "Dónde", "Guárdala como";
  ciudades sugeridas del estado; campos opcionales plegados) y botón de guardar fijo.
- Panel: misma paleta y tipografía; tablas densas pero legibles, filtros en línea con las pestañas, avisos
  honestos cuando los datos son de demostración o la muestra es pequeña.

## 4. Funcionalidades implementadas y verificadas

Verificadas = cubiertas por pruebas que se ejecutaron en verde (sección 6).

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

## 5. Pendiente

Bloqueado por Oliver o por servicios externos:

1. **GitHub:** resuelto. La rama está subida y el PR #1 (borrador) espera revisión de Oliver; no se fusiona
   sin él. No hay CI de pruebas (corren en local, sección 7); el único workflow compila el APK de prueba.
2. **Proyecto Supabase «Marketplace»** (`mimnotafmfasvwrclxan`, us-east-1, Postgres 17, plan gratuito).
   Oliver aprobó aplicar el esquema sin datos demo (tarjeta de decisión, 2026-10-09 11:51Z). Las migraciones
   1 a 6 se aplicaron con el conector. Desde la 7, el conector pide una confirmación por los `DELETE`/`DROP`
   que Oliver no ve en el proyecto (se queda colgado): no reintentar ni disfrazar sentencias. Las 15
   restantes están en `tools/supabase-remote/aplicar-migraciones-07-a-21.sql` (generado por `build.py`, una
   transacción, se niega a correr dos veces, renombra el historial a las versiones de los archivos); se le
   pidió ejecutarlo en el SQL Editor. Después: verificar con consultas de solo lectura, avisos de seguridad,
   desplegar funciones y los pasos del panel en `docs/INSTALACION.md` (hook de auth, URLs, correo de
   confirmación o SMTP, secretos de Vault, primer superadmin). Nunca cargar el seed demo en un proyecto remoto
   (tiene cuentas con clave conocida). Este contenedor no llega a `*.supabase.co` (proxy 403); solo el conector.
3. **APK de prueba (EAS):** proyecto https://expo.dev/accounts/marketplacebrand/projects/marketplace (creado
   por Oliver; no crear otro). `config/expo.json` fija owner y slug; `projectId` se completa con el valor que
   imprime la verificación del workflow. El contenedor no llega a expo.dev, así que se compila desde GitHub
   Actions (`.github/workflows/eas-android-preview.yml`, al subir una etiqueta `apk-preview-*`), con el
   secreto `EXPO_TOKEN` que Oliver debe crear. Perfil `preview`: APK interno contra el proyecto Supabase.
   No publicar en Google Play. Apple/Google y builds de tienda: `docs/PUBLICACION.md` (costo).
4. **Credenciales** de Binance Pay, PayPal, FCM/APNs y SMTP. Ver `docs/SERVICIOS_EXTERNOS.md`.
5. **Datos reales:** datos de cobro, tarifas, comisiones, catálogo con fotos autorizadas y precios actuales.

Mejoras ejecutables sin bloqueo (siguiente trabajo sugerido):

- Pruebas en Android/iOS reales cuando exista una build (Maestro o Detox). En particular la franja sin
  conexión (anula el inset superior para el native-stack; verificado solo en web).
- Verificación automática de pagos USDT en cadena.
- CI en GitHub Actions con el stack local (hoy las suites corren solo en esta máquina).
- Panel publicado en internet para pruebas con el APK (hoy solo corre en local; publicar requiere a Oliver).
- Push en Android necesita Firebase Cloud Messaging en la build; sin eso la app lo explica en Ajustes.

## 6. Integraciones: estado

Tabla completa y actualizada en `docs/INTEGRACIONES.md`.

## 7. Pruebas y resultados (ejecutadas de verdad)

Tras `pnpm db:reset` el 2026-10-09, cierre de la ronda de parámetros: 171 pruebas en verde (detalle y casos
críticos en `docs/PRUEBAS.md`):

| Suite | Comando | Resultado |
|---|---|---|
| Base de datos | `pnpm test:db` | 73/73 |
| E2E por API pública | `pnpm test:e2e` | 8/8 |
| Funciones del servidor (Deno) | `pnpm test:functions` | 10/10 |
| Núcleo | `pnpm --filter @kora/core test` | 34/34 |
| Panel unitario (SSRF y DNS rebinding) | `pnpm test:admin` | 28/28 |
| UI app (Playwright, Pixel 7) | `pnpm test:ui` | 10/10 |
| Panel entre roles (Playwright) | `pnpm test:panel` | 8/8 |
| Tipos / lint / build del panel | `pnpm typecheck`, `pnpm lint`, `pnpm --filter @kora/admin build` | sin errores |

No ejecutado: builds nativas y dispositivos reales (sin Android SDK ni Google Maven ni macOS), proveedores
externos en vivo (sin salida de red ni credenciales), transacciones reales (prohibido).

`pnpm test:db` clona la base de desarrollo en `kora_test` y prueba sobre la copia.

## 8. Cómo continuar (instrucciones concretas)

```bash
# 0) Recuperar el código si no tienes el repo
git clone /mnt/project-files/marketplace/kora-repo.bundle marketplace   # o desde GitHub cuando esté subido
cd marketplace && git checkout claude/marketplace-v1

# 1) Dependencias (Node >= 20, pnpm 10, Postgres 16 instalado en /usr/lib/postgresql/16/bin)
corepack enable && pnpm install

# 2) Stack local sin Docker (descarga PostgREST y GoTrue la primera vez)
pnpm stack:start          # Postgres 54322, gateway 54321 (/auth/v1, /rest/v1, /storage/v1, /functions/v1)
pnpm db:reset             # aplica migraciones + seed + assets demo
source tools/local-stack/env.sh   # DB_URL, puertos; claves locales en .local/keys.env

# 3) Apps
pnpm --filter @kora/admin dev     # panel en http://127.0.0.1:3100
pnpm --filter @kora/mobile start  # Expo
# Cuentas demo (solo local): admin@example.com, vendedor@example.com, comprador@example.com — clave Demo-1234

# 4) Pruebas
pnpm test:db && pnpm test:e2e && pnpm test:functions && pnpm test:ui && pnpm test:panel && pnpm test:admin && pnpm --filter @kora/core test
pnpm typecheck && pnpm lint

# 5) Guardar progreso (commit + respaldo en los archivos del proyecto)
git add -A && git commit && bash tools/backup-to-project.sh
```

Convenciones:

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
- APK de prueba: con `EXPO_TOKEN` en GitHub, `git tag apk-preview-N && git push origin apk-preview-N`; lee el
  resultado con los registros del job (página de la compilación, enlace del APK y, si falla, el final del log
  de EAS). `workflow_dispatch` no sirve mientras el workflow no esté en `main`.

## 9. Bitácora

- 2026-10-09 — Base de datos, motor financiero, app móvil, panel admin y vendedor; todas las suites en verde.
  Primer commit; respaldo en `/mnt/project-files/marketplace/kora-repo.bundle` y `/mnt/project-files/marketplace/repo`.
  Push a GitHub rechazado (app de Claude sin acceso al repo); pedido a Oliver.
- 2026-10-09 — Funciones del servidor (pagos en línea, webhooks, tasas, push) con migración `001600`; pago en
  línea en la app (iniciar, retomar, cancelar); marca del panel desde `config/brand.json`; ESLint en app y
  panel; base reconstruida desde cero y 138 pruebas en verde; documentación final en `docs/`.
- 2026-10-09 — Ronda de profundidad tras la directriz de Oliver ("implementar no es terminar"): opiniones
  verificadas con calificaciones derivadas, perfil de tienda, barras fijas, inicio editorial con feed continuo,
  hoja de la tasa, reclamos como conversación con escalado, centro de notificaciones por día con avisos demo
  seguros, formulario de dirección por secciones, carrito vacío con sugerencias, medición de recomendaciones,
  panel de opiniones y de recomendaciones, validación de parámetros en la base (migración `001800`).
  Cada pieza con prueba y revisión de pantalla (claro y oscuro). Push a GitHub sigue rechazado (403).
- 2026-10-09 — Segunda ronda: tarjeta de pago en verificación, gestión de direcciones con promoción de la
  principal (`001900`), app sin conexión (persistencia selectiva, franja, estados honestos, reintentos en una
  sola capa), hojas de confirmación multiplataforma, recibos de push y salud del canal en el panel (`002000`),
  importador protegido contra DNS rebinding (undici + `guardedLookup`). GitHub ya acepta el push: rama subida
  y PR #1 en borrador. 167 pruebas en verde.
- 2026-10-09 — Parámetros del panel con formularios propios y vista previa de precio, precio sugerido en el
  importador, contacto de soporte configurable (`002100`). 171 pruebas en verde. Oliver aprobó aplicar el
  esquema al proyecto «Marketplace»: 6 migraciones aplicadas; las 15 restantes, en un archivo ensayado para el
  SQL Editor. App vinculada a Expo marketplacebrand/marketplace, perfil `preview` contra ese backend y
  workflow de EAS por etiqueta; esperando el SQL ejecutado y `EXPO_TOKEN`.
