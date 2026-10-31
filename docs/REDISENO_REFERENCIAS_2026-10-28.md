# Catálogo y compra a partir de las referencias de Oliver · 28 de octubre

Oliver pidió trasladar a la aplicación tres composiciones mostradas en imágenes: apertura y catálogo integrados, selección limpia de métodos de pago y revisión del pedido con productos e importe al pie. Este incremento modifica la app Expo existente; no añade una maqueta ni métodos de pago ficticios.

## Cambios

- Inicio: cabecera Electric Violet, apertura comercial con fotografía a la izquierda, información y acción a la derecha; fila horizontal de categorías con los iconos disponibles del backend. La apertura conserva el destino real de colección o producto, precio y disponibilidad. Las tarjetas compartidas integran la foto cuadrada dentro de la superficie; favorito y estados mantienen sus acciones y etiquetas. No se agregan promociones, cámara ni botones de compra que no existan.
- Pago: lista compacta con icono, nombre y selector a la derecha, usando exclusivamente métodos habilitados por el backend. La base de la obligación aparece antes de elegir el método; la estimación, comisión, tasa y cotización exacta conservan sus condiciones. El detalle de saldo sigue disponible y los pagos pendientes siguen bloqueando otra cotización. El método se elige después de crear el pedido, como en el flujo real.
- Revisión: cada entrega conserva tienda, envío, plazo y edición; sus líneas muestran imagen, nombre, variante, cantidad e importe `line_total_usd` entregado por el servidor. El resumen violeta reúne productos, envío, recargos, total y acción. En pantallas de menos de 720 puntos o fuente nativa superior a 1,25, el desglose pasa al contenido desplazable y la barra conserva total, «Pagas hoy» cuando hay cuotas y confirmación. No se cambian cálculos, precios, reglas de pago, Supabase, iOS ni configuración nativa.

## Comparación y límites

Las imágenes antes/después de Inicio usan el mismo fixture de producto, catálogo y categorías, red externa bloqueada; las de checkout/pago proceden de la app con backend local y cuentas ficticias. Los números de pedido pueden cambiar entre ejecuciones. Son capturas **Chromium web**, no Android. Las de texto ampliado a 320×640 simulan CSS ×1,6; no representan escala de fuente del sistema Android. [Manifiesto y hashes](capturas/referencias-ux-2026-10-28/manifiesto.json).

| Pantalla | Antes | Después |
|---|---|---|
| Inicio a 320 | [Antes](capturas/referencias-ux-2026-10-28/inicio-antes-light-320.png) | [Después](capturas/referencias-ux-2026-10-28/inicio-despues-light-320.png) |
| Revisión a 320 | [Antes](capturas/referencias-ux-2026-10-28/checkout-antes-light-320.png) | [Después](capturas/referencias-ux-2026-10-28/checkout-despues-light-320.png) |
| Pago a 320 | [Antes](capturas/referencias-ux-2026-10-28/pago-antes-light-320.png) | [Después](capturas/referencias-ux-2026-10-28/pago-despues-light-320.png) |

Ejemplos adicionales: [categorías oscuras 412](capturas/referencias-ux-2026-10-28/categorias-despues-dark-412.png), [cuotas y texto ampliado oscuro](capturas/referencias-ux-2026-10-28/checkout-cuotas-texto-160-dark-320.png). Las tres referencias originales están en el mensaje de Oliver; no se han copiado a este repositorio ni se afirma una comparación de píxeles idénticos.

## Revisión y pruebas

Se consultaron Product Design `index`, `image-to-code`, `user-context` y `design-qa`, y `oliver-design-direction`: objetivo visual seleccionado, captura antes/después, jerarquía/foco/capturas y revisión independiente. La prueba fue en Chromium local; no se declara una verificación del browser del complemento ni una clonación exacta de sus imágenes. La auditora rechazó primero la barra que tapaba productos a fuente ampliada, el importe oculto antes de los métodos, un título extenso en el hero y una categoría partida. Tras corregirlos y recapturar emitió **APROBADO** para las tres zonas web y backend local, con las limitaciones de plataforma anteriores.

En el export final: cuatro pruebas específicas de revisión/pago y dos de Inicio, más cuatro reejecutadas por la auditora; 52 pruebas de `@kora/core`, tipos y lint del monorepo, export web y Android/Hermes. La batería de regresión previa al último ajuste de iconos/espaciado terminó con 53 casos aprobados y un caso de compra bloqueado porque la tasa ficticia local había caducado; ese único caso se repitió y pasó en el export final después de registrar en la base local un dato `demo` con el mismo valor ya existente. La primera ejecución fallida queda documentada; no hubo compras ni pagos remotos.

## Publicación

Publicado por [EAS40697681395](https://github.com/somosoudy-design/marketplace/actions/runs/40697681395) Success, fuente `6bff554`/request `003fa12`; guard del runtime APK5 aprobado. ID Android `01a182ba-0cf5-7d7b-97a0-5cd6475af0b4`, grupo `fcf85e39-1888-4ae0-8132-d08734635f38`. La observación de sólo lectura [40698064910](https://github.com/somosoudy-design/marketplace/actions/runs/40698064910) confirmó que es la última compatible del canal y no es rollback. Sin APK ni publicación en production; no se ha comprobado recepción en Samsung.
