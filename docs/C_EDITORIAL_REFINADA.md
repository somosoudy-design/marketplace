# C — Electric Violet Editorial: refinamiento e implementación

2026-10-13. **Oliver eligió C**, por continuidad y sensación de tienda integrada. La recomendación B anterior queda como antecedente. Primero pidió no publicar; luego autorizó explícitamente reemplazar la portada para verla en su Android. Se publicará solo cuando cierre revisión/pruebas y el guard confirme APK 5; canal `preview`, sin APK ni cambios nativos.

## Decisión de composición

Una superficie continua de ancho completo integra marca, búsqueda y editorial. Título de colección de ancho útil completo; debajo, SKU/Demo/precio/CTA con foto íntegra lateral. No hay contenedor flotante del hero, radio exterior, márgenes entre marca y editorial ni sombra. Las categorías forman el puente en la superficie del catálogo; después aparecen cuatro productos contiguos. **C no adopta la secuencia de B.**

Se compacta mediante agrupación, ancho del título, escala comercial y eliminación de espacio redundante. No se quitan leyendas, precio, disponibilidad ni categorías. Cabecera/categorías mantienen objetivos ≥44; búsqueda ≥48 y crece si el texto necesita más espacio. Con fuente OS grande, leyenda/nombre ocupan el ancho completo y foto acompaña precio/acción; comparación de una columna. Sin altura máxima.

## Antes y después: medidas verificables

| Evidencia | Banda hasta fin de editorial | Primera fotografía de comparación | Completas |
|---|---:|---:|---:|
| C elegida, esquema generado 853×1844 presentado a 412 | **395,58 px** | ≈503 px, lectura visual | 2 |
| C refinada por ImageGen, misma proporción | **363,70 px** | No se utiliza como prueba de la app | — |
| C implementada, web 412×892, ambos temas | **316 px** | **421 px** | 2 |
| C implementada, web 320×892, ambos temas | **319 px** | **424 px** | 2 |
| App publicada antes de este bloque, web 412 | Superficies separadas; no es una banda C continua | 429 px | 2 |
| App publicada antes de este bloque, web 320 | Superficies separadas; no es una banda C continua | 432 px | 2 |

El esquema C original tiene borde exterior en y=819; la ideación corregida en y=753. Conversión reproducible por ancho `y × 412 / 853`, sin deformar ni retocar imágenes: [geometría raster](diseno-v2/c-refinada/geometria-raster.json). Esa medida real de un esquema **no prueba reflow** ni equivale a un `onLayout` Android. La ideación sola no resolvió todo el presupuesto; la composición en código sí alcanza 316/319.

Medidas DOM de la app: [normal y estrés](capturas/c-editorial/after/mediciones-detalladas.json), [antes real](capturas/c-editorial/before/mediciones.json). La banda de 412 reduce **79,58 px (~20%)** frente a C elegida. Frente a la app publicada anterior, el comienzo del catálogo mejora solo 8 px: la mejora principal es **continuidad estructural**, no fingir cuatro tarjetas completas ni una gran ganancia de densidad.

| Estado | Antes real en app | C nueva real en web |
|---|---|---|
| Claro 412 | [PNG](capturas/c-editorial/before/light-412-inicio.png) | [PNG](capturas/c-editorial/after/light-412-normal.png) |
| Oscuro 412 | [PNG](capturas/c-editorial/before/dark-412-inicio.png) | [PNG](capturas/c-editorial/after/dark-412-normal.png) |
| Claro 320 | [PNG](capturas/c-editorial/before/light-320-inicio.png) | [PNG](capturas/c-editorial/after/light-320-normal.png) |
| Oscuro 320 | [PNG](capturas/c-editorial/before/dark-320-inicio.png) | [PNG](capturas/c-editorial/after/dark-320-normal.png) |

Estrés web CSS 1,6, **sin cambiar fontScale de React Native**: banda 527,38/463,38 y comienzo de productos 646,78/582,78 en 320/412, ambos temas. Crece sin cortar editorial, precio ni búsqueda; el buscador persistente sigue accesible. No exige dos tarjetas completas con texto grande. [Claro 320](capturas/c-editorial/after/light-320-texto-css.png) / [oscuro 412](capturas/c-editorial/after/dark-412-texto-css.png). La etiqueta Inicio truncada en esta simulación no acredita el ajuste nativo. OS 1,6 requiere comprobación Android aparte.

## Implementación y contratos conservados

- `index.tsx`: masthead y editorial adyacentes, con el mismo fondo; categorías después. Saludo y contadores reales, cuatro destinos y acciones existentes. Buscador persistente mide la posición real del campo después de layout/reflow. Estilo claro de barra de estado solo mientras Inicio tiene foco, con stack JS/restauración al salir y guard web; ninguna configuración nativa.
- `EditorialOpening.tsx`: único destino de colección y nombre completo, precio del servidor, Demo y disponibilidad excepcional. Imagen original del catálogo con contain, sin usar ImageGen como asset. Título completo y reflow nativo del caption.
- `SectionHeader`: variante `stackAction` usada solo en módulos de Inicio, para que acciones no partan titulares en 320/fuente grande. Los demás consumidores conservan su variante; no hay pulido global.
- Todos los `TrackedSection` permanecen hijos directos del contenedor de scroll: integrar visualmente no añade un padre con coordenadas distintas. Perfil/preferencia resueltos, keys/slot y filas independientes conservados. Abrir colección no cuenta como abrir SKU.
- `/catalog` con parámetros `collection/title` o `category/title`; `/explore` para búsqueda; ficha, favoritos independientes, carrito y regreso existentes. Resto de recomendaciones, Retoma, colecciones y tiendas sigue accesible. Sin hero válido, no bloque editorial vacío. Catálogo vacío/error/guardados siguen los estados existentes.

No se modifican Supabase/SQL/servicios, datos remotos, checkout, finanzas, BCV, vendedor, panel, iOS, nombre, dependencias o configuración APK.

## Product Design y control de calidad

`index`, `audit`, framework, `ideate` y preflight realmente consultados. Brief ya resuelto por elección C; una edición ImageGen con captura real/C y assets Demo adjuntos. Prompt en [archivo](diseno-v2/c-refinada/prompt.txt); resultado es referencia de composición, no fotografía ni evidencia nativa. Aplicados jerarquía, continuidad, claridad comercial, reflow y límites de evidencia. No se hizo otra auditoría general ni se copió cada píxel de la imagen.

Raíz es único escritor; UX/UI, ecommerce y auditor son lectores reales. **Revisión focal cerrada en ronda 1: APROBADO**, sin cambios obligatorios, por auditor independiente, UX/UI y ecommerce. Los lectores inspeccionaron fuente, medidas y capturas de ambos temas/anchos/estrés. Criterios: banda normal 310–335 en 412 (hasta355 en320 si reflow), primeras fotos ≤450/470, dos completas normales, ninguna información/ruta perdida, crecimiento legible y métricas correctas. No aprobar por tests solamente. No fue necesaria una segunda ronda al no haber objeciones significativas. La aprobación todavía distingue web/código de la comprobación nativa posterior.

| Especialista | Veredicto y hallazgos |
|---|---|
| Auditor independiente | APROBADO:16 capturas,316/319 y421/424 cumplen presupuesto; C continua, cuatro después, tracking correcto. OS1,6/statusbar/recepción aún por comprobar |
| UX/UI | APROBADO visual web: escala menor conserva C, foto íntegra más pequeña es coste; no más densidad inventada ni nueva pulida |
| Ecommerce | APROBADO comercial: colección/SKU/precio/Demo claros, orden/fallback/rutas y medición conservados |
| Director de Producto | Integró elección C; rechazó tomar ImageGen como medida de app, captura con fade y APIStatusBar incompatible con web; correcciones verificadas. Sin desacuerdos importantes |

## Pruebas y límites del checkpoint

- **31/31 focales finales** en claro/oscuro, sin omisiones ni reintentos, tras la variante de encabezados (1,9 min). Catálogo/contexto/favorito/atrás/carrito, fallback/pocos datos/agotado, búsqueda y continuidad C, tracking con sesión local/perfil demorado.
- Tipos/lint global aprobados antes de la última variante; tipos/lint móvil aprobados después. Exportación web y **Android/Hermes 5,9 MB aprobadas**, sin dependencia nueva.
- Ocho estados web y ocho scroll, sin errores JS/overflow horizontal/recortes de editorial y búsqueda. Una captura tomada durante fade de imágenes fue rechazada y recapturada tras estabilizar, sin retoque.
- Primer intento de captura falló por `StatusBar.pushStackEntry` ausente en web; guard de plataforma corregido y pase repetido. Primer typecheck señaló una referencia `t` retirada por error; restaurada. No se eliminaron aserciones ni pruebas.
- Backend API local actual en lectura/rollback; Auth de cuenta Demo existente sin bootstrap/reset/migración. Tracking valida solicitudes, no persistencia de telemetría. Sin compras/pagos remotos.
- Cinco pares sólidos de texto verificados, contraste mínimo **6,88:1**; [resultados](diseno-v2/c-refinada/contraste.json). No equivale a certificación WCAG/TalkBack ni contraste sobre fotos.
- Flujo Android08 conserva recorridos y añade buscador persistente→Buscar→Inicio; flujo09 existente comprueba fuente OS1,6. Se ejecutarán sobre la OTA real, no sobre el export local.

**Pendiente:** publicación con guard exacto, ID y recepción Android/OS1,6. La OTA previa sigue vigente. No afirmar recepción en Samsung ni pruebas nativas de esta versión antes de comprobarlas.

## Lenguaje que puede extenderse

Continuidad significa alinear contenido y agrupar lo que se decide conjuntamente, sin construir una pila de cajas. Electric Violet identifica acciones/contexto editorial; catálogo y fotos conservan superficies tranquilas. Un solo precio principal, estados reales y jerarquías consistentes acompañan el recorrido.

Buscar puede heredar agrupación/contexto y tipografía, sin esta banda editorial; ficha puede integrar foto/decisión; carrito puede usar filas y subtotal/acción conectados. **No imponer un header violeta grande** a esas tareas. Son directrices posteriores, no cambios de esta entrega; tampoco autorizan tocar cálculos o vendedor.

## Publicación real, recepción pendiente

Fuente cerrada `1a37860` (código `ef44048`), solicitud `ad41160`. [EAS 38342356897](https://github.com/somosoudy-design/marketplace/actions/runs/38342356897) **Success**; guard del runtime APK5 exacto y publicar preview/Resultado success, publicación **2026-10-13 03:36 UTC**. No APK ni production. Android40 solicitado08+09ambostemas yOS1,6; ID/fecha/runtime y recepción todavía por comprobar.
