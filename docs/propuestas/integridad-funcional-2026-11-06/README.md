# MAYAMI · revisión funcional aislada · 6 de noviembre de 2026

Inicio: 6nov; cierre: 7nov2026 UTC.

Base comprobada: `claude/marketplace-v1`, `eee8d4d9dcdc89b6e33ba8d9f21b2b0b710b1ebd`, igual a origin al iniciar. No había un informe nuevo adjunto; Oliver autorizó investigar los puntos funcionales independientes. Después autorizó **sólo contratos y lógica funcional** en core/API. El diseño continúa en otro chat del Mac.

## Estado de entrega y límites

- Incorporados al directorio de trabajo: contratos opt-in en `packages/api`, lógica pura de selección/condición en `packages/core`, mensajes para los errores nuevos y pruebas unitarias. Sin commits ni push, por instrucción vigente.
- **Los tres SQL de `sql/` son propuestas INACTIVAS. No están en `supabase/migrations`.** Se ejecutaron únicamente en un clon local PostgreSQL creado para esta revisión. No autorizan una migración remota ni cambios de permisos reales.
- Las pruebas DB asociadas se conservan en `tests/` de esta propuesta; no entran en la suite automática de la base vigente, que todavía no tiene estos RPC. No se deshabilitó ninguna prueba existente.
- Ninguna pantalla, componente, estilo, layout, imagen, configuración nativa, tasa o fórmula financiera se modificó. No hay un cambio visible ni una actualización de la app en esta entrega.
- Ninguna llamada al Supabase remoto, compra real, pago, modificación de catálogo o despliegue. Sin EAS Update ni APK.

## Defectos confirmados y tratamiento

La suite inicial `functional-review.test.ts` reprodujo **6 fallos y 1 control correcto** antes de aplicar la propuesta local. Tras el parche, las mismas siete expectativas pasan.

| Hallazgo comprobado | Corrección propuesta y prueba |
| --- | --- |
| El RPC de actividad y el INSERT directo permitían fabricar eventos `purchase` | El servidor reserva esos eventos al checkout; la política de INSERT propio también impide la vía directa. Se conservan vistas legítimas. Es un cambio de RLS propuesto, no aplicado remotamente. |
| El checkout escribía eventos de personalización incluso después del opt-out | Mantiene el pedido y su historial, pero respeta la preferencia en los eventos de personalización. No modifica el registro financiero. |
| Dos reintentos concurrentes del mismo reporte de pago podían terminar en `quote_used` | Bloqueo por comprador/intención antes de consultar el reporte ya guardado. Ambos recuperan el mismo ID, con una sola fila y estado pendiente de verificación. |
| Un método deshabilitado todavía aceptaba un reporte nuevo | Valida `enabled` bajo bloqueo compartido. Los reportes existentes siguen pendientes y se pueden recuperar. **La política para transferencias hechas antes de deshabilitar el método requiere decisión antes de activar.** |
| Cambiar la nota sin cambiar el estado de moderación sobrescribía el evento del moderador anterior | Conserva actor, fecha y nota originales; añade un evento nuevo y evita duplicar un reintento idéntico. |
| El incremento del carrito leía la cantidad antes del bloqueo común | Serializa la lectura y escritura por comprador, incluyendo INSERT/UPDATE/DELETE directos de carrito mediante triggers. Pruebas con barreras reales de concurrencia. |
| La fusión antigua no tiene una clave que permita distinguir repetición de nueva intención | Se añaden `cart_add_intent` y `cart_merge_intent`, con journal privado ligado a comprador, operación y payload. Replay idéntico no añade unidades; payload diferente falla. No se afirma que el contrato antiguo sea idempotente. |
| El checkout podía crear un pedido con un resumen distinto del revisado | Se añaden `checkout_preview_reviewed` y `place_order_reviewed`; una revisión del servidor vincula productos, cantidades, dirección, entrega, plan y total. Si cambian, exige revisar de nuevo. No acepta un total calculado por el cliente. |
| El detalle actual usa una galería general, sin contrato explícito que la relacione con el color | Contrato de fotos por variante + resolvedor único de precio, stock, portada y galería. No asocia fotos por nombre, posición, parecido o rotación. La conexión de las pantallas está pendiente. |

Los nuevos contratos de carrito devuelven el resultado histórico de esa intención. Después de un replay el cliente debe refrescar `cart.summary()`; no debe tratar la cantidad histórica como estado actual del carrito.

El token de revisión es una huella de la respuesta del servidor, no una cotización firmada ni una reserva de inventario. Canonicaliza el orden incidental de colecciones sin cambiar el método seleccionado, importes o reglas. La dirección que se guarda procede exactamente de ese resumen. Los reintentos de un pedido ya creado recuperan su ID incluso si el carrito está vacío.

## Reacondicionado y variantes

No existía un campo de condición equivalente en el modelo inspeccionado. La propuesta añade `products.condition` nullable con valores explícitos `new` y `refurbished`. `NULL` significa sin clasificar; no equivale a nuevo y **no se hace backfill**. La etiqueta de `refurbished` es «Reacondicionado». La condición no modifica disponibilidad, precio, stock, garantía o devolución.

Los RPC nuevos `catalog_set_condition` y `catalog_set_variant_media` comprueban los permisos reales de miembro de tienda —incluido staff— o administrador. Exigen la versión esperada, bloquean asociaciones de otro producto/tienda, conservan los campos comerciales y rechazan escrituras directas que eludan la versión. Los cambios sensibles publicados de un vendedor fallan de forma conservadora; no crean un atajo de aprobación.

`media_classified=false` distingue fotografías antiguas sin clasificar de `true` con lista vacía, que significa «sin fotos asignadas». Una imagen sólo se comparte entre variantes mediante enlaces explícitos. La galería de una variante nunca incorpora automáticamente las fotos de otro color. El resolvedor:

- conserva la selección al refrescar y toma su precio/stock actuales;
- no cambia de color al deslizar, ni al agotarse o desaparecer un SKU;
- reinicia el índice al seleccionar otro SKU y limita el índice de galería;
- impide comprar sin una variante válida, activa y con cantidad permitida;
- no infiere colores de títulos ni inventa asociaciones de fotografías;
- conserva las variantes múltiples de un color, sin elegir una capacidad aleatoria.

Los lectores SQL y TypeScript normalizan las claves Color con las mismas reglas de espacios y mantienen los valores declarados. Si existen aliases Color/color con valores distintos, devuelven desconocido en vez de decidir arbitrariamente.

`catalog.metadata(ids, condition?)` está limitado a 100 IDs, respeta RLS y permite filtrar **sólo ese lote**. No es un filtro global de búsqueda ni resuelve paginación/ranking. Los datos `condition`/`available_colors` de tarjetas son opcionales y requieren enriquecimiento coordinado; el RPC antiguo de búsqueda no se ha modificado.

## Contratos nuevos y compatibilidad

| API opt-in | RPC de la propuesta |
| --- | --- |
| `catalog.metadata` | `catalog_metadata` |
| `catalog.productCommercial` | `product_detail_commercial` |
| `seller.setCondition` | `catalog_set_condition` |
| `seller.setVariantMedia` | `catalog_set_variant_media` |
| `cart.addWithIntent` | `cart_add_intent` |
| `cart.mergeWithIntent` | `cart_merge_intent` |
| `checkout.previewReviewed` | `checkout_preview_reviewed` |
| `checkout.placeOrderReviewed` | `place_order_reviewed` |

Las firmas existentes y sus consumidores siguen disponibles. Si falta un RPC nuevo, la API informa del fallo: no vuelve silenciosamente al checkout sin revisión, no inventa una condición y no asigna una foto general a un color.

**Compatibilidad de carrito:** el APK vigente espera que la fusión antigua conserve las líneas válidas aunque otra no esté disponible. Se mantiene esa semántica y sólo se omiten fallos de línea conocidos. Los errores inesperados y de límite de solicitudes se propagan. La fusión nueva con intención es atómica; una línea inválida revierte todo y no consume la clave.

La persistencia de esta preparación sólo está demostrada en el clon local. No llamar a los RPC nuevos desde una versión publicada hasta aprobar y activar el servidor correspondiente y conectar sus consumidores.

## Preventa: propuesta técnica sin habilitación

Preventa es un modo comercial futuro, distinto de la condición física y de `availability`. No se añade un valor al enum vigente ni se reinterpreta `on_order` (Por encargo), `reservable` o `unavailable`. Las cadenas nuevas de preventa no son comprables en el resolvedor.

Antes de implementarla Oliver debe definir: cobro completo o parcial, si existe reserva y su vencimiento, fecha/compromiso de entrega, cancelaciones y devoluciones. Después se necesitará un contrato servidor versionado para las condiciones aceptadas, elegibilidad, inventario/reservas, resumen de revisión y reintentos. Sin esos términos no habrá CTA operativo ni pedido de preventa. No se inventan garantías ni grados de reacondicionamiento.

## Pruebas ejecutadas y evidencia

Entorno: copia del código de la base indicada y clon local dedicado, fuera del checkout compartido. DB mediante transacciones `SET ROLE authenticated/anon` y claims, aplicando RLS y RPC reales; no es una prueba HTTP de PostgREST ni física de Android.

| Comprobación final | Resultado |
| --- | --- |
| Core completo, incluyendo selección, condiciones y recuperación API | **66/66** |
| Nuevas pruebas DB: integridad inicial / catálogo / carrito y revisión | **7 + 22 + 22 = 51/51** |
| Regresión DB existente: checkout / pagos / catálogo / guardado vendedor | **9 + 14 + 2 + 6 = 31/31** |
| Total DB del cierre | **82/82** |
| Typecheck core, API y harness DB del clon | Pasa |

Los tres SQL finales se aplicaron también, en orden, sobre un segundo clon local recién creado: **82/82** nuevamente. Este ensayo comprueba los archivos completos de la propuesta, además del clon usado durante las correcciones.

Las pruebas de catálogo comparan filas persistidas y verifican que precios, stock, imágenes originales y moderación no cambien con la nueva metadata. Prueban comprador, invitado, dueño, staff, administrador y otra tienda, versiones antiguas, bloqueos y galerías explícitas. Las pruebas de pago no confirman fondos; los reportes permanecen pendientes de verificación.

Se corrigió un fallo del instrumento de prueba de la carrera de dirección: al introducir canonicalización, su hook temporal seguía usando el hash antiguo. El hook final conserva el cuerpo real y sólo añade una barrera; la expectativa de conservar la dirección aceptada no cambió. No se modificaron las expectativas de las pruebas históricas.

Logs originales locales: `.local/functional-review-20261106/logs/{before,final-db,final-core}.log`. Huellas y conteos en [evidencia.json](evidencia.json). Los logs de fixtures no contienen credenciales ni datos comerciales reales. La copia de trabajo aislada y su nombre de base están en `.local/functional-review-20261106/`; no hay que reiniciar la base compartida.

### Repetir en el clon existente

No ejecutar `db:reset`, `test-db.sh` ni los SQL sobre la base compartida o un proyecto Supabase. Las pruebas nuevas rechazan destinos distintos de loopback y bases cuyo nombre no comience por `mayami_functional_`.

```bash
source /workspace/.onboarding/env.sh
TASK_DB=$(cat .local/functional-review-20261106/database-name.txt)
[[ "$TASK_DB" == mayami_functional_* ]] || exit 20
export TEST_DATABASE_URL="postgres://postgres:postgres@127.0.0.1:54322/$TASK_DB"
pnpm --dir .local/functional-review-20261106/source/tests/db-tests exec vitest run --no-file-parallelism \
  test/db/functional-review.test.ts test/db/catalog-metadata.test.ts test/db/checkout-intents.test.ts \
  test/db/checkout.test.ts test/db/payments.test.ts test/db/catalog-authoring.test.ts test/db/seller-product-write.test.ts
pnpm --filter @kora/core test
pnpm --filter @kora/core typecheck
pnpm --filter @kora/api typecheck
```

Para otro entorno: crear primero un clon **local autorizado** de la base vigente, copiar los tres tests de esta propuesta a `tests/db-tests/test/db/` de una copia aislada del código y aplicar allí los tres SQL en orden, en transacciones con `ON_ERROR_STOP`. `catalog-metadata.test.ts` importa el core desde esa estructura. No reaplicar los CREATE de tablas a un clon que ya tenga estas propuestas. Revisar de nuevo la base si avanzó el esquema; no convertir estos archivos directamente en migraciones automáticas.

No se ejecutaron capturas ni pruebas UI, TalkBack, dispositivo, EAS o checkout remoto. No se declara corregido el comportamiento visible de las fichas ni del checkout hasta integrar y probar esos consumidores.

## Revisión independiente y coordinación

Especialistas reales: `backend_rates_security` preparó el contrato de carrito/revisión y sus pruebas; `brand_system` preparó condición/fotos y pruebas; `build_admin_security` revisó guardado/moderación; `brand_auditor` hizo la revisión independiente. Únicamente el integrador modificó fuente compartida; las propuestas y ejecuciones de los especialistas permanecieron aisladas.

El auditor exigió y se corrigió:

1. Reconsulta de dirección posterior a la revisión: ahora se guarda el snapshot aceptado; carrera reproducida y comprobada.
2. Huella dependiente del orden incidental de arrays: canonicalización y prueba de permutaciones/fechas de carrito iguales.
3. Cambio incompatible de merge antiguo: conservado para APK vigente, separado del contrato nuevo atómico.
4. Desacuerdo SQL/core en Color y whitespace: contrato unificado y comparación directa en DB.

Veredicto de segunda revisión: **APROBADO para integrar core/API y conservar los tres SQL como propuestas inactivas**. No autoriza activación, interfaz o publicación. La revisión del auditor fue estática; los resultados de ejecución los verificó el integrador.

## Pendientes y próxima tarea exacta

1. **Coordinar con el chat visual antes de tocar consumidores.** En Android `apps/mobile/src/app/product/[id].tsx` debe usar selección por ID y galería resuelta; en web `apps/storefront/src/components/product-detail.tsx` debe sincronizar índice/variante. Confirmar las rutas actuales con `rg --files` si cambiaron. Las tarjetas recibirán condición y colores explícitos; no añadir chips/estilos desde este frente.
2. Conectar revisión de checkout y claves persistentes de intención en los hooks de carrito/autenticación y checkout de ambos clientes. Recuperar el pedido por comprador/intención si se pierde la respuesta; nunca generar una nueva intención automáticamente para un reintento.
3. Aprobar por separado el SQL/los permisos, la política de métodos deshabilitados y la activación backend. Probar HTTP/PostgREST y UI antes de publicar. Nunca usar el proyecto prohibido `bfuggvbgttvcygbexqyn`.
4. **Guardado vendedor preparado el 7nov, aún sin activar:** [nuevo contrato, pruebas y relevo](../guardado-vendedor-2026-11-07/README.md). Comprueba producto, todas sus variantes, fotos y costes; persiste opciones y evita reescribir inventario en reintentos. El formulario antiguo y el panel siguen pendientes de integrarlo; no se declara protección activa. Las huellas de esta entrega del 6nov son históricas y las actuales se registran en el bloque nuevo.
5. **Precio automático en panel pendiente:** el panel puede escribir directamente donde el RPC móvil rechaza edición manual de precio automático. Unificar operación y proteger el servidor sin cambiar cálculos; requiere coordinar el editor compartido.
6. Revisar qué campos publicados sensibles exigen moderación (hoy título/descripcion/categoría no cubren todas las fotos/características). La nueva metadata falla de forma conservadora; no se cambió la política general ni se autoaprobaron productos.
7. Filtro global de condición/color con paginación y ranking correctos; no sustituirlo por filtrado de una página ya cargada. Clasificar fotos únicamente con asociaciones reales autorizadas.
8. Accesibilidad, navegación y errores visuales no se corrigieron aquí: necesitan intervención coordinada en componentes y pruebas de interfaz. Preventa y garantías de Reacondicionado requieren las decisiones señaladas arriba antes de activarse.

Esta nota es el checkpoint y relevo del frente funcional. No se sobrescriben `ESTADO_ACTUAL.md`, `PENDIENTES.md` o `HISTORIAL_AGENTES.md` que comparte el frente visual; el integrador de continuidad podrá enlazar esta entrega. No hacer commit, push ni despliegue hasta autorización de Oliver.
