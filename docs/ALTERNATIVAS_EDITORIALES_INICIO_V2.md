# Inicio V2 — tres direcciones editoriales para la siguiente entrega

2026-10-13. **Diseño y comparación; ninguna de estas alternativas está implementada o publicada.** Oliver autorizó primero 1A+2A y después esta exploración. La portada publicada permanece intacta. [Arquitectura maestra](ARQUITECTURA_EXPERIENCIA_V2.md) · [Implementación y recepción Android reales](IMPLEMENTACION_INICIO_V2.md).

## Qué ya llegó a Android

Fuente `6df3c7d`, solicitud `df823ef`, [EAS 38308796610](https://github.com/somosoudy-design/marketplace/actions/runs/38308796610) **Success**. Solo `preview` Android, runtime exacto de APK 5 `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`. Actualización **`01a131f4-143f-7afa-a03e-9ac8ffc20573`**, 2026-10-12 21:10 UTC.

[Android 39 / 38309209301](https://github.com/somosoudy-design/marketplace/actions/runs/38309209301): **4/4**, claro/oscuro, sin reintentos, navegación afectada y fuente OS 1,6. Diagnóstico confirma recepción, canal, runtime y fecha. [Veinte JPEG originales](capturas/inicio-v2/android/README.md). No equivale a recepción o aprobación física en el Samsung de Oliver. UI local 27+2, tipos/lint y exportaciones ya cerrados; no se repitieron suites generales para generar ideas.

## Evidencia visual y condiciones de comparación

**[Abrir comparación completa: publicada + A/B/C](diseno-v2/alternativas/comparacion.html).** Mismo tema claro, catálogo de referencia, vista inicial y ancho de presentación; cada imagen se conserva completa sin retocar. Las tres direcciones iniciales se mostraron una vez en el chat, en orden A, B, C; después se mostraron sus correcciones. Las revisiones conservan esos nombres: no son alternativas nuevas. La versión final se identifica por los archivos de la tabla, no por un número de imagen ambiguo. Los primeros originales están en `diseno-v2/alternativas/ronda-1/`.

| Dirección | Imagen completa | Organización dominante |
|---|---|---|
| Publicada | [Captura web real 412×892](capturas/inicio-v2/after/light-412-inicio.png) | Búsqueda → categorías → editorial compacta → cuatro productos |
| A · Editorial inmersiva | [Concepto generado](diseno-v2/alternativas/a-editorial-inmersiva.png) | Búsqueda → categorías → imagen editorial amplia → comparación |
| B · Marketplace modular | [Concepto generado](diseno-v2/alternativas/b-marketplace-modular.png) | Búsqueda → categorías → primera fila → colección → segunda fila |
| C · Electric Violet editorial | [Concepto generado](diseno-v2/alternativas/c-electric-violet-editorial.png) | Marca/búsqueda/editorial continuas → categorías → comparación |

Brief de 412×892; salidas originales **853×1844**, proporción muy próxima, no render exacto. Se pidió no mostrar marcos de teléfono ni sistema operativo. La imagen publicada es evidencia de una app real; A/B/C son propuestas ImageGen, sin navegación ejecutable. Los assets proporcionados son **ilustraciones Demo existentes**, no fotografías comerciales auténticas. La generación los reinterpreta: no garantiza identidad de píxeles. No se usarán estas imágenes como assets del catálogo ni como evidencia de un producto real.

| Inicio de fotografía de comparación | Posición | Tarjetas completas en primer viewport |
|---|---:|---:|
| Publicada | 429 px, medición DOM real | 2 |
| A | ≈552 px, estimación visual normalizada por ancho | 2 |
| B | ≈252 px, estimación visual normalizada por ancho | 2 |
| C | ≈503 px, estimación visual normalizada por ancho | 2 |

Esto compara **jerarquía**, no conversión. B acerca la primera decisión; no demuestra más ventas ni cuatro tarjetas completas. A/C dedican más espacio a editorial. No comparar estas estimaciones con alturas Android como si fuesen la misma medición.

## A — Editorial inmersiva

**Decisión:** ampliar la ilustración del producto hasta que organice la apertura, con título y leyenda comercial integrados. Un solo CTA «Ver colección»; producto, precio y Demo identifican qué se muestra, sin convertir el precio del SKU en precio de la colección. Dos productos comparables continúan debajo; cuatro pestañas cierran el recorrido visible.

**Ventaja frente a publicada:** el producto editorial deja de ser una miniatura subordinada a una caja violeta. La relación título/imagen crea una pieza editorial reconocible, con lectura más intencional que un banner genérico.

**Coste:** primera comparación aproximadamente 123 px más abajo. La pieza necesita una imagen de catálogo realmente buena para justificar esa inversión; con ilustraciones Demo el resultado seguirá teniendo apariencia de demostración, aunque mejore la composición. No inventar una escena lifestyle para ocultarlo.

**Corrección tras revisión:** se restauró la barra vigente (Inicio activo expandido, inactivas solo icono). Se decide explícitamente conservar categorías antes de editorial para mantener un acceso comercial temprano, aunque el prompt inicial exploraba lo contrario. El CTA grande sigue siendo una variante editorial; no imponerlo globalmente. El coste de altura se conserva y declara.

**Lugar razonable:** variante de una colección con material editorial suficiente, no apertura predeterminada de todo Inicio. Sin colección/imagen válida, pasar directamente a comparar; sin promociones reales, ninguna promesa de descuento o envío.

## B — Marketplace modular

**Decisión:** el comprador ve y compara productos antes del módulo de colección. La editorial conserva nombre, producto ilustrativo, precio del SKU, Demo y destino, pero pasa a ser la siguiente ruta de descubrimiento. Navegación y búsqueda permanecen donde se esperan.

**Ventaja frente a publicada:** el primer contenido comercial ya es comparable. El comienzo de fotografía se adelanta aproximadamente 177 px en el concepto final; hay una mejora de organización, no un cambio de radios. La pieza editorial sigue dando identidad violeta, sin convertir toda la portada en publicidad.

**Coste:** menos protagonismo inicial de la colección y menos inmersión. Dos tarjetas dominantes pueden sentirse genéricas si las siguientes secciones vuelven a repetir el mismo patrón. No aumentar densidad añadiendo más títulos, controles o CTA.

**Decisión de producto recomendada:** B conserva los cuatro SKU y su orden, pero organiza **primera fila de dos → colección → segunda fila de dos → Retoma si existe**. No borrar ni duplicar los otros dos para imitar el PNG. El especialista comercial evaluó esta diferencia y acepta su coste: se pierde comparación simultánea de cuatro, pero Inicio prioriza descubrimiento y permite una decisión inmediata con otra ruta real aún visible. Medir cada fila de manera independiente cuando sea visible. Esta secuencia difiere de cuatro contiguos en la arquitectura/publicación actuales y debe ser aprobada por Oliver antes de construir. No se recomienda esconder la discrepancia ni afirmar conversión demostrada.

**Corrección visual:** precios con coma venezolana y leyenda «Producto mostrado · Demo» añadida; SKU y destino de colección explícitos. La imagen generada no reemplaza componentes actuales: conservar tipografía/tokens, favorito discreto con hit area ≥44 y barra activa expandida. La cabecera y el módulo siguen siendo mayores que el presupuesto solicitado; no afirmar que se compactaron por haberlo pedido al generador. Ajustar el ritmo con contenido real durante una implementación autorizada, sin reducir fotos o controles para cumplir una cuota.

## C — Electric Violet editorial

**Decisión:** marca, búsqueda y colección se integran en una superficie editorial continua, sin una tarjeta de campaña flotante. El límite hacia categorías y catálogo se convierte en una transición de experiencia; fotos/precios siguen en superficies tranquilas.

**Ventaja frente a publicada:** el reconocimiento viene de la arquitectura —continuidad de marca y editorial— y no de pintar una caja existente. Aun sin el violeta, la organización del bloque y su límite con categorías son diferentes.

**Coste:** la zona superior ocupa demasiado: comparación aproximadamente 74 px más tarde que publicada. Mayor esfuerzo de reflow y cabecera persistente; riesgo de convertir Inicio en un póster. No dar a todos los recorridos comprador/vendedor esta densidad ni esa superficie.

**Correcciones y límite pendiente:** se añadieron «Colección» y «Producto mostrado · Demo», moneda con coma y señal de continuidad de categorías; título pasó de tres a dos líneas y desapareció la segunda fila recortada. Una salida de corrección salió con proporción 935×1683 y fue rechazada; se regeneró el encuadre a 853×1844, sin deformar imágenes. **La zona superior final sigue cerca de 396 px**, frente a ≈403 inicial y 310–335 solicitados: no se considera cumplida una reducción significativa. El riesgo de altura persiste y debe formar parte del dictamen final; no elegir C como portada predeterminada hoy ni prometer una reducción futura sin evidencia.

## Invariantes y continuidad del sistema

- **Datos/destinos:** `home_feed`, categorías y colecciones existentes. «Esenciales para cargar todo» / `esenciales-tech`; UGREEN Nexode 65 W $42 Demo, SHEGLAM labial $8 Demo y UGREEN power bank $55 Demo coinciden con fuente de catálogo y captura. Precio del servidor en implementación; nunca fijar estos números en componentes. Categorías representativas visibles no sustituyen la lista completa: Odontología y demás siguen accesibles horizontalmente.
- **Navegación:** editorial → `/catalog` con `collection: slug, title`; categoría → `/catalog` con `category: slug, title`; tarjeta → ficha; favorito independiente; Buscar preserva consulta; atrás recupera contexto. Cuatro pestañas vigentes, sin quinta de vendedor. Campana y carrito mantienen contadores reales; las ideas no añaden contadores ficticios.
- **Primera comparación:** cuatro productos en orden del backend, excluyendo solo SKU editorial; sin duplicar o reemplazar por variedad inventada. Personalización requiere sesión/preferencia real/flag del feed. Mantener espera del perfil y métricas por fila, sin atribuir abrir colección como clic en producto.
- **Scroll siguiente:** En B, segunda fila completa después de editorial antes de Retoma. Retoma solo si hay historial; colecciones con nombres/destinos conservados; tiendas individuales con datos reales; resto de selección y populares según datos disponibles. Cierre finito y acceso a catálogo son alcance 2B futuro. No fingir que los tres primeros viewports ya prueban esa continuidad.
- **Estados:** sin colección válida, comparar antes; sin preferencias conocidas, título neutral; poco catálogo sin relleno; Demo/encargo/agotado según backend; carga estable; error con reintento y datos guardados si existen. No introducir bloque nuevo para cada estado.
- **Sistema visual:** Plus Jakarta y tokens reales de `packages/design-tokens`; márgenes/alineaciones por composición y tactilidad, sin nuevo branding. Coral es señal real, no adorno repetido. Radio según función, sin sombras decorativas ni degradados. No convertir todas las acciones en cápsulas.
- **Accesibilidad:** áreas ≥44, texto escalable, foto íntegra, reflow de una columna con fuente grande, precio legible y etiqueta independiente. Cualquier dirección debe crecer a 320 px; no fijar altura para lograr un fold ideal. Modo oscuro con tokens existentes. Nada de esto está probado funcionalmente por una imagen generada.
- **Interacción:** press feedback y favorito existentes, movimiento reducido, sin autoplay/paginación decorativa. Buscador persistente reutilizado al scroll; en C revisar transición cromática/foco sin incorporar un segundo campo activo. Sin librerías ni cambios nativos.

## Recursos de Product Design usados realmente

| Recurso consultado | Procedimiento aplicado / decisión |
|---|---|
| [Index](skill://Plugin_fa77aec24fc08191bc6e57f377126d76/index/SKILL.md), [Audit](skill://Plugin_fa77aec24fc08191bc6e57f377126d76/audit/SKILL.md), framework | Capturar primero la app; separar evidencia visual, problema y acción; revisión de jerarquía y continuidad, no considerar tests como calidad visual |
| User Context / Get Context y preflight | Brief resuelto con propietario, arquitectura, tokens, código y capturas locales; preflight ejecutado, sin contexto guardado. No inventar investigaciones |
| [Ideate](skill://Plugin_fa77aec24fc08191bc6e57f377126d76/ideate/SKILL.md) | Tres llamadas ImageGen iniciales independientes, una pantalla por dirección; después ediciones de las mismas tres direcciones exigidas por revisión, no nuevas variantes; cambiar estructura antes de estilo; adjuntar la captura publicada y cuatro assets Demo inspeccionados; mantener restricciones en cada prompt; mostrar resultados completos y detenerse antes de construir |
| Investigación de Etapa 0 | Referencias externas Amazon/ML/SHEIN/HIG/Baymard bloqueadas; siguen siendo heurísticas conocidas, no una investigación nueva verificada |

[`prompt-a.txt`](diseno-v2/alternativas/prompt-a.txt), [`prompt-b.txt`](diseno-v2/alternativas/prompt-b.txt), [`prompt-c.txt`](diseno-v2/alternativas/prompt-c.txt) conservan las instrucciones iniciales exactas. `revision-a.txt`, `revision-b.txt`, `revision-c.txt` y `revision-c-encuadre.txt` registran las correcciones. Tres alternativas finales, no siete direcciones; la salida C de proporción incorrecta se conserva como rechazada, no entra en la comparación. [`procedencia.json`](diseno-v2/alternativas/procedencia.json) registra orden visible, archivos y SHA-256. Assets de referencia copiados sin modificar en `referencias/`; también se adjuntó la captura real versionada. Las salidas originales permanecen en `/workspace/generated_images`; copias documentales idénticas. No se generaron fotografías para producción.

No se aplicó Image-to-Code a estas ideas ni se publicó un prototipo en Sites. Recursos compartidos no accesibles del plugin no se citan como leídos. La autorización de Oliver para comparación/recomendación prevalece sobre el cierre genérico del skill que solo pregunta qué variante construir.

## Control de calidad — dos rondas cerradas

Equipo real y único escritor/committer raíz. UX/UI, ecommerce y auditor independientes inspeccionaron originales, tres PNG finales, base publicada y documento. Sin edición concurrente. Dos rondas cerradas; no habrá una tercera para ocultar desacuerdos. La primera implementación publicada tuvo su revisión separada, también cerrada.

| Especialista | Primera revisión | Corrección enviada |
|---|---|---|
| UX/UI | Recomienda B; A cambia chrome y C apertura excesiva/leyenda; formato decimal y discrepancia 2/4 | **B recomendada**, A válida con coste; C no recomendada por altura persistente. Pide ruta real `/catalog`; corregida por código |
| Ecommerce | B candidata; aclarar precio del SKU, resto de categorías/productos y assets reinterpretados | **B APROBADO/recomendado**, A APROBADO conceptual; C no recomendada. Acepta B 2 → colección → 2 y coste de separar filas. Ruta documental corregida |
| Auditor independiente | A y C **CAMBIOS OBLIGATORIOS**, B **APROBADO como concepto**; conjunto pendiente | **A APROBADO**, **B APROBADO/recomendado**, **C CAMBIOS OBLIGATORIOS por altura**. Permite entregar comparación honesta con C marcada. Ruta factual corregida, sin tercera ronda visual |
| Director de Producto | Rechaza presentar las imágenes como plantillas nativas, primera aprobación automática y encuadre C incorrecto | Conserva originales/prompts; regenera encuadre con ImageGen; fija B con ecommerce. Comprueba y corrige la ruta falsa que había escrito. Eleva C a Oliver y no declara aprobadas las tres |

**Veredicto final del auditor: APROBADO como entrega comparativa**, con la objeción de C visible y elevada a Oliver. A y B aprobados **como conceptos**, C mantiene **CAMBIOS OBLIGATORIOS**. No existe aprobación integral de las tres ni permiso interno para construir/publicar. La precisión documental de rutas se corrigió verificando `openCollection` y `CategoryTiles`; no exigía otra ronda de imágenes.

**Desacuerdo pendiente elevado a Oliver:** la altura de C no cumple el objetivo; no se propone resolverlo automáticamente ahora. Si Oliver prefiere esa dirección, deberá aceptar una nueva revisión de composición antes de construir. En B, la separación de filas es un tradeoff acordado internamente y necesita su aprobación como dueño. No hay otros desacuerdos importantes.

**Recomendación:** B, por prioridad comercial y menor dependencia de fotografía editorial. Primera fila de dos productos → colección → segunda fila de dos, preservando los cuatro. Es una variación estructural respecto a la arquitectura aprobada y requiere decisión de Oliver. A es alternativa válida si prioriza inmersión y acepta el coste; C no se recomienda mientras su apertura siga consumiendo ese espacio. No hay implementación ni publicación adicional.

## Validación de la documentación

Galería servida localmente y comprobada en Chromium a **320, 412, 1024 y 1440 px**: cuatro imágenes por vista cargadas, sin errores JS ni overflow horizontal del documento; primer enlace accesible por Tab. [`validacion.json`](diseno-v2/alternativas/validacion.json). Primer intento `file://` bloqueado por política del navegador; repetido mediante HTTP local normal, sin cambiar políticas. Enlaces locales y hashes comprobados; no requiere reiniciar backend, instalar dependencias o repetir suites de app. Es validación del **documento**, no de oscuro/320/fontScale/TalkBack de una propuesta.

## Siguiente incremento propuesto, todavía no autorizado

1. Oliver compara la versión recibida con A/B/C y elige/corrige la dirección. Confirmar orden de colección y primera selección, no pedir reaprobar 1A+2A.
2. Congelar el contrato de B: primera fila de dos → colección única → segunda fila de dos, mismos cuatro SKU/datos/rutas y cabecera/categorías actuales. Si elige B, implementar primero **solo ese orden y la leyenda editorial**, preservando tracking separado por fila; no rehacer tarjetas ni mezclarlo con checkout.
3. Capturas reales antes/después en 320/412, ambos temas, normal/fuente OS 1,6; conservar estado/datos y contabilizar posición y tarjetas completas. Revisión del auditor sobre implementación, no sobre este PNG.
4. Pruebas focales: colección/categoría/ficha/atrás/favorito, pocos datos/sin colección/error, preferencia demorada y tracking por fila; tipos/lint/exportación. No repetir toda la auditoría ni tocar finanzas.
5. Commit y push; publicación preview individual **solo con nueva autorización** y guard exacto APK 5; recepción Android focal. Después 2B: continuidad finita de colecciones/Retoma/tiendas sin perder acceso a contenidos.

**Aceptación:** jerarquía perceptiblemente distinta y comercialmente clara; ningún SKU/destino/estado perdido; fotos originales y Demo; títulos legibles sin recortes en texto grande; apertura ajustada al contenido; capacidad operativa intacta. No aceptar cambios solo de radios, iconos o tintes. No implementar estas decisiones durante la presente exploración.
