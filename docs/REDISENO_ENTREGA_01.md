# HAYAZGO — Rediseño de producto, Entrega 01

Estado: implementación y checkpoint;29/29 focalizadas aprobadas. Evidencia final/publicación aún en cierre. Alcance: Buscar, tarjetas compartidas y adaptación indispensable de skeleton/mini tarjetas. Base baeb39d. No Entrega 02.

## Método y criterio

Product Design real: index/SKILL.md, audit/SKILL.md y audit/references/design-audit-framework.md del plugin product-design@openai-curated-remote. Contexto: DISENO, DIRECCION_PRODUCTO, tokens y código actuales; preflight sin contexto personal guardado. Browser skill/Sites no expuestos; Chromium/Playwright local permite capturas reales del código existente. Referencias generales critical-overrides/communication-protocol no disponibles en el paquete; no se afirma haberlas consultado.

Lentes aplicadas: jerarquía/claridad, arquitectura, fricción, consistencia y estados; lectura/contraste, foco/teclado, objetivo táctil, movimiento reducido y reflujo. Decisiones: sustituir dos barras de cápsulas por categorías discretas y herramientas agrupadas; reservar cabecera fija para búsqueda/herramientas; precio/disponibilidad en hoja secundaria sin perder capacidades. Imagen 4:5 protagonista; favorito visual19 px/táctil44, sin sombra/círculo oscuro; radios10, nombre una línea, precio tabular destacado y estados honestos.

## Evidencia antes

20 capturas nuevas del estado actual, no históricas. Herramienta tools/design/capture-delivery-01.mjs; .local/delivery-01/before. Web exportada Chromium, datos demo locales, viewports412×892 y320×780, ambos temas. Estados: catálogo, Belleza, ordenar, vacío, scroll600. No pruebas físicas Android. Primera tarjeta y=270 px en ambos anchos; 2 completas/4 al menos parciales. Capturas inspeccionadas: título y dos barras ocupan espacio; favorito44 círculo dominante especialmente en oscuro.

## Pendiente de este bloque

Implementación, mismas capturas después/mediciones, pruebas focalizadas y runtime Android; luego checkpoint/publicación preview autorizada y emulador APK5 si comprobaciones satisfactorias. No publicar si falla validación.

## Implementación y comprobación focalizada

Buscar inicia con buscador48px, herramientas44px y categorías discretas44px; cabecera164 frente270 antes. Fijos búsqueda/herramientas/conteo con categoría; categorías/resumen se desplazan para priorizar catálogo. Sin título grande/dos barras de cápsulas. Precio/disponibilidad se editan como borrador en Sheet común; cerrar cancela, Aplicar hace una consulta conjunta, Restablecer conserva contexto protegido. Cinco órdenes y cuatro disponibilidades conservados.

Tarjetas:4:5 existente, radio10 frente18; corazón19 frente22 y superficie28 frente círculo44 con sombra. Objetivo44, acción separada del enlace, estado accesible/optimista/háptica y escala existente. Nombre13/18 semibold, una línea/tracking−0,1; precio16/20 extrabold/tabular/tracking−0,3; sin nuevas conversiones o cálculos. Oferta/escasez reales conservadas, Demo no las simula; agotado/encargo/en camino/reservable visibles. Skeleton tiene altura idéntica, mini tarjeta mantiene lenguaje; fotos omiten fade con movimiento reducido.

29/29 regresión focalizada en1,3min: Buscar/filtros/RPC/borrador/cancelar/contextos/scroll/regreso, normal/oferta/agotado/encargo/demo, favorito real persistente y separado de ficha en Inicio/Buscar/colección/favoritos, teclado/Space/Escape/reduced motion y carga. Tipos/lint mobile aprobados. Contratos/precios/backend sin cambiar. Primeros fallos: activación Space en radio corregida solo web; selector skeleton renombrado para no coincidir con enlaces; tests esperan debounce/caché; reinicios simultáneos de stack local interrumpieron un pase, repetido con único dueño. No pruebas desactivadas.

La captura inicial de scroll no se había desplazado: cuatro tomas rechazadas y recapturadas desde snapshot exportado de baeb39d, sin cambiar rama ni fuentes actuales. No publicar tomas rechazadas como evidencia.
