# Reseñas y respuestas: diagnóstico UGC para Play · 9 noviembre 2026

## Resultado y límite de esta tanda

La fuente Android aislada `39ffbee1e9bfbaaaba771da35bfa1479bf6044ce` no ofrece denuncia de reseña/respuesta/autor ni bloqueo persistente reversible. Tampoco exige aceptación de normas UGC antes de publicar o editar. Existen compra verificada, guardas de autor/tienda y moderación administrativa; no deben sustituirse ni presentarse como los controles que faltan.

Se cierra **diagnóstico y propuesta mínima**, conforme a la instrucción de terminar esa etapa antes de ampliar un alcance grande. Resolverlo exige persistencia/ACL, lecturas públicas y REST, notificaciones, app y editor de respuestas del panel. No se añadieron botones sin soporte ni se ocultó todo el UGC. **No se implementó aún la corrección**: sigue siendo un bloqueante identificado para el siguiente candidato Play.

Sólo lectura de la fuente39ff y pruebas offline. Fuente versionada39ff/árbol `46ec34e446545efab5e1e78b6d5e468e8054faad` conservada; no se mezcló HEAD compartido, Google, cuotas o arreglo web login-CSRF. No SQL, migraciones, RLS/grants/configuración hospedados, navegador, usuarios, compras, nuevos builds, OTA, web o Play. El checkpoint de esta tanda sólo añade documentación y evidencia.

El AAB vc3 previo se conserva: build `e25d3cdf-4652-462c-9cc1-16723c1739e0`, `/Users/brandeastudio/Downloads/Mayami-AAB-Prueba-2026-11-09/MAYAMI-0.1.0-vc3.aab`, 86.911.369 bytes, SHA256 `eb8243732509e141fb3e4211be539a702afd063bbb21dcde49872362a3570f23`. No contiene estos futuros controles y no se ha subido a Play desde este frente.

## Requisito externo verificado

Google incluye expresamente las reseñas de comercio electrónico dentro de UGC. Su política exige aceptación previa de términos o normas del usuario, definición/prohibición de contenido objetable y moderación con denuncia de contenido/usuarios y bloqueo. La guía indica que esos controles deben ser accesibles y estar claramente identificados. Fuentes primarias consultadas el9nov2026: [guía de moderación](https://support.google.com/googleplay/android-developer/answer/12923286?hl=en-GB), [política UGC](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en-GB). Esto acredita el requisito, no garantiza aceptación de una implementación futura.

Para la propuesta de seguridad se consultaron el changelog de Supabase y sus [funciones de base de datos](https://supabase.com/docs/guides/database/functions) y [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). No se modificaron SDK, versión de Postgres o dependencias.

## Cobertura real de la fuente39ff

| Área | Evidencia local | Estado |
|---|---|---|
| Presentación pública | `apps/mobile/src/components/reviews/Reviews.tsx:93`: muestra reseña y respuesta, sin acciones | Hueco reproducido en TSX |
| Producto y tienda | `product/[id].tsx:416`, `store/[slug].tsx:146`; `product_reviews` y `store_profile` | Ambas muestran reseñas; la RPC de tienda no serializa respuestas |
| Publicar/editar reseña | `ReviewSheet.tsx:19`: envía item/estrellas/texto; basta rating | Sin consentimiento UGC previo |
| Registro | `sign-up.tsx:58`: aviso y enlaces genéricos | No acredita consentimiento versionado de autores existentes |
| Responder desde tienda | `apps/admin/src/components/Reviews.tsx:143` | Publica sin aceptación UGC; no hay editor móvil de respuesta |
| Términos locales | `apps/storefront/src/data/policies.json`, Uso responsable | Prohíbe fraude/suplantación/acceso indebido; no define de forma suficiente el contenido UGC objetable |
| Compra/autor/edición | `20261009001700_reviews_engagement.sql:137` | Exige comprador, entrega, rating/texto válido, límite de frecuencia y edición60d |
| Permiso de respuesta | Mismo SQL`:180` | Exige pertenencia a tienda; no inventar atribución humana histórica |
| Moderación existente | Mismo SQL`:203`; panel`:169` | Sólo admin, motivo/auditoría y rating derivado; oculta toda la reseña, no sólo una respuesta |
| Denuncias/bloqueos/aceptación | Migraciones y API revisadas | No se encontraron tablas/RPC/contratos para ellos |
| Identidad pública | `PublicReview` en `packages/api/src/types.ts:395` | Nombre abreviado sin UUID del autor; conservar ese límite |
| Lectura REST | `reviews_read`, SQL`:49` | Permite leer filas publicadas: filtrar sólo UI/RPC deja otra vía |
| Avisos | `reply_review`, SQL`:197` | Guarda extracto de respuesta en notificaciones; no basta ocultar ReviewItem |
| Caché | `apps/mobile/src/lib/query.ts:84` | `reviews/store` sin actor; esas dos claves no se persisten, notificaciones sí |

No se consultaron las definiciones hospedadas. La cobertura describe esta fuente exacta, no un inventario del servidor vivo. El diagnóstico backend completo y sus referencias están en la evidencia adjunta.

## Propuesta mínima, tres bloques con cierre propio

### 1. Persistencia, consentimiento y lectura segura; sólo local

Preparar tres registros privados: aceptaciones `{actor, versión, fecha}`, bloqueos `{actor, clase de sujeto, sujeto, fecha}` y denuncias `{id, denunciante, contexto, objetivo, motivo, detalle acotado, estado/decisión}`. El objetivo se deriva de `review_id + target` en servidor. Nunca aceptar del cliente actor, denunciante, autor arbitrario o rol; no ampliar `PublicReview` con identificadores humanos.

Cuatro familias de contratos, sin CRUD genérico: estado propio/bloqueos; aceptar normas vigentes; denunciar contenido o autor desde una reseña/respuesta; fijar/revertir un bloqueo propio. Más la lectura restringida y decisión de moderación administrativa. Todas las escrituras requieren sesión real y guardas existentes; `PUBLIC/anon` sin EXECUTE, helpers privados y tablas sin lectura global. Unicidad, límite de frecuencia e idempotencia ligada a actor/objetivo/payload, incluidos reintentos tras transporte incierto. No revelar identidad del denunciante al denunciado o a la tienda.

Los textos se presentan como autor comprador y respuesta de tienda. La propuesta usa **usuario** como sujeto de reseña y **tienda** como sujeto público de respuesta. No deducir un empleado de miembros actuales; si se decide bloquear además una persona real que respondió, registrar su ID sólo hacia delante, sin rellenar históricos inventados. El bloqueo de tienda debe llamarse «Bloquear respuestas de esta tienda» y afectar su UGC, conservando el acceso comercial. Esta interpretación de identidad pública necesita revisión antes de afirmar cobertura completa de usuarios exigida por Play.

Separar estado/motivo de moderación de la respuesta del estado de la reseña. Quitar una respuesta ofensiva no debe quitar una opinión honesta ni su rating. La denuncia por sí sola no declara infracción ni cambia reputación; la cola debe permitir acción administrativa y dejar trazabilidad, sin prometer un plazo de servicio inventado. Integrar datos nuevos con el cierre de cuenta/política de conservación vigente antes de activar, sin inventar otra retención ni borrar historial comercial.

Filtrar autores bloqueados **antes de paginar** en las dos lecturas públicas y enmascarar sólo la respuesta bloqueada/moderada. Cerrar la lectura pública directa de la fila con respuesta o sustituirla por una proyección segura; conservar consultas operativas propias/admin/tienda mediante permisos expresos y pruebas. Una policy de fila no puede ocultar sólo una columna. Mantener rating/resumen global derivado; indicar cuando la vista personal omite contenido, sin convertir el bloqueo en moderación global.

Evitar que nuevos avisos de respuesta reexpongan texto bloqueado y tratar extractos UGC ya guardados/caché. Conservar avisos transaccionales, pedidos, pagos y reclamos legítimos. No desactivar todo el centro de avisos. El diseño exacto de esta transición debe quedar probado antes de decidir el DDL definitivo.

Normas UGC visibles en app y editor del panel, con versión y aceptación explícita vinculada al actor; `submit_review` y `reply_review` la exigen en servidor antes de crear/editar. No inferir aceptación a partir de una cuenta ya creada, JWT editable o texto genérico de registro. Prohibir amenazas/acoso/odio, contenido sexual explícito/ilegal, explotación infantil, datos personales ajenos, suplantación, fraude y spam, preservando opiniones negativas honestas y reclamos. No reescribir las demás condiciones comerciales ni declarar que estos textos ya están publicados.

**Cierre de bloque1:** esquema/RPC/ACL y cambios de lectura/avisos probados en cluster nuevo loopback con fixtures `example.com`, migración preparada y revisión independiente. No copiar una DB de procedencia mixta ni ejecutar `test-db.sh` sin guardas: sus líneas9–10 borran la base de test y clonan desarrollo; `tests/db-tests/src/db.ts:20` acepta URL de entorno sin guarda host. No ejecutar cambios hospedados.

### 2. Conectar sólo los recorridos afectados

Reutilizar Sheet, botones, Banner y tokens. Acceso contextual en reseña y respuesta con acciones separadas: «Denunciar opinión/respuesta», «Denunciar autor/tienda» y «Bloquear autor/respuestas de tienda». Denuncia con motivo, detalle acotado, envío confirmado y estado recuperable. Bloqueo con explicación de alcance y reversión localizable en una lista breve de bloqueos; no añadir un rediseño o una pestaña general.

Controles visibles a invitados; las acciones personales persistentes requieren identificación y retorno seguro. No ejecutar automáticamente una denuncia o bloqueo después de iniciar sesión. Carrito/favoritos de invitado y entrada a tiendas siguen funcionando. Probar que la identificación exigida para estas acciones no se propaga a navegación o compra anticipadamente.

Claves de UGC/consentimiento/bloqueos ligadas a invitado/A/B; API capturada al actor y descarte de resultados obsoletos. No mostrar contenido de una caché global como si fuese una vista personalizada confirmada. Tras bloquear/desbloquear, retirar o invalidar sólo el UGC de ese actor; reconciliar resultado incierto antes de reintentar. Conservar borrador y no mostrar éxito al fallar. El cambio de cuenta no presta consentimiento ni bloqueos.

Agregar aceptación mínima al editor de respuestas y acceso restringido a la cola/decisión de respuesta; el panel es una dependencia real del servidor común. No activar una guarda que rompa el editor anterior sin coordinar una transición compatible. Excluir cambios al login, SSR, finanzas y al resto del diseño.

**Cierre de bloque2:** integración local y tests de interacción/cambio de actor/errores, tipos/lint. Revisión claro/oscuro de controles afectados en una futura tanda que permita el recorrido visual. En esta tanda no se usó navegador ni se acredita render visual/dispositivo.

### 3. Verificación final y delta de despliegue; sin ejecutarlo aquí

| Caso que debe pasar | Resultado exigido |
|---|---|
| Invitado o actor falsificado | Sin escritura/consentimiento ajeno ni helpers/tablas accesibles |
| A bloquea a R; B e invitado consultan | Sólo A oculta las reseñas de R, también por REST; paginación y score global correctos |
| A bloquea tienda T | Sólo UGC de T oculto para A; tienda, catálogo, compra y reclamo conservados |
| A lista/revierte bloqueo de B | Rechazado sin revelar datos; undo propio restaura visibilidad tras recarga |
| Reportar reseña, respuesta y cada autor pertinente | Sujeto derivado correcto; respuesta inexistente/objetivo inaccesible/motivo inválido rechazados |
| Reporte duplicado o key reutilizada con otro payload | Una denuncia válida o conflicto explícito; sin duplicación ni falso éxito |
| Denunciado/tienda lee reportes | Identidad/detalle privado del denunciante no expuesto |
| Moderación sólo de respuesta | Reseña legítima/rating intactos; sólo admin y auditada |
| Aceptación ausente, antigua, falsa o de B | Submit/reply rechazados; aceptación vigente de A permite el UGC autorizado |
| Bloqueo y notificaciones nuevas/guardadas/offline | Sin extractos UGC bloqueados; avisos de pagos/reclamos conservados |
| Error, doble toque, reconexión, cambio A→B en vuelo | Borrador/estado honestos, cancelación/reconciliación sin cruce de cuenta |

Reutilizar los casos focales de `reviews-engagement.test.ts` y `privileges.test.ts` en instancia fixture-only nueva; no relanzar toda la matriz financiera como sustituto. Las suites UI existentes `reviews.spec.ts` móvil/panel no prueban bloqueo/denuncia porque esos controles aún faltan.

Después de implementación y revisión local: preparar **un delta remoto concreto** con hashes SQL, tablas, funciones, ACL/RLS y tratamiento de avisos; preflight READ ONLY del proyecto Marketplace `mimnotafmfasvwrclxan`, identidad/base/versiones/definiciones/permisos esperados. Solicitar autorización específica de ese delta antes de ejecutarlo. Ante deriva o denegación, parar y reportar, sin vía alternativa.

Tras aprobación específica: un batch transaccional revisado, lectura independiente de verificación y clientes compatibles en tanda separada. Conservar rollback de funciones/permisos revisado; no borrar denuncias/bloqueos/aceptaciones para revertir. No publicar HEAD combinado. Nuevo AAB, prueba Android real y subida Play requieren sus propias tandas; este plan no las ejecuta ni garantiza aprobación de Google.

## Evidencia ejecutada y artefacto

Tres caracterizaciones sobre los cuerpos TSX reales de ReviewItem/ReviewSheet, transpilados en VM con puertos React/query/UI/API controlados: (1) se muestran reseña/respuesta sin acciones; (2) edición con estrellas invoca submit sin aceptación UGC; (3) error conserva borrador, muestra Banner, no cierra/invalida y permite reintento explícito. Exit0; los dos primeros resultados son **huecos reproducidos**, no controles aprobados. No DOM, dispositivo, SDK, red o autorización SQL.

Cinco casos existentes de `tests/mobile/legal-links.test.ts` aprobados: direcciones HTTPS canónicas y recuperación cuando abrir un documento falla. No visitan esas páginas ni acreditan contenido hospedado/consentimiento UGC.

No se ejecutaron los casos de denuncia/bloqueo/autorización SQL/aislamiento/undo de la matriz: faltan sus contratos. No hubo test de servidor vivo, pantalla claro/oscuro, instalación física, nueva compilación o aceptación Play. La revisión independiente distingue esas limitaciones.

Evidencia persistente: [carpeta de propuesta](propuestas/ugc-play-20261109/), con diagnóstico backend, caracterización/script, recibo de5tests, fuentes/hashes y comprobación del AAB previo. Archivo portable y manifest de hashes se entregan en `/Users/brandeastudio/Downloads/Mayami-UGC-Diagnostico-2026-11-09/`. Cuota Codex observada31%restante; ya no se aplica la reserva20%, sin resets ni pagos.

Revisión independiente local conforme: referencias y recibos contrastados; no falsos PASS de controles pendientes. Se corrigió el texto y se comprobarán las rutas del artefacto antes del cierre. No se ejecutaron pruebas adicionales por el revisor.
