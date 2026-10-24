# Catálogo: cinco referencias con edición de estudio

**Validación local terminada; publicación y recepción Android pendientes.** Prioridad reafirmada por Oliver: completar imágenes antes de continuar UX general. Código final `69dcac5`, base `7025f23`. Android preview/APK 5 exclusivamente. La OTA vigente sigue siendo `01a16b56-46a9-7960-a239-4b2271e68d5a` hasta confirmar la nueva publicación.

## Cambio efectivo

Cinco referencias con fotografías documentales tienen **seis nuevas ediciones de estudio**, con encuadre, iluminación y fondo coherentes con el lote anterior. Se reutilizan fotografías CC autorizadas ya presentes en el proyecto. Son **derivados generativos declarados**, con atribución y licencia; no fotografías oficiales del fabricante ni acreditación de una unidad comercial.

| Producto existente | Presentación | Licencia |
|---|---|---|
| UGREEN lector SD · USB-A y USB-C | Lector, tapa y lazo; ambas conexiones del mismo objeto | CC0 |
| UGREEN cargador de carro 30 W · 25845 | Negro, USB-C/USB-A e indicador frontal | CC BY-SA 4.0 |
| Samsung EP-T4510 | Con cable / solo cargador, según variante real | CC BY-SA 4.0 |
| Anker PowerCore 10.000 mAh | Vista cenital, sin atribuir accesorios incluidos | CC BY 4.0 |
| StarTech ST7300U3M | Vista frontal, siete puertos; sin inventar conexiones laterales | CC BY-SA 4.0 |

**6 WebP a 1024 px / 426.812 bytes.** Registro existente por UUID/ruta/variante: doce asignaciones sustituyen las seis documentales; se conservan las 55 asignaciones del lote de 32 imágenes. Samsung solo usa su imagen sin cable también en el carrito. La galería no mezcla presentaciones.

Se exige `is_demo` confirmado, Android preview y backend Marketplace; las demás configuraciones mantienen Storage. Sin cambios de backend, precios, existencias, moderación, permisos, finanzas, iOS o configuración nativa. Sin APK nuevo.

[Fuentes, prompts, revisiones y hashes](../../apps/mobile/assets/catalog-exhibition/studio-manifest.json). [Licencias por archivo](../../apps/mobile/assets/catalog-exhibition/LICENSE-studio-images.md). La app enlaza autor, licencia y ambas fuentes Samsung, incluida la macro usada para el puerto.

## Comparación real

**60 PNG sin editar:** 28 anteriores y 28 posteriores de Inicio C, Buscar UGREEN y cinco fichas, a 320/412 px y ambos temas; cuatro de Samsung solo y carrito a 320 px. Código anterior `7025f23`; posterior `69dcac5`. No son evidencia Android física. [Procedencia y hashes](../capturas/estudio-cc-2026-10-24/web-evidence.json).

| Estado | Antes | Después |
|---|---|---|
| Inicio, oscuro 320 | [Captura](../capturas/estudio-cc-2026-10-24/before/dark/320-inicio.png) | [Captura](../capturas/estudio-cc-2026-10-24/after/dark/320-inicio.png) |
| Buscar UGREEN, claro 412 | [Captura](../capturas/estudio-cc-2026-10-24/before/light/412-buscar-ugreen.png) | [Captura](../capturas/estudio-cc-2026-10-24/after/light/412-buscar-ugreen.png) |
| Lector, oscuro 320 | [Captura](../capturas/estudio-cc-2026-10-24/before/dark/320-ficha-3.png) | [Captura](../capturas/estudio-cc-2026-10-24/after/dark/320-ficha-3.png) |
| Samsung, claro 320 | [Captura](../capturas/estudio-cc-2026-10-24/before/light/320-ficha-1.png) | [Con cable](../capturas/estudio-cc-2026-10-24/after/light/320-ficha-1.png) |
| Variante y carrito | — | [Solo](../capturas/estudio-cc-2026-10-24/validation/dark-samsung-solo.png) · [Carrito](../capturas/estudio-cc-2026-10-24/validation/dark-carrito-solo.png) |

UGREEN todavía muestra seis referencias con recursos anteriores; la comparación no se presenta como renovación completa.

## Pruebas y revisión independiente

- Tipos/lint móvil y exportaciones web/Android Hermes finales aprobados. Los seis archivos están en el export Android: [6/6 hashes concordantes](../capturas/estudio-cc-2026-10-24/android-assets.json).
- Ocho unitarias de aislamiento y seis UI finales aprobadas: cuatro nuevas de recursos/licencias y Samsung solo → carrito → acceso a sesión, más dos regresiones de Inicio/Buscar/cinco fichas. Ambos temas; cero desbordamientos en las 56 comparables.
- Consultas públicas de lectura; carrito del dispositivo. Sin pedidos, cotizaciones, pagos o sesiones remotas creadas. Favoritos autenticados y checkout no recorridos de nuevo.
- Arte: auditor independiente aprobó seis finales tras corregir puerto USB-C, indicador, cable cortado y lateral inventado. Anker terminó con vista conservadora sin panel de conexiones. Borradores rechazados ignorados y fuera del paquete.
- Código: auditor exigió atribuir también la macro Samsung; enlace añadido y probado. Una Home oscura y varias validaciones estaban en transición/scroll: descartadas y recapturadas tras comprobar región activa, posición, recurso decodificado y pintura final. No se modificó la app para ocultar fallos del capturador.

Flujos Android preparados: `15-catalogo-estudio` / `16-catalogo-estudio-texto`, claro/oscuro y fuente OS normal/1,6. Sintaxis YAML comprobada; ejecución y nueva recepción OTA pendientes. No atribuir al Samsung de Oliver la evidencia web o del emulador.

**Dictamen independiente final web: APROBADO publicar**, fuente69dcac5. Auditor inspeccionó las28posteriores y4validaciones, comparó cuatro anteriores representativas, verificó60/60hashes y los bytes reales de6/6recursos en el export Android. Confirmó créditos completos, aislamiento y coherencia kit/solo/carrito; sin P1/P2 nuevas en este alcance. No requiere otra ronda web. La recepción nativa y fuente OS se aceptarán únicamente tras la ejecución correspondiente.

## Cobertura pendiente

Tras publicar serán **30 productos renovados de 44**, con 38 imágenes activas nuevas. Permanecen **13 muestras pendientes: seis UGREEN y siete SHEGLAM**. DJI no demo conserva su fotografía real del backend.

Dos agentes revisaron fuentes previas y páginas oficiales de términos/medios/sitemaps, sin repetir descargas de productos ni diagnóstico de Supabase. No localizaron nueva licencia pública ni correspondencia suficiente de SKU/tono para esas muestras. Afiliación o CDN200 no acredita esos requisitos.

[Referencias concretas para completar las 13 muestras](RECURSOS_PENDIENTES_2026-10-24.md) · [Decisiones por UUID y fuentes](RECURSOS_PENDIENTES_2026-10-24.json). El permiso de publicar avances ya está vigente; faltan identidad y derechos del material, no otra confirmación rutinaria.

## Recursos y equipo

Criterios realmente leídos de Product Design, `c1/audit`, recurso `skill://Plugin_fa77aec24fc08191bc6e57f377126d76/audit/references/design-audit-framework.md`: consistencia entre apariciones, claridad perceptiva y confianza. No nueva auditoría general ni atribución al framework de una licencia o fidelidad que no certifica. Canvas/Canva no disponible; ImageGen usado para las ediciones. Root único escritor/committer; catálogo/derechos y auditor independientes.
