# Documento de continuidad — Marketplace "Kora" v1

> Propósito: que cualquier sesión o persona continúe exactamente donde quedó el trabajo, sin rehacer nada
> ni perder las directrices originales. Actualízalo al cerrar cada hito (sección 8 = bitácora).
>
> Última actualización: 2026-10-09 (cierre de v1). Rama de trabajo: `claude/marketplace-v1`.

## 0. Estado en una línea

La v1 está construida, documentada y verificada en local: base de datos, motor financiero, app móvil, panel
de administración y de vendedor, funciones de servidor y 138 pruebas en verde tras reconstruir la base desde
cero. Lo que queda depende de Oliver o de servicios externos: acceso de GitHub para subir la rama, proyecto
Supabase dedicado, cuentas de Expo/tiendas y credenciales de proveedores (ver sección 5).

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
  redirecciones re-validadas, tamaño máximo). Limitación conocida: no protege contra DNS rebinding entre la
  validación y la conexión; es una herramienta solo para administradores.
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

## 5. Pendiente

Bloqueado por Oliver o por servicios externos:

1. **GitHub:** la app de Claude no tiene acceso a `somosoudy-design/marketplace` (público). Cuando lo tenga:
   `git push -u origin claude/marketplace-v1` y abrir PR hacia `main` (el remoto solo tiene un README inicial;
   la rama ya está rebasada sobre él).
2. **Proyecto Supabase dedicado** (autorización y posible costo). Pasos en `docs/INSTALACION.md`.
3. **Expo/EAS, Apple y Google** para builds instalables y publicación (costo). Ver `docs/PUBLICACION.md`.
4. **Credenciales** de Binance Pay, PayPal, FCM/APNs y SMTP. Ver `docs/SERVICIOS_EXTERNOS.md`.
5. **Datos reales:** datos de cobro, tarifas, comisiones, catálogo con fotos autorizadas y precios actuales.

Mejoras ejecutables sin bloqueo (siguiente trabajo sugerido):

- Pruebas en Android/iOS reales cuando exista una build (Maestro o Detox).
- Recibos de entrega de Expo Push (segunda fase) además de los tickets.
- Verificación automática de pagos USDT en cadena.
- Métricas del sistema de recomendaciones en el panel.
- Protección contra DNS rebinding en el importador (resolver una vez y conectar a esa IP).

## 6. Integraciones: estado

Tabla completa y actualizada en `docs/INTEGRACIONES.md`.

## 7. Pruebas y resultados (ejecutadas de verdad)

Tras `pnpm db:reset` el 2026-10-09 (detalle y casos críticos en `docs/PRUEBAS.md`):

| Suite | Comando | Resultado |
|---|---|---|
| Base de datos | `pnpm test:db` | 58/58 |
| E2E por API pública | `pnpm test:e2e` | 8/8 |
| Funciones del servidor (Deno) | `pnpm test:functions` | 9/9 |
| Núcleo | `pnpm --filter @kora/core test` | 32/32 |
| Panel unitario (SSRF) | `pnpm test:admin` | 23/23 |
| UI app (Playwright, Pixel 7) | `pnpm test:ui` | 5/5 |
| Panel entre roles (Playwright) | `pnpm test:panel` | 3/3 |
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

## 9. Bitácora

- 2026-10-09 — Base de datos, motor financiero, app móvil, panel admin y vendedor; todas las suites en verde.
  Primer commit; respaldo en `/mnt/project-files/marketplace/kora-repo.bundle` y `/mnt/project-files/marketplace/repo`.
  Push a GitHub rechazado (app de Claude sin acceso al repo); pedido a Oliver.
- 2026-10-09 — Funciones del servidor (pagos en línea, webhooks, tasas, push) con migración `001600`; pago en
  línea en la app (iniciar, retomar, cancelar); marca del panel desde `config/brand.json`; ESLint en app y
  panel; base reconstruida desde cero y 138 pruebas en verde; documentación final en `docs/`.
