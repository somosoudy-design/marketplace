# Ficha: selección vinculada a compra

**Segundo incremento del 24 de octubre de 2026.** El catálogo 25/32 ya está publicado y recibido; este bloque lo conserva. Fuente funcional `f195f8a`. Publicación de ficha todavía pendiente de cierre independiente.

## Problema y decisión

Al bajar hacia características, condiciones u opiniones desaparecían variante, cantidad y precio, mientras los botones seguían fijos. El comprador podía actuar sin ver qué estaba agregando y debía volver manualmente al selector. El vendedor aparecía después de un bloque largo de condiciones.

La ficha ahora agrupa «Tu selección», conserva junto a la compra la variante, cantidad y **precio por unidad que devuelve el backend**, y ofrece Editar sobre ese resumen completo de al menos 44 px de alto. Editar vuelve al selector medido bajo el encabezado y transfiere el foco. Vendido por antecede a condiciones; no se añade otra hoja, cálculo, promoción ni paso de checkout.

Mientras se agrega se bloquean variante, cantidad, Editar y la acción de compra concurrente. Un bloqueo síncrono evita dos envíos rápidos antes del siguiente render. La confirmación reemplaza el resumen; cambiar la selección la retira para que no describa otro producto/color/cantidad. Se conservan stock, máximos, errores y acciones Comprar/Encargar/Reservar/Avisarme existentes.

En Android la galería y su skeleton comienzan debajo del área de estado del sistema, con superficie del tema detrás del reloj e iconos. La apariencia se restaura al salir. No cambia configuración nativa ni iOS; la validación real del contraste sigue pendiente de la OTA de este bloque.

## Product Design y equipo

El director UX leyó mediante `skills.read` el paquete `c1/audit`, recurso exacto:

`skill://Plugin_fa77aec24fc08191bc6e57f377126d76/audit/references/design-audit-framework.md`

- **Hierarchy and clarity:** variante, cantidad e importe unitario acompañan la acción.
- **Interaction flow and friction:** Editar vuelve al control existente, sin un recorrido nuevo.
- **Responsive reflow and zoom resilience:** el resumen crece sin truncar selección, importe o botones.

El framework aporta esos criterios; la composición y las medidas son decisiones del proyecto. No se atribuye al complemento una plantilla o aprobación automática. Canvas/Canva no disponible. Root es el único escritor; UX, especialista comercial y auditor revisan independientemente.

## Medidas y pruebas

La barra normal mide **131 px** en las cuatro combinaciones web 320/412 y claro/oscuro. El selector completo mide 198 px y, al activar Editar, comienza en **y=68**: queda entero por encima de la barra. El padding inferior responde a la altura real. Se acepta el coste vertical porque mantiene contexto comercial fuera del primer desplazamiento; no se acorta ni recorta la foto para compensarlo.

**8/8 casos UI finales aprobados**, ambos temas:

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

Auditor aceptó composición normal y exigió corregir el foco de Editar: resuelto y probado. Se sustituyó un nombre de icono inexistente que mostraba el pictograma de etiqueta por `arrow-up` del conjunto real. Sin revisión infinita ni otra auditoría global.

Pendiente: dictamen final independiente, commit/push de evidencia, EAS Android preview con guard exacto APK 5 y recepción nueva mediante `13-ficha-seleccion` / `14-ficha-seleccion-texto`, claro/oscuro normal/OS 1,6. No APK nuevo, production, cambios nativos, backend, cálculos o pagos.
