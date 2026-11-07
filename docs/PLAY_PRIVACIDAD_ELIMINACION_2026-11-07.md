# Privacidad y eliminación de cuenta para Play · 7 de noviembre de 2026

La preparación local de enlaces y página está terminada. El flujo actual de cierre no acredita eliminación completa y bloquea afirmar que ese requisito de Play está resuelto. No se publica nada en esta tanda.

## Cambios entregados

- Registro móvil enlaza términos y política de privacidad con URLs HTTPS de mayami.app. Cuenta y Preferencias exponen los documentos y la solicitud web de eliminación; Cuenta los muestra también al invitado. Un fallo del abridor muestra una dirección utilizable, sin afirmar que el documento haya cargado.
- Nueva página /eliminar-cuenta reutiliza soporte@mayami.app. Permite solicitar sin instalar la app, explica titularidad, operaciones pendientes, qué retira el procedimiento y qué permanece. El correo está visible para copiarlo si no hay cliente mailto; abrir el enlace no se presenta como envío.
- Privacidad amplía su alcance a la app: actividad/recomendaciones, imágenes elegidas, notificaciones, almacenamiento local y proveedores identificados en fuente. Los textos móviles de solicitud/confirmación ya no prometen anonimización total por ley. La retención decidida por delegación se entrega como propuesta separada de la implementación real.

Se conserva diseño, navegación de acceso, galería por variante, Preventa, modo invitado, acciones y backend. No hay cambios en ficha, selector de color, botones de compra, precios, stock o finanzas. No se integran cuotas ni Google/correos pendientes en esta fuente.

## Verificación acotada y sus límites

| Comprobación | Resultado |
|---|---|
| Enlaces móviles | 5 pruebas unitarias aprobadas: URLs canónicas, éxito de dispatch y fallos rechazados/false con dirección legible. |
| Tipos y lint | Móvil y storefront aprobados. No se relanzó una matriz completa del monorepo por cambios de enlaces/texto. |
| UI focal | 12 casos aprobados: registro/Cuenta/Preferencias, eliminación/privacidad/contacto, en ambos temas a 320 px. |
| Texto ampliado | Simulación CSS 1,6 sobre texto de ExpoWeb y web; sin desborde horizontal. No equivale al font setting de Android nativo. |
| Apertura externa | Se comprobó la URL que recibe el dispatcher; window.open se sustituyó en el test para no navegar/transmitir fuera. Fallo de apertura simulado y mensaje de error verificado. No se declara apertura nativa en un teléfono. |
| Recurso web | HTTP 200 y enlaces reales en Next local para /eliminar-cuenta, /privacidad y /contacto; no se cambió el 404 del sitio publicado. |
| Flujo existente SQL | 2 pruebas de eliminación existentes aprobadas y 1 diagnóstico adicional de datos residuales; sólo fixtures locales. El diagnóstico caracteriza defectos y no es una prueba de aceptación aprobada. |
| Compilaciones | Un export ExpoWeb para la UI y un servidor Next dev. Ningún AAB/APK, emulador, OTA o publicación. |

No se envió un correo, se creó una cuenta remota, se procesó una eliminación real, se cambiaron credenciales o se reabrió Console. Se conserva el primer error de tipado de fixture SQL; su corrección no modifica el producto.

La revisión independiente de fuente y capturas se conserva en independent-ui-review.md. Ocho capturas móviles y dos focos web abiertos resultaron favorables para lo visible. La revisión web es parcial: los focos parten secciones y el indicador de desarrollo solapa sus últimas líneas; no se atribuye ese indicador al sitio de producción ni se acredita visualmente todo el documento. El autor de cambios y el revisor son distintos. No se midió contraste AA ni recepción física. Las limitaciones de capturas o de simulación no se convierten en verificación nativa.

## Datos, retención y bloqueo

[Inventario, propuesta de retención y borrador Data safety](PLAY_DATOS_RETENCION_2026-11-07.md) distingue hechos, inferencias y objetivos aún sin implementar. Oliver delegó la decisión; no queda una pregunta genérica de retención pendiente. El texto legal y la implementación necesitan revisión antes de publicar.

El procesador conserva auth.identities y metadatos de avatar/comprobante; también quedan notas, mensajes y campos de pago. El mismo sub de las claims SQL sigue permitiendo leer/escribir por acceso directo después de completed. No se ejecutó un JWT real. El siguiente arreglo mínimo debe cerrar esa finalización: retirar identidad/archivos no retenidos, aplicar la clasificación, impedir repoblación mediante RPC/RLS/Storage y emitir un recibo verificable antes de completed. Cambiar sólo require_user no cubre las rutas directas. No se implementa un borrado amplio ni se integra una prueba futura RED como si pasara.

Google pide recurso web y vía dentro de la app, pero también eliminación de datos asociados; el bloqueo de acceso no sustituye ese requisito. Referencias: [requisitos de eliminación](https://support.google.com/googleplay/android-developer/answer/13327111) y [datos de usuario](https://support.google.com/googleplay/android-developer/answer/10144311).

## Fuente y evidencia reproducible

Fuente ejecutable de enlaces/página probada: 5815e3aebbc1a2c6812dc46958708983410e6afb, basada en 59e88a07a53338678c29aaf16a824daa7b31d58c. Cierres documentales posteriores no cambian el código probado. Worktree mayami-play-privacy separado de mayami-cuotas-release. La rama compartida conserva ambas fuentes y Google/correos; HEAD compartido no es una fuente publicable.

Evidencia privada en .local/play-privacy-20261107 del checkout principal: ui/results.json y PNG, db-tests/results.json/first-run, DELETION_AUDIT.md, audit-evidence.json, deletion-characterization.json, propuestas de aceptación futura, logs del único export y diff/manifiesto de aislamiento. Los builds locales usan configuración loopback y no deben publicarse.

La entrega es local. No pedir reconexión de Supabase, no reanudar tandas cosméticas ni abrir otra investigación Play desde este bloque. Identidad/configuración definitiva de AAB, publicación y trámites físicos permanecen fuera de esta tanda.
