# Calidad integral de HAYAZGO · 31 de octubre de 2026

## Resultado y alcance real

Se revisaron compra web/app, integración, tasas, notificaciones, seguridad del cliente y administración. Se corrigieron fallos reproducibles y se reorganizó el checkout web. **Este incremento está aprobado para los recorridos comprobados; no certifica que todo el marketplace esté listo para lanzamiento comercial.** Hay dependencias operativas y de producto al final de este documento.

Un único integrador escribió y publicó commits en `claude/marketplace-v1`. Seis especialistas investigaron, propusieron y probaron en paralelo, sin ediciones concurrentes de la fuente. Checkpoints iniciales `287ff66` y `49a5ac1`. Ninguna migración, modificación de datos remotos, pago real, cambio de fórmulas financieras, iOS ni APK nuevo.

## Compra: una experiencia continua

El servidor conserva precios, planes, fechas, cotizaciones y estados. La web comparte con la app la secuencia **Dirección → Entregas → Plan → Revisión → Pago**. Dirección va primero porque determina opciones, coste y plazo; posponerla haría cambiar condiciones al final.

La confirmación y recuperación del pedido pasan a `packages/api/src/checkout-confirmation.ts`: la web ya no importa código de la carpeta móvil. Ambas superficies consumen el mismo contrato y conservan la entrada compatible anterior. Se mantiene el cuerpo de la implementación y sus once pruebas, incluida una respuesta perdida y la prohibición de inventar otro pedido.

| Paso | Problema comprobado antes | Resultado revisado |
|---|---|---|
| 1. Dirección | Encabezado redundante, texto pequeño, acción al final del resumen | Progreso compacto y navegable; selección legible y una acción contextual |
| 2. Entregas | Tienda, productos y decisión separados | Agrupación por entrega real, fotografía/importe, opciones y fechas; no fusiona paquetes artificialmente |
| 3. Plan | Total sin distinguir compromiso inicial, calendario poco conectado | Plan del backend, total y anticipo cuando corresponde; calendario conservado |
| 4. Revisión | Sin ETA ni edición directa de entrega/plan; confirmación explicada dos veces | Productos primero, dirección y plan editables, plazo por grupo y una sola explicación junto al botón |
| 5. Método de pago | Importe pendiente después de una lista de métodos | Importe base visible antes de elegir; cotización definitiva siempre del servidor |
| 6. Reporte del pago | Datos e inputs dispersos, selector de archivo del navegador | Datos para pagar y reporte separados; copia con feedback, archivo identificado, vencimiento y errores visibles |

Una hoja de compra integra contenido y resumen en escritorio (1120 px), con el mismo lenguaje de selección Electric Violet. En móvil la acción y el importe permanecen disponibles. Tipografía de opciones/productos de 14–15 px, controles de al menos 44 px, adaptación de texto y movimiento reducido. El diseño evita una tarjeta independiente para cada dato.

**Mediciones DOM de las mismas fases, sin editar imágenes:** primer contenido a 320/412 px pasa de **309,4 a 240,6 px** (22% menos cabecera); escritorio, de 324,1 a 270,6 px. El botón de confirmación a 412 pasa de Y1024,3 —fuera de la ventana de 960— a Y874,4. Se comprobó texto ampliado al 200% mediante estilos en navegador; no equivale a fuente Android del sistema ni a certificación WCAG.

### Comparación visual

| Estado | Antes | Después |
|---|---|---|
| Revisión, escritorio claro | [Original](capturas/calidad-integral-2026-10-31/ux/before-4-revisión-1440-light.png) | [Original](capturas/calidad-integral-2026-10-31/ux/after-4-revisión-1440-light.png) |
| Revisión, móvil oscuro | [Página original](capturas/calidad-integral-2026-10-31/ux/before-4-revisión-412-dark.png) | [Página original](capturas/calidad-integral-2026-10-31/ux/after-4-revisión-412-dark.png) · [ventana visible](capturas/calidad-integral-2026-10-31/ux/after-viewport-4-revisión-412-dark.png) |
| Pago, 320 claro | [Original](capturas/calidad-integral-2026-10-31/ux/before-6-reporte-320-light.png) | [Original](capturas/calidad-integral-2026-10-31/ux/after-6-reporte-320-light.png) |
| Comprobante PDF, panel | [Original](capturas/calidad-integral-2026-10-31/admin/before-pdf-320-light.png) | [Original](capturas/calidad-integral-2026-10-31/admin/after-pdf-320-light.png) |

[27 PNG originales y sus hashes](capturas/calidad-integral-2026-10-31/manifest.json). Las capturas de página completa conservan la posición original de la barra fija; la captura de ventana demuestra su ubicación al usarla. Son fixtures locales, no compras del propietario ni fotografías modificadas para mejorar la comparación.

## Fallos de estructura y seguridad corregidos

| Hallazgo reproducido | Corrección | Comprobación |
|---|---|---|
| Login podía enviar email/contraseña en una URL mediante GET antes de hidratar JS | Formularios sensibles declaran POST; búsqueda conserva GET | JS desactivado, solicitud interceptada localmente, URL sin parámetros sensibles |
| «Volver a intentar» sólo limpiaba errores de cotización/dirección/cancelación | Reintento real; acciones sensibles conservan confirmación e identidad | Segundo request y persistencia correcta; no éxito simulado |
| Cambiar USD/VES ↔ USD/USDT retenía el borrador del par anterior; selector y payload discrepaban | Formularios por par, fuentes compatibles, cadena habilitada y campos numéricos validados | PATCH inspeccionado y rechazado antes del backend; payload correcto al regresar |
| Panel aceptaba como vigente un snapshot futuro | Mismo intervalo efectivo que el servidor: `taken_at <= ahora < valid_until` | Tres unitarias; ninguna fórmula cambiada |
| Administrador en modo comprador podía mezclar datos de otros compradores | Direcciones y detalle de pedido explícitamente filtrados por usuario, claves de caché por cuenta | Propios accesibles y ajenos ocultos en web y app exportada; permisos administrativos permanecen en su superficie |
| Tienda con error de consulta quedaba cargando para siempre | Error recuperable, estado vacío y subárbol por tienda | Error, reintento y vuelta al contenido |
| Comprobante PDF se representaba como imagen rota | Apertura PDF, raster permitido, otros MIME sólo descarga; revocación de Blob y reintento | PDF y HTML sintéticos de lectura; no embeber contenido activo bajo el origen del panel |
| Acciones de revisión administrativa continuaban activas durante una solicitud | Bloqueo sincrónico, payload capturado, modos/inputs/cierre/Escape bloqueados mientras espera | RPC retenida y abortada; no se aprobó ningún pago |
| Modal estrecho cortaba acciones; Cuenta carecía de nombre accesible | Acciones adaptables y cierre 44 px; nombre accesible persistente | 320 px claro/oscuro, teclado y DOM |

La protección de formularios no reemplaza autorización del servidor. No se alteraron RLS, roles ni políticas financieras remotas.

### Tasas coherentes, sin prometer disponibilidad imposible

Se preservó la validación del servidor por Fecha Valor/calendario para BCV y la frescura correspondiente a otras fuentes. El panel ahora explica esa distinción. Veinte pruebas BCV y cinco de privilegios pasaron en un clon local nuevo: futuro, viernes/feriados, medianoche venezolana, calendario ausente y respaldo explícito. Ocho pruebas de adaptadores también pasaron.

Si no existe una tasa válida, **VES permanece bloqueado** y no se usa una tasa antigua en silencio. Esto evita cobrar con un dato inválido; no garantiza que una fuente externa nunca falle. No se repitió el diagnóstico remoto del 14 de octubre ni se cambió una tasa manualmente. Antes del último día bancario de 2026 se necesita el calendario 2027 verificado, no fechas inferidas.

## Notificaciones conectadas

La web incorpora `/notificaciones`, contador exacto, consulta por propietario, paginación, enlaces a pedidos/productos, marcado explícito y reintento. El contador no depende de las primeras 50 filas. Si entra un aviso entre páginas se elimina la duplicación por ID; Actualizar incorpora los nuevos. El estado del pedido sigue siendo la autoridad.

La app marcaba todos los avisos del servidor después de cargar sólo 50. Se reprodujo con 55: cinco nunca mostrados quedaban leídos. Ahora la autolectura requiere que la fila permanezca al menos 60% visible durante 1,5 s; la acción explícita sólo marca los cargados. Hay paginación y error recuperable. Cuenta A, sesión cerrada y Cuenta B conservan separación.

PushBridge actualiza avisos/pedidos al recibir en primer plano, evita procesar dos veces el mismo toque y descarta respuestas de una conexión anterior. Se probó el ciclo del SDK mediante dobles de prueba, no mediante envíos físicos. El panel distingue dispositivos registrados, aceptación por el proveedor y recepción observada.

**Pendientes de notificaciones:** comprobar recepción nativa; resolver avisos de vendedores hacia la tienda correcta; diseñar desvinculación/payload privado cuando se cierra sesión sin red. El fallo de red al retirar un token no permite garantizar que el teléfono deje de recibir mensajes de la cuenta anterior. La bandeja y los datos del comprador sí están aislados por servidor y sesión.

## Seguridad de dependencias y compilación

Parche acotado: Next/eslint-config-next 16.4.1 y undici 7.30.1 en panel, eliminando once avisos observados. Sharp0.35.5 integrado sólo en herramientas después de seis conversiones aisladas que conservan dimensiones/alpha/píxeles esperados; no se regeneraron fotografías, iconos ni configuración nativa. Audit final: **39→25 avisos:2críticos,8altos,11moderados,4bajos**. La reducción no equivale a ausencia de riesgo.

Hay avisos residuales que requieren trabajo dedicado. Los críticos de tinypool están en el ejecutor de tests; no se expone su servidor. Zod4 exige migración de esquemas compartidos. La decodificación de enlaces de Expo merece prioridad de runtime: **se rechazó forzar `decode-uri-component` 0.5.1 sobre query-string7 porque su cambio a ESM rompe la llamada CommonJS**. Un prototipo de compatibilidad pasó pruebas aisladas, pero no acredita navegación Metro/Hermes ni runtime APK5. No se ocultó el audit mediante una versión incompatible.

## Equipo y control de calidad

| Especialista | Hallazgo/decisión relevante | Resultado |
|---|---|---|
| UX/UI senior | Exigió reorganizar fases, acortar cabecera, legibilidad, CTA visible y feedback de copiar | APROBADO tras corregir overflow de texto ampliado y feedback invisible |
| Ecommerce | Dirección primero; preservar grupos logísticos, ETA, total vs anticipo y consecuencias de confirmar | Integrado sin adoptar promociones, MOQ o negociación que el producto no ofrece |
| Backend/tasas | Reprodujo mezcla de políticas, GET sensible y vigencia futura | APROBADO con 19 unitarias y 2 UI, además del contrato SQL existente |
| Integración/notificaciones | Detectó lectura indiscriminada, contador limitado y ausencia de inbox web | Web y app exportada comprobadas, con límites físicos explícitos |
| Build/admin/seguridad | Dependencias, tienda bloqueada, PDF roto, modal estrecho y diagnóstico push excesivo | Correcciones y export estático aprobados |
| Auditor independiente | Reprodujo reintentos falsos, duplicación concurrente y acciones contrapuestas durante revisión | APROBADO al corregirlos; nueve casos propios y quince PNG inspeccionados |

La hipótesis de que una segunda compra quedara atrapada en el checkout anterior **no se reprodujo**. Se probó navegación cliente/Atrás y funcionó. Tampoco se trató el agotamiento de un SKU de pruebas como fallo de producto: se crearon fixtures exclusivas, sin reponer stock del catálogo compartido.

Product Design utilizado realmente: `audit/SKILL.md`, `audit/references/design-audit-framework.md` e `index/SKILL.md`, más `oliver-design-direction/SKILL.md`. Procedimiento aplicado: capturas actuales antes del diagnóstico visual, hallazgos por fase, implementación, mismas capturas, accesibilidad/interacción y revisión independiente. Captura mediante Chromium/Playwright instalado; no se atribuye uso de Canvas o de un navegador conector no disponible.

Referencia externa verificable: portada pública de [Amazon](https://www.amazon.com/) (HTML obtenido, búsqueda/categorías/pedidos/carrito). Su checkout autenticado no fue auditado. SHEIN y Alibaba no estaban accesibles por la política de red: sus patrones se emplearon como conocimiento de diseño, no como investigación actual. Se adoptó divulgación progresiva/contexto de pedido; se rechazaron saturación promocional, compra de un toque sin condiciones y flujos B2B ajenos al contrato de HAYAZGO.

## Pruebas del incremento

- **39 UI web** sobre build de producción local: compra completa, cuentas, direcciones, pruebas anteriores y nuevas, pago/comprobante, recuperación sin duplicado, avisos y errores.
- **11 UI panel**: nueve de calidad/seguridad y dos de configuración por par.
- **4 UI app exportada**: lectura visible, contador/paginación, aislamiento al cerrar sesión y administrador comprador con datos propios.
- **116 unitarias**: 52 core + 47 panel + 17 confirmación/ciclo push. Las repeticiones no aumentan el conteo.
- **25 SQL + 8 adaptadores** verificados por backend en un clon local exclusivo.
- Tipos/lint monorepo, build Next web, exclusión de recursos privados en release, export estático de panel y export móvil web/Android Hermes. No se creó APK ni se probó iOS.
- Revisión visual 320/412/1440 claro/oscuro, texto 200% simulado y teclado/copiar/archivo sin enviar pago. Las pruebas funcionales no se presentan como demostración de calidad visual por sí solas.

Todos los cambios de datos de prueba ocurrieron en el backend local. Los tests interceptan accesos al Marketplace remoto; los casos administrativos de aprobación/configuración retuvieron y abortaron las solicitudes. Log técnico y propuestas: `.local/premium-20261031/`. El caso de notificaciones que inicialmente coincidió con el anunciador de rutas de Next se acotó a `main`; la suite final completa pasó sin omitirlo.

## Matriz de preparación: próximo trabajo exacto

| Área | Estado comprobado | Siguiente incremento verificable |
|---|---|---|
| Compra web | Recorrido operativo y rediseño revisado localmente | Alojamiento Next HTTPS protegido, dominio/callbacks y revisión del propietario desde navegador real. No hay URL pública del storefront |
| App Android | Código JavaScript/assets exporta; mantiene configuración nativa | Guard exacto APK5 antes de OTA; después comparar ID recibido en Samsung y realizar prueba física de avisos |
| Notificaciones | Inbox y ciclo lógico verificados | Prioridad: privacidad de logout sin red y destino correcto de avisos de vendedor; prueba física permiso/tap/arranque/reanudación |
| Administración | Panel existente con correcciones operativas y seguridad | Siguiente bloque: colas por rol y acciones frecuentes en Mi tienda; la administración avanzada completa sigue en panel web, no se inventó una consola nativa |
| Tasas | Contrato local y configuración por par coherentes | Calendario 2027 con fuente verificada y monitorización operativa; no cambiar tasas para hacer pasar tests |
| Dependencias | Next/undici corregidos; riesgos restantes clasificados | Compatibilidad de decodificación de enlaces; después migración de tooling Vitest y esquemas Zod por bloques con sus pruebas |
| Lanzamiento comercial | Aún pendiente | Catálogo/modelos/derechos y datos de cobro definitivos, legales, copias/restauración, servicios habilitados y operación. No activar proveedores ni realizar pagos reales como prueba |

La aprobación interna no sustituye la evaluación de Oliver. Este documento distingue lo implementado, lo probado y lo todavía necesario para un producto terminado.
