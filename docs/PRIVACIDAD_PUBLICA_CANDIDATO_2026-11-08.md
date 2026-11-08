# Privacidad y eliminación: candidato de storefront · 8 de noviembre de 2026

Entrega preparada y probada; **no publicada**. No acredita preparación completa para Google Play. No se modificaron APK/Android, editor, Google, cuotas, backend, Cron, permisos ni planes. El cierre anterior de la cuenta de prueba no se repitió.

## Estado público observado

GET sin cookies: inicio200, privacidad200, contacto200 y `/eliminar-cuenta`404. El HTML público contiene BUILD_ID `ZFY1G0Dw-qyRFOIV0IH7N`. La lectura oficial de Cloudflare confirma Worker `d8756e3b-42c9-47ee-b041-44456fa341f6`,100%, deployment `bf363f9a-073e-41df-999d-b21927c53d1b`, creado7nov2026. No se cambió ese despliegue.

Los recibos de publicación asocian ese BUILD_ID a la fuente compilada `9916d3ef7792584f1ad9ceb52f4080664d370c80`; el endpoint no expone un SHA Git. Los inputs de runtime/configuración/lockfile de storefront de esa fuente a59e88a07 son idénticos. No compilar ni desplegar HEAD compartido: contiene otros trabajos.

## Delta aislado

Fuente candidata `db41707f0c35e7e4e50373321225b03a2fd6ade0`, árbol `25418089e9d3e1228b211169cada337699c10eb6`, padre9916d3e. Exactamente cinco rutas frente a la fuente publicada: rutaSSR de eliminación, InformationPage, enlace del footer, policies.json y prueba focal account-deletion. Diseño, estilos, catálogo y compra conservados.

La página externa identifica Mayami, muestra soporte@mayami.app y permite solicitar cuenta+datos sin iniciar sesión ni reinstalar. Explica titularidad, alcance y límites, ofrece dirección copiable y aclara que abrir mailto **no envía** ni crea una solicitud en base de datos. La gestión es manual y requiere recepción/atención reales.

Retención: revisión prevista90d desde evento de seguridad o cierre según el registro; ejecutor periódico no activado/observado y90d no es hoy un máximo garantizado. Logs/backups externos sin plazo físico individual verificado. No se atribuye prueba hospedada de JWT anterior. Términos/devoluciones y fecha global6nov intactos; sólo privacidad/eliminación/contacto llevan fecha8nov. Estos textos sustituyen el candidato anterior que prometía plazos no observados; no activan un acuerdo nuevo ni purgas.

En la rama compartida se adapta además `privacy-copy.test.mjs`: reutiliza las cinco pruebas nuevas y conserva la prueba existente del acuse móvil. Es compatibilidad de pruebas, no un sexto input de runtime del artefacto db417. No se modifica la app móvil.

## Pruebas ejecutadas

- Cinco Node focales PASS; acuse móvil existente comprobado sin cambiar su fuente. Tipos y lint de storefront PASS.
- Un único build Cloudflare desde db417 limpio, sólo URL/anon públicas de Marketplace, sin dotenv ni claves privadas. Los tres gates release/comercial/Cloudflare pasan:40productos,53archivos,92asociaciones; artefacto2874archivos/68157945bytes según gate.
- Worker local real: tres GET200 con contenidoSSR en eliminación/privacidad/contacto; cuatro vistas390/1280 claro/oscuro, sin overflow ni errores de página; enlace footer navega correctamente. Browser aislado sin red externa, credenciales o correo enviado. No prueba de teléfono, accesibilidad completa o acceso mundial.
- Extracción del paquete en workspace portable y los tres gates nuevamente PASS, sin rebuild. Revisión independiente de código/copy y cuatro capturas aprobada. Verificación independiente del tar/manifiesto:2290/2290entradas y213archivos fuente coinciden. Recibo conservado junto al artefacto.
- Comprobación adicional justificada por la revisión de portabilidad: Worker extraído sirvió las tres rutas con200/SSR mientras `.open-next` original estaba temporalmente apartado; se restauró al terminar y se detuvo el proceso. Hay rutas locales del Mac en metadata y chunks intermedios, pero el handler final empaqueta sus cargas y esta prueba no dependió del árbol adaptado original. La entrega es para Cloudflare Worker, no un Next standalone genérico.

## Artefactos reproducibles

Carpeta local persistente: `/Users/brandeastudio/.codex/worktrees/mayami-play-privacy/marketplace/.local/privacy-storefront-candidate-20261108/`.

| Archivo/dato | Valor |
|---|---|
| storefront-candidate.tar.gz |20378099bytes;SHA256 `f838936a8838d40cbb8b41c1cd4ffd3adce2450dd24fd7db2c0a9205aadef9c3`|
| manifest.json |SHA256 `7a0c46fe60bab2b5e87090bc8ef047b6a4274ea9452b7a7b7a4d863a32eebca5`|
| source.patch |Delta exacto9916→db417;SHA256 `35c4bc4dfe67019e7665419851ee0a0df8cd71cba13a760b42222d85fcbc2b24`|
| source.bundle |Commit db417 recuperable sobre9916;SHA256 `4fa7fdbc3db522b8de748a3e948eb35393596520c2953386c6be0d10c7d96b7d`|
| BUILD_ID |`gXzoqz9BVz7a2MPxDrfwZ`|
| pnpm-lock.yaml SHA256 |`ca73ff5943dcbf0f875147622f02dd181fe1accc3ddab283aa95aa999fde91c4`|

También: QA_RECEIPT.json, RELOCATION_RECEIPT.json, INDEPENDENT_REVIEW.md, cuatroPNG, build.log, preview.log, package.log, run-public.py y portable/. El manifiesto enumera contenido/hash por archivo y21symlinks relativos interiores, sin enlaces absolutos. El tar es un overlay compilado: fuentes/scripts de gates se recuperan del snapshot db417, no están todos dentro del tar. source.bundle verificado por Git; no depende sólo del reflog local. Evidencia HTTP/despliegue público en `/Users/brandeastudio/marketplace/.local/privacy-public-20261108/`.

## Canal externo y siguiente acción

DNSMX/SPF actuales apuntan a Cloudflare Email Routing. El recibo existente del6nov indica regla habilitada soporte@mayami.app→somosoudy@gmail.com y destino verificado; **no es comprobación actual de recepción**. La búsqueda focal en Gmail no halló mensajes recibidos a esa dirección. La consulta del panel de routing agotó tiempo sin hacer cambios. No se envió correo de prueba. La entrega y atención manual desde fuera de la app siguen sin prueba extremo a extremo, y no deben declararse resueltas por mostrar un mailto.

Google permite correo o formulario externo, pero exige un recurso funcional y accesible, identidad reconocible y descripción clara de qué se elimina/conserva; privacidad públicaHTML sin login/geobloqueo, coherente con comportamiento real y Data safety. Fuentes primarias consultadas8nov: [eliminación](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en), [datos de usuario](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en), [preparación de revisión](https://support.google.com/googleplay/android-developer/answer/9859455?hl=en). No existe aquí una verificación completa de Data safety ni una aprobación de Google.

Bloqueos concretos: confirmar recepción/gestión externa real por el operador y autorizar la publicación de **este** candidato. No activar envíos de prueba, ejecutor/Cron, permisos o credenciales para completar esta tanda.

Ruta técnica existente tras autorización posterior: recuperar db417 con source.bundle sobre9916, usar checkout dedicado limpio y dependencias fijadas por pnpm-lock; verificar SHA del tar/manifiesto, extraer overlay en esa raíz y ejecutar los tres gates de tools/storefront. El paquete incluye `.open-next`, inputs de gates y configuración; no requiere recompilar. Después, desde ese checkout y con sesión Cloudflare existente, `pnpm --filter @kora/storefront deploy:cloudflare` conserva variables con `--keep-vars`. Este comando **no se ejecutó**. Antes de cualquier publicación hay que reconfirmar source/artefacto y estado remoto; después comprobar URLs/BUILD_ID en público. No usar HEAD compartido ni cambiar el trigger de CI.
