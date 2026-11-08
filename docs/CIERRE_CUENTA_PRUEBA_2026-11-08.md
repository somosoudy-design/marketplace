# Cierre hospedado de la cuenta de prueba

8 de noviembre de 2026. Oliver autorizó eliminar únicamente la cuenta de prueba designada y confirmó que había enviado la solicitud desde la APK. Se utilizó el flujo normal del panel oficial, sin aprobación adicional del mismo alcance, atajos de Auth o SQL mutante.

## Resultado confirmado

Una sola solicitud del UID autorizado; identidad, alias y alta exactos cotejados antes de actuar. El preflight oficial de sólo lectura encontró solicitud requested sin job, cero roles/membresías/pedidos/pagos y cero vínculos comerciales en los27 ámbitos consultados. No se escogió otra solicitud.

Un único envío de «Procesar cierre» en https://kora-panel.expo.app/admin/usuarios. Fuente del panel previamente recibida: da9085c00f884f487a2ae4d35aed71a220d553a0, build candidate.da9085c00f88, deployment fzi7bsabfc. El panel mostró «Cierre verificado». No hubo segundo envío, retry, despliegue o modificación del backend.

La lectura posterior filtrada al mismo UID/requestId confirmó:

- Solicitud completed y cleanup_state completed.
- Job closed/completed, data_cleaned=true, attempts=1, last_code nulo, sin lease activa y con finished_at. Terminó el8nov a las01:56:03 de Venezuela.
- Auth soft_deleted=true; contraseña, metadata y credenciales temporales ausentes; alias original retirado. Sesiones, refresh tokens, MFA, credenciales de un uso y autorizaciones/consentimientos OAuth:0.
- Permanece una identidad con identity_data vacío, conforme al tombstone de Auth. No es una credencial utilizable ni se presenta como eliminación física de toda fila Auth.
- Diez ámbitos de datos diarios sin filas; perfil minimizado y Storage relacionado0. Roles/membresías/pedidos/pagos siguen0.
- Auditoría gestionada, holds activos y marcador de recibo expirado:0. El marcador separado se genera al caducar el recibo; no se exige que exista inmediatamente.

Una revisión independiente de los recibos contra backend881 confirmó la coherencia entre los estados y no encontró razón para repetir el cierre.

## Alcance de la evidencia

Esto verifica el cierre hospedado por el flujo implementado. El preflight no sembró datos diarios ni archivos; su estado final vacío no demuestra una prueba de borrado de archivos previamente cargados. El conteo SQL de Storage verifica metadata; el worker comprueba los objetos que encuentra antes de completar, pero no se realizó una lectura física independiente de bytes en esta prueba.

managed_audit=0 no equivale por sí solo a que no exista ninguna auditoría Auth o del proveedor. El finalizador exige su guardia de clasificación. No se ejecutó purga global ni se prometió eliminar logs externos o backups. El recibo operativo queda elegible para caducidad a90×24h desde el cierre; no se configuró ni acreditó un ejecutor automático de esa caducidad.

No se exportaron contraseñas, JWT, cookies, claves o sesiones. La única operación mutante sobre cuentas fue el cierre por UI para la solicitud cotejada. Todas las consultas de comprobación fueron BEGIN READ ONLY/SELECT/COMMIT. Ninguna operación se dirigió a otro UID; no se hizo una comparación global de las demás cuentas.

Falta observar el cliente oficial que conservaba la sesión anterior: se pidió a Oliver volver a abrir/actualizar la APK de esa cuenta. No se afirma rechazo literal de un JWT real probado. La observación de la app, cuando llegue, se distinguirá de esa garantía técnica. No se crea otra cuenta ni se restablecen sus credenciales para probarlo.

## Recibos y continuación

En `/Users/brandeastudio/marketplace/.local/account-normal-flow-20261108/` se conservan PRE_CLOSE_READONLY.sql, PRE_CLOSE_READONLY_RESULT.json, CLOSE_INTENT.json, CLOSE_UI_RESULT.jpg, POST_CLOSE_READONLY.sql, POST_CLOSE_READONLY_RESULT.json y FINAL_CLOSE_RECEIPT.json. Incluyen los identificadores exactos, omitidos aquí por minimización de datos. La consulta oficial fue el snippet b938704e-621f-4446-bace-e4d1b6e02c13 de Marketplace/MIM/Free.

No volver a procesar esta solicitud. Próximo paso de esta prueba: registrar sólo la observación de acceso desde la APK si Oliver responde. Esto no acredita aceptación de Play ni resuelve por sí solo la retención periódica o todas las obligaciones de publicación.

La preparación Android quedó pausada de forma segura en el checkpoint local7325bcc, con plantillas desconectadas y sin build, firma o publicación. Su incorporación documental conserva todos los archivos activos del preview y no reanuda su desarrollo. El panel publicado y el plan Free permanecen intactos.
