# Ficha: selección vinculada a compra

**Segundo incremento del 24 de octubre de 2026.** El catálogo 25/32 ya está publicado y recibido; este bloque lo conserva. Fuente funcional `f195f8a` y cierre de reflujo `73be557`. Dictamen independiente final web: **APROBADO** para publicar Android preview. Comercio también APROBADO.

## Problema y decisión

Al bajar hacia características, condiciones u opiniones desaparecían variante, cantidad y precio, mientras los botones seguían fijos. El comprador podía actuar sin ver qué estaba agregando y debía volver manualmente al selector. El vendedor aparecía después de un bloque largo de condiciones.

La ficha ahora agrupa «Tu selección», conserva junto a la compra la variante, cantidad y **precio por unidad que devuelve el backend**, y ofrece Editar sobre ese resumen completo de al menos 44 px de alto. Editar vuelve al selector medido bajo el encabezado y transfiere el foco. Vendido por antecede a condiciones; no se añade otra hoja, cálculo, promoción ni paso de checkout.

Mientras se agrega se bloquean variante, cantidad, Editar y la acción de compra concurrente. Un bloqueo síncrono evita dos envíos rápidos antes del siguiente render. La confirmación reemplaza el resumen; cambiar la selección la retira para que no describa otro producto/color/cantidad. Se conservan stock, máximos, errores y acciones Comprar/Encargar/Reservar/Avisarme existentes.

En Android la galería y su skeleton comienzan debajo del área de estado del sistema, con superficie del tema detrás del reloj e iconos. La apariencia se restaura al salir. No cambia configuración nativa ni iOS. La OTA de este bloque ya acredita contraste y regreso en emulador, ambos temas y fuente OS normal/1,6.

## Product Design y equipo

El director UX leyó mediante `skills.read` el paquete `c1/audit`, recurso exacto:

`skill://Plugin_fa77aec24fc08191bc6e57f377126d76/audit/references/design-audit-framework.md`

- **Hierarchy and clarity:** variante, cantidad e importe unitario acompañan la acción.
- **Interaction flow and friction:** Editar vuelve al control existente, sin un recorrido nuevo.
- **Responsive reflow and zoom resilience:** el resumen crece sin truncar selección, importe o botones.

El framework aporta esos criterios; la composición y las medidas son decisiones del proyecto. No se atribuye al complemento una plantilla o aprobación automática. Canvas/Canva no disponible. Root es el único escritor; UX, especialista comercial y auditor revisan independientemente.

## Medidas y pruebas

La barra normal mide **131 px** en las cuatro combinaciones web 320/412 y claro/oscuro. El selector completo mide 198 px y, al activar Editar, comienza en **y=68**: queda entero por encima de la barra. El padding inferior responde a la altura real. Se acepta el coste vertical porque mantiene contexto comercial fuera del primer desplazamiento; no se acorta ni recorta la foto para compensarlo.

**8/8 casos UI finales aprobados** tras el último ajuste de reflujo, ambos temas:

1. Descripción → Editar con Enter → foco del encabezado → Tab a variante → cambiar color/cantidad → agregar → carrito sin duplicar.
2. Persistencia local retenida: edición bloqueada, doble pulsación rápida produce una escritura; confirmación desaparece al cambiar selección después.
3. 320 px, variante larga y precio distinto de fixture: unitario correcto, máximo respetado, barra legible con texto web 1,6 y selector completo fuera del área de la barra.
4. Agotado conserva Avisarme e inicio de sesión, sin resumen de compra ni Agregar.

Tipos/lint móvil y exportaciones web/Android Hermes aprobados. El estrés modifica sólo el fixture del navegador, no productos ni precios remotos; no equivale a fuente Android OS. Error autenticado de agregar no se repitió en este bloque y la rama de error anterior se conserva. TalkBack físico no disponible; no afirmar certificación del lector por probar el foco web.

**20 PNG sin editar**: 16 antes/después de apertura y estado al bajar, más cuatro de llegada al selector/estrés. [Hashes, procedencia y medidas](capturas/ficha-seleccion-2026-10-24/web-evidence.json).

| Contexto | Antes | Después |
|---|---|---|
| Apertura claro 320 | [Captura](capturas/ficha-seleccion-2026-10-24/before/light/320-ficha.png) | [Captura](capturas/ficha-seleccion-2026-10-24/after/light/320-ficha.png) |
| Decisión al bajar, oscuro 320 | [Captura](capturas/ficha-seleccion-2026-10-24/before/dark/320-decision.png) | [Captura](capturas/ficha-seleccion-2026-10-24/after/dark/320-decision.png) |
| Destino de Editar | — | [Foco y selección](capturas/ficha-seleccion-2026-10-24/validation/dark-selector-destino.png) |
| Estrés sólo web/fixture | — | [Reflujo](capturas/ficha-seleccion-2026-10-24/validation/dark-seleccion-estres-web.png) |

## Control de calidad y entrega

Auditor aceptó composición normal y exigió corregir el foco de Editar: resuelto y probado. Se sustituyó un nombre de icono inexistente que mostraba el pictograma de etiqueta por `arrow-up` del conjunto real. Al revisar el fixture estrecho se descubrió que una opción larga se recortaba: corregido reflujo opcional sólo en chips de variantes, probado ancho y texto completos, exportaciones finales correctas. Comercio detectó además cuatro validaciones mal etiquetadas porque Playwright truncó el nombre del tema en su carpeta: se inspeccionaron los originales y se corrigió el mapeo explícito. El registro final tiene 20 rutas únicas y 20 hashes correctos. Sin revisión infinita ni otra auditoría global.

Cerrados foco, reflujo, procedencia de 20 capturas y 8 pruebas finales; sin P1/P2 web abiertas en ese alcance. Evidencia conservada en commit/push y EAS40045652185 Success. Recepción nueva completada mediante `13-ficha-seleccion` / `14-ficha-seleccion-texto`, claro/oscuro normal/OS 1,6. No APK nuevo, production, cambios nativos, backend, cálculos o pagos.

## Publicación confirmada

EAS [40045652185 Success](https://github.com/somosoudy-design/marketplace/actions/runs/40045652185), fuente `19a1329`, Android preview; guard exacto APK 5 **`eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`** y publicación correctos. Incluye el catálogo anterior 25/32 y la ficha nueva. OTA **`01a16b56-46a9-7960-a239-4b2271e68d5a`**, publicada **24oct00:36UTC / 23oct20:36Venezuela**, leída de los cuatro diagnósticos nuevos.

Recepción [Android40045853547 Success](https://github.com/somosoudy-design/marketplace/actions/runs/40045853547), revisión45/fuente0608286: **4/4 sin reintentos**, flujos13/14, ambos temas, fuente OS normal/1,6. API35, visitante y Marketplace responde344/229/306/261ms. No recepción física comprobada en Samsung ni checkout autenticado/TalkBack nuevos.

**36 JPG derivados por el publicador CI**, copiados byte a byte sin más edición desde `ci/capturas@bba2bc6b3f7aee600f759b475d853f2d5d5763d2`; hashes36/36. Cuatro capturas de instalación inicial excluidas. PNG originales permanecen en el artefacto de la ejecución. [Manifiesto](capturas/ficha-seleccion-2026-10-24/native/evidencia.json), [resultados](capturas/ficha-seleccion-2026-10-24/native/resumen.md).

| Evidencia Android posterior | Claro | Oscuro |
|---|---|---|
| Fotografía y compra contextual | [Normal](capturas/ficha-seleccion-2026-10-24/native/light/13-02-apertura.jpg) | [Normal](capturas/ficha-seleccion-2026-10-24/native/dark/13-02-apertura.jpg) |
| Editar → selector con Arena/2 | [OS1,6](capturas/ficha-seleccion-2026-10-24/native/light/14-04-arena-dos.jpg) | [OS1,6](capturas/ficha-seleccion-2026-10-24/native/dark/14-04-arena-dos.jpg) |
| Carrito conserva foto/color/cantidad | [Normal](capturas/ficha-seleccion-2026-10-24/native/light/13-06-carrito.jpg) | [Normal](capturas/ficha-seleccion-2026-10-24/native/dark/13-06-carrito.jpg) |
| Contraste sistema y galería clara | [OS1,6](capturas/ficha-seleccion-2026-10-24/native/light/14-07-contraste-sistema.jpg) | [OS1,6](capturas/ficha-seleccion-2026-10-24/native/dark/14-07-contraste-sistema.jpg) |
| Diagnóstico de OTA ejecutada | [Código real](capturas/ficha-seleccion-2026-10-24/native/light/13-09-recepcion.jpg) | [Código real](capturas/ficha-seleccion-2026-10-24/native/dark/13-09-recepcion.jpg) |

**Dictamen independiente final nativo: APROBADO** para el incremento acotado de selección/compra y contraste. El auditor abrió los36JPG, verificó36pares de hashes/dimensiones y contrastó run/fuente/diagnósticos. Confirma selector completo al editar, Arena2, 89USD por unidad/carrito178USD, imagen coherente y contraste/restauración de sistema en ambos temas y escalas. Cierra la P2 anterior de statusbar dentro del recorrido observado. Estas capturas acreditan destino visual nativo, no ejecución de TalkBack.

**Límite adicional observado, P2 preexistente:** con fuente OS1,6 la tarjeta de vendedor recorta parte de «Aún sin opiniones». Causa localizada en `StoreCard.tsx:82`, altura18 fija; componente idéntico al baseline73f5b99 y entre las dos publicaciones, sólo cambia su posición en la ficha. No afecta identidad, controles de selección o compra comprobados; el auditor acepta este incremento y exige conservar la tarea. Próximo ajuste focalizado: altura adaptable y capturasOS1,6 con/sin opiniones, usando estados03/04 actuales como antes. No declarar adaptación tipográfica completa de toda la ficha ni ocultarlo bajo el resultado4/4.

**Recursos realmente enviados al export Android:** los bytes optimizados de los32WebP están incluidos, con hashes concordantes, no sólo guardados en una carpeta fuente. [Registro del export final](catalogo-exhibicion/ANDROID_RECURSOS_2026-10-24.json).
