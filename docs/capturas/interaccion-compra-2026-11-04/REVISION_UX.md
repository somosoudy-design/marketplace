# Revisión visual focalizada · carrito y confirmación · 4 noviembre 2026

## Dictamen UX/UI

**APROBADO para integrar este bloque visual**, limitado a la evidencia descrita. No detecté un bloqueo nuevo de composición, superposición o alcance de acciones en las pantallas capturadas. La mejora es estructural: cambia la relación entre producto, precio y controles, reúne las entregas en una superficie y recupera espacio de lectura al compactar la barra fija. No constituye aprobación de la publicación ni certificación del comportamiento en Android físico.

Fuente DESPUÉS informada por el integrador: `55e6aaa`. App antes 8090 y después 8091, exports separados. Storefront 3200 antes y después de reconstruir producción. Se conservaron las mismas 3 referencias, 4 unidades, 2 entregas y el mismo comprador local; no se sustituyeron precios ni imágenes para favorecer el después. Subtotal 101 USD, envío 5,30 USD y total 106,30 USD iguales en ambos. Ninguna captura confirmó pedidos. Se bloqueó el endpoint remoto durante la prueba.

Product Design `audit` y `design-audit-framework`: capturar primero, revisar pantallas reales, expresar problemas por tarea y severidad, proponer correcciones verificables y volver a inspeccionar. Directrices de Oliver: continuidad de composición, producto protagonista y densidad justificada. El video de X no se pudo consultar; no se atribuye al video ninguna duración o comportamiento observado. Los cinco criterios provienen de lo escrito por Oliver.

## Evidencia revisada

Abrí personalmente las 18 capturas originales de cada serie y las 3 capturas posteriores complementarias. Están en `before/` y `after/` (18 PNG por fase); las complementarias están en `complementary/`; no son montajes ni imágenes generadas.

- App: carrito y revisión a 320/412 × 892, claro y oscuro.
- App: 320 × 740 oscuro con texto aumentado 1,6× por DOM. Es una simulación de presión tipográfica en Chromium, no fontScale del sistema Android.
- Web: carrito y revisión a 320/1440 × 960, claro y oscuro; capturas fullPage.
- Complementarias: final de revisión después de desplazar a 320 normal y 1,6×; viewport original web 320 × 960 para aclarar la barra fija.

Los fullPage web muestran la barra fija a la altura del viewport dentro de una imagen larga. Eso es comportamiento de captura; no una barra colocada en medio del documento. Consultar `complementary/after-09-web-review-viewport-320-dark.png` para el viewport real sin montaje.

## Comparación medida

| Condición | Antes | Después | Lectura |
|---|---:|---:|---|
| App carrito 320: filas de producto |178/160/160px|152/142/142px|Tercera referencia y controles pasan a quedar completos por encima de la barra inicial.|
| App carrito 320: contenido desplazable |910px|823px|87px menos con mismos datos, sin reducir áreas táctiles.|
| App carrito 412: filas |160/142/142px|150/150/150px|Uniformidad; no se presenta como ahorro universal por fila.|
| App revisión 320/412: primer producto |Y290|Y248|42px antes en pantalla.|
| App revisión 320 × 892: barra fija |210px|113px|97px devueltos al contenido.|
| App revisión 320 × 740 texto 1,6×: barra fija |342,375px|179px|De 46,3% a 24,2% del viewport. Antes no había producto visible inicialmente; ahora hay una referencia completa y parte de la siguiente.|
| App revisión: contenido desplazable 412/320 |1081/1109px|1053/1105px|Ahorro total pequeño: el avance importante es la agrupación y la barra, no ocultar información.|
| Web carrito 320: filas |194,984/212,984/212,984px|167,172/143,781/143,781px|Precio y control comparten pie; precio unitario sólo para cantidad 2.|
| Web carrito 320: altura main |1122px|989px|133px menos.|
| Web revisión 320: altura main |1520px|1439px|81px menos, se elimina inventario duplicado.|
| Web revisión 320: primer producto |Y300,469|Y351,516|51px después: coste de encabezado de conteo+agrupación; no se afirma mejora vertical en todos los puntos.|

Métricas crudas: `before/metrics-*.json`, `after/metrics-*.json`, `bar-comparison.json`, `text160-bottom.json`.

## Decisiones que funcionan

1. **Carrito integrado.** Las fotos, variante y nombre tienen una jerarquía consistente. El importe de línea comparte el pie con cantidad y quitar. Los separadores de vendedor preservan la operación multitienda sin producir una tarjeta independiente por producto. A 320 los tres productos y sus controles están visibles al abrir, que antes no ocurría con la tercera referencia.
2. **Revisión como conjunto comercial.** Una sola superficie reúne 3 productos/4 unidades; dentro permanecen 2 entregas, tienda, método, coste, fecha estimada y Cambiar. No se finge que existe un único envío. El resumen lateral web ya no repite el inventario.
3. **Barra fija con una tarea.** Mantiene total y Confirmar; el desglose y la explicación permanecen en el cuerpo. A texto ampliado se puede leer producto y acción al mismo tiempo. Al desplazar, el último aviso termina 24 px por encima de la barra: no queda atrapado debajo. Dirección, plan y desglose siguen alcanzables.
4. **Semántica consistente.** 3 referencias, 4 unidades y 2 entregas ya no se etiquetan como el mismo conteo. App/web conservan los mismos importes y resumen comercial.
5. **Color con función.** Violeta de selección/CTA y superficies de contenido tranquilas se sostienen en claro y oscuro; el fondo de producto no compite con los importes. No se añadieron cápsulas decorativas para suplir jerarquía.

## Pruebas y límites

- 5 flujos de captura completados: 2 app, 2 web, 1 texto ampliado. Comando y especificación en `capture.spec.ts`/`playwright.config.ts`.
- El primer intento del flujo app claro falló porque el helper comprobaba inmediatamente `isVisible()` durante el cambio de fase. El DOM ya estaba en Plan, no estaba bloqueado. Se corrigió únicamente el helper privado para esperar cambio de progreso y se repitió ese flujo: aprobado. Los otros 4 pasaron en su primer intento DESPUÉS. No fue un arreglo de producto ni se ocultó una regresión.
- No overflow horizontal en 320/412 app y 320/1440 web; texto ampliado mantiene scrollWidth 320.
- Dos recorridos complementarios verificaron por medición que desglose/aviso final se desplazan completamente sobre la barra: normal, último texto Y755/barra Y779; 1,6×, último texto Y536,84/barra Y561.
- Favoritos, errores, concurrencia y movimiento reducido se verifican en la suite del auditor independiente; las capturas estáticas de este informe no prueban fluidez por sí solas.
- No se confirmó compra ni se invocó place_order. No se tocó stock, precio ni backend remoto.
- No hubo dispositivo Android físico ni se verificó recepción OTA desde esta revisión. Esos controles corresponden al integrador.

## Observaciones no bloqueantes

- El texto de la pestaña Carrito se trunca con 1,6×; es preexistente y el icono/estado sigue reconocible. Conviene una revisión específica del ancho de pestaña activa con fuentes grandes en Android real, sin reducir letra ni área táctil para ocultarlo.
- Carrito web 1440 ahora evita que Resumen ocupe toda la altura de la lista. Las filas todavía dejan bastante vacío horizontal; una próxima adaptación desktop puede alinear importe y cantidad con el cuerpo en una sola banda, manteniendo la semántica móvil. No compromete esta entrega móvil.
- Cupones no es una funcionalidad terminada: no existe contrato de aplicación/descuento confirmado. Es correcto no introducir una entrada aparentemente funcional. Debe figurar explícitamente como pendiente, no como uno de los cinco puntos resueltos.
- La simulación 1,6× no reemplaza probar TalkBack/Android fontScale. Tampoco se certifica contraste WCAG por observación visual.

No hay correcciones visuales obligatorias nuevas para este bloque. La aprobación interna mantiene sus límites; no sustituye la comprobación del propietario en su teléfono.
