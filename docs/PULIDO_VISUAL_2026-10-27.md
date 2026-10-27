# Pulido visual del marketplace · 27 de octubre de 2026

## Alcance y criterio

Oliver pidió mejorar orden, jerarquía, tamaños, distribución, coherencia y microinteracciones. Se aplicaron criterios de `product-design:index` y `product-design:audit` (capturar antes de juzgar, priorizar el recorrido y verificar resultados), y la skill `oliver-design-direction` (identidad propia, jerarquía comercial, densidad funcional y atención a detalles). El preflight de contexto no encontró contexto guardado. La integración de navegador de Product Design no estaba disponible: las capturas se obtuvieron con Playwright/Chromium del repositorio, no se presenta ese uso como una auditoría automatizada del complemento ni como prueba en Android.

Participaron especialistas reales de UX, experiencia comercial y panel; un auditor independiente examinó capturas y cambios y root fue el único integrador. La exploración que sustituía el componente compartido de precio por autoajuste nuevo y reorganizaba la cuadrícula con fuente grande se rechazó para esta entrega: un importe extremo bajaba a 12,49 px a 320 y no había prueba nativa. En su lugar se conserva el componente de precio existente y se separa únicamente una marca real al comienzo del nombre, si coincide con `brand_name` y queda contenido útil. El título completo, importe y disponibilidad siguen en la etiqueta accesible.

## Intervenciones

- **Buscar e Inicio:** en tarjetas compartidas, la línea de nombre muestra el dato diferenciador y la marca confirmada acompaña el precio. Si no hay coincidencia exacta por palabra o la marca es el título completo, no se altera el texto. El nombre sigue en una línea. Se mantiene la cuadrícula, la imagen, estados, favorito y destino de ficha. El fondo de la fotografía editorial evita bandas oscuras sobre imágenes claras en modo oscuro.
- **Carrito:** subtotal y acción principal comparten una fila en sesiones con tamaño de fuente normal; para visitantes, texto grande o importes que no caben se conserva la disposición apilada. En el fixture de 320×720 el borde superior del pie baja de aproximadamente 483 a 523 px, dejando unos 40 px adicionales para los productos. Se mantienen cantidades, subtotal del servidor, agrupación y checkout progresivo.
- **Ficha:** indicador de página contrastado sobre las fotografías, sin interceptar gestos, y las transiciones de precio/confirmación y salto a opiniones respetan movimiento reducido. No cambia la galería ni la selección comercial.
- **Panel de vendedor:** etiquetas visibles de variante, precio, inventario y SKU al estrechar el editor; SKU con espacio suficiente, dos imágenes por fila y acciones táctiles de al menos 44 px. Los campos conservan su asociación accesible y la persistencia previa.
- **Panel compartido:** importes largos tienen espacio para permanecer en su tarjeta; se redistribuyen los resúmenes según ancho, sin cambiar cálculos. Los campos y controles compartidos tienen objetivos de 44 px y estados de foco. El menú móvil anuncia apertura, contiene el foco, cierra con Escape y lo devuelve al disparador. Las tablas muestran indicación de desplazamiento sólo cuando desbordan y se pueden recorrer con teclado y tacto.
- **Inventario:** el campo conserva 96×44 px; en móvil el estado se sitúa debajo y se reserva el espacio de la acción para que, tras editar al final de la tabla, campo y Guardar queden visibles simultáneamente. La auditoría rechazó dos iteraciones que dejaban un control cortado; se corrigieron antes de aceptar el cambio.

## Evidencia visual

Las imágenes son capturas originales sin editar del export web, con los mismos datos de fixture en un backend local. No representan fotografías nuevas, ventas reales, pruebas de TalkBack ni una captura física Android. El texto 1,6 usado en ciertos casos es una simulación CSS web, no el ajuste del sistema operativo. Los UUID locales no coinciden con algunos reemplazos fotográficos privados del backend remoto; por eso algunas ilustraciones antiguas incluyen texto incrustado. [Manifiesto y hashes](capturas/pulido-2026-10-27/manifiesto.json).

- Buscar a 320, claro: [antes](capturas/pulido-2026-10-27/buscar-antes-light-320.png) · [después](capturas/pulido-2026-10-27/buscar-despues-light-320.png). También hay pares para oscuro y 412 px en el mismo directorio.
- Carrito a 320, claro: [antes](capturas/pulido-2026-10-27/carrito-antes-light-320.png) · [después](capturas/pulido-2026-10-27/carrito-despues-light-320.png); par oscuro disponible.
- Editor de variantes a 320: [antes](capturas/pulido-2026-10-27/editor-antes-light-320.png) · [después](capturas/pulido-2026-10-27/editor-despues-light-320.png); par oscuro disponible.
- Resumen de administración a 1280: [antes](capturas/pulido-2026-10-27/dashboard-admin-antes-light-1280.png) · [después](capturas/pulido-2026-10-27/dashboard-admin-despues-light-1280.png); los importes son los mismos fixtures locales.
- Inventario a 320: [iteración rechazada](capturas/pulido-2026-10-27/inventario-vendedor-antes-light-320.png) · [corrección](capturas/pulido-2026-10-27/inventario-vendedor-despues-light-320.png); vendedor/admin y ambos temas incluidos. La primera imagen documenta el defecto encontrado en una iteración, no el diseño original publicado.

## Verificación y límites

- Tipos y lint del monorepo, más repetición de los paquetes afectados; export estático del panel, export web y bundle Android Hermes sin APK.
- 13 pruebas UI de carrito/reputación y galería en web, claro y oscuro; cubren precio por unidad, cantidades, errores/reintento, visitante, navegación, atributos y fotos de Storage. Dos unitarias de separación de marca. Las cifras extremas y posiciones del pie se probaron en fixtures locales, sin órdenes ni pagos remotos.
- Panel: 29 casos de navegación/foco/adaptación y cinco de guardado/aislamiento del editor sobre export local; un selector de prueba incorrecto agotó el tiempo, se corrigió y el caso pasó en la repetición. Cuatro casos adicionales comprueban campo y Guardar completos tras editar en admin/vendedor y ambos temas; no guardan inventario. 28 unitarias de panel y 19 del control de publicación aprobadas.
- Auditoría independiente: el cambio de tarjetas mejora la comparación a tamaño normal; el menú, las tablas y el inventario corregido pasan en lo revisado. **Pendiente:** a 320 con texto web simulado al 160 %, los modelos de cables vuelven a truncarse de forma parecida, algunas etiquetas de disponibilidad, contador y pestaña activa también se cortan. No presentar esta entrega como adaptación ampliada completa ni inferir el comportamiento de Android. Próximo incremento: diseñar una disposición de catálogo y navegación que conserve precio entero y textos legibles a fuente grande; comprobarla con el APK existente cuando exista una copia recuperable.
- No se integraron fotos nuevas. Siguen 13 productos/18 variantes pendientes de material exacto y distribuible. No se modificaron datos remotos, backend, pagos, tasas, cálculos ni configuración nativa.

## Publicación

Fuente validada y publicación incremental autorizadas por Oliver. La solicitud de Hosting debe ser un commit separado que apunte al commit de fuente inmediatamente anterior; la OTA debe pasar el guard de runtime exacto de APK 5 en Android `preview`. Los resultados, IDs y límites de recepción se añaden a continuidad después de observar CI. La URL histórica del APK5 sigue caducada: no repetir la descarga ni declarar recepción en emulador o Samsung sin prueba.
