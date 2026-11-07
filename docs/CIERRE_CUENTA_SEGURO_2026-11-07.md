# Cierre seguro de cuenta · entrega mínima local · 7 de noviembre de 2026

Se terminó el módulo local de bloqueo y limpieza verificable de cuentas simples. **No está activado en producción ni acredita eliminación integral o aceptación de Google Play.** El resultado real final es `in_review / retention_pending`: Auth conserva el correo original en su auditoría y su plazo/mecanismo de minimización no están resueltos. No se modificaron tablas internas de Auth para fabricar un resultado.

La fuente se conserva aislada desde 92f75a0d, con checkpoints e0c665a7 y f4c2f22d; Google/correos y cuotas permanecen en sus fuentes separadas. La rama compartida conserva esos cambios paralelos. No desplegar su HEAD combinado.

## Comportamiento implementado

- La aprobación del operador instala un marcador de cierre; no equivale a terminar la eliminación. Pedidos abiertos y permisos de personal mantienen sus rechazos anteriores **antes** de crear el marcador. Historia comercial, documentos o referencias de antiguos operadores sin clasificar quedan pendientes y no entran al limpiador.
- El marcador bloquea el JWT antiguo en RPC, RLS directo y Storage. Un gate de transacción ordena operaciones en curso antes de aprobar; los escritores posteriores no pueden repoblar los datos. El pre-request de PostgREST se configuró sólo en el proceso local; no se cambió ningún rol global.
- Worker `account-close` autorizado por JWT de administrador; los RPC de limpieza sólo admiten service_role y lease vigente. Credenciales de servidor nunca llegan al panel. Auth Admin soft-delete retira credenciales/metadata/sesiones mediante su API y conserva un UID/tombstone seudónimo; no se afirma eliminación física de todas las filas de identidad.
- Storage elimina y verifica los bytes por su API oficial. Diez ámbitos diarios: direcciones, favoritos, carrito, alertas, actividad, recomendaciones, tokens push, notificaciones y dos journals privados; también limpia perfil/preferencias y texto de la solicitud. No borra historia comercial ni modifica cálculos de dinero.
- El recibo privado sólo contiene UID/ID de solicitud, fase, lease, intentos, códigos estables y fechas; no copia correo, notas ni respuestas de proveedor. `completed` requiere comprobación de Auth, Storage y datos; INSERT/UPDATE directo no puede simularlo y no se puede retirar un recibo aprobado. Fallos y reintentos no reabren la cuenta.
- Panel enlazado localmente al worker, sin retorno al procesador antiguo si falta la capacidad. Distingue proceso, interrupción, retención pendiente y cierre verificado. Un `completed` antiguo sin recibo se muestra «Cierre anterior sin verificar»; este módulo no recertifica esas solicitudes antiguas. Resultado pendiente visible como aviso persistente, sin mensaje de éxito.

## Evidencia ejecutada

Clon exclusivo `mayami_account_close_20261107`, PG17 en 127.0.0.1:55437; Auth GoTrue2.180, PostgREST y Storage oficial1.34 con backend real de archivos. Usuarios sintéticos example.com, JWT emitidos por password grant real. Ninguna cuenta, compra, transferencia o correo reales.

| Comprobación | Resultado |
|---|---|
| Baseline anterior, antes de cambiar negocio | **RED**, tres aserciones estrictas fallan: perfil legible, escritura persistente y lectura/subida de avatar tras `completed`. Sin `.skip`/`.fails`. |
| Aceptación nueva, Auth/REST/Storage reales | **1/1 PASS**, tres invariantes anteriores verdes; cuatro avatars por SHA y diez ámbitos diarios cargados. JWT antiguo no lee/escribe tras fallo ni reintento; otro actor conserva sus datos. |
| Fallo de Storage inyectado una sola vez | `failed`, archivos todavía presentes pero JWT antiguo denegado; Auth ya retirado. Retry elimina filas y bytes, Auth DELETE total **1**; termina pendiente por auditoría real. |
| SQL focal con rollback | PASS: anon/buyer no ejecutan seis RPC service-only, no aprobación por buyer, no false completed, staff/pedido abierto rechazados, historia cancelada retenida antes de limpiar, lease incorrecto/expirado y segundo worker rechazados, Auth vivo no finaliza. |
| Concurrencia, dos conexiones + observador | PASS: aprobación espera shared gate, no retiene anticipadamente la fila de solicitud; al liberar avanza. Rollback conserva Auth/perfil/solicitud y no deja job. |
| Admin tools y privilegios | **11/11 PASS**. ACL/owner de las170 funciones preexistentes conservados;24 cuerpos cambian sólo para el gate/flujo de cierre. Se corrigió search_path de require_user. Allowlist reconoce dos entradas nuevas y el favorites_merge_intent ya instalado. |
| Panel unitarias / tipos / lint / Deno | **67/67 PASS**, tipos/lint admin y Deno check aprobados. |
| Panel focal, Chrome local390px, claro/oscuro | Dos recorridos finales PASS, worker real por puente HTTP local55456; pendiente sin éxito falso, sin error JS ni overflow horizontal de página. Cuatro PNG sin retocar y revisión independiente. No prueba nativa ni Edge runtime hospedado. |
| Protección financiera durante cierre | **16/16 tablas idénticas por hash** antes de migrar → después de aceptación de cierre, antes de ejecutar regresiones financieras separadas. No transacciones reales. |

Regresiones adicionales: checkout9/9, acceso vendedor4/4, acciones vendedor3/3, pagos12/14. Los dos fallos de pagos se reproducen con iguales valores en un clon **sin** el módulo (20→16,67 USD; USDT33,36/1,001→27,77/0,83333333). No se corrigieron expectativas ni importes ajenos a este alcance. La suite favorites-merge-intent no comenzó porque su guard de nombre no admite este clon; no se debilitó. No declarar todas las suites verdes.

Esas pruebas financieras crean fixtures y alteran tasas/políticas locales; el contraste final encontró14/16 tablas con todas las filas originales idénticas y diferencias sólo en exchange_rates/rate_policies causadas por esos tests (payments.test.ts actualiza observed_at/max_age_minutes). Se conservan ambas mediciones: no atribuir el estado posterior de esas fixtures al limpiador ni afirmar que toda la base final está idéntica.

Primer pase real sólo tenía perfil/archivos. Se amplió a diez ámbitos; un fixture falló por array vacío no permitido en merge_journal, se corrigió con un producto local y el pase final pasó. El primer PASS y el fallo de fixture se conservaron. La captura inicial de aviso oscuro mostró texto detrás de una superficie translúcida: se cambió únicamente el resultado pendiente de esta pantalla a aviso persistente y se repitió el foco visual.

## Retención pendiente y límites

[Google Play permite retener datos necesarios por seguridad, fraude u obligación normativa si se informa claramente](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en), sin sustituir eliminación por congelación. [Supabase documenta auditoría externa y escritura opcional en auth.audit_log_entries](https://supabase.com/docs/guides/auth/audit-logs); su interruptor no acredita un TTL de filas existentes. No se comprobó un plazo real para esa tabla ni la configuración alojada y no se alteró.

Decisión de producto: sin conservación adicional de datos diarios una vez verificado el cierre;90 días para justificante mínimo/consultas no mercantiles y registro mínimo de seguridad, con finalidad real;10 años sólo para archivo mercantil necesario según clasificación. Un email original en auditoría no se vuelve necesario por pertenecer a esa tabla. Falta demostrar minimización y vencimiento efectivo del residuo del proveedor y del recibo; no se promete una purga automática implementada. [Decisión y alcance](PLAY_DATOS_RETENCION_2026-11-07.md).

La aceptación cubre una cuenta simple y fallo/retry de Storage. No prueba todos los proveedores de identidad, cargas simultáneas masivas, links de archivo firmados previamente durante un fallo, expiración de backups, todos los expedientes comerciales o corrección de cierres legacy. Las URLs firmadas antiguas no se declaran revocadas antes de eliminar físicamente el archivo. Un fallo mantiene la solicitud abierta.

## Reproducción y relevo

- Aceptación: `MAYAMI_ACCOUNT_CLOSE_TEST_CONFIG=/ruta/privada/api.private.json pnpm exec deno test --allow-env=MAYAMI_ACCOUNT_CLOSE_TEST_CONFIG --allow-read=/ruta/privada --allow-write=/ruta/privada --allow-run=/opt/homebrew/bin/psql --allow-net=127.0.0.1:55455 supabase/functions/tests/account-close.acceptance.ts`. La configuración debe declarar localOnly y el clon exacto; nunca imprimir claves. El recibo no se sobrescribe: archivarlo antes de un nuevo ensayo intencional.
- Concurrencia: `node tools/local-stack/account-close-concurrency.mjs /ruta/ignorada/input-local.json`. SQL complementario: `psql ... -v buyer_uuid=UUID -v admin_uuid=UUID -v request_uuid=UUID -f tools/local-stack/account-close-rollback.sql`. Requiere solicitud de fixture activa creada por API; termina con rollback. No ejecutar en otra base.
- Evidencia persistente ignorada: `/Users/brandeastudio/marketplace/.local/account-close-20261107`: baseline-red-results.json, real-worker-acceptance-results.json, finance-preservation.json, finance-original-rows-final.json, function-delta.json, sql-focal-final-results.log, proposals/sql-checks/concurrency-results.json, panel-focus-results.json y captures. Revisiones independientes bajo `.local/play-privacy-20261107/account-close` y captures/VISUAL_REVIEW.md. Archivos private de acceso separados0600, sin valores en recibos.
- Próxima decisión técnica exacta: resolver finalidad/minimización/plazo aplicable a la auditoría Auth y al recibo sin atajos sobre esquemas internos, y clasificar por separado campos/documentos comerciales. Hasta entonces conservar pending; no ampliar este módulo ni seguir ensayando infraestructura sin una hipótesis concreta.
- Antes de cualquier activación futura: revisar versión/esquema Auth, fuente aislada y baselineMD5, migración única, worker y pre-request equivalente. Ninguna activación fue autorizada en esta tanda. No publicar HEAD combinado, web/OTA/Play, AAB/APK ni alterar firma/paquete/cuentas. No servicios con cargos.
