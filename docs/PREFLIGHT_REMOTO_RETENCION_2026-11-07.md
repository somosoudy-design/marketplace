# Preflight remoto de retención · sólo lectura · 7 de noviembre de 2026

**PASS de acceso, baseline y metadata de permisos. Nada activado.** Se usó la sesión legítima de la cuenta indicada por Oliver, confirmada en el navegador integrado; organización Marketplace/lspwtzxmraagilwwnqrl, proyecto Marketplace/mimnotafmfasvwrclxan, rama main/Production. Free visible. No CLI de otra cuenta, conector denegado, extracción de credenciales, proyecto bfuggvbgttvcygbexqyn o mecanismos de evasión.

Se ejecutó `tools/supabase-remote/account-retention-preflight.sql` de la fuente881765ff y un único complemento de metadata, ambos `BEGIN READ ONLY; SELECT…; COMMIT;`. El complemento confirmó `transaction_read_only=on`. Se preservó el borrador anterior y se usaron dos borradores independientes. No se consultó contenido de filas de usuarios, ni hubo DDL/DML/grants, cambios de Auth/Cron/plan, fixtures remotas, contacto con soporte o publicación.

## Resultado observado

| Metadata | Resultado |
|---|---|
| process_account_deletion prosrcMD5 | a6be40bcca9a00f70005d89a08190c5a, coincide con guarda inicial |
| require_user prosrcMD5 | 56adbdbd37b826bef6af16e891b1eddd, coincide con guarda inicial |
| Rol de sesión/efectivo | postgres/postgres |
| Owner auth.audit_log_entries | supabase_auth_admin; diferencia del ownerpostgres local |
| Auth writer | superuser=false, bypass_rls=false; en local era superusuario |
| RLS/forceRLS auditoría | true/false. El propietario puede omitir RLS por propiedad; BYPASSRLS=false no prueba que RLS se aplique a ese escritor |
| Privilegios caller sobre auditoría | SELECT, UPDATE, DELETE y TRIGGER: true. Sólo consultados; no usados para escribir. |
| Columnas auditoría | instance_id UUID, id UUID no nulo, payload JSON, created_at timestamptz, ip_address varchar no nulo; coinciden con el contrato local |
| PostgreSQL/SHA256 | server_version_num170011; sha256(bytea) disponible |
| Dependencias | checkout_private, favorites_private, authoring_private y las siete tablas Auth consultadas, incluidas OAuth, presentes |
| Migraciones cierre/retención |20261107213544 y20261107221337 no registradas |
| Ejecutor | public.account_retention_run inexistente |
| Cron | pg_cron instalado;0jobs visibles para este caller cuyos comandos referencien account_retention_run/account_close_expire_receipts. No se volcaron comandos ni secretos. No prueba ausencia de otros jobs o retenciones. |

Los permisos de metadata resuelven la duda inicial de acceso/DML/TRIGGER del caller, sin probar una ejecución real del trigger/worker hospedado. No se ejercitó escritura para demostrarla, por el alcance de esta tanda. Las guardas posteriores a la primera migración todavía no pueden compararse en remoto: se verificarán entre archivos, sin cambiar sus valores.

Consultas visibles: [preflight](https://supabase.com/dashboard/project/mimnotafmfasvwrclxan/sql/5bdabac6-54d9-427b-b98a-1bd534299295) y [complemento](https://supabase.com/dashboard/project/mimnotafmfasvwrclxan/sql/3372d189-eeca-43ae-bd8a-c8673642c2c1). Recibo local sin datos de usuarios ni credenciales: `/Users/brandeastudio/marketplace/.local/account-retention-preflight-20261107/REMOTE_PREFLIGHT_EVIDENCE.json`, con resultados JSON separados y propuesta ACTIVATION_PATH.md.

## Plan, logs y backups realmente visibles

- Plan de la organización: **Free**. No se cambió el plan ni se abrió un checkout.
- [Scheduled backups](https://supabase.com/dashboard/project/mimnotafmfasvwrclxan/database/backups/scheduled): la pantalla indica que Free no incluye los backups de proyecto ofrecidos allí; ofrece Pro con hasta7d de backups programados. No se restauró, descargó o activó nada. Esto **no prueba** que el proveedor carezca de copias internas, backups de seguridad u otra retención física.
- [Logs](https://supabase.com/dashboard/project/mimnotafmfasvwrclxan/logs): sólo se recopilaron controles, sin copiar/exportar mensajes. Rango seleccionado60min; menú con10/30/60min,3h,24h,7/14/28d. Son opciones de filtro, **no prueba de ventana efectiva del plan ni del plazo de eliminación física**. No se afirmó que28d estén disponibles en Free.
- No quedó visible una garantía específica de borrado físico de usuarios, logs externos o backups. Su confirmación sigue pendiente; no se deduce de la tabla de precios o del selector.

## Ruta mínima de activación posterior

Base de backend aprobada localmente: **881765ffc6f2dac1f3e98c3171b2284840671f28**. El HEAD compartido contiene otros frentes y no es la fuente a desplegar.

1. **Dos correcciones de preparación, sin implementarlas aquí.** Sincronizar sólo el texto de retención en `apps/storefront/src/data/policies.json` con la política probada, aclarando logs externos y ejecución periódica; la fuente8817 aún conserva copy anterior/sin90d. Fijar el nuevo SHA frontend. Resolver el pin del panel: CI exige request-only y source=HEAD^, por lo que no sirve un request sobre HEAD compartido para señalar8817. Preferir artefacto limpio con hash verificable o un ajuste acotado y revisado del pin, sin forzar historia. No se auditó aquí el texto efectivo que sirve la web vigente.
2. **Backend, en orden y con verificación intermedia.** Aplicar únicamente20261107213544_account_closure_receipts.sql →20261107221337_account_retention_minimum.sql, cada archivo/transacción y registro de versión, conservando baseline/owner/ACL/historial. No dbpush global ni seeds. Las dos guardas iniciales coinciden; los cinco MD5 de la segunda se comprobarán al llegar a su etapa; la primera exige account_private ausente y la segunda closed_subjects ausente. Contrastar el conjunto DEFINER que la primera reescribe, para no asumir que una sola huella cubre todo. Detener ante deriva; no cambiar hashes para forzarla.
3. **Worker/gate, sin tocar Google o correo.** Desplegar sólo account-close e imports `_shared/{env,http,rest}.ts`, con verify_jwt=true y entorno servidor del mismo MIM. Usar el acceso/canal confirmado; no la CLI conectada a yorwinrdiaz. Leer el pre-request actual y conservarlo/encadenarlo al activar account_request_guard mediante un canal soportado. SQL no configura por sí solo ese hook. Verificar capacidades/ACL/rechazos sin aprobar una solicitud real ni crear fixtures remotas.
4. **Frontends desde fuente limpia.** Panel: build/export con KORA_PANEL_EXPORT=1 y PANEL_SOURCE_SHA del pin correcto; comprobar artefacto/rutas/marcador y publicar mediante el canal existente con cuenta/Free verificados en esa activación. Web: build:cloudflare desde el checkout limpio, SSR/WorkersFree/bindings/keep-vars conservados; publicar páginas privacidad/eliminar-cuenta/contacto con el texto preciso. No APK/OTA/Play ni despliegue del checkout principal por accidente.
5. **Retención operativa y límite externo.** Confirmar para MIM/Free el plazo real de logs externos/backups, minimización y restauración, sin contactar soporte automáticamente. Ejecutar el job realclock autorizado `select public.account_retention_run(100);` y sólo después programar/observar frecuencia, cola y errores usando pg_cron ya instalado. No activar helpers de reloj inyectado. Ningún job de este módulo fue creado aquí; la retención automática sigue pendiente de activación y verificación.

No se detectó denegación de acceso ni diferencia incompatible en las guardas/metadata comprobadas. **Pendientes concretos:** textos frontend y pin de publicación, hook previo/conjunto DEFINER a preservar, validación funcional hospedada dentro del alcance que se autorice, plazos externos y programación. Esta entrega es evidencia y ruta; no activa el módulo ni certifica aceptación Play. Google/cuotas/SMTP/templates, importes y expectativas de pagos permanecen fuera.
