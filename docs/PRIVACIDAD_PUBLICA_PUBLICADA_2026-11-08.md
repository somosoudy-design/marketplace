# Privacidad y eliminación publicadas · 8 de noviembre de 2026

Se publicó exclusivamente el candidato de storefront ya verificado. [Eliminar cuenta y datos](https://mayami.app/eliminar-cuenta), [privacidad](https://mayami.app/privacidad) y [contacto](https://mayami.app/contacto) responden200, con contenidoSSR y navegación pública sin login. Eliminar cuenta pasó de404 a200. No es una aceptación de Google Play ni acredita que el buzón se gestione extremo a extremo.

## Publicación exacta

La coordinación amplió expresamente la autorización para publicar este candidato con la sesión Cloudflare existente. Antes de actuar se revalidaron tar/manifiesto y2290entradas contra el árbol compilado; fuente limpia/padre/configuración/lockfile y Worker/despliegue previo coincidían. Sin credenciales nuevas ni ampliación de acceso.

| Dato | Valor |
|---|---|
| Fuente compilada |`db41707f0c35e7e4e50373321225b03a2fd6ade0` sobre `9916d3ef7792584f1ad9ceb52f4080664d370c80`|
| Archivo SHA256 |`f838936a8838d40cbb8b41c1cd4ffd3adce2450dd24fd7db2c0a9205aadef9c3`|
| Manifiesto SHA256 |`7a0c46fe60bab2b5e87090bc8ef047b6a4274ea9452b7a7b7a4d863a32eebca5`|
| BUILD_ID |`gXzoqz9BVz7a2MPxDrfwZ`|
| Worker |`mayami-storefront`|
| Versión anterior |`d8756e3b-42c9-47ee-b041-44456fa341f6`|
| Versión nueva |`3fa586f2-cf50-4ec1-a288-9171ae216591`,100%|
| Deployment |`5a856939-a21d-4103-9e4e-ceb56f0b9f10`|
| Publicado |8nov2026,13:16:00.294UTC /09:16Venezuela|

Una ejecución de la ruta existente `pnpm --filter @kora/storefront deploy:cloudflare` desde el checkout dedicado db417, conservando variables con `--keep-vars`. No se reconstruyó ni se desplegó HEAD compartido. Los tres gates volvieron a pasar y Wrangler subió sólo dos assets nuevos/modificados. No hubo segundo despliegue.

Lectura posterior de Cloudflare confirma nueva versión100%. Runtime y bindings son idénticos a la versión anterior: ASSETS y WORKER_SELF_REFERENCE, mismas flags/headers. Configuración y dominios existentes conservados. No se activaron Workers Paid, servicios con cargos, permisos, bindings, DNS o medidas de seguridad nuevos. No se publicaron Google, cuotas, móvil, panel, editor Aroma’top o backend; tampoco retención/Cron, cuentas o cierres.

## Qué cambió y cómo se verificó

PáginaSSR de eliminación con Mayami, soporte@mayami.app, instrucciones externas sin reinstalar/login, verificación de titularidad y límites de datos; enlaces desde footer, privacidad y contacto. Mailto sólo abre correo y así se explica; no crea una solicitud en base de datos. Diseño, catálogo y compra conservados.90d se presenta como revisión prevista, sin automatización ni máximo garantizado; logs/backups externos separados. Fecha global6nov para textos intactos y8nov sólo para documentos modificados.

Preparación: cinco Node focales, tipos/lint storefront, un build Cloudflare, tres gates, extracción y comprobación real del Worker reubicado sin el árbol compilado original. Cuatro vistas locales390/1280 claro/oscuro y revisión independiente aprobadas. En rama compartida pasan seis pruebas de privacidad, incluida la cobertura previa del acuse móvil sin modificar su fuente. [Delta y artefactos](PRIVACIDAD_PUBLICA_CANDIDATO_2026-11-08.md).

Producción,13:17:12UTC: tres GET200HTML con soporte/enlaces y BUILD_ID exacto. Browser aislado390px, sin sesión ni credenciales: footer Contacto→Eliminación; enlace de correo visible; artículo→Privacidad. Sin overflow/errores de página; sóloGET al mismo origen y ningún correo enviado. El driver inicial buscó un nombre de enlace incompleto; se corrigió al texto real y la verificación pasó, sin cambiar producto/bytes ni repetir despliegue.

Hash de tar/manifiesto y árbol compilado revalidados tras publicar, idénticos. Revisión independiente de evidencia pública/Worker/copy aprobada. Esta comprobación no acredita acceso mundial, dispositivo Android, entrega de email, revocación literal de JWT anterior o conformidad completa de Data safety.

## Evidencia y pendiente real

Carpeta persistente: `/Users/brandeastudio/.codex/worktrees/mayami-play-privacy/marketplace/.local/privacy-storefront-candidate-20261108/`. Contiene artefacto, manifiesto, source.patch, source.bundle, PREDEPLOY_RECEIPT.json, deploy.log, PUBLICATION_WORKER_RECEIPT.json, PUBLICATION_HTTP_RECEIPT.json, HTML público de las tres rutas, captura `published-eliminar-cuenta-light-390.png`, logs y revisiones. No contiene nuevas credenciales.

Pendiente: acreditar recepción y gestión manual efectiva de solicitudes externas por soporte@mayami.app. Hay DNS actual y recibo de regla habilitada/destino verificado del6nov, sin prueba de entrega/atención hoy. No se envió correo de prueba ni se configuraron nuevas automatizaciones. El operador debe verificar titularidad, procesar por el flujo autorizado y comunicar el resultado; mostrar un mailto no demuestra que ese trabajo ocurra. La publicación del enlace está terminada; esta dependencia operativa y las demás etapas de Play se conservan separadas.
