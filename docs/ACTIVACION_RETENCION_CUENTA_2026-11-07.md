# Segunda migración instalada y commit confirmado

Sólo `20261107221337_account_retention_minimum.sql` aplicada una vez en Marketplace/mimnotafmfasvwrclxan, main/Production, mediante la sesión legítima y aprobación específica de Oliver. Primera migración no repetida. Fuente backend `881765ffc6f2dac1f3e98c3171b2284840671f28`; SHA256 exacto `2b013119ddd074ed14c2758e5ca6a1aecd351394d370c246b89e74407abfd916`.

## Ejecución acotada

Guardas refrescadas:5/5 cuerpos coincidentes, segunda versión/objetos/trigger ausentes, facultades existentes presentes y0jobs/elegibles. Sin cambios de owner/grants para obtener acceso, ni reapertura del diagnóstico resuelto de Supabase administrado/supautils.

Revisión focal independiente del batch de43532bytes, SHA256 `8164d966268fa75b06530451dd7e5772e0aca33c23187900a655bd63a867efc1`. Fuente autorizada íntegra una vez; contenido real del editor cotejado por SHA. Un intento, una transacción, lock_timeout5s/statement_timeout120s. Antes del COMMIT pasaron controles de:

- Tres tablas privadas RLS,17funciones nuevas con cuerpos/atributos/ACL esperados:15helpers sin acceso de roles API y2RPC sólo service_role;5reemplazos existentes;2índices; trigger Auth BEFORE INSERT ROW/tgtype7 y EXECUTE del creador.
- Owners/ACL/RLS y triggers previos de Auth, funciones no modificadas y67policies/triggers de primera etapa conservados. Las cinco funciones previstas conservan atributos/ACL; sólo cambia su cuerpo autorizado.
- Solicitudes e historial de migraciones conservados. Huellas de id/xmin/ctid de auditoría y solicitudes visibles al caller idénticas, sin leer payload, IP, correo ni contenido personal. Jobs y tres tablas nuevas vacíos; ninguna llamada de procesamiento.

Sólo se añadió la nueva fila estándar de versión20261107221337/nameaccount_retention_minimum, statements=ARRAY[] deliberado; no se afirma guardar el DDL allí. Fuente y batch quedan fijados por SHA en los recibos. El aviso genérico del editor sobre RLS corresponde también a snapshots TEMP ON COMMIT DROP; se preservó el SQL exacto sin auto-inyectar cambios. Las tres tablas permanentes habilitan RLS explícitamente y se verificaron.

## Confirmación independiente

[Lectura READ ONLY posterior](https://supabase.com/dashboard/project/mimnotafmfasvwrclxan/sql/e6309515-ef47-4e09-9862-df1bd78e5d16): ambas versiones registradas una vez;17cuerpos/atributos y17ACL coincidentes;5guardas finales;3tablas RLS/ACL;2índices válidos; trigger exacto/creatorEXECUTE;67policies y67triggers previos; jobs=markers=holds=managed_audit=0. Owner de auditoría sigue supabase_auth_admin. Esto confirma COMMIT; no se infirió del SELECT previo al commit.

**El trigger está instalado y activo para INSERT futuros elegibles.** Instalar no ejecutó minimización histórica ni purgas. El ejecutor está instalado, pero no se llamó ni se programó. No se desplegó el worker ni se aprobaron cierres o generaron eventos/cuentas de prueba. Tampoco se cambiaron hook/planes, publicaron frontends/OTA/APK/Play, tocaron Google/correos/cuotas o incurrió en cargos. Free conservado. No se repitieron suites locales cerradas.

No se acredita funcionamiento de un cierre real ni ejecución del trigger con un evento hospedado elegible; esas pruebas no estaban autorizadas. Un error futuro del trigger puede afectar escrituras Auth, riesgo aceptado expresamente para esta instalación. No desinstalar borrando marcadores/recibos, ni asumir que retirar el DDL recupera campos posteriormente minimizados. Logs externos/backups y plazos físicos individuales permanecen fuera de esta comprobación. La retención periódica de90d todavía no está operativa y el frontendda9085c sigue candidato, sin publicar estos textos.

Evidencia local: `/Users/brandeastudio/marketplace/.local/account-second-activation-20261107/`: AUTORIZACION.md, FRESH_READONLY_RECEIPT.json, activation.proposed.sql/PRE/POST, INDEPENDENT_REVIEW.md, EXECUTION_ATTEMPT.json, PRECOMMIT_RESULT.json y COMMIT_RECONCILIATION_READONLY.json. [Batch ejecutado](https://supabase.com/dashboard/project/mimnotafmfasvwrclxan/sql/7906aa00-746a-4451-851b-3e8127788186). Próxima etapa requiere alcance y aprobación separados; no repetir ninguna de las dos migraciones.
