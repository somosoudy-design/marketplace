# Evidencia y control de calidad — arquitectura V2

12 de octubre de 2026. Etapa 0 documental. [Arquitectura maestra](../ARQUITECTURA_EXPERIENCIA_V2.md) · [Tablero comparativo autónomo](propuestas.html).

## Qué representan las imágenes

**Actual**: PNG originales de la app web exportada de `d945797`, capturados en esta ejecución, 412 × 892, Chromium, visitante, ambos temas. No se retocaron ni recortaron. Son evidencia de la interfaz web; no se presentan como Android físico.

**Propuesta**: esquemas HTML de composición independientes de la app. Todos contienen «ESQUEMA · PROPUESTA NO IMPLEMENTADA». Renderizados a 320/412 × 892, claro/oscuro. Ningún botón ejecuta operaciones; no son un prototipo funcional ni una app nueva. Sus importes financieros entre corchetes son campos del servidor, no cotizaciones inventadas.

**Por código**: para checkout y pago autenticados, el tablero dibuja la estructura leída del código, identificada expresamente. Las capturas actuales 06/07 muestran barreras de acceso. No se afirma inspección visual de compra autenticada, persistencia o pagos.

| Paso | Actual aceptado / límite | Propuesta 412 claro | Diagnóstico y objetivo |
|---|---|---|---|
| 01 Inicio | [Captura](actual/light/01-inicio.png): válida | [Esquema](propuestas/light/412/01.png) | Portada acumulativa → apertura editorial finita y primera comparación |
| 02 Buscar | [Captura](actual/light/02-buscar.png): válida | [Esquema](propuestas/light/412/02.png) | Base compacta vigente → jerarquía de exploración; conservar capacidades |
| 03 Resultados | [Captura estabilizada](actual/light/03-resultados.png): válida, 11 cargados | [Esquema](propuestas/light/412/03.png) | Consulta conserva categorías completas → controles contextuales y catálogo antes |
| 04 Ficha | [Captura](actual/light/04-ficha.png): válida | [Esquema](propuestas/light/412/04.png) | Galería dominante → precio/variante/cantidad/vendedor/entrega próximos |
| 05 Carrito visitante | [Captura](actual/light/05-carrito.png): válida | [Esquema](propuestas/light/412/05.png) | Fila operativa y subtotal referencial; conservar pestañas e inicio de sesión |
| 06 Checkout | [Acceso protegido](actual/light/06-checkout-protegido.png): no es compra autenticada | [Esquema por contrato](propuestas/light/412/06.png) | Secciones apiladas por código → revisión progresiva con Total/Hoy/Saldo |
| 07 Pago | [Permiso denegado](actual/light/07-pago-protegido.png): no es un pago abierto | [Esquema por contrato](propuestas/light/412/07.png) | Encabezado/CTA inconsistentes → cotización exacta, reporte y verificación |

El tablero permite ver ambos temas; carpetas `propuestas/light/320`, `propuestas/dark/320` y sus equivalentes 412 conservan los originales renderizados. Las capturas actuales oscuras están en `actual/dark`.

**Capturas rechazadas:** primera toma de Resultados conservaba tarjetas anteriores mientras el campo ya decía «ugreen». Se descartaron ambas y se recapturó tras desaparecer SHEGLAM y estabilizarse la consulta. No se entregan como resultados finales. Los fallos iniciales del servidor estático —404 sin fallback SPA y arranque no listo— se corrigieron utilizando el servidor SPA existente y comprobación de disponibilidad; ninguna captura fallida se usa para diagnosticar la app.

## Registro de fuentes y confianza

| ID | Fuente consultada | Qué sustenta / qué no |
|---|---|---|
| E1 | Oliver, evaluación física Samsung S24 comunicada en el encargo | Insatisfacción real del propietario; no estudio con varios compradores ni telemetría de conversión |
| E2 | Capturas actuales 01–05 en esta ejecución | Composición y contenido visibles en web visitante; no rendimiento/TalkBack/Android físico |
| E3 | [Inicio](../../apps/mobile/src/app/(tabs)/index.tsx), [Catalog](../../apps/mobile/src/components/catalog/Catalog.tsx), [ficha](../../apps/mobile/src/app/product/[id].tsx) | Orden de módulos, destinos, estados, capacidades y costes de navegación |
| E4 | [Checkout](../../apps/mobile/src/app/checkout.tsx), [pago](../../apps/mobile/src/app/pay/[orderId].tsx), [tipos API](../../packages/api/src/types.ts), migraciones existentes de checkout/pagos/pricing | Semántica de preview/pedido/cotización/reporte, entregas y elegibilidad; lectura, sin ejecutar operaciones |
| E5 | [MiniProductCard](../../apps/mobile/src/components/catalog/MiniProductCard.tsx), [format](../../apps/mobile/src/lib/format.ts), [RateSheet](../../apps/mobile/src/components/RateSheet.tsx) | Excepciones de disponibilidad ausentes en miniatura y nombres de adaptadores expuestos; corrección futura separada |
| E6 | [DISENO](../DISENO.md), [DIRECCION_PRODUCTO](../DIRECCION_PRODUCTO.md), [ARQUITECTURA](../ARQUITECTURA.md), [REVISION_GLOBAL_UX](../REVISION_GLOBAL_UX.md), [FRENTE_A_V2](../FRENTE_A_V2.md), continuidad y últimos commits | Identidad/reglas/capacidades existentes; ante contradicción con documentación histórica manda código comprobado |
| E7 | Product Design: recursos abajo | Método aplicado de captura, diagnóstico, evidencia, accesibilidad y evaluación; no asesoría externa inventada |

Los hallazgos de Inicio/ficha tienen evidencia visible y de código. El destino incorrecto «Ver todas», la promesa de anticipo, elegibilidad de planes, `line_count` y obligaciones de pago se identifican por código. No todos los problemas se observaron en una interacción autenticada.

### Product Design realmente consultado

| Recurso | Procedimiento utilizado | Decisión o evidencia resultante |
|---|---|---|
| `c1/index` — `index/SKILL.md` | Enrutamiento según revisión/diseño con código real | Audit antes de propuesta; no iniciar implementación ni inventar uso de image-to-code |
| `c1/audit` — `audit/SKILL.md` | Capturar primero, abrir archivo, aceptar/rechazar estado, declarar bloqueos | Originales actuales; rechazo/recaptura de transición; checkout/pago declarados por código |
| `audit/references/design-audit-framework.md` | Jerarquía, navegación, confianza, estados, foco, objetivos táctiles, reflow y movimiento | A–E, CTA con consecuencia, densidades contextuales, condiciones comerciales y aceptación por etapa |
| `c1/get-context` | Consolidar objetivo y brief conocido | Arquitectura antes de código; Electric Violet; no repetir preguntas ya respondidas |
| `c1/research` | Separar evidencia de inferencia y registrar límites de fuentes | Tabla E1–E7 y referencias bloqueadas; heurísticas sin atribuir investigación verificable |
| `c1/user-context` | Preflight de contexto guardado | Script oficial ejecutado: no había contexto persistido; se usó documentación actual |

Raíz real del paquete: `skill://Plugin_fa77aec24fc08191bc6e57f377126d76`. Los recursos compartidos `critical-overrides` y `communication-protocol` no fueron accesibles; no se afirman leídos. No están expuestos Browser/Sites del plugin; se usó Chromium/Playwright instalado para capturas verificables y documentación local, sin publicación ni dependencias nuevas.

### Referencias públicas intentadas, sin contenido consultable

Los seis accesos devolvieron **Tunnel 403** el 2026-10-12. No se descargaron interfaces ni se inventaron hallazgos actuales de estas apps. La tabla de patrones del documento rector usa conocimientos profesionales explícitamente identificados como heurísticas.

- Amazon Shopping: `https://apps.apple.com/us/app/amazon-shopping/id297606951`.
- Mercado Libre: `https://apps.apple.com/us/app/mercado-libre/id463624852`.
- SHEIN: `https://apps.apple.com/us/app/shein-shopping-online/id878577184`.
- Apple HIG layout: `https://developer.apple.com/design/human-interface-guidelines/layout`.
- Apple HIG navigation: `https://developer.apple.com/design/human-interface-guidelines/navigation-and-search`.
- Baymard: `https://baymard.com/blog/mobile-product-listing-pages`.

## Decisiones y costes aceptados

| Pantalla / decisión | Beneficio | Coste y condición de adopción |
|---|---|---|
| Inicio finito, una colección protagonista | Orientación editorial y comparación antes; distintos módulos con función clara | Catálogo continuo requiere un toque hacia Buscar. CTA explícito, muestra popular y todas las colecciones siguen accesibles |
| Hero con destino único de colección | Evita un bloque con destinos anidados ambiguos | El SKU editorial necesita entrar a colección para abrirse; nombre/precio son ilustrativos del producto, sin CTA de compra |
| Resultados sin fila permanente de categorías | Recupera una franja para productos y reduce contexto repetido | Cambiar categoría exige Filtrar; botón crítico sigue visible, categoría general se descubre en exploración |
| Ficha con galería contenida | Precio, variante, cantidad, vendedor y condiciones se acercan a la decisión | Imagen menor y más espacio neutro con contain. No recortar/deformar SKU; paginación conservada; zoom queda fuera |
| Carrito operativo | Cantidad, variante e importe se leen juntos | Un carrito corto conserva espacio libre; no rellenarlo con módulos de promoción para simular riqueza |
| Checkout con resúmenes editables | Revisión progresiva y consecuencia de confirmar explícita | Revisar detalle previo requiere expandir/editar; calendario y costo por entrega nunca desaparecen |
| Pago con estados separados | Distingue estimación, cotización y verificación; recuperación segura | Puede requerir renovar una cotización vencida y esperar revisión; no suprimir controles financieros por reducir pasos |

## Equipo real y revisión independiente

**Director de Producto:** `/root`, único escritor/committer. Criterios establecidos antes de revisar: mejora estructural, siete visuales fundamentados, A–E coherentes, capacidades/contratos íntegros, accesibilidad y límites honestos; rechazo de cosmética y evidencia falsa. Máximo dos rondas.

### Hallazgos por especialista, ronda 1

- **UX/UI Design Director — `/root/ux_director_v2`:** portada finita; conservar cuatro pestañas y catálogo existente; destinos honestos; contexto estable. Aceptó apertura de colección con un único destino. Exigió conservar origen/fecha-hora de tasa aplicada, no prometer zoom existente, salida al mismo pedido, reglas tipográficas futuras sin rehacer tarjetas y evidencia diferenciada. Rechazó las primeras capturas de resultados.
- **Ecommerce Product Specialist — `/root/commerce_v2`:** grupos de entrega no equivalen a tiendas; planes dependen del carrito; pedido/cotización/reporte son compromisos distintos. **Cambios obligatorios:** dirección con obligatoriedad existente, reporte condicionado al método, precios visitante vs cuenta y bloqueo durante processing/verificación. Todas incorporadas. En ronda 2 precisó distinguir `rate_observed_at` de `issued_at`/`expires_at`; incorporado: una nueva cotización no hace más fresca su tasa.
- **Independent Design Reviewer — `/root/reviewer_v2`:** encontró estructura real y exigió cambios, sin aprobar por tests. Señaló pestañas ausentes en esquema de carrito, Compartir/Cantidad omitidos en ficha, contraste de iconos oscuros, saldo al borde del footer y diagnóstico de pago demasiado amplio; pidió costes explícitos por decisión.

### Propuestas / partes rechazadas y correcciones

| Rechazo | Causa e impacto | Corrección integrada |
|---|---|---|
| Navegación de Carrito del esquema inicial | Sin pestañas, pierde regreso exploratorio; contradice navegación global | Restaurar Inicio/Buscar/Carrito/Cuenta; no convertir carrito en callejón sin salida |
| Ficha incompleta del esquema | Compartir/Cantidad omitidos; capacidades necesarias sin destino | Dibujarlos y especificar CTA por disponibilidad, aviso/cancelación de alerta y paginación existente |
| Iconos Filtrar/Ordenar oscuros | SVG negros sin color semántico, descubribilidad/contraste insuficiente | Stroke semántico para todos los iconos y recaptura de ambos temas |
| Primer esquema checkout | Entregas activa con CTA aparentemente disponible y datos finales fuera de vista | Revisión final resumida/editable; condiciones de habilitación y Total/Hoy/Saldo legibles |
| Diagnóstico de pago como confirmación general | El CTA actual ya envía para verificar: sobredimensionaba problema | Precisar inconsistencia del encabezado, conservando semántica correcta de CTA/aviso |
| Promesas universales / campos obligatorios nuevos | Contradicen contratos: anticipo, comprobante, municipio | Elegibilidad del carrito, requisitos por método y obligatoriedad actual |
| Propuesta como prueba final | Esquema no valida persistencia, accesibilidad ni Android | Etiquetas explícitas, límites y aceptación posterior por etapa |

**Segunda ronda y veredicto final: pendientes en este checkpoint.** No hay aprobación ficticia. Las discrepancias importantes después de dos rondas se elevarán a Oliver; no habrá una tercera ronda indefinida.

## Validación documental ejecutada

Capturas actuales con solo lecturas; 28 renders (siete × dos temas × dos anchos), sin errores JavaScript, imágenes rotas o overflow horizontal del contenedor. La geometría se conserva en [mediciones-esquemas.json](mediciones-esquemas.json). Se inspeccionan visualmente; los resultados técnicos solo prueban integridad del documento, no calidad final ni accesibilidad nativa.

La franja «ESQUEMA» ocupa espacio adicional y debe descontarse al comparar altura comercial. Las fotos demo se copiaron sin modificar; precios/estados proceden de seed/catálogo existente. Fuente Plus Jakarta Sans reutilizada con su licencia OFL en `assets`.

No se ejecutaron suites de compra ni reset de base de datos porque no se cambió comportamiento y están prohibidas las escrituras de esta etapa. No se tocaron código móvil, módulos, SQL, panel, iOS, configuración nativa o workflows. No se generó APK ni EAS Update. La OTA anterior permanece vigente.

## Decisiones para Oliver

Aprobar o corregir portada finita y un destino editorial, navegación conservada, catálogo contextual, galería/decisión, revisión progresiva y separación de compromisos. Primera implementación recomendada: base imprescindible + apertura/primera comparación de Inicio, no una refactorización global. La aprobación interna de documentos no autoriza implementación ni publicación.
