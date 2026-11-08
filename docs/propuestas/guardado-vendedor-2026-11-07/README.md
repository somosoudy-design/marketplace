# MAYAMI · guardado seguro del vendedor · 7nov2026

Bloque funcional posterior a [integridad, condiciones y variantes](../integridad-funcional-2026-11-06/README.md). Base Git `eee8d4d` en `claude/marketplace-v1`; origin comprobado con fetch, sin cambiar rama ni incorporar por fuerza cambios sobre el directorio compartido. Se conservó el trabajo sin commit del bloque anterior.

**Estado:** contratos y validaciones core/API incorporados al directorio de trabajo. SQL preparado y probado exclusivamente en clones locales, **fuera de `supabase/migrations`**. Sin cambios en pantallas, estilos, imágenes, configuración nativa, servidor remoto, permisos reales, compras o pagos reales. No commits, push ni despliegues por la instrucción vigente de Oliver.

## Qué resuelve el contrato nuevo

La versión del producto no identifica todos los cambios de inventario. Una compra local de 5→4 unidades puede actualizar la variante dejando intacto `products.updated_at`. El formulario antiguo puede volver a guardar las 5 unidades de su copia. El panel también escribe producto/variantes/fotos en peticiones separadas. Ambos consumidores actuales siguen pendientes de integración: **este bloque no afirma que ya estén protegidos**.

Se añaden dos métodos opt-in:

| Método API | RPC de la propuesta | Resultado |
| --- | --- | --- |
| `seller.productReviewed(storeId, productId)` | `seller_product_editor_reviewed` | `{product, revision, pricing}` o `null` si no existe en la tienda autorizada |
| `seller.saveProductReviewed(storeId, productId, revision, intentKey, changes)` | `seller_save_product_reviewed` | `{product_id, revision, replayed}` |

El guardado es **sólo para productos existentes**. Nunca crea un producto por omisión de la revisión. Las firmas y llamadas antiguas permanecen intactas; no hay fallback automático al RPC antiguo si el nuevo falla o no está disponible.

La revisión opaca proviene de un único snapshot estable: fila completa del producto, **todas** las variantes —incluidas inactivas u omitidas—, fotografías y costes de producto/variantes. Incluye datos y versiones; no depende sólo del reloj ni convierte timestamps a `Date` del cliente. El lector devuelve también el pricing existente dentro del mismo snapshot, evitando mezclar una revisión nueva con costes obtenidos antes en otra llamada. Los tipos nuevos representan correctamente sus números JSON y mantienen `options` heredadas como `Json`, sin afirmar que ya estén validadas.

Antes de escribir se bloquean variantes, producto, imágenes y costes; se vuelve a comprobar el estado completo. Se usan `NOWAIT` y timeout local al RPC para evitar esperar indefinidamente en órdenes incompatibles con checkout o editores antiguos. También se bloquean las categorías relevantes y la fila real de membresía/rol que autoriza al usuario. Un permiso revocado durante una espera no autoriza el guardado posterior.

La clave de intención se liga al actor, tienda, producto, revisión y payload. Un reintento idéntico recupera el resultado histórico **antes de comparar la revisión antigua**, sin volver a escribir el inventario ni repetir el guardado. Otra carga con la misma clave falla. El journal es privado y se confirma en la misma transacción; si algo falla, no consume la clave. Un replay exige permisos vigentes y no devuelve información de otro actor.

**Después de un replay hay que releer el editor:** la revisión devuelta corresponde al resultado histórico, no necesariamente al inventario actual. Nunca refrescar silenciosamente la revisión y reenviar el formulario antiguo; eso anularía la protección.

## Parches que conservan los datos

- Omitir una variante o fotografía conserva su fila; no la elimina ni desactiva. No se borran blobs.
- Omitir un campo conserva su valor exacto, incluidos texto alternativo, dimensiones, descripción, SKU y espacios heredados. La normalización de texto sólo se aplica al campo enviado explícitamente.
- `option_names` y `options` ausentes se conservan. `[]` y `{}` explícitos son cambios reales. No se infiere color desde títulos o fotos.
- No se puede retirar un nombre dejando una variante omitida que todavía lo utiliza: deben enviarse los cambios explícitos compatibles. Los mapas vacíos heredados siguen siendo válidos; no se rellenan atributos ficticios.
- Los UUID equivalentes se comparan como UUID, evitando eludir validaciones con mayúsculas u otra representación aceptada por PostgreSQL.
- La condición Reacondicionado, metadata de origen y asociaciones de imágenes no se mezclan con el formulario general. Cambiar un color con fotos ya asociadas exige revisar primero esas asociaciones; no se atribuyen imágenes del color anterior al nuevo.
- Las fotos conservan IDs y paths inmutables. Una foto distinta necesita otro ID; reordenar no sustituye ni borra la original.
- Los cambios de metadata de productos sensibles publicados fallan de forma conservadora para vendedores. No se concede aprobación ni se permite inyectar campos protegidos; administradores y staff usan sus roles reales.

El RPC nuevo realiza escrituras de parches acotados y conserva los triggers vigentes de moderación, stock, precio y auditoría. No llama al upsert completo antiguo para evitar tocar las variantes omitidas. Los costes se delegan en `set_product_costs`; **no se copia ni cambia una fórmula**. Los costes parciales conservan sus campos omitidos y los costes por variante requieren un parche de costes explícito, aunque sea `{}`; no se ignoran en silencio.

Los precios automáticos conservan sus reglas. Un cambio manual de precio automático o de peso sin una revisión explícita de costes se rechaza con un error específico. La frescura y corrección del motor de tasas sigue siendo un trabajo independiente; este bloque no lo modifica ni lo declara resuelto.

El servidor exige tipos JSON numéricos, rechazando cadenas como `NaN`/`Infinity` antes de que un cast a `numeric` pueda aceptarlas. La API valida además números finitos **antes de serializar**: JavaScript convertiría Infinity/NaN en `null`, que en stock tiene un significado comercial real. No se transforma un valor inválido en stock ilimitado.

## Pruebas reales

Entorno local dedicado `mayami_functional_seller_*`, en loopback. Las pruebas escriben fixtures UUID con cuentas `example.com`, mediante roles `authenticated`/`anon` y procedimientos SQL reales. No son pruebas HTTP de PostgREST ni de Android físico.

- **30/30 nuevas DB:** compra entre lectura y guardado; stock distinto con mismo timestamp; variante inactiva/foto/costes omitidos modificados; owner/staff/admin; invitado/comprador/otra tienda; respuesta perdida; claves por actor; rollback y clave reutilizable tras fallo; IDs/properties protegidas; precio automático; suspensión/rechazo; fotos por color; UUID en mayúsculas; espacios heredados; NaN/Infinity; journal privado; intención concurrente; revocación durante espera y bloqueo de categoría.
- **112/112 DB de cierre:** las 30 nuevas y las 82 anteriores de integridad, catálogo, revisión del checkout, pagos y editor. Ejecutadas después de aplicar el archivo SQL completo en un clon nuevo que ya contenía las tres propuestas anteriores.
- **74/74 core:** incluye cinco validaciones de autoría y tres pruebas de API nuevas, además de las suites anteriores.
- Typecheck de core, API y harness DB: aprobado. `git diff --check`: aprobado.

El test inicial de renombrar opciones omitía un SKU que todavía utilizaba el nombre retirado. El servidor lo rechazó correctamente. Se corrigió el fixture de éxito enviando las dos modificaciones explícitas, se mantuvieron sus expectativas y se añadió un test independiente que exige rechazo y rollback de la combinación inconsistente. No se cambiaron expectativas de pruebas históricas ni se deshabilitaron tests.

Logs: `.local/functional-seller-20261107/logs/`; hashes en [evidencia.json](evidencia.json). Fuente de pruebas ejecutadas en `.local/functional-review-20261106/source/tests/db-tests/test/db/seller-reviewed.test.ts`; la copia de entrega está en [tests/seller-reviewed.test.ts](tests/seller-reviewed.test.ts).

Para repetir sin reiniciar nada compartido:

```bash
source /workspace/.onboarding/env.sh
TASK_SELLER_DB=$(cat .local/functional-seller-20261107/final-database-name.txt)
[[ "$TASK_SELLER_DB" == mayami_functional_seller_* ]] || exit 20
export TEST_DATABASE_URL="postgres://postgres:postgres@127.0.0.1:54322/$TASK_SELLER_DB"
pnpm --dir .local/functional-review-20261106/source/tests/db-tests exec vitest run --no-file-parallelism test/db/seller-reviewed.test.ts
pnpm --filter @kora/core test
pnpm --filter @kora/core typecheck
pnpm --filter @kora/api typecheck
```

No ejecutar `db:reset` ni usar un destino remoto. Para reproducir en otra máquina, copiar el test a `tests/db-tests/test/db/` de una copia aislada y aplicar allí los tres SQL de la propuesta anterior y [04-seller-reviewed.sql](sql/04-seller-reviewed.sql), en orden y en transacciones con `ON_ERROR_STOP`. No reaplicar CREATE sobre un clon donde ya se ejecutó. El test rechaza bases no locales o sin prefijo aislado.

## Revisión independiente

`build_admin_security` investigó inventario/locks y preparó las pruebas; `brand_system` contrastó contratos, opciones y tipos numéricos; `brand_auditor` revisó la implementación y casos finales de forma independiente. Root fue el único integrador de fuente y ejecutor de SQL/pruebas locales.

El auditor exigió corregir y comprobó: locks de categorías, pricing en el snapshot, permisos tras una espera, equivalencia de UUID, conservación exacta de campos omitidos y rechazo de NaN. Veredicto: **APROBADO para preparación inactiva**, sin bloqueos pendientes dentro del contrato opt-in. Su revisión fue estática y de logs; los resultados de ejecución los verificó root. La aprobación no autoriza activación ni demuestra comportamiento en las pantallas actuales.

## Archivos propios de este bloque

- `packages/api/src/api.ts`: dos métodos nuevos; consumidores antiguos conservados.
- `packages/api/src/types.ts`: DTO de lectura completa y cambios parciales, sin cambiar tipos legacy.
- `packages/core/src/seller-authoring.ts`: validaciones nuevas de opciones, revisión y números finitos.
- `packages/core/src/index.ts`, `errors.ts`: exports y dos errores específicos.
- `packages/core/test/seller-authoring.test.ts`, `functional-api.test.ts`: pruebas nuevas.
- Esta carpeta: SQL inactivo, pruebas DB, evidencia y relevo.

Se verificaron las huellas de los archivos compartidos antes de integrarlos. No se modificaron archivos en `apps/`, estilos, layouts ni recursos. El checkpoint anterior queda conservado; sus hashes son históricos y los de este bloque están separados. No se sobrescriben los documentos de estado global que comparte el frente visual.

## Próxima tarea exacta y pendientes

1. Coordinar la integración con el chat visual antes de modificar `apps/mobile/src/app/my-store/product.tsx` y `apps/admin/src/app/(panel)/vendedor/productos/editar/ProductEditor.tsx`. Ambos deben leer `productReviewed`, conservar el borrador/revisión/intención y guardar mediante `saveProductReviewed`.
2. Ante conflicto, conservar los cambios del vendedor y reconciliar con el servidor. Ante respuesta perdida, repetir la misma clave y payload; ante replay, refrescar el estado actual. No actualizar la revisión automáticamente para forzar un guardado.
3. Cambiar los flujos actuales de escritura directa y comprobar HTTP/PostgREST y UI. Este contrato sólo protege a quien lo usa: el legacy y el panel directo mantienen el riesgo hasta su sustitución. Cerrar permisos de escritura antiguos requiere autorización y activación coordinadas, no una revocación unilateral.
4. La creación de productos conserva su operación anterior; este RPC es update-only. Las altas y los borrados requieren sus propios contratos y validación coordinada; no anunciarlos como completados aquí.
5. Mantener pendientes la integración de condición/fotos/selección y checkout del bloque anterior, filtro global paginado, política de métodos deshabilitados y condiciones comerciales de Preventa. No se amplió este bloque hacia interfaz ni reglas financieras.
6. Antes de activar: revisar SQL/permisos con Oliver, comprobar dependencias contra el esquema entonces vigente y conservar historial. No desplegar estas propuestas desde este frente ni publicar código móvil por esta preparación.
