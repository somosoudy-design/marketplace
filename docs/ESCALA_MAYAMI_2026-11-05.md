# mayami · escala contextual y coherencia de arranque

5 de noviembre de 2026. Oliver rechazó el tamaño de la primera integración y señaló la K del arranque.
El mínimo144 de la guía se había aplicado como una regla de interfaz; cabía, pero su peso visual era
excesivo. Se corrige el criterio, conservando exactamente el original de Work.

## Decisión y resultado

| Contexto | Antes | Ahora |
|---|---|---|
| Inicio app |144×27,32px|112×21,25px|
| Cabecera fija app |144×27,32px|96×18,21px|
| Cabecera web móvil/escritorio |144/176px|112/144px|
| Pie web |144/160px|112px|
| Panel navegación/acceso |144/160px|112/144px|

Los controles conservan44px; no se reducen letras de la interfaz, fotografías ni márgenes para compensar
la marca. El ancho visible normal baja22,2%; el área gráfica39,5%. En sticky la búsqueda crece
132→180px a320 y224→272px a412. La primera fila de productos permanece en y406/y440: **no se ganó altura
de catálogo**; mejoró el peso relativo y el espacio para buscar. Maestro SVG, colores y proporción intactos.
`brandMarkWidths` define los tamaños de contexto; `brand-artwork.json` conserva la referencia original
del manual. Esta excepción responde al feedback explícito de Oliver, no altera el archivo recibido.

El avatar sin nombre ahora usa una persona, en lugar de la K heredada. Se conservan fotos e iniciales de
usuarios con nombre; no sustituir una inicial legítima del usuario por el logo del marketplace.

## Evidencia comparable

Datos locales, mismas rutas/temas/anchos. PNG completos sin retoques; no capturas físicas Android.

| Estado | Antes | Después |
|---|---|---|
| Inicio320 claro | [Captura](capturas/escala-mayami-2026-11-05/before-01-app-home-320-light.png) | [Captura](capturas/escala-mayami-2026-11-05/after-01-app-home-320-light.png) |
| Inicio412 oscuro | [Captura](capturas/escala-mayami-2026-11-05/before-01-app-home-412-dark.png) | [Captura](capturas/escala-mayami-2026-11-05/after-01-app-home-412-dark.png) |
| Barra fija320 oscuro | [Captura](capturas/escala-mayami-2026-11-05/before-08-app-sticky-320-dark.png) | [Captura](capturas/escala-mayami-2026-11-05/after-08-app-sticky-320-dark.png) |
| Web320 claro | [Captura](capturas/escala-mayami-2026-11-05/before-02-web-home-320-light.png) | [Captura](capturas/escala-mayami-2026-11-05/after-02-web-home-320-light.png) |
| Panel320 oscuro | [Captura](capturas/escala-mayami-2026-11-05/before-07-panel-menu-320-dark.png) | [Captura](capturas/escala-mayami-2026-11-05/after-07-panel-menu-320-dark.png) |

## K del arranque: causa y solución concreta pendiente

La K está compilada en splash, icono adaptativo, monocromo y notificaciones del APK5. `_layout.tsx`
sólo retiene el splash mientras prepara fuentes/sesión; no hay una introducciónJS con K que sustituir.
Ocultarlo con otra pantalla no cambia el primer frame y añade una transición artificial; se descartó.

[Propuesta nativa lista para revisión](propuestas/marca-nativa-mayami/README.md): cinco PNG originales o
rasterizados de sus trazados, manifiestos, patch Android y verificador. Usa M del kit en superficies
compactas; etiqueta instalada mayami, paquete/scheme/firma/canal existentes. Patch no aplicado y ningún
APK generado. La receta de recursos sí se ejecutó fuera de la configuración activa, sin dependencias nuevas.
El verificador comprobó8hashes, sintaxis, aplicación limpia del patch y aislamiento de la etiqueta Android.
No equivale a probar un APK. Hay que verificar máscara, arranque, firma y versionCode en la futura build.

**La restricción previa de Oliver de no generar APK nuevo impide completar el cambio de la K nativa.**
La siguiente acción requiere levantar esa restricción; el trabajo preparatorio ya está guardado.

## Revisión y pruebas

- Dirección visual:112/96 reconoce la marca y reduce su dominio; recomendación de segunda intro descartada.
- Integración:63 fuentes nativas idénticas; assets/configuración compilados siguen intactos. CI comprobará
  además el runtime exacto APK5 antes de OTA.
- Auditor independiente: **APROBADO para la escala de interfaz**.10 escenarios propios (8contexto y2geometría/
  fuente160%) con320/412/1440, claro/oscuro, acceso y navegación. No aprueba como resuelta la K nativa.
- Root:2 regresiones web de cabecera checkout/pago y1 flujo de foto (cancelación, error, persistencia,
  retirada y avatar sin nombre);4 comprobaciones de originales; tipos/lint, builds Next y exports Expo
  web/Android Hermes pasan. Sin cambios de precios, pagos, backend o configuración iOS.
- Product Design audit/framework y directrices de Oliver aplicados: jerarquía, proporción contextual,
  comparación real y límites de evidencia. Se corrige la evaluación anterior de «cabe» como aceptación
  suficiente; no se vuelve a inventar una marca ni se retoca su dibujo.

## Publicación

Pendiente de guard APK5 y respuesta EAS. Sólo Android preview; web/panel validados localmente, sin despliegue.
No afirmar recepción en Samsung ni desaparición de la K nativa con esta OTA.
