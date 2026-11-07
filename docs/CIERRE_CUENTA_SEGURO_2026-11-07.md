# Cierre seguro de cuenta · módulo local · 7 de noviembre de 2026

Alcance: solicitud, aprobación, limpieza verificable de cuenta simple y bloqueo de autorizaciones anteriores. Base de fuente 92f75a0d, sin código de cuotas o Google/correos. Prohibido en esta tanda: producción, cuentas reales, migraciones remotas, configuración de accesos, correo real, web/OTA/Play o AAB/APK.

Se reutilizan el diagnóstico y la retención propuesta. La clasificación comercial no equivale a una purga implementada ni a justificar todos los datos durante diez años. Para conservar seguridad y límites, el módulo mínimo sólo finalizará cuentas sin historia/documentos comerciales pendientes de clasificación. No se modificarán importes, obligaciones, ledger o historia financiera.

Primer checkpoint: worker account-close preparado y sin enlazar, Deno check aprobado. Usa las credenciales de servidor existentes del entorno, nunca del navegador; las pruebas reutilizan exclusivamente el mecanismo local existente. Todavía no se aplicó un cambio de funciones de negocio al clon.

Baseline de aceptación rojo probado con servicios reales locales: Auth GoTrue, PostgREST y Storage API oficial v1.34.0 con backend de archivos. En mayami_account_close_20261107 el JWT del comprador posterior a completed todavía lee perfil, modifica nombre y descarga/sube bytes de avatar; tres aserciones de aceptación fallan. Recibos en .local/account-close-20261107, sin tokens en documentación.

Pendiente: migración propuesta con estados/recibos, RLS y entradas RPC; finalización de Auth mediante su API; eliminación de bytes mediante Storage API; pruebas verdes de autorización, reintento y fallo parcial; revisión independiente puntual. No se declara listo Play ni eliminación completa.

Segundo checkpoint: migración propuesta creada con CLI y worker actualizado. Aprobación separada de finalización, recibo privado sin PII, bloqueo previo de sesión en RPC/RLS/Storage y reintento por lease. La revisión focal detectó referencias de antiguos operadores: se mantienen como clasificación pendiente, sin borrar sus registros. Auth soft-delete se ejecutará antes de Storage para retirar credenciales aun ante un fallo posterior. Su API deja auditoría con correo original: la finalización permanecerá retention_pending si ese residuo no tiene clasificación; no se modifican tablas de auditoría del proveedor. Aún no se aplicó la migración de negocio ni se declaró aceptación verde.
