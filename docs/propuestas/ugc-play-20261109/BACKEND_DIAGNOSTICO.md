# Diagnóstico backend UGC · 9 noviembre 2026

Fuente leída: 39ffbee1e9bfbaaaba771da35bfa1479bf6044ce, árbol limpio. Sólo lectura de código. Sin SQL, servicios, red, credenciales, compilación, migración ni cambios versionados. No se consultó estado hospedado.

## Cobertura acreditada

- `supabase/migrations/20261009001700_reviews_engagement.sql:26-50`: reviews tiene comprador, compra, producto, tienda, texto/nota, status y respuesta textual. RLS permite leer publicadas, propias, admin o miembros de tienda. No hay denuncia, bloqueo ni atribución humana de la respuesta.
- Mismo archivo `:137-177`: submit_review exige require_user, compra del actor y entrega completada, limita frecuencia/texto/nota y edición a60d. Mantiene estado moderado al editar y recalcula rating servidor.
- `:180-200`: reply_review exige pertenencia a tienda/admin, valida texto, audita y envía extracto al autor. Sólo almacena reply_body/reply_at, no quién respondió ni aceptación de términos.
- `:203-222`: moderate_review exige admin y motivo para ocultar, audita y recalcula rating. Oculta toda la fila; no puede moderar una respuesta por separado conservando la reseña legítima.
- `:226-247` product_reviews y `:272-302` store_profile son SECURITY DEFINER: publican reseñas sin estado personalizado de bloqueo. El resumen global sigue contando publicadas. Store_profile sólo devuelve tres reseñas con texto, sin respuesta.
- `:545` revoca escritura directa en reviews a anon/authenticated. `20261009153318_api_hardening.sql:18-33` quita execute anon de submit/reply/moderate, dejando llamadas autenticadas con guardas internas.
- `packages/api/src/api.ts:165-185` expone mine/deliveredItems/submit/reply/moderate; no report/block/consent. `types.ts:395-407` PublicReview no expone user_id (conviene preservarlo).
- `apps/admin/src/components/Reviews.tsx:35-42` lee tabla reviews directamente. `:125-139` permite responder u ocultar/publicar. `:143-157` respuesta publica con API sin consentimiento. `:191-200` moderación define datos personales/ofensas/publicidad y advierte que una opinión negativa honesta no debe ocultarse. No hay cola de denuncias.
- `20261009000100_foundation.sql:83-99` require_admin/require_user derivan actor de sesión; `20261009000200_catalog.sql:72-82` require_store_member valida pertenencia, admin o servicio. Nuevos controles deben mantener estas guardas y no fiarse de actor/reporter pasado por cliente ni metadata editable.

## Huecos que impiden un arreglo sólo de botones

1. No hay registro ni flujo administrativo de denuncias de contenido/autores.
2. No hay bloqueo persistente reversible, filtro servidor ni aislamiento de bloqueos por actor.
3. No hay aceptación UGC versionada, previa a submit/reply, acreditada en servidor; exigirla sólo en Android dejaría reply del panel sin cubrir.
4. Una respuesta se presenta como de la tienda, identidad pública existente. Atribuir su autor humano histórico a cualquier miembro sería inventado. Bloquear sólo UGC de esa tienda es una propuesta coherente con la identidad pública, no una garantía de aceptación de Play; si se exige autor humano, introducir reply_user_id sólo hacia delante, sin backfill ficticio.
5. Filtrar sólo product_reviews/store_profile no basta: reviews_read permite obtener la fila publicada por REST. Una respuesta bloqueada no puede enmascararse selectivamente con una policy de fila sin quitar también una reseña legítima.
6. reply_review envía extractos a notificaciones (`:197-198`); bloquear debe evitar nueva exposición en estos avisos y gestionar extractos ya guardados, sin ocultar reclamos/pagos/avisos legítimos.

## Propuesta mínima delimitada para la siguiente tanda

Tres registros privados: aceptaciones `{actor, version, accepted_at}`, bloqueos `{actor, subject_kind:user|store, subject_id, created_at}` y denuncias `{id, reporter, review_id, target:review|reply|author|store, reason, detalle limitado, subject derivado, snapshot del texto pertinente, estado/decisión}`. IDs humanos sólo servidor. Claves de unicidad e idempotencia para reintentos; no aceptar IDs arbitrarios de sujeto/reporter desde app. Denuncia referencia reseña publicada accesible; target reply exige respuesta existente; target autor se resuelve desde reviews.user_id y tienda desde store_id. No divulgar denunciante a denunciado o tienda.

Contratos de usuario acotados: consultar su estado/aceptación/bloqueos; aceptar versión actual; denunciar reseña/respuesta/autor o tienda a partir del contexto; fijar/deshacer bloqueo con identificador opaco de su propio registro. Esto equivale a cuatro familias de RPC (estado, consentimiento, denuncia, bloqueo), no CRUD genérico. Para administración hace falta una lectura restringida de cola y reutilizar la acción de moderación con decisión sobre respuesta separada; no prometer que el panel actual ya la ofrece. Evitar rediseño: acceso contextual y gestión breve de bloqueos.

Los nuevos registros no se exponen a anon ni a selects globales de authenticated. RPC mínimo EXECUTE authenticated, PUBLIC/anon revocados y helpers internos no ejecutables; require_user/require_admin al inicio, search_path fijado, rate limit y validación/locks según escritura. Si se usa public con RLS, ownership explícito y sólo permisos mínimos; elegir una variante, no sumar ambas superficies. Preparar cambios de permisos localmente, pero no aplicarlos hospedados sin aprobación específica.

Lectura pública personalizada: product_reviews/store_profile filtran reseñas de comprador bloqueado y enmascaran sólo respuestas de tienda bloqueada o moderada, manteniendo reseña, catálogo, compra y acceso a tienda. Resumen/rating global sigue inmutable: bloqueo privado no altera reputación ni oculta que el resumen incluye todas las opiniones válidas. Cerrar la lectura REST pública de reviews y conservar propios/admin/tienda operativos, o sustituirla por una proyección segura; ambos son cambios reales de permisos que necesitan revisión/ensayo y futura aprobación remota. No solucionarlo con un filtro cliente o manteniendo el bypass REST.

Antes de submit/reply, consentimiento servidor vigente, además de controles visibles; preservar entrega/propiedad/frecuencia/edición/importe. Tanto ReviewSheet como ReplyDialog del panel necesitan el acceso mínimo a normas/aceptación si comparten esta guarda. Definir contenido prohibido (acoso/amenazas/discurso de odio/sexual ilegal o explícito/datos personales/estafas/spam) sin convertir una queja legítima en infracción. Decisión de moderación conserva motivo/auditoría y no borra pedidos/reclamos.

Bloquear debe ocultar inmediatamente UGC de ese sujeto para ese actor tras confirmación y sobrevivir recarga; deshacer restaura sólo su visibilidad. Error de red: no mostrar éxito ni descartar borrador; estado incierto se reconcilia por lectura/idempotencia antes de repetir. Denunciar no declara culpable ni oculta globalmente por sí solo. El revisor dispone de motivo/texto objetivo para actuar.

## Caché y aislamiento imprescindibles

`apps/mobile/src/lib/query.ts:80-88` reviews/store no incluyen actor; `:60-70` no persiste esas dos claves, sí notificaciones. Dar scope por actor a resultados personalizados y a bloqueos/aceptaciones; no permitir respuesta tardía de A poblar datos de B. Invalidar/retirar exactamente UGC afectados al bloquear/deshacer y limpiar al cambiar cuenta. `:75-77` clearAccountCache ya existe, pero no reemplaza binding de operaciones. No reutilizar copia invitado/global como resultado de actor autenticado sin reconciliar bloqueos. Evitar flashes de contenido bloqueado tras refetch lento y extracción desde avisos ya guardados.

## Matriz local mínima para implementar luego

- Auth: anon no escribe/denuncia/acepta; spoof de actor/reporter rechazado; tablas/helpers sin acceso directo indebido.
- A bloquea autor R: sólo A deja de ver sus reseñas en producto y tienda/REST; B e invitado conservan contenido válido. Resumen global inalterado. Duplicado idempotente; A no puede listar/deshacer bloqueos de B.
- A bloquea tienda T: sólo respuestas UGC de T se ocultan, no reseña comprador, productos, compra, pedidos ni reclamo legítimo. Avisos UGC no reexponen el texto. Undo A restaura; cuenta B no hereda bloqueo.
- Denunciar reseña/respuesta/autor/tienda resuelve sujeto correcto servidor; respuesta inexistente/oculta inaccesible y reason inválido no crean registro; ni autor ni tienda ven quién denunció. Reintento no duplica. Reporte por queja negativa no modifica rating/estado por sí solo.
- Moderación respuesta conserva reseña/rating; moderación reseña conserva auditoría y recálculo existente; ocultación/desocultación autorizada sólo admin.
- Consentimiento ausente/antiguo/falso se rechaza antes crear/editar UGC, tanto submit como reply; versión actual aceptada se vincula al actor. Cambiar de cuenta no presta aceptación.
- Doble toque, fallo/transporte incierto, reconexión, cancelación y respuesta tardía tras cambio de cuenta: borrador/estado honestos y recuperación sin cruce de usuarios.
- UI: claro/oscuro y accesibilidad; controles separados denunciar/bloquear, confirmación de bloqueo y reversión localizables sin rediseño.

## Tests existentes y entorno

No se encontró unidad offline específica de reglas/reseñas/UGC. `tests/db-tests/test/db/reviews-engagement.test.ts:19-111` cubre entrega/propietario/edición/moderación/respuesta/rating; `test/db/privileges.test.ts:4-89` fija allowlist, anon y guardas. UI `tests/app-e2e/tests/reviews.spec.ts:16-58` y `tests/app-e2e/panel/reviews.spec.ts:8-54` dependen de DB/servicios/fixtures. Reusar/adaptar casos focales, no ejecutar toda matriz financiera ni presentar sus tests como UGC.

Offline adyacentes posibles: `tests/mobile/legal-links.test.ts`, `tests/mobile/offline-layout.test.ts`; sólo prueban enlaces/estructura offline, no nuevos controles UGC. Ninguno fue ejecutado por este subagente.

Stack local portable vive en tools/local-stack; psql instalado `/opt/homebrew/bin/psql`. No se observó cluster `.local/pg` ni proceso postgres activo en la inspección de este checkout. `tools/local-stack/env.sh:4-22` fija `.local`, PGDATA/puertos; `reset-db.sh:6` borra PGDATA/storage. `test-db.sh:9-10` hace DROP del test y clone del desarrollo, por eso no iniciarlo/ejecutarlo automáticamente: en tandas previas no se acreditó toda procedencia de cuentas. `tests/db-tests/src/db.ts:20-23` acepta URL de entorno sin guardas host. Para la futura prueba crear cluster nuevo loopback con nombre task-specific y fixture-only desde migraciones, nunca clonar base con datos mezclados ni seed remoto. Guardar recibo de host/puerto y base vacía antes de insertar usuarios example.com. Nueva migración debe crearse con CLI migration new cuando realmente se autorice prepararla.

## Plan exacto antes de desplegar

1. Acordar la identidad pública de respuesta (tienda como actual; persona futura si se exige) y acotar parche backend+app+mínima aceptación/moderación del panel.
2. Implementar desde39ff en fuente aislada, preparar migración y tests en cluster nuevo local, sin remoto. Mantener vc3 previo y su evidencia.
3. Verificar ACL/RLS/REST, actores, notificaciones/caché y UI afectada; revisión independiente de diff/capturas/recorridos. Tipos/lint y pruebas focales, sin build AAB/OTA/web.
4. Preparar un delta remoto legible con tablas/RPC/policies/grants exactos y preflight readonly/guardas de identidad/versión/definiciones/ACL; solicitar autorización específica de ese cambio hospedado antes de ejecutar nada.
5. Sólo tras esa aprobación y preflight: aplicar un batch transaccional revisado una vez, verificar resultados por lectura, activar clientes compatibles en tanda separada. No crear un AAB hasta confirmar backend/controles completos. No publicar HEAD combinado.
6. Revisión Play y prueba Android real posteriores, sin afirmar aceptación garantizada. Si falla activación, no retirar controles ni fingir éxito: conservar versión anterior y reparar por delta revisado, sin borrar denuncias/bloqueos/consentimientos registrados.
