# Recuperación al confirmar la compra · 29 de octubre

Oliver reportó una pantalla completamente blanca y confirmó que ocurre al pulsar «Confirmar pedido» en Android. No hay un Samsung conectado ni un APK5 recuperable para repetir su caso nativo en este entorno. No se atribuye la causa a una animación o a `usePreventRemove` sin evidencia.

## Fallo comprobado

En la versión publicada se reprodujo dos veces contra el backend **local**: `place_order` crea el pedido y vacía el carrito, pero se pierde su respuesta. `onError` reactivaba el preview y el carrito vacío sustituía la revisión, sin acceso ni recuperación del pedido creado. La consulta local confirmó un solo pedido y el mismo ID de la respuesta perdida. [Captura anterior](capturas/confirmacion-compra-2026-10-29/antes-respuesta-perdida.png). Esta es una pérdida de continuidad comprobada, **no una reproducción literal del blanco de Samsung**.

También se probó que una respuesta HTTP exitosa incompleta podía bloquear checkout o abrir `/pay` sin identificador. Son fallos provocados en pruebas; no se ha observado que el backend remoto entregue esa respuesta. Lecturas puntuales, sin cambios, confirmaron que la función remota declara `order_id` y `number` y que existen la unicidad comprador/intención y la serialización por comprador.

## Corrección

- Después de una respuesta incierta, se consulta el pedido de la **misma cuenta y misma intención**, con filtro explícito de comprador incluso si es administrador. No se elige el pedido más reciente ni se ejecuta otra compra automáticamente.
- La selección y el snapshot revisados se conservan mientras el resultado es incierto; un carrito vacío no borra la confirmación. «Comprobar pedido» sólo consulta. Si aún no aparece, se permite reintentar la confirmación con los mismos argumentos y clave; el servidor ya protege esa pareja contra duplicados. No se cambiaron SQL ni cálculos.
- Sólo se navega a Pago después de validar identificador y número. Se muestran estados explícitos de confirmación, recuperación y pedido creado. La recuperación permite ir a Mis pedidos y desactiva correctamente la protección de navegación cuando encuentra el pedido.
- Cada sesión de checkout queda ligada al comprador: un cambio de cuenta desmonta la intención anterior. Los errores comerciales conocidos siguen regresando a su fase editable.

## Evidencia y validación

[Recuperación clara](capturas/confirmacion-compra-2026-10-29/recuperacion-light.png) · [oscura](capturas/confirmacion-compra-2026-10-29/recuperacion-dark.png) · [pedido recuperado en Pago](capturas/confirmacion-compra-2026-10-29/pago-recuperado-light.png) · [hashes](capturas/confirmacion-compra-2026-10-29/manifiesto.json). Son capturas web originales con datos de prueba locales.

Pasaron 11 unitarias del helper y 10 UI de recuperación: respuesta perdida después de commit, consulta fallida y recuperación posterior, solicitud que no llegó y reintento estable, respuesta incompleta y salida a Mis pedidos. Se comprueba un solo pedido en la base y los filtros de la consulta. La auditora ejecutó independientemente cuatro casos en claro/oscuro, revisó capturas y fuente y emitió **APROBADO** para web/backend local.

En el export definitivo pasaron las **42 UI** de recuperación, fases, errores, compra completa y envío de pago a verificación, además de 11 unitarias del helper y 52 core, tipos/lint monorepo y exportación Android/Hermes. El análisis estático detectó acceso a un ref al renderizar el snapshot; se movió a estado React y se repitieron las 42 UI y la auditoría focal independiente (4/4). Sin compras, pagos, datos o migraciones remotos; sin nuevo APK, iOS o cambios nativos.

## Continuación

Publicado [EAS40999854509](https://github.com/somosoudy-design/marketplace/actions/runs/40999854509) Success, fuente `e34330c`/request `f23ffdc`, Android preview y guard runtime APK5 aprobado. ID `01a18af2-bd5c-7ec1-9e59-9b458a7e11f0`, grupo `4d390f5e-555d-450e-b0a2-88cdec5cede7`. Observación de metadatos de sólo lectura solicitada. La confirmación de que desaparece el blanco concreto en el Samsung requiere probarlo en ese teléfono; no equiparar publicación con recepción.
