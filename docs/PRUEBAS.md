# Resultados de pruebas

## UX-04 — 2026-10-10 (Codex cloud)

Sobre `claude/marketplace-v1`, base `9e50d2a`; backend local sin Docker (Postgres 17.11), Node 24.19.0,
pnpm 10.28.0 y Chromium. No se modificaron SQL, funciones del servidor, motor financiero ni código del panel.

| Comprobación | Resultado |
|---|---|
| `pnpm typecheck` / `pnpm lint` | Sin errores |
| `pnpm --filter @kora/core test` | 50/50 |
| `pnpm test:admin` | 28/28 |
| `pnpm test:e2e` | 12/12 (compra y avatar) |
| `pnpm test:ui` (exportación reconstruida; suite repetida tras ajustar selectores de pruebas) | 39 aprobadas, 1 omitida por confirmación de correo activa en local |
| `navigation.spec.ts`, incluido en la suite de la app | 6/6, claro y oscuro: cuatro destinos, foco desde Inicio, filtros/búsqueda conservados, ficha y regreso, contador del carrito |
| `pnpm test:panel` | 9/9 |
| Revisión visual | Inicio, Buscar, Carrito y Cuenta, Pixel 7 en claro/oscuro; Inicio/Buscar también a 340 px |

Capturas: `node tools/design/screens.mjs .local/ux04/light light` y
`node tools/design/screens.mjs .local/ux04/dark dark`. La evidencia queda local e ignorada por Git.
Las pruebas de foto de perfil y compartir tiendas pasan junto a UX-04. La primera ejecución de las nuevas
pruebas alcanzaba tarjetas/pantallas ocultas retenidas por el navegador; se corrigió el alcance de los
selectores y la suite completa pasó. No se desactivaron casos. Sin nueva ejecución SQL/funciones ni pruebas
de UX-04 en emulador/teléfono; la compatibilidad OTA la comprueba el workflow antes de publicar.

## Validación inicial — 2026-10-09 (histórico)

Ejecutadas el 2026-10-09 en el entorno de desarrollo (Linux, Node 22, Postgres 16, stack local sin Docker),
inmediatamente después de `pnpm db:reset` (base reconstruida desde cero con las 23 migraciones y el seed).

## Resumen

| Suite | Comando | Resultado |
|---|---|---|
| Base de datos: RLS, finanzas, checkout, pagos, logística, privilegios, herramientas, opiniones, recomendaciones, avisos, parámetros, motor de precios | `pnpm test:db` | **82/82** en verde (11 archivos; 2026-10-09 23:35Z) |
| Compra completa por la API pública (como la app) | `pnpm test:e2e` | **8/8** en verde |
| Funciones del servidor (Deno, contra el stack local) | `pnpm test:functions` | **15/15** en verde (2026-10-09 23Z; incluye `panel-api`) + `assets-mirror` 1/1 |
| Núcleo: dinero, planes, tasas, proveedores, errores, motor de precios | `pnpm --filter @kora/core test` | **50/50** en verde |
| Panel: protección SSRF y DNS rebinding del importador | `pnpm test:admin` | **28/28** en verde (2 archivos, uno sin dobles de red) |
| Interfaz de la app (Playwright, Pixel 7, build web) | `pnpm test:ui` | **14/14** en verde |
| Panel entre roles (Playwright, escritorio) | `pnpm test:panel` | **8/8** en verde con el servidor de Next y **8/8** sobre la exportación estática publicada (servida con `tools/panel/serve-static.mjs`) |
| Tipos (8 paquetes) | `pnpm typecheck` | sin errores |
| Lint (app y panel) | `pnpm lint` | sin errores ni avisos |
| Build de producción del panel | `pnpm --filter @kora/admin build` | correcta |
| Catálogo demo remoto contra una base solo con migraciones (cargar, doble carga, quitar, compra y pago de un comprador nuevo, quitar con pedidos) | `pnpm test:remote-catalog` | **11/11** comprobaciones |
| Configuración nativa | `expo config`, `expo prebuild --platform android` | correcta |
| APK de prueba (EAS) | `tools/eas/verify-apk.mjs` en el workflow | backend de eas.json, sin direcciones locales, solo clave anon, projectId correcto |
| Recorrido de visitante en el APK real (Maestro, Android 15, pantalla de Pixel 6, backend de pruebas) | `tests/apk-flows/01-visitante.yaml` en el workflow «APK en emulador» (cambiar `.github/apk-emulator-request`) | en verde el 2026-10-09 (APK 4 + actualización `01a122a3`): catálogo remoto, ficha por enlace, variante, carrito, carrito conservado al reabrir, paso a iniciar sesión |

Total: **179 pruebas automatizadas** en verde, más las 11 comprobaciones del catálogo remoto.

## Casos críticos del brief

| Caso | Dónde se prueba |
|---|---|
| Doble pulsación de Comprar | `checkout.test.ts`, `purchase-flow.test.ts` (un solo pedido por idempotencia + bloqueo) |
| Pago duplicado | `payments.test.ts` (reintentos idempotentes, referencia duplicada, doble aprobación) |
| Cambio de tasa durante checkout | `payments.test.ts` (la cotización abierta conserva su tasa) |
| Cotización vencida | `payments.test.ts`, UI del pago (actualizar monto) |
| Producto agotado durante la compra | `checkout.test.ts` |
| Dos compradores por la última unidad | `checkout.test.ts` (uno gana, stock nunca negativo) |
| Fallo de conexión | `purchase-flow.test.ts` (error de red amable), `checkout.test.ts` (un reintento tras perder la respuesta devuelve el mismo pedido) |
| Pago pendiente de verificación | `payments.test.ts` (no desbloquea logística); `orders.spec.ts` (el vendedor ve "Esperando pago") |
| Reembolso parcial | `payments.test.ts` (ajusta comisión y saldo del vendedor) |
| Pedido con varios vendedores | `checkout.test.ts` (una entrega por vendedor y modalidad, sin agrupar) |
| Cuotas pagadas con métodos distintos | `payments.test.ts` (VES, USDT y Zelle; saldo en USD) |
| Acceso indebido a otra tienda | `marketplace.test.ts`, `seller-tools.test.ts` |
| Regreso al catálogo conservando el scroll | `browse.spec.ts` (búsqueda, filtros y posición) |
| Ejemplo 120 USD con 50% en VES | `payments.test.ts` |
| Webhooks falsificados | `functions.test.ts` (Binance y PayPal rechazados), `server-functions.test.ts` (un evento falso no bloquea al legítimo) |
| Pago confirmado tarde tras cancelar | `server-functions.test.ts` (va a revisión manual, no se pierde) |
| Push sin duplicados | `server-functions.test.ts`, `functions.test.ts` |
| Opinión sin compra o inflar la nota | `reviews-engagement.test.ts` (solo tras entrega, una por línea, nadie escribe la tabla ni `rating_avg`/`rating_count`, ni un admin) |
| Moderación de opiniones | `reviews-engagement.test.ts`; `panel/reviews.spec.ts` (ocultar exige motivo, publicar de nuevo, respuesta de la tienda) |
| Avisos de demostración que parezcan reales | `reviews-engagement.test.ts` (pedidos o cuentas demo generan avisos `is_test`, nunca enviados por push); `after-sale.spec.ts` (aviso único en el centro) |
| Reclamo: escalar antes de tiempo, dos reclamos abiertos | `reviews-engagement.test.ts` (`too_early`, índice único), `marketplace.test.ts` (el escalado queda en la conversación) |
| Posventa completa en la app | `after-sale.spec.ts` (calificar, abrir reclamo, escribir, ver el reclamo en el pedido, aviso que abre el pedido) |
| Parámetro inválido rompe el checkout o el feed | `config-guards.test.ts` (texto en un número, fuera de rango, clave desconocida en `ranking`, borrar un ajuste requerido) |
| Pago reportado: no volver a pagar por error | `purchase.spec.ts` (tras enviar, la pantalla de pago muestra "Estamos verificando tu pago" y no ofrece otro método) |
| Borrar la dirección principal | `checkout.test.ts` (la más reciente pasa a ser principal; sin direcciones no queda ninguna); `account.spec.ts` (confirmación y nueva principal en pantalla) |
| Abrir pedidos sin conexión | `offline.spec.ts` (con la API bloqueada y recarga completa: número, pasos con su nombre, aviso de que no se pudo actualizar; franja sin conexión que no tapa el título; pantalla nunca cargada explicada; recuperación al volver la red) |
| Cancelar un pedido en web | `offline.spec.ts` (la hoja de confirmación funciona igual en todas las plataformas) |
| Push aceptado pero no entregado | `functions.test.ts` (recibo pedido solo cuando vence, dispositivo inexistente borrado, aviso marcado "Sin entregar" solo si nadie lo recibió, recibo no listo reintentado a los 10 min) |
| Avisos atascados o credenciales de push rechazadas | `panel/dashboard.spec.ts` (el resumen lo advierte y dice qué revisar) |
| DNS rebinding en el importador | `safe-fetch.test.ts` (un host que pasa la primera revisión y cambia a una IP privada al conectar es rechazado); `safe-fetch-connect.test.ts` (sin dobles: undici resuelve a través del guardián y no abre un socket hacia localhost) |
| Parámetros del panel con formularios | `panel/settings.spec.ts` (valor inválido rechazado con su motivo antes de guardar, guardado por grupo, vista previa del precio con la regla comercial); `config-guards.test.ts` (correo y horario de soporte validados en la base) |
| Precio sugerido al importar | `panel/settings.spec.ts` (sin regla revisada no se sugiere nada; revisada, el importador calcula costo + margen + flete por peso + manejo con el redondeo configurado y lo aplica con un toque) |
| Contacto de soporte en la app | `account.spec.ts` (Cuenta › Ayuda muestra el correo y horario configurados en el panel) |
| Superficie de la API para invitados | `privileges.test.ts` (un invitado solo ejecuta las funciones públicas del catálogo; toda función fija su `search_path`); `purchase-flow.test.ts` (un invitado que intenta comprar recibe "Inicia sesión para continuar") |
| Tareas programadas sin la clave maestra | `server-functions.test.ts` (la clave de tareas vive en Vault, solo el rol de servicio la comprueba y solo la exacta pasa); `functions.test.ts` (rates-sync acepta la clave de Vault y rechaza una falsa o recortada) |
| Catálogo todavía vacío | `browse.spec.ts` (el inicio explica que las tiendas preparan su catálogo y ofrece crear cuenta, sin secciones vacías) |
| Enlaces de los correos de acceso | `auth-links.spec.ts` (el enlace de recuperación abre la pantalla de contraseña nueva, valida, guarda y deja de servir al reutilizarlo; el de confirmación inicia sesión y lo dice; abrir la pantalla sin enlace explica dónde abrirlo) |
| Sesión que desaparece | `session.spec.ts` (si la sesión guardada falta con la app abierta, agregar al carrito pide iniciar sesión, la app vuelve al modo visitante y nada dice «Revisa tu conexión»); `auth.test.ts` (base64 y la lectura de la sesión cifrada con los bytes de relleno de Android) |
| Registro sin confirmación (entorno de pruebas) | `signup-without-email.spec.ts` (con «Confirm email» desactivado: sin pantalla de código, el carrito del visitante pasa a la cuenta, no se envía ningún correo; corre solo con `AUTH_AUTOCONFIRM=true pnpm stack:start`) |
| Esquema remoto en un solo archivo | Ensayo manual: base local nueva con las migraciones 1 a 6, el archivo de `tools/supabase-remote` aplicado en una transacción, mismo esquema que la base completa (funciones, columnas, políticas, índices) y negativa a correr dos veces |
| Métricas de recomendaciones | `reviews-engagement.test.ts` (CTR, carrito y compra tras clic; solo admin); `panel/reviews.spec.ts` (nombres de espacios, aviso de tráfico demo, pesos validados) |

## Lo que no se ejecutó (y por qué)

- **Builds nativas e instalación en dispositivos o emuladores:** el entorno no tiene Android SDK ni acceso a
  Google Maven, y no hay macOS para iOS. La UI se probó con la versión web de la misma app en un viewport
  de Pixel 7. Falta probar en Android e iOS reales (gestos, háptica, push, sesión de pago en el navegador).
- **Proveedores externos en vivo** (BCV, DolarApi, Binance P2P, Kraken, Binance Pay, PayPal, Expo Push): el
  entorno no tiene salida a esos dominios y no hay credenciales. Se probaron los lectores con respuestas de
  ejemplo y las integraciones con dobles de prueba que validan firma y forma de cada petición.
- **Transacciones reales:** ninguna, por instrucción.
- **Correo:** en local, Auth pide el código de 6 dígitos y los correos llegan a un buzón de prueba
  (`pnpm stack:start`); el registro sin confirmación del entorno de pruebas se prueba con
  `AUTH_AUTOCONFIRM=true pnpm stack:start`. No hay SMTP real.
- **Cron en Supabase:** `pg_cron`/`pg_net` no existen en el Postgres local; la migración lo detecta y no
  programa. Los trabajos se probaron llamándolos directamente.

## Problemas encontrados y corregidos en esta ronda

- Un evento de webhook con firma inválida podía ocupar el id del evento legítimo y hacerlo pasar por
  duplicado. Ahora se guarda con un id sintético.
- Un pago en línea abandonado bloqueaba el pedido indefinidamente. Ahora expira a los 180 min
  (configurable) y el comprador puede cancelarlo; si el proveedor confirma después, va a revisión manual.
- El formulario de dirección se sobrescribía si los datos se recargaban en segundo plano mientras el
  comprador escribía.
- El panel mostraba la marca escrita a mano en vez de leer `config/brand.json`.

## Problemas encontrados y corregidos en la ronda de profundidad (opiniones, posventa, recomendaciones)

- La nota de las tiendas nunca cambiaba: el guardián de campos de tienda revertía el recálculo. Ahora las
  calificaciones son datos derivados con su propio guardián (nadie las escribe, tampoco un vendedor).
- `mine` en las opiniones era nulo para visitantes; ahora es falso.
- Los avisos de pedidos de demostración no se marcaban como prueba y podían enviarse por push.
- Los montos en los avisos salían como "33.34 USD"; ahora "$33,34".
- La colección "Menos de 50 USD" incluía unos audífonos de 89 USD (dato demo contradictorio).
- La hoja de la tasa decía que USDT no tenía conversión; usa su propia tasa y puede tener comisión.
- Un administrador podía guardar "48 horas" como plazo y romper el checkout o el feed para todos; ahora la
  base valida esos ajustes y explica el error.
- Tres códigos de error de opiniones no tenían texto en español (lo detectó la prueba de cobertura de
  `errors.ts`); el de "ya no se puede editar" tenía el mismo código que "aún no entregado" y ahora es propio.


## Problemas encontrados y corregidos en la segunda ronda (pago, direcciones, sin conexión, push, importador)

- Tras reportar un pago, la pantalla seguía ofreciendo pagar de nuevo; ahora muestra el pago en verificación.
- Promover la dirección principal por `updated_at` elegía mal (cada edición lo cambia); ahora por `created_at`.
- La app mostraba el código interno "delivered" como título de una entrega cuando los nombres de los pasos no
  estaban cargados; ahora muestra un esqueleto y los nombres se guardan para abrir sin red.
- Una conexión caída tardaba cerca de un minuto en mostrarse: supabase-js reintentaba cada lectura debajo de
  React Query. Ahora hay una sola capa de reintentos (`retryReads: false`).
- En web, la app no se enteraba de que había vuelto la conexión (NetInfo web escucha solo
  `navigator.connection`); ahora también escucha los eventos `online`/`offline` del navegador.
- El aviso flotante "Sin conexión" tapaba el título de la pantalla; ahora es una franja que empuja el
  contenido.
- `Alert.alert` no funciona en web: cancelar un pedido no pedía confirmación allí. Ahora se usa una hoja
  propia en todas las plataformas.
- El texto de solicitud de eliminación prometía un correo que el sistema no envía; ya no lo promete.
