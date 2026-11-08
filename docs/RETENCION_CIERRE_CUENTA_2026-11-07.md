# Retención mínima del cierre · resultado local · 7 de noviembre de 2026

Preflight remoto posterior completado en sólo lectura: [resultado y ruta de activación](PREFLIGHT_REMOTO_RETENCION_2026-11-07.md). Los permisos y dos guardas iniciales se comprobaron; no se activó el módulo.

**Resueltos los dos resultados locales:** la copia Authaudit gestionada se minimiza y caduca; el recibo verificado vence a90×24h sin revivir acceso ni perder replay. El worker ya termina `completed` cuando sólo quedan registros de seguridad necesarios bajo política/hold específico. No se exige borrar absolutamente todo para completar el cierre. No se certifica aceptación Play ni borrado de logs externos/backups.

Fuente aislada desde34ecd9ae; checkpoints1badf958 yb541520c. Ninguna activación de producción, cuenta real, publicación, UI/matriz/emulador/build, Google/correos/cuotas, cambio de importes o gasto. Se reutilizó el clon mayami_account_close_20261107 y sus cuatro servicios; PG compartido no se reinició.

## Qué cambió

Migración20261107221337, creada con CLI y aplicada transaccionalmente sólo al clon. Guarda los cinco cuerpos esperados del módulo anterior. No crea tablas/funciones/índices en Auth, no cambia roles/grants de Auth ni toca schema_migrations/storage.migrations. Todas las estructuras nuevas son account_private; Auth recibe sólo trigger INSERT admitido y DML acotado de su copia opcional de auditoría.

- Después de Auth API y limpieza diaria verificadas, se minimizan eventos conocidos de un único sujeto cerrado. Se retiran actor_name, actor_username, correo, teléfono e IP innecesarios; se conservan acción, tipo, fecha, proveedor y UID seudónimo mínimo. No se afirma anonimato.
- Cada fila gestionada queda ligada a su ID, sujeto/hash, huella de contenido y fecha original+2160h. No se renueva su plazo al reintentar. Filas mixtas/desconocidas y huellas alteradas requieren clasificación y no se borran automáticamente. La comprobación revisa tanto las filas vinculadas actuales como todos los IDs ya registrados para ese sujeto; remapear un UID no evade la huella.
- Lotes de500 excluyen antes del límite lo ya verificado y lo que no puede clasificarse. El reintento avanza. El INSERT de Auth posterior al cierre se trata también sin exigir JWT al escritor SQL; user_deleted, emitido antes de soft-delete, queda cubierto por el barrido posterior a la API.
- Holds concretos sólo por auditID exacto o recibo, con motivo permitido, caso y vencimiento finito. No hay hold real creado ni obligación legal inventada: las pruebas usan casos sintéticos. case_id es una referencia que un operador autorizado debe justificar fuera de este módulo; SQL verifica estructura y vencimiento, no su legitimidad jurídica automáticamente. Un registro necesario bajo hold válido puede permanecer y no bloquea por sí solo `completed`; sólo impide la caducidad de su ámbito.
- El recibo close_jobs y su solicitud completed se eliminan a partir de finished_at+2160h, sólo si están verificados y sin hold de recibo/clasificación pendiente. Failed/processing/retention_pending conservan el trabajo y el reintento. Holds y elegibilidad se filtran antes del límite para evitar atascar la cola.
- Al purgar el recibo se conserva un marcador mínimo separado SHA256(sujeto), SHA256(solicitud), closed_at: revocación activa e identidad terminal de replay. Sigue siendo dato seudónimo, no un log de eventos. session_open bloquea job **o** marcador; aprobación/claim/finish reconocen un replay aun sin las filas del recibo. No se recrean recibos caducados.

El marcador se conserva mientras ese UID sea un sujeto revocado que no debe reutilizarse; se revisa al cambiar el ciclo de vida Auth/issuer o el mecanismo de revocación. No hereda diez años ni se presenta como auditoría con retención indefinida. Esta tanda no activa una eliminación periódica del marcador que pudiera reabrir sesiones.

## Verificación ejecutada

Un test Deno focal ampliado, con GoTrue JWT por password grant real, Storage API/bytes reales y SQL local guardado por nombre/host/puerto. El reloj adelantado es un parámetro privado; no se cambió el reloj global y las peticiones posteriores usan el mismo JWT emitido segundos antes.

| Caso | Resultado |
|---|---|
| Fallo Storage y reintento; diez ámbitos diarios y cuatro avatars | PASS. Auth DELETE una vez para el sujeto principal; JWT antiguo denegado tras fallo y reintento; cero bytes/datos diarios y control intacto. |
|501 eventos raw, batch500 y holduser_deleted específico | PASS. Primer lote pendiente; siguiente termina completed sin repetir Auth. Cero filas personales inesperadas fuera del hold exacto; huella del hold intacta. |
| INSERT futuro con supabase_auth_admin sin claims | PASS, minimizado. **Ese rol local es superusuario**: prueba el contexto sin JWT, no acredita permisos/RLS hospedados. |
| Fila registrada remapeada A→B, rollback | Readiness deA false; GC no elimina su recibo. Scope/fingerprint protegido, caso totalmente revertido. |
| Antes90d; llegada90d con holds; fin de cada hold | Sin cambios antes. A90d purga504 auditorías no retenidas; mantiene una específica. Al vencer ese hold purga1; al vencer el hold de recibo purga éste y solicitud, conserva marcador1. Repetición sin cambios. |
| Recibo separado **sin hold**, frontera exacta | Presente a90d−1µs; eliminado exactamente a90×24h; marcador1, replaycompleted y JWT antiguo aún403 en perfil/RPC,400 en Storage. |
| Marcador independiente de Auth.deleted_at | Fixture activo de control denegado con marcador transitorio; rollback restaura todo. No se modificó Auth.users para simularlo. |
| Trabajo failed envejecido / ACL reloj privado | Sigue con su reintento; buyer no ejecuta el job ni elige reloj. |
| Ejecutor público realclock con service_role porHTTP |200 y contadores0, manual/idempotente. **No programado**. |
| Regresión focal admin/privilegios |11/11 PASS; Deno check/test PASS. No matrices UI ni suites financieras repetidas. |
| Preservación |18/18 tablas idénticas por hash:16 protegidas de negocio y dos tablas de migraciones del proveedor. |

Último test:1/1 PASS,2s; dos sujetos cerrados (uno con holds y otro sin hold), un control y un administrador. Una eliminación Auth por cada sujeto. El primer pase con holds ya pasó; se añadió el borde exacto sin hold y se corrigió una inferencia literal TypeScript del contador, sin desactivar comprobaciones. P1/remap y P2/batch surgieron en revisión independiente y se corrigieron antes de aplicar SQL. Los recibos previos se conservaron.

Evidencia: `/Users/brandeastudio/marketplace/.local/account-retention-20261107/acceptance-results.json` y copia fija reviewed-acceptance-results.json, SHA256086668504e9dc4661683116e13f1289022d893a96ddeb7a57fc5c18054d30b80; acceptance-summary.json, manual-executor.json, protected-preservation.json, migration-apply.log y local-preflight.json. Revisiones/primarias en esa misma carpeta ignorada. Credenciales sólo en el archivo privado local preexistente, sin valores en recibos o repositorio.

Reproducción: mismo comando de aceptación anterior, añadiendo `MAYAMI_ACCOUNT_RETENTION_TEST_REPORT=/ruta/ignorada/recibo-nuevo.json`, su carpeta a allow-read/write y la variable a allow-env. El test rechaza sobrescribir un recibo existente. Archivo: supabase/functions/tests/account-close.acceptance.ts. No ejecutar contra otra base ni copiar valores privados a logs.

## Límite externo y activación separada

[Supabase distingue logs externos de la copia opcional Postgres](https://supabase.com/docs/guides/auth/audit-logs). GoTrue2.180 emite el evento externo **antes** de escribir SQL: nuestro trigger/barrido no lo modifica. [El changelog permite triggers/RLS sobre audit_log_entries y restringe cambios estructurales](https://supabase.com/changelog/34270-restricting-access-on-auth-storage-and-realtime-schemas-on-april-21-2025); no garantiza nuestros permisos concretos alojados.

[La ventana de logs depende del plan](https://supabase.com/docs/guides/observability/logs); [el marco del proveedor distingue base, backups y telemetría](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq). Ninguna de esas páginas prueba aquí un plazo físico individual para los logs externos o backups de Marketplace. Tampoco apagar «Write audit logs to the database» purga datos históricos. La retención necesaria por seguridad, explicada claramente, no implica por sí sola rechazo de Play; [su política admite esos fines legítimos](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en).

**Paso exacto restante, sin ejecutarlo en esta tanda:**

1. Con conexión autorizada e identidad de Marketplace/mimnotafmfasvwrclxan confirmada fuera de SQL, ejecutar sólo `tools/supabase-remote/account-retention-preflight.sql`. Verificar owner/DML/TRIGGER y contexto real de Auth; no elevar roles ni asumir los permisos del superusuario local. Resolver cualquier diferencia antes de activar.
2. Confirmar para ese proyecto/plan con Supabase el plazo efectivo, minimización/eliminación y restauración de logs externos/backups con email/UID de usuarios eliminados. Conservar la respuesta y reflejar el límite real en privacidad; no enviar mensajes o solicitudes al proveedor automáticamente. No elegir un plan con cargos.
3. En una activación posterior autorizada y desde fuente aislada compatible: migraciones previas del cierre+esta, worker y guard de petición; publicar el texto de retención preciso. Configurar un ejecutor confiable que llame `select public.account_retention_run(100);` (o RPCservice equivalente) con reloj real, observar sus ejecuciones/cola/errores y probar el vencimiento. No usar el helper de reloj privado. El cron local no está instalado y ningún job se creó: el mecanismo está probado manualmente, **no hay purga automática activa**.

No abrir otra auditoría general ni cambiar pagos/importes/expectativas para este resultado. No desplegar el HEAD compartido, que conserva Google/cuotas y trabajo paralelo. El estado local completed significa limpieza verificada del ámbito gestionado y política de seguridad aplicada; no afirma que hayan desaparecido todos los logs/backups del proveedor.
