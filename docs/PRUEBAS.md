# Resultados de pruebas

Ejecutadas el 2026-10-09 en el entorno de desarrollo (Linux, Node 22, Postgres 16, stack local sin Docker),
inmediatamente después de `pnpm db:reset` (base reconstruida desde cero con las 18 migraciones y el seed).

## Resumen

| Suite | Comando | Resultado |
|---|---|---|
| Base de datos: RLS, finanzas, checkout, pagos, logística, privilegios, herramientas, opiniones, recomendaciones, avisos, parámetros | `pnpm test:db` | **71/71** en verde (10 archivos) |
| Compra completa por la API pública (como la app) | `pnpm test:e2e` | **8/8** en verde |
| Funciones del servidor (Deno, contra el stack local) | `pnpm test:functions` | **9/9** en verde |
| Núcleo: dinero, planes, tasas, proveedores, errores | `pnpm --filter @kora/core test` | **34/34** en verde |
| Panel: protección SSRF del importador | `pnpm test:admin` | **23/23** en verde |
| Interfaz de la app (Playwright, Pixel 7, build web) | `pnpm test:ui` | **6/6** en verde |
| Panel entre roles (Playwright, escritorio) | `pnpm test:panel` | **5/5** en verde |
| Tipos (8 paquetes) | `pnpm typecheck` | sin errores |
| Lint (app y panel) | `pnpm lint` | sin errores ni avisos |
| Build de producción del panel | `pnpm --filter @kora/admin build` | correcta |
| Configuración nativa | `expo config`, `expo prebuild --platform android` | correcta (proyecto Android generado; no compilado) |

Total: **138 pruebas automatizadas** en verde.

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
| Métricas de recomendaciones | `reviews-engagement.test.ts` (CTR, carrito y compra tras clic; solo admin); `panel/reviews.spec.ts` (nombres de espacios, aviso de tráfico demo, pesos validados) |

## Lo que no se ejecutó (y por qué)

- **Builds nativas e instalación en dispositivos o emuladores:** el entorno no tiene Android SDK ni acceso a
  Google Maven, y no hay macOS para iOS. La UI se probó con la versión web de la misma app en un viewport
  de Pixel 7. Falta probar en Android e iOS reales (gestos, háptica, push, sesión de pago en el navegador).
- **Proveedores externos en vivo** (BCV, DolarApi, Binance P2P, Kraken, Binance Pay, PayPal, Expo Push): el
  entorno no tiene salida a esos dominios y no hay credenciales. Se probaron los lectores con respuestas de
  ejemplo y las integraciones con dobles de prueba que validan firma y forma de cada petición.
- **Transacciones reales:** ninguna, por instrucción.
- **Correo:** autoconfirmado en local; sin SMTP.
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

