# UGC bloque1 implementado y probado sólo local · 9nov2026

Base exclusiva `39ffbee1e9bfbaaaba771da35bfa1479bf6044ce`, sin HEAD principal ni Google/cuotas/web-CSRF. Bloque1 terminado: persistencia privada, consentimiento, contratos y lecturas/avisos seguros. **Gatefalse por defecto; no se activó ni se aplicó nada hospedado.** El AABvc3 previo permanece igual y no contiene estos cambios. UI, dispositivo y aceptación de Play siguen pendientes.

## Artefactos principales

- Migración: `supabase/migrations/20261109172643_mayami_ugc_private_controls.sql`.
- SHA256: `c94d0794e6b2a1954bbcc710900cb8af61c17031f537935697bd5dc34c9d8c97`.
- Activación separada, sólo plantilla local/revisión: `tools/ugc/activate-reviewed.sql`.
- SHA256 de activación: `d0115afc6e289619a3ba56ad954da58827d810fcce5e87a973c0d09c78cdfd4f`.
- Contratos aditivos: `packages/api/src/ugc.ts`, compuestos como `api.ugc`; métodos anteriores intactos.
- Pruebas: `tools/ugc/contracts.test.cjs`, `tools/ugc/local.test.cjs` y allowlist UGC explícita en `tests/db-tests/test/db/privileges.test.ts`.

## Qué hace el servidor preparado

Esquema `ugc_private` no expuesto y sin privilegios de aplicación, RLS defensiva: ajustes/gate, aceptaciones por actor+versión, bloqueos privados y denuncias. Denuncias guardan hash inmutable del intento, no una segunda copia del detalle. Tres registros de usuario más ajustes; ningún UUID humano añadido al contrato público de reseñas.

Diez RPC acotadas: policy pública; status/accept/report/block/unblock autenticadas; staff_reviews exige tienda propia o admin; reports/resolve_report/moderate_reply exigen admin. Helpers privados no ejecutables por anon/authenticated/service_role. Actor derivado de sesión y validado contra existencia/ban real, sin confiar en metadata del cliente. Escrituras usan FOR SHARE sobre auth.users para serializar con cierre/ban; no basta FOR KEY SHARE.

Reporte deriva sujeto desde review_id y objetivo review/reply/review_author/store_author, valida existencia/publicación/acceso, motivo/detalle y autor propio, limita frecuencia y protege reintento por actor+UUID+hash. Reusar una key con otro payload da conflicto. No oculta contenido ni cambia rating por sí solo. Cola administrativa omite identidad del denunciante, accesible sólo a admin.

Bloqueo deriva comprador o **tienda como identidad pública de la respuesta**, sin inventar empleados históricos. Status devuelve ID opaco de bloqueo, clase y etiqueta, nunca UUID humano del sujeto. Repetir bloqueo conserva registro; desbloquear exige ID propio. Filtro en producto/tienda antes de paginar; bloqueo de tienda enmascara sólo respuesta/fecha, conserva reseña, catálogo, pedido, carrito y reclamo. Rating/resumen global no cambia por una preferencia privada.

Respuesta tiene estado/motivo separado. Admin puede ocultar/restaurar sólo esa respuesta sin retirar reseña ni alterar score; editar una respuesta moderada no la autopublica. Moderación de reseña, auditoría y cálculo de rating anteriores conservados. Nuevas acciones/moderación de respuesta se niegan mientras gatefalse.

Normas con versión `ugc-2026-11-09-v1` visibles por contrato, definición de contenido prohibido y protección de opinión negativa honesta. Al activar, trigger exige aceptación vigente antes de crear/editar UGC también desde panel, sin sustituir guardas existentes de compra/entrega/tienda. Aceptación y bloqueos no se prestan entre cuentas.

Todos los avisos `system` con review_id se sanitizan a título/cuerpo genéricos y data limitada a producto/reseña, incluidos los ya almacenados: éste es un UPDATE real que un futuro delta hospedado deberá autorizar explícitamente. No se reescriben avisos de pagos/reclamos. Bloquear tienda marca pendientes UGC como skipped; nuevas respuestas bloqueadas o moderadas no insertan aviso. INSERT comparte lock con bloqueo; UPDATE no invierte orden fila/advisory. No se puede retirar un push ya enviado/reclamado por un proveedor ni limpiar remotamente una caché vieja desconectada.

Cierre definitivo por banned_until=infinity limpia aceptaciones y bloqueos propios, anonimiza detalle del denunciante cerrado y retira extractos del autor cerrado. Conserva bloqueos que otros actores eligieron sobre ese autor y los recibos/hashes de sus denuncias: no reaparecen reseñas ni se rompe idempotencia ajena al cerrar la cuenta. No cambia el proceso de cierre, pedidos o historial financiero existentes. La política de conservación completa del servicio no se reaudita en esta tanda.

## Transición sin romper el panel anterior

La migración instala gatefalse. LegacySELECT* y editor previo siguen funcionando; report/block y moderación nueva rechazan ugc_not_enabled, evitando fingir bloqueo con REST abierto. Policy/status/accept y contratos operativos pueden prepararse antes. No se ofrece una activación remota automática.

La transacción separada cierra lectura raw de anon, revoca tabla/columnas de authenticated y concede sólo las seis columnas del contrato propio mine; reemplaza reviews_read por propios/admin/tienda operativos y habilita gate. Una respuesta ya no sale por rawREST; filas publicadas ajenas tampoco. El nuevo staffRPC sustituirá el SELECT* del panel compatible. **Aplicarla ahora contra el panel previo lo rompería y bloquearía publicación sin aceptación: no hacerlo.**

## Pruebas ejecutadas

Cluster PostgreSQL17.11 nuevo bind127.0.0.1:56439, vacío, sin dump/clone/seed ni datos remotos. AuthSQL mínimo explícito y PostgREST16.5 existente con JWT sintético local; no GoTrue ni sesión/correo real. Se aplicaron 32 migraciones base y la nueva33 desde vacío. El recibo inicial del helper capturó por una carrera el archivo UGC aún vacío; no acredita su versión final. La prueba acreditada final es la base nueva `ugc_guard_final` y `GUARD_FRESH_MIGRATION.json`, con hash final y usuarios/pedidos0 antes de fixtures.

- **19 grupos PG/REST PASS**, recibo vigente `GUARD_FINAL_UGC_TEST_RESULTS.json`: preparación/activación, consentimiento/actor, 4 objetivos de denuncia y reintentos, bloqueos A/B/invitado, paginación, REST, seis columnas propias, aislamiento de tienda/admin, conservación de catálogo/carrito/pedido/reclamo, avisos, moderación separada, ban/stale actor y cierre con replay ajeno.
- **4 grupos concurrentes/ACL PASS**, `CONCURRENCY_RESULTS.json`: solapamiento real mark-read/bloqueo sin deadlock; respuesta que espera bloqueo sin aviso; cierre que espera aceptación/bloqueo sin resucitar filas; diez RPC con permisos exactos.
- **3 contratos Node PASS**, sin retry automático y con el mismo intento al reintentar explícitamente; mensajes UGC específicos preservan ApiError.
- Tipos API/móvil/admin/db-tests y lint móvil PASS. Sin cambios visuales o fuentes UI; no navegador/capturas.
- Advisors security/warn del CLI contra loopback: results[]; no significa auditoría completa. Primer intento falló por TLS local sin SSL y no ejecutó consulta; una corrección sslmode=disable contra el mismo destino pasó.
- Suite existente de privilegios: **4 PASS / 1 FAIL**. Diferencia preexistente `favorites_merge_intent`, creada/expuesta en base39ff pero ausente de su EXPOSED. Su migración original coincide por hash; no se modificó ni se relajó esa deuda para poner verde. Los permisos nuevos UGC se probaron por lista exacta aparte.

Fallos conservados del arnés: primera guarda comparaba inet text127.0.0.1/32 con127.0.0.1 y paró antes de fixtures; se corrigió a host(inet_server_addr()) sin ampliar destino. Un caso intentaba denunciar después de ocultarse el contexto mediante bloqueo y recibió not_found correctamente; se ordenó denuncia antes de bloqueo. Correcciones de producto por revisión independiente (actor baneado, orden de locks, cierre e idempotencia ajena) se probaron de nuevo desde base vacía final; no contar los resultados anteriores como adicionales.

El arnés versionado contiene los mismos19 casos de la copia ejecutada, con rutas resueltas desde repo. Exige base39ff como ancestro, directorio .local, host/puerto/base/DATADIR exactos y tablas iniciales vacías; no usa URLs de entorno ni clona/borra bases. `--resume` sólo reutiliza el recibo de fixtures del task y no vuelve a acreditar preparación. Scripts y recibos completos viajan en el paquete; JWT/configuración privada local quedan excluidos.

## Límites y siguiente bloque mínimo

No prueba financiera completa, SDK/Auth real, dispositivo, render, caché persistida vieja, subida/aceptación Play. La identidad tienda cubre la identidad pública de estas respuestas, no identifica ni bloquea a un empleado histórico en otros canales. Este bloque no se extiende a chat/reclamos ni impide compraventa. Revisión independiente focal conforme con esos límites.

Bloque2 mínimo: acciones separadas en ReviewItem, formulario/errores de denuncia, confirmar/revertir bloqueo y gestor breve en Cuenta; aceptación en ReviewSheet y ReplyDialog; migrar lectura panel a staffRPC y conectar cola/decisión de respuesta. Ligar API/resultados/cache a actor, purgar/reconciliar notificaciones UGC y no reutilizar contenido global como vista personalizada. Incrementar buster o descartar caché anterior antes de considerar bloqueo efectivo en cliente compatible, sin borrar avisos transaccionales; probar A/B/invitado y cambios en vuelo. Mantener diseño y controles comerciales. El editor/lectura operativa acotada actual devuelve hasta100 filas; adaptar filtros/paginación necesarios para conservar las funciones actuales antes de activar.

## Secuencia exacta previa a cualquier despliegue

1. Terminar y probar bloque2 app/panel y transición de clientes antiguos; no activar servidor antes de editores/aceptación/lectura compatibles. Vc3 permanece candidato anterior, no recompilar aquí.
2. Preflight READ ONLY futuro del único proyecto Marketplace: confirmar identidad/base, ausencia de schema/versión UGC, hashes de product_reviews/store_profile/policies/ACL y compatibilidad de cierre. Contar avisos system+review_id que se sanearían, sin divulgar textos privados. Ante deriva, no sobrescribir con funciones antiguas ni ejecutar la plantilla.
3. Preparar delta exacto migración+activación+tratamiento de avisos y ACL, revisar antes y después y pedir aprobación específica hospedada. Esta tanda no la da.
4. Tras esa aprobación: una aplicación transaccional revisada/registrada y verificación independiente por lectura, con clientes compatibles coordinados. No publicar HEAD principal. Rollback debe preservar denuncias/bloqueos/aceptaciones; no reabrir rawSELECT ni desactivar consentimiento como atajo.
5. Sólo otra tanda autorizada genera AAB/prueba física/Play. No se garantiza aceptación Google. Sin servicios nuevos o cargos, sin resets de cuota.

Fuente recuperable `207c489e198f2c78035526c3c95be5cd8f8c4ea7`, árbol `1cf89fc9666fcb3b839bfabb161636e10b3dc7eb`, aislado sobre39ff. Evidencia local: `/Users/brandeastudio/.codex/worktrees/mayami-play-privacy/marketplace/.local/ugc-block1-20261109/`. El paquete de entrega incluye patch/bundle incremental desde39ff, migración/activación, tests y recibos filtrados; excluye cluster, claves JWT y configs con secretos. Los procesos locales deben quedar cerrados al terminar.

Paquete verificado: `/Users/brandeastudio/Downloads/Mayami-UGC-Bloque1-Local-2026-11-09/MAYAMI-UGC-Bloque1-Local-2026-11-09.tar.gz`, 110994bytes, SHA256 `73d944cfec553223b18f0f30dd3b55342fec059b7754a0a194ac80c43747303f`. Bundle incremental y37miembros verificados, sin JWT/config privada. [Recibo](propuestas/ugc-block1-20261109/DELIVERY_RECEIPT.json). Procesos locales cerrados.
