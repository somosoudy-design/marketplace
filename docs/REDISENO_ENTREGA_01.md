# HAYAZGO — Rediseño de producto, Entrega 01

**Estado:** validación local y visual completada; publicación preview autorizada en preparación. Fuente móvil d945797, base baeb39d. Alcance exclusivo Buscar/tarjetas compartidas y adaptaciones indispensables de mini/skeleton/colecciones. Entrega 02 no iniciada.

## Product Design aplicado

Integración real: [Product Design](plugin://product-design@openai-curated-remote/). Recursos consultados:

- index/SKILL.md: revisar producto existente antes de implementar.
- audit/SKILL.md: captura primero, inspección de archivos, rechazar estado equivocado, hallazgos ligados a evidencia actual.
- audit/references/design-audit-framework.md: jerarquía/claridad, arquitectura, fricción, consistencia/estados; contraste/lectura, foco/teclado, targets, movimiento y reflujo.
- user-context/SKILL.md y su preflight: no contexto personal guardado; grounding en DISENO/DIRECCION_PRODUCTO/tokens/código reales.

Paquete skill://Plugin_fa77aec24fc08191bc6e57f377126d76. Referencias generales critical-overrides/communication-protocol no disponibles; no se afirma consultarlas. Browser skill/Sites no expuestos; Chromium/Playwright permite capturas reales del código existente. No imágenes generadas, prototipo aparte ni resultados de navegador presentados como Android físico.

## Antes: riesgos de composición

1. Título grande + buscador + categorías en cápsulas + segunda barra de cápsulas + conteo relegaban productos a y270px. Categorías y herramientas competían visualmente.
2. Corazón22px/círculo44px/sombra, oscuro en dark, competía con fotografía; radio18 excesivo para superficie comercial compacta.
3. Al desplazar se perdía acceso a búsqueda/filtros; carga tenía skeleton de altura distinta.

## Después: decisiones concretas

1. **Buscar:** sin título grande. Buscador rectangular48px, conteo/Filtrar/Ordenar agrupados y categorías de texto44px con subrayado violeta. Búsqueda/herramientas quedan fijas; categorías/resumen se desplazan. Categoría en conteo mantiene contexto. La selección de orden se anuncia y se identifica en el resumen.
2. **Filtros:** precio/disponibilidad en Sheet común. Borrador sin consultar hasta Aplicar; cerrar/Escape/Atrás descartan; Restablecer conserva contexto protegido. Las cinco opciones de orden, cinco rangos, cuatro disponibilidades, búsquedas/categorías/tienda/colección/paginación permanecen. Una sola consulta conjunta al aplicar. No cálculos o contratos nuevos.
3. **Tarjeta:** fotografía4:5 intacta, superficie única/radio10/borde semántico sutil, sin sombras; corazón19px/superficie28px sin círculo oscuro, objetivo44×44 separado del enlace. Nombre13/18 semibold/tracking−0,1/una línea; precio16/20 extrabold/tabular/tracking−0,3. Una familia Plus Jakarta Sans.
4. **Estados:** oferta/escasez reales preservadas, Demo nunca las simula; agotado/encargo/en camino/reservable discretos sobre foto. Skeleton con altura idéntica; mini tarjeta conserva lenguaje. Favorito optimista/háptica/escala existente, selección clara; hojas/press/fade respetan movimiento reducido. Marco del buscador conserva dimensiones al enfocar.
5. **Técnica:** Catalog/Sheet/Price/tokens existentes, FlatList/caché/virtualización conservadas; landmark web nombrado para lectura, activación Space de opciones corregida solo web. Sin nuevos módulos/dependencias/configuración nativa/backend.

## Medición comparable

Altura desde borde superior del viewport web hasta primera tarjeta, catálogo inicial sin filtros. Margen inferior se mide respecto a barra de pestañas real. No incluye barra de estado física Android.

| Viewport / tema | Antes | Después | Tarjetas completas antes→después | Al menos parcialmente visibles |
|---|---:|---:|---:|---:|
|412×892 claro|270px|164px|2→4|4→6|
|412×892 oscuro|270px|164px|2→4|4→6|
|320×780 claro|270px|164px|2→4|4→6|
|320×780 oscuro|270px|164px|2→4|4→6|

**106px menos (39,3%)** antes del catálogo, manteniendo fotografía/tamaño de tarjeta. Geometría original: capturas/entrega-01/measurements.json.

## Evidencia actual

20 pares: catálogo, Belleza, ordenar, vacío y desplazamiento600 en ambos anchos/temas. PNG originales copiados sin recortar, componer, retocar o cambiar escala;50 archivos/3,6MB, incluyendo10 extras posteriores. Datos demo locales. Las capturas de variantes son respuestas aisladas de pruebas rotuladas «Prueba»; no promociones reales ni datos publicados.

Cuatro primeras tomas de scroll no se habían desplazado: rechazadas. Se recapturaron con el código exacto baeb39d exportado en snapshot ignorado, sin cambiar rama, datos o fuentes actuales. No se publican las tomas inválidas como evidencia.

| Estado inicial | Antes | Después |
|---|---|---|
|412 claro|![Antes](capturas/entrega-01/before/412-light-catalog.png)|![Después](capturas/entrega-01/after/412-light-catalog.png)|
|412 oscuro|![Antes](capturas/entrega-01/before/412-dark-catalog.png)|![Después](capturas/entrega-01/after/412-dark-catalog.png)|
|320 claro|![Antes](capturas/entrega-01/before/320-light-catalog.png)|![Después](capturas/entrega-01/after/320-light-catalog.png)|
|320 oscuro|![Antes](capturas/entrega-01/before/320-dark-catalog.png)|![Después](capturas/entrega-01/after/320-dark-catalog.png)|

<details><summary>Categoría, ordenar, vacío y scroll equivalentes</summary>

| Estado | Antes | Después |
|---|---|---|
|412-light-category|![Antes](capturas/entrega-01/before/412-light-category.png)|![Después](capturas/entrega-01/after/412-light-category.png)|
|412-light-sort|![Antes](capturas/entrega-01/before/412-light-sort.png)|![Después](capturas/entrega-01/after/412-light-sort.png)|
|412-light-empty|![Antes](capturas/entrega-01/before/412-light-empty.png)|![Después](capturas/entrega-01/after/412-light-empty.png)|
|412-light-scroll|![Antes](capturas/entrega-01/before/412-light-scroll.png)|![Después](capturas/entrega-01/after/412-light-scroll.png)|
|412-dark-category|![Antes](capturas/entrega-01/before/412-dark-category.png)|![Después](capturas/entrega-01/after/412-dark-category.png)|
|412-dark-sort|![Antes](capturas/entrega-01/before/412-dark-sort.png)|![Después](capturas/entrega-01/after/412-dark-sort.png)|
|412-dark-empty|![Antes](capturas/entrega-01/before/412-dark-empty.png)|![Después](capturas/entrega-01/after/412-dark-empty.png)|
|412-dark-scroll|![Antes](capturas/entrega-01/before/412-dark-scroll.png)|![Después](capturas/entrega-01/after/412-dark-scroll.png)|
|320-light-category|![Antes](capturas/entrega-01/before/320-light-category.png)|![Después](capturas/entrega-01/after/320-light-category.png)|
|320-light-sort|![Antes](capturas/entrega-01/before/320-light-sort.png)|![Después](capturas/entrega-01/after/320-light-sort.png)|
|320-light-empty|![Antes](capturas/entrega-01/before/320-light-empty.png)|![Después](capturas/entrega-01/after/320-light-empty.png)|
|320-light-scroll|![Antes](capturas/entrega-01/before/320-light-scroll.png)|![Después](capturas/entrega-01/after/320-light-scroll.png)|
|320-dark-category|![Antes](capturas/entrega-01/before/320-dark-category.png)|![Después](capturas/entrega-01/after/320-dark-category.png)|
|320-dark-sort|![Antes](capturas/entrega-01/before/320-dark-sort.png)|![Después](capturas/entrega-01/after/320-dark-sort.png)|
|320-dark-empty|![Antes](capturas/entrega-01/before/320-dark-empty.png)|![Después](capturas/entrega-01/after/320-dark-empty.png)|
|320-dark-scroll|![Antes](capturas/entrega-01/before/320-dark-scroll.png)|![Después](capturas/entrega-01/after/320-dark-scroll.png)|

</details>

| Estados nuevos / comprobación | Claro | Oscuro |
|---|---|---|
|Hoja de filtros|![Claro](capturas/entrega-01/extra/320-light-filters.png)|![Oscuro](capturas/entrega-01/extra/320-dark-filters.png)|
|Estados comerciales de prueba|![Claro](capturas/entrega-01/extra/320-light-variants.png)|![Oscuro](capturas/entrega-01/extra/320-dark-variants.png)|

## Funcionamiento y límites

-29/29 Playwright focalizadas sobre fuente final,1,3min: claro/oscuro/320px, borrador/aplicar/cancelar/rangos y parámetros RPC reales, búsqueda/categorías/contextos protegidos, scroll/regreso, favoritos reales persistentes/acción independiente en Inicio/Buscar/colecciones/Favoritos, teclado/Space/Escape/movimiento reducido, normal/oferta/agotado/encargo/demo y carga sin salto.
-Tipos/lint mobile, exportación web y Android JS/Hermes aprobados; HBC5,9MB. Esto último no es un APK o ejecución nativa.
-axe:0 infracciones y0 verificaciones incompletas en8 vistas específicas (filtros/activos/variantes/carga, ambos temas). No certificación completa WCAG ni prueba TalkBack.
-50 PNG revisados,320/412/768px. Sin overflow observado; misma geometría inicial/4 tarjetas completas. Scroll conserva buscador/herramientas/contexto. No benchmark formal de rendimiento ni dispositivo físico conectado.

Incidencias resueltas: Space de radio no activaba en web; testID skeleton coincidía con selector de enlaces; tests contaban resultados placeholder antes de debounce; arranque paralelo de servicios locales dejó backend inaccesible e interrumpió un pase. Último pase usa único proceso dueño del stack, sin reset/borrado; ningún test desactivado.

Reproducción en cloud (servicios y runner/captura en una misma sesión): source /workspace/.onboarding/env.sh; pnpm stack:start; pnpm --filter @kora/app-e2e build:web; Playwright con playwright-app.config.ts y filtro de Entrega01/Buscar/favoritos/contextos; servir serve.mjs8089 y ejecutar tools/design/{capture,verify}-delivery-01.mjs. Reutilizar axe temporal; no instalar dependencias de app.

## Publicación y continuidad

Preview Android autorizado por Oliver para esta entrega, después de validación. Runtime esperado APK5: eb5ed1179b9c76c9c3cf27333aa48306728eb4ba. Guard exacto EAS antes de publicar; no APK nuevo/cambio de canal. Actualizar aquí run/resultado y prueba nativa07 clara/oscura con ID/fecha/capturas tras publicación.

Siguiente: Oliver revisa esta versión en Samsung S24. Entrega02/Inicio solamente después de su revisión y nuevas instrucciones: jerarquía editorial, categorías/carruseles/ritmo del scroll con las tarjetas nuevas, sin reconstruir funciones. No iniciar ahora. BCV/SQL Mi tienda separados.
