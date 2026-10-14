# Mi tienda operativa — ampliación de VEN-01A

Oliver probó VEN-01A en Android y solicitó administración móvil real. Base `887197b`;
orden autorizado: perfil, catálogo, acciones de pedidos. Conservar la lectura/navegación ya publicada.
**Estado histórico (11 de octubre, 18:59 UTC):** Oliver autorizó publicar primero; EAS preview/guard APK 5 aprobados,
OTA `01a12c4b` recibida en emulador. Dos migraciones nuevas probadas solo localmente, estado remoto sin
verificar por falta de acceso. Perfil usa contrato existente; catálogo/acciones mantienen consulta/panel si
falta soporte del servidor. Ningún APK nuevo ni cambio de servicio/dato backend remoto, iOS o checkout.
La corrección de tasas BCV conserva su prioridad crítica separada.

## Diagnóstico remoto confirmado — 14 de octubre de 2026

Acceso administrativo recuperado mediante token personal seguro; Marketplace ACTIVE_HEALTHY, 26 migraciones. **No están aplicadas 20261011172600_seller_product_editor ni 20261011174200_seller_fulfillment_detail.** Los cuatro RPC nuevos tampoco existen en pg_proc. El 404/PGRST202 ya está confirmado como falta de activación, no solo caché. Los RPC anteriores y sus grants permanecen; no reconstruir los editores ni publicar para intentar aplicar SQL.

Los 5 buckets y RLS están presentes. La política llamada catalog sí cubre **catalog y stores**, con pertenencia/carpeta o admin; 21 hashes de políticas coinciden con local. No falta por ese motivo una política de logos/portadas. No se hicieron uploads ni operaciones autenticadas remotas; persistencia/aislamiento de vendedores todavía requieren validación posterior.

Informe `DIAGNOSTICO_SUPABASE_2026-10-14.md`. Revisar/autorización del paquete exacto ya probado antes de ejecutarlo; **no se aplicó ninguna migración ni se publicaron cambios móviles en este diagnóstico**. BCV directo falla TLS UnknownIssuer y conserva prioridad crítica.

## Bloque 1 — perfil

Pantalla existente `/my-store/settings`: nombre comercial, frase corta, descripción, correo de contacto,
información de envío, devoluciones, garantía y acento de la paleta existente. Selección de logotipo y portada
por `expo-image-picker`, ya incluido en APK 5. Vista previa, 5 MB, JPG/PNG/WebP, guardar explícitamente.
Los demás datos de `policies` se conservan. Estado, slug, kind, demo y valoraciones no son editables aquí.
No se añadieron campos de teléfono/dirección que no existan en el contrato del panel.

`api.seller.updateStore` utiliza UPDATE con sesión/anon y exige devolver una fila: un cambio denegado
nunca se presenta como guardado. `uploadImage` usa el bucket `stores` y rutas únicas por tienda, sin
sobrescritura; las políticas existentes solo permiten INSERT. No borra imágenes previas, certificados o datos.
Rutas subidas se conservan durante un reintento de guardado; archivos subidos pero no asociados pueden
quedar huérfanos, pues el backend no permite borrarlos al vendedor. No se amplían esos permisos.

Guardado bloquea duplicados y edición durante la solicitud; conserva el formulario al fallar o perder
conexión. Confirmación antes de abandonar cambios, incluidas acciones de stack/Atrás; advertencia al
recargar web. Caché por usuario/tienda y sin drafts privados persistidos en disco. Se actualiza la pertenencia
real en caché y se invalidan tienda pública, Inicio, catálogo y fichas; los cambios persisten en `stores`.

El panel continúa ofreciendo las operaciones avanzadas y su vista previa. No se cambia RLS, el panel ni
la configuración nativa. Compatibilidad técnica prevista con APK 5 por usar módulos ya presentes;
la galería nativa autenticada sigue para la revisión física de Oliver; Android visitante se validó tras publicación.

### Validación y reproducción

- Tipos y lint locales aprobados durante implementación; repetir si cambia código.
- `seller-store-edit.spec.ts`: persistencia real + galería/upload/archivo público/página de tienda,
  validación, fallos, reintento, dirty/back, desconexión y recuperación, ambos temas, ancho 320 px.
- `seller-store-write.test.ts`: UPDATE propio, protección de identidad/estado/ratings, denegación ajena
  y anónima, permisos SQL de Storage. Se ejecuta junto con `seller-access.test.ts`.
- No usar `db:reset` ni el script de tests que elimina `kora_test`. Crear copia local nueva con pg_dump/
  pg_restore y definir `TEST_DATABASE_URL`; datos demo aditivos, ningún servicio remoto.
- Stack y runner UI en el mismo proceso de ejecución cloud: `pnpm stack:stop; pnpm stack:start`, después
  `pnpm --filter @kora/app-e2e exec playwright test -c playwright-app.config.ts seller-store-edit.spec.ts seller-app.spec.ts`.
- Logs ignorados `.local/logs/seller-store-*`, capturas `.local/seller-ops/screens/`.

Cierre bloque 1: UI **26/26** (1,8 min), permisos **6/6**, tipos/lint/export web aprobados. Ocho capturas de perfil antes/después, página pública y error en ambos temas; revisión directa de campos, botones y confirmación/error. No prueba nativa nueva. Commit de cierre: `928494d`; en aquel cierre la publicación estaba pausada. Autorizada/publicada posteriormente (abajo).

## Bloque 2 — catálogo operativo

Pantalla de catálogo ampliada, nuevo `/my-store/product` para crear/editar. Ficha (nombre/subtítulo/
descripción/seis características/categoría), variantes, precio principal manual, SKU, inventario, disponibilidad,
peso/máximo por pedido/precio anterior y fotografías de galería. Puede pausar la venta con No disponible,
pausar/activar variantes sin borrarlas, agregar variantes manuales y cambiar la portada entre las fotos.
Estados reales y motivos/historial de moderación; corrige y reenvía un rechazo, suspensión requiere administración.

Para productos ya automáticos, precio de solo lectura y edición de costo por variante, flete, gastos y margen
mediante `set_product_costs` existente. No se cambió fórmula, tasa, cobro o checkout. Cambiar el modo de precio/
origen/enlace de costos y ampliar variantes automáticas quedan en el panel. No se eliminan productos,
variantes vendidas ni fotos guardadas. El servidor no admite drafts: no hay botón falso de borradores.

### Guardado y migración preparada

`20261011172600_seller_product_editor.sql` aplicada **solo localmente**, incluida copia de pruebas.
`seller_save_product` SECURITY INVOKER agrupa operaciones del editor existente: RLS/triggers siguen activos,
campos permitidos explícitos, sin aprobar/reasignar tienda. Variantes y referencias de fotos se guardan en
la misma transacción; costo opcional delega al RPC existente. UUID estables por intención y rutas subidas
conservadas: una respuesta perdida se reintenta sin duplicar producto, variante o imagen. Error de una variante
revierte ficha/otras variantes. No borra datos. Storage no participa en la transacción: archivos subidos sin
asociar pueden quedar huérfanos (no ampliar permisos ni limpiarlos automáticamente).

Fallo real reproducido antes de arreglarlo: tras rechazo, editar ficha y precio publicaba un producto de bajo
riesgo. La migración conserva revisión manual/pending usando el último evento administrativo existente;
actualizar variantes/costos ya no aprueba un rechazo. Suspensión y categorías sensibles mantienen revisión.
La aprobación continúa en `moderate_product` con permiso administrativo real. Regresión roja/verde conservada
en `.local/logs/seller-moderation-{before,after}.log`.

`seller_editor_ready` comprueba soporte del servidor. Sin la migración, el catálogo de lectura/panel funciona,
pero no aparecen acciones móviles de edición. No hay variable cliente que conceda permisos.
**La edición depende de activar/verificar la migración remota.** OTA publicada con autorización posterior
y guard nativo aprobado; la publicación de JavaScript no aplica SQL. Ningún SQL remoto ejecutado desde este cloud.

### Pruebas bloque 2

- Backend **20/20**: seis nuevas operaciones/RLS/rollback/idempotencia/moderación/reprecio con snapshot local,
  siete reglas existentes de precios, dos autoría y cinco privilegios (allowlist actualizada para dos RPC nuevos).
- Núcleo **50/50**, tipos/lint/export web aprobados.
- UI **30/30**: 22 regresiones VEN-01A + ocho operaciones de catálogo, claro/oscuro, 320 px. Crear/galería/
  dos variantes/SKU, precio/stock/pausa/reanudación, ficha pública, respuesta perdida sin duplicar foto/producto,
  dirty/Atrás, costo automático, rechazo pendiente, aislamiento y servidor sin migración. Esperan `aria-busy=false`
  y confirmación final, no dan por guardado el estado de carga. Perfil también pasó **4/4** en corrida conjunta
  anterior (12/12 con catálogo). Capturas de formulario/error/historial revisadas en ambos temas.
- La galería se valida por picker web + gateway local; permisos de Storage además por SQL contra RLS.
  No equivale a selección física Android, TalkBack o rendimiento nativo.

## Bloque 3 — pedidos operativos

Listado existente ampliado con «Ver entrega y acciones» y detalle `/my-store/order?id=...`.
Nombre/número, solo líneas de esa entrega, destino, método, transportista/guía, nivel de pago, siguiente tarea
permitida e historial real. El vendedor puede confirmar/preparar/despachar/registrar tránsito/entregar cuando
los pasos del servidor y el pago lo permiten. Las importaciones y otros pasos administrados por la plataforma
explican quién debe actuar; no ofrecen una acción falsa. Se conservan consulta y panel sin la migración.

Antes de confirmar y antes de guardar se vuelve a consultar la entrega y los pasos reales. Confirmación explícita
con nota/guía, bloqueo de doble toque y salida durante guardado, advertencia al abandonar cambios, error/reintento
con formulario conservado. Una respuesta perdida se reintenta consultando primero el estado guardado: si el paso
ya se completó, no vuelve a avanzar ni duplica historial. Si otra sesión avanzó más, se bloquea la acción obsoleta. Si completó el mismo paso con datos distintos,
se comparan evento/nota/guía/transportista: se muestra el conflicto, se conserva el borrador y no se afirma
que se guardaron datos que no persistieron.
Cerrar una entrega actualiza el listado y conserva su detalle/historial; regreso a Pedidos y Cuenta verificado.

### Persistencia y límites de permisos

Las escrituras utilizan **advance_fulfillment existente, sin modificarlo**. Guarda status, nota/historial,
guía, transportista y fecha de entrega según sus reglas existentes; actualiza los estados derivados y avisos
como ya lo hacía el panel. No hay UPDATE directo a órdenes/pagos/saldos, cálculo o liquidación nueva.
La contabilización existente al entregar permanece en ese procedimiento; se comprobó su balance local.
El servidor exige pertenencia, seller_can_set, avance hacia delante, pago requerido y guía al despachar a
domicilio. No hay verificación de pago, cancelación administrativa o estados de importación en la app vendedor.

`20261011174200_seller_fulfillment_detail.sql`, aplicada **solo al stack local y copia de pruebas**:
consulta de detalle con el mismo modelo del panel, require_store_member y filtros tienda/id, sin límite de
200 filas o 180 días; retorna null para una entrega ajena dentro del alcance propio. Incluye solo líneas,
dirección e historial de esa entrega. No cambia permisos de tablas o advance_fulfillment. Dos RPC nuevos de
lectura; anon no los ejecuta. seller_orders_ready señala disponibilidad del servidor, nunca concede un rol.

### Pruebas del bloque 3

- SQL **10/10**: tres casos nuevos, dos herramientas existentes y cinco privilegios. Pago no confirmado,
  paso administrado, vendedor ajeno, comprador y visitante denegados; preparación/guía/historial persistidos,
  dos despachos simultáneos dejan un solo evento, terminal no retrocede y detalle antiguo sigue legible.
- UI **8/8**, ambos temas/320 px: entrega sin pagar y plataforma, aislamiento/servidor sin RPC, confirmación
  cancelada sin escritura, preparación/despacho/entrega, guía/transportista/nota, historial, dirty/Atrás,
  regreso/lista cerrada, error de lectura/reintento, respuesta perdida sin duplicar y confirmación obsoleta.
- Las fixtures pagadas **locales** usan comprador/quote/submit con ruta de comprobante y un administrador demo
  que aprueba por review_payment antes de probar vendedor. La app vendedor nunca llama ese procedimiento.
- Ocho capturas de entrega sin pago, confirmación, cerrada y reintento en ambos temas; revisión directa.
  Captura de confirmación espera estabilidad del botón, no un fotograma de entrada de la hoja.

## Cierre conjunto — 2026-10-11

Fuente funcional de los tres bloques: `5a3b884`, checkpoints `8889952`/`5a3b884` resueltos por este cierre; perfil `928494d`,
catálogo `9648e35`, SQL preparatorios `d3bf8dd`/`656160b`. Cierre documental: `git log -1` de la rama.

- UI conjunta **42/42** (3,6 min): 22 regresiones VEN-01A, cuatro perfil, ocho catálogo y ocho pedidos.
  Tras aclarar textos y tomar disponibilidad desde AVAILABILITY compartida (incluido En camino), se reexportó
  web y repitieron **20/20** operativos (2,5 min), con persistencia de En camino y retorno a Disponible.
- Después de revisar concurrencia de notas/guía, pedidos **8/8** finales (1 min), ambos temas: respuesta
  perdida reintenta sin duplicar; mismo paso con datos distintos conserva el borrador sin éxito falso;
  un paso posterior bloquea la confirmación antigua. Tipos/lint/web/Hermes repetidos sobre `5a3b884`.
- Backend conjunto **31/31** en copia local conservada `kora_seller_ops_171524`: perfil 2, acceso 4,
  catálogo 6, pedidos 3, herramientas 2, reglas de precio 7, autoría 2 y privilegios 5.
- Núcleo **50/50** durante bloque 2, sin cambios posteriores. Tipos/lint de toda la rama y exportación web
  final aprobados. Exportación **Android JS/Hermes** final aprobada sobre `5a3b884`; no es un APK o prueba nativa.
- Revisión visual en claro/oscuro/320 px: formularios, vista pública, confirmación/errores/reintento,
  estados de moderación y entrega. Botones/hojas/campos reutilizan tokens Electric Violet y áreas táctiles
  existentes. No se afirma prueba de TalkBack, teclado/picker o rendimiento en teléfono físico.
- Logs `.local/logs/seller-ops-{types-final,lint-final,build-final,ui-final,ui-settled,db-final,android-final}.log` y `.local/logs/seller-orders-ui-final.log`.
  22 capturas operativas `.local/seller-ops/screens/*-{store-before,store-saved,public-store,store-retry,
  product-form,product-retry,product-review,delivery-unpaid,delivery-confirm,delivery-history,delivery-retry}.png`.
  Revisión combinada `.local/seller-ops/review-final.png`, evidencia local ignorada por Git.

### Reproducir sin borrar datos ni escribir en remoto

Preparar Node/pnpm y stack según ENTORNO.md. No usar db:reset/test:db (su wrapper elimina kora_test).
Conservar la copia local o crear una nueva por pg_dump/pg_restore, aplicar únicamente SQL nuevo a esa copia
y definir TEST_DATABASE_URL local con las variables de tools/local-stack/env.sh; no imprimir credenciales.

```bash
pnpm typecheck && pnpm lint
pnpm --filter @kora/db-tests exec vitest run --no-file-parallelism \
  test/db/seller-store-write.test.ts test/db/seller-access.test.ts \
  test/db/seller-product-write.test.ts test/db/seller-order-actions.test.ts \
  test/db/seller-tools.test.ts test/db/pricing.test.ts \
  test/db/catalog-authoring.test.ts test/db/privileges.test.ts
pnpm --filter @kora/app-e2e build:web
# En cloud, stack y runner en la misma invocación; esperar su fin antes de otra exportación web.
pnpm stack:stop && pnpm stack:start && \
  pnpm --filter @kora/app-e2e exec playwright test -c playwright-app.config.ts \
  seller-app.spec.ts seller-store-edit.spec.ts seller-product-edit.spec.ts seller-order-actions.spec.ts
pnpm --filter @kora/mobile exec expo export --platform android --output-dir ../../.local/seller-ops/android
```

### Operaciones que conservan el panel

- Perfil: administración de estado/identidad de tienda y operaciones avanzadas; la app no inventa
  teléfono/dirección de contacto que no estén en el contrato editable actual.
- Catálogo: cambiar modo/origen/enlace de costos, agregar variantes a un producto automático y gestión
  avanzada; fotos guardadas no se eliminan desde móvil. No hay borradores persistidos en el backend actual.
- Pedidos: importación/lotes, pasos de plataforma, cancelaciones/reembolsos, revisión de pagos y finanzas;
  el vendedor conserva únicamente sus permisos reales en el panel, no obtiene facultades administrativas.

### Publicación y Android — 2026-10-11 18:59 UTC

Oliver: «Publícala primero para revisar en mi teléfono y mientras reviso continúa si tienes pendientes».
[EAS preview 38165223060](https://github.com/somosoudy-design/marketplace/actions/runs/38165223060),
fuente `2a38dfb`, **Success**, guard exacto APK 5 aprobado antes de publicar, 18:48:30Z.
Código móvil/API idéntico a `5a3b884`; package.json, lockfile, Expo/EAS, Firebase y assets nativos sin cambios.
Runtime `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`; no nuevo APK, panel o iOS/checkout/BCV.

[Android 15 revisión 36, run 38165564922](https://github.com/somosoudy-design/marketplace/actions/runs/38165564922),
fuente `3ea956e`, **Success**: visitante **2/2** claro/oscuro sin reintentos; seis rutas protegidas (incluidos
editor de producto y detalle de entrega), Cuenta/login/flecha/Atrás, inicio/reapertura. Diagnóstico en ambos
confirma OTA **`01a12c4b-86a2-7565-9f95-ae8e8a6f7711`**, 18:48 UTC, preview/runtime APK 5,
backend Marketplace responde y sesión cifrada. 18 capturas del recorrido revisadas, sin recortes/superposiciones.
[Evidencia inmutable](https://github.com/somosoudy-design/marketplace/tree/ac77702b7701fa4bc212a86446ac5c635ab626cf/ultima).
No afirmar instalación/recepción en el teléfono físico ni guardado con sesión vendedor en Android por este flujo.

Oliver puede cerrar completamente la app, abrir con conexión y volver a abrirla tras la descarga; confirmar
`01a12c4b` al pie de Cuenta o en Diagnóstico. Revisar perfil/galería, teclado, formularios/Atrás, roles,
TalkBack y fluidez. Si no aparecen acciones de catálogo/pedidos, comprobar primero soporte del servidor;
no republicar ni cambiar permisos del cliente como remedio.

### Activación pendiente del servidor — paquete preparado

**Actualización 14oct:** las restricciones anteriores de red/credencial están resueltas. El diagnóstico remoto de solo lectura confirmó las dos migraciones ausentes; no hubo SQL de activación. Token personal seguro ya vinculado, sin solicitar contraseñas ni claves por chat. El paquete debe revisarse y autorizarse antes de ejecutar.

Se preparó `tools/supabase-remote/aplicar-mi-tienda-operativa.sql` con builder específico
`build-mi-tienda.py`: **exactamente** `20261011172600_seller_product_editor.sql` y
`20261011174200_seller_fulfillment_detail.sql`, en ese orden. No usar el `build.py` antiguo ni `db push`
general: podrían incluir migraciones ajenas y reescribir historial antiguo.

Una transacción/advisory lock, identidad de proyecto desde `vault.decrypted_secrets.kora_project_url`,
prerequisitos existentes, conflicto nombre/versión aborta. Migraciones ya registradas se omiten; no se
reemplazan por reejecutar. Registra únicamente sus dos versiones, verifica RPC/grants/modo de seguridad
y notifica a PostgREST. No seeds/cuentas, UPDATE/DELETE de datos comerciales, historial reescrito,
reglas financieras o permisos nuevos de tabla. La identidad Vault debe estar configurada y coincidir;
si falta, detenerse y revisar el proyecto en vez de modificar secretos como atajo.

Pruebas del archivo **8/8** (0,4 s): aplicación real/reejecución sin reescribir funciones/historial,
proyecto incorrecto, conflicto por nombre/versión, prerequisito/RPC ausente y grants inconsistentes
abortan/rollback. Copia nueva conservada `kora_seller_release_20261011185732`, ninguna eliminación/reset.
Tras aplicar el paquete, suites de permisos/persistencia existentes **24/24** (2,22 s, siete archivos);
advance_fulfillment/set_product_costs intactos. Logs `.local/logs/seller-release-{activation,permissions}.log`.

### Pasos exactos para el operador autorizado en Supabase

1. Obtener/reconocer autorización **del SQL remoto**, distinta de publicar la OTA. Abrir exclusivamente
   [Marketplace — SQL Editor](https://supabase.com/dashboard/project/mimnotafmfasvwrclxan/sql/new).
   Confirmar proyecto/ref `mimnotafmfasvwrclxan`; nunca `bfuggvbgttvcygbexqyn`.
2. Revisar el archivo `tools/supabase-remote/aplicar-mi-tienda-operativa.sql` de esta rama y las dos
   migraciones originales. Copiar el archivo completo al editor; no seleccionar trozos aislados.
   Ejecutar como postgres. Si alguna protección falla, la transacción revierte; conservar error y revisar
   prerequisitos/historia/identidad. No borrar datos, reescribir versiones o ampliar RLS para forzarlo.
3. Resultado esperado: filas `20261011172600 / seller_product_editor` y
   `20261011174200 / seller_fulfillment_detail`, más `catalog_supported = true` y `orders_supported = true`.
   Si ambas ya estaban registradas, se omiten y verifican; si el nombre tiene otra versión, aborta para revisión.
4. Cerrar/reabrir HAYAZGO con sesión autorizada para renovar consultas de soporte. Comprobar edición de
   tienda, catálogo/fotos/stock/moderación y entregas permitidas con cuentas/datos explícitamente autorizados.
   Guardar, volver a entrar y confirmar persistencia; permisos ajenos/admin/pago siguen en servidor.
   No crear datos/demo, pedidos o pagos remotos automáticamente para probar.
5. Registrar fecha, resultado y versiones en ESTADO_ACTUAL/PENDIENTES/HISTORIAL. Publicación ya terminada:
   activar estos RPC no requiere otra OTA mientras el código publicado permanezca igual.

### Reproducir las pruebas del paquete local

Con Node/pnpm/Postgres y stack preparados, usar la copia anterior que tiene las funciones pero todavía no
las dos versiones registradas (`.local/seller-ops-db-name`); retener las copias viejas y crear una nueva:

```bash
source /workspace/.onboarding/env.sh # solo cloud; en otra máquina preparar PATH según ENTORNO.md
source tools/local-stack/env.sh
export PGHOST=127.0.0.1 PGPORT PGUSER=postgres PGPASSWORD="$DB_PASSWORD"
export KORA_RELEASE_TEST_DATABASE="kora_seller_release_$(date -u +%Y%m%d%H%M%S)"
createdb "$KORA_RELEASE_TEST_DATABASE"
pg_dump -Fc -d "$(cat .local/seller-ops-db-name)" -f .local/seller-ops/release/backend-before.dump
pg_restore --exit-on-error -d "$KORA_RELEASE_TEST_DATABASE" .local/seller-ops/release/backend-before.dump
python3 tools/supabase-remote/build-mi-tienda.py --check
python3 tools/supabase-remote/test-mi-tienda.py
```

El test exige localhost/nombre de copia específico; nunca conecta al remoto. Su fixture Vault de identidad
solo vive en esa copia nueva. No elimina bases ni filas. Para los 24 casos de acceso/persistencia, definir
TEST_DATABASE_URL hacia esa copia y ejecutar el comando de siete suites de PRUEBAS.md sin pricing (ya probado).

### Próxima acción exacta

No repetir VEN-01A/perfil/catálogo/pedidos/franja o publicación. Esperar resultados físicos de Oliver;
activar/verificar únicamente las dos migraciones con acceso/autorización SQL al proyecto correcto.
Sin soporte remoto las acciones conservan consulta/panel. BCV sigue como prioridad crítica separada,
no se aborda mientras Oliver revisa sin una instrucción específica. No hay nuevo WIP funcional pendiente.
