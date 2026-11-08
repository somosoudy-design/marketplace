# Panel de cierre publicado

8 de noviembre de 2026. Publicación puntual autorizada por Oliver, con alcance exclusivo del panel administrativo y de vendedores existente. No es una publicación en Google Play ni prueba de eliminación completada.

## Fuente y paquete

- Fuente: `da9085c00f884f487a2ae4d35aed71a220d553a0`.
- Build conservado: `candidate.da9085c00f88`.
- Proyecto: `@marketplacebrand/marketplace`, ID `9f629f10-d679-4a99-9965-8a9e588afc85`.
- Export previo: 245 archivos, manifiesto SHA256 `c4155e02c64ee3ad41686debfb029e7bdae574dbd9dea7d912f303f82a09f184`, tar SHA256 `7535b9b079c6cdc9e69155ae61501852634b09b569f40a742091011c6c505dcb`.
- Deployment: `fzi7bsabfc`, https://kora-panel--fzi7bsabfc.expo.app.
- Producción: https://kora-panel.expo.app.

El paquete corresponde sólo al panel: login, rutas de administración y vendedor. No incluye páginas públicas de privacidad/storefront ni distribución móvil. El delta admin/API es de tres archivos frente a59e88a07 y de doce frente al panel realmente publicado0eb9047; no se presenta como sólo tres archivos sobre producción. El código existente del editor revisado y su contrato de actor forman parte de esa fuente previamente preparada; no se añadió un acceso nuevo al editor administrativo de Aroma'top.

## Canal y verificación

Oliver confirmó el permiso permanente del CLI oficial de Expo exclusivamente para marketplacebrand con rol Developer, capaz de publicar/compilar/gestionar credenciales. El formulario se comprobó antes de una aprobación; no otras organizaciones ni roles superiores. El CLI manejó su sesión sin lectura/exportación manual de valores privados. La UI de facturación mostró Free, $0/mes y estimado $0; no se contrató ningún plan o extra.

Se revalidaron manifiesto, cada archivo del export, configuración/proyecto, scanner anon/sin secretos/sin backend local y procedencia del contexto EAS. No se repitieron builds o suites cerradas. El contexto de Expo del checkout aislado coincide con el candidato; el directorio exportado fue el del paquete, nunca el HEAD compartido.

CLI24.12.1 recibió inicialmente una ruta absoluta y falló **antes del upload**. La inspección de su código oficial confirmó que concatena projectDir/exportDir con path.join; se cambió sólo el argumento a la ruta relativa que resuelve al mismo export. El comando corregido subió un único deployment y lo promovió a producción, exit0. No se reintentó un upload incierto. Para una futura recuperación, no repetirlo sin reconciliar los recibos existentes.

El gate `tools/panel/check-deploy.mjs` aprobó22 comprobaciones en deployment y alias: fuente/build exactos, HTML/rutas, JavaScript,404 y cabeceras de seguridad. La revisión independiente comprobó además `/admin/usuarios` HTTP200 y el chunk `0jgt86nz0r5y5.js` en ambos dominios, que contiene `account-close` y coincide con el manifiesto: SHA256 `892ccb529a55365a0226917b9fca51c8113489149748f0c0f9e6e4fd9fc8c7dc`.

## Estado de la prueba hospedada

La sesión administradora oficial funciona; la cuenta de prueba designada aparece como cliente sin tienda. La pestaña Solicitudes de eliminación del panel nuevo muestra «No hay solicitudes», sin aviso de cierre no disponible. Esto acredita recepción y lectura de UI; no equivale a haber invocado el worker o comprobado una eliminación.

El comprador debe solicitar el cierre desde la APK oficial: Cuenta → Preferencias y privacidad → Solicitar eliminación. La web de compradores publicada carece de ese formulario; la página informativa candidata tampoco lo sustituye. Después se cotejarán UID y requestId de la única cuenta autorizada antes de procesarla una vez por UI normal. Los identificadores exactos de la prueba y recibos se conservan sólo localmente; no se incluyen credenciales.

Pendiente: solicitud APK, cierre verificable, comprobación del estado y de los datos, y acceso anterior por el cliente oficial si es observable. No se acredita todavía invalidación literal de JWT ni aceptación Play. No se usó el RPC antiguo para simular completed, ni Auth/delete como atajo, SQL mutante, adaptadores de credenciales o sesiones trasladadas entre orígenes.

## Recibos locales

En `/Users/brandeastudio/marketplace/.local/panel-publish-20261108/`: `DEPLOY_INTENT.json`, `deployment.json`, `HTTP_RECEIPT.md`, `PENDING_ACCESS.json` (histórico, sustituido por el recibo final), capturas de autorización/plan/fixture y `official-requests-after.jpg`. Fuente/manifest/export en el checkout aislado indicado en [la preparación](PRIVACIDAD_PANEL_CANDIDATO_2026-11-07.md). El recibo final distingue acceso aprobado/publicación recibida de la solicitud y cierre aún pendientes.

Sin cambios backend, SQL, hook, Cron, purga general, membresías/roles Mayami, editor Aroma'top o catálogo; sin publicación storefront, privacidad pública, APK/OTA/AAB ni cargos. El formulario localhost de credenciales anterior continúa suspendido y no fue reutilizado.
