# Primera migración de seguridad aplicada

7nov2026. Sólo `20261107213544_account_closure_receipts.sql` aplicada en Marketplace/mimnotafmfasvwrclxan, main/Production, mediante la sesión legítima autorizada. **COMMIT confirmado por una transacción independiente de sólo lectura.** Fuente backend `881765ffc6f2dac1f3e98c3171b2284840671f28`; SHA256 del archivo exacto `33930eebc24b882f4fffc0642ae6fbe7c7555e265aad99e71b00d10293e2b58e`. La autorización humana y sus exclusiones se conservan en el recibo local.

## Prerrequisitos resueltos

`supautils` está cargada por `session_preload_libraries`. Su concesión administrada existente permite a postgres gestionar políticas de storage.objects; GUC registrado SIGHUP, origen configuration file, sin pending_restart. No se cambiaron propietarios, membresías o concesiones para obtener esa facultad. La ausencia de MEMBER/USAGE/SET del propietario sólo describía ownership ordinario; no descartaba esta facultad oficial de Supabase. La creación de la política y su persistencia quedaron confirmadas en esta ejecución.

**Sin hook configurado según la comprobación oficial de Supabase administrado.** La lectura de pg_db_role_setting de authenticator/base actual no contiene pgrst.db_pre_request con nombre, conforme al paso1 de [la guía oficial](https://supabase.com/docs/guides/api/query-plans#production-use-with-pre-request-protection). La revisión adicional del entorno se reserva allí a self-hosted. No se afirma un dump de todo el proceso ni se registra/cambia un hook. Marketplace es administrado.

Guardas frescas: misma metadata canónica `7255d3dc608f1b0193764d1aad57001e` de67tablas/23funciones, dos cuerpos legacy exactos, módulo/versiones ausentes y facultad TRIGGER Storage presente. Sin deriva respecto del preflight aprobado.

## Ejecución e integridad

Un solo intento y una sola transacción con lock_timeout5s y statement_timeout120s; locks ordenados, snapshots y aserciones antes del único COMMIT. Batch revisado independientemente de42423bytes, SHA256 `f345d4d9c67f76da93a20b8eeb44cbc2b5ec4bdc4bee35d7073e63ca5ed410da`. El contenido real del editor se copió y cotejó por SHA antes de ejecutar; contiene el archivo autorizado sin modificaciones, una sola vez.

Pasaron antes del commit:

- 67políticas restrictivas authenticated con destino/expresión exactos;67triggers por sentencia y un trigger de finalización.
- 23funciones DEFINER existentes según reemplazo previsto:22wrappers y process_account_deletion explícito;8STABLE→VOLATILE. require_user comprobado por separado. Los dos reemplazos explícitos fijan search_path pg_catalog según fuente; el resto conserva su configuración.
- Owners, ACL, RLS, políticas, triggers y columnas previos conservados; Storage mantiene owner supabase_storage_admin y sus ACL reales. Atributos/cuerpos de las demás funciones existentes conservados.
- Huellas de solicitudes de eliminación e historial de migraciones previos idénticas; cero trabajos de cierre. No se invocó ninguna función de cierre/limpieza ni se borró historia comercial. Esto no es un nuevo ensayo de compras/pagos ni un fingerprint de todas sus filas.

El editor mostró advertencias genéricas por DDL/cuerpos con DELETE y tablas temporales. Se ejecutó el SQL revisado sin añadir automáticamente RLS a los snapshots temporales ON COMMIT DROP. La tabla permanente close_jobs habilita RLS explícitamente; la lectura posterior lo confirma. No se deshabilitó RLS existente.

Registro estándar añadido: una fila nueva de schema_migrations, versión20261107213544, nombre account_closure_receipts, statements=ARRAY[] deliberado. No se afirma guardar el DDL allí: su procedencia está fijada en los archivos/recibos SHA. Cada fila previa del historial se conservó.

## Confirmación independiente y límites

[Lectura posterior](https://supabase.com/dashboard/project/mimnotafmfasvwrclxan/sql/fa07e448-512d-4400-bbde-f516346b56f5): read_only=true; versión exacta registrada una vez; módulo presente;67targets/67policies/67statement triggers/1completion;22wrappers; processMD5 `379bf3640c4a4b9b913bd122c94ff1d6`, require_userMD5 `03b48aa32e343e8f52465e4e66a10e4f`; close_jobs=0 y RLS=true; segunda versión y ejecutor ausentes; hook sin configurar según el alcance anterior. La fila SELECT del batch anterior no se usó sola para declarar confirmado el commit.

**No está activa la eliminación completa ni la retención automática de90d.** Quedan fuera de esta autorización segunda migración, worker account-close, configurar hook, Cron, purga, aprobar cierres, fixtures, publicación web/panel/OTA/APK/Play, Google/correos/cuotas y cargos. Free conservado. Frontend candidato da9085c no publicado; no presentar el módulo parcial como aceptación Play.

Evidencia local: `/Users/brandeastudio/marketplace/.local/account-first-activation-20261107/`: AUTORIZACION_Y_ALCANCE.md, FRESH_GUARDS_READONLY.json, activation.proposed.sql/PRE/POST, INDEPENDENT_REVIEW.md, EXECUTION_ATTEMPT.json, PRECOMMIT_ASSERTIONS_RESULT.json y COMMIT_RECONCILIATION_READONLY.json. [Batch ejecutado](https://supabase.com/dashboard/project/mimnotafmfasvwrclxan/sql/4e48a34b-145c-4573-bb92-c6d96fcf06b4). Próxima etapa requiere alcance separado; no repetir esta migración.
