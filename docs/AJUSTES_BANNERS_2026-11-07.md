# Mayami · banners y texto del comprador · 7 de noviembre de 2026

Oliver pidió tres correcciones: banner Android, banners web y texto técnico visible. Se conserva la referencia aprobada, las fotografías originales, la selección, los precios y los destinos. No se abre otro rediseño ni se cambian reglas de negocio.

## Qué cambió

- Se retira «Imagen general del producto» de banners, tarjetas y resúmenes. Esa frase describía una clasificación interna; la clasificación se conserva. BM88, AM8 y JUOVI tienen una opción activa en la lectura pública y ya no muestran un aviso innecesario sobre distintas elecciones.
- HiTune S3 y Nexode Air tienen dos opciones activas con fotos sin asociar. Sus fichas muestran «Las fotos pueden variar según la opción elegida». Tras elegir explícitamente un color cuya foto se desconoce, la tarjeta móvil muestra «Imagen no disponible». No se asigna la foto de otro color ni se rellena un vacío explícito.
- Los banners integran foto, fondo de estudio y base gráfica violeta. El título dispone de más espacio y cada cantidad permanece junto a su unidad, evitando una W aislada. En ancho estrecho o con texto ampliado, la app apila foto y contenido. Se conservan las fotografías, sin generar o recortar imágenes de producto.
- La web conserva SSR. Una misma variante determina foto, precio y enlace del banner; sin un candidato válido aparece el acceso al catálogo. Las categorías conservan sus destinos y usan fotografías reales disponibles o un icono. No se inventan ofertas, existencias ni productos.

La mezcla de la foto se aplica sobre papel casi blanco, incluso en tema oscuro, con respaldo blanco en versiones Android anteriores a 10. No se mezcla sobre el fondo oscuro de la aplicación.

## Verificación local

Tipos y lint de móvil/web, **101 pruebas core y 85 móviles**, aprobados. La corrida final Playwright pasó **26/26**: app a 320/360/390/412 y web a 320/360/390/412/768/1024/1440, ambos temas, más fichas y protección de fotografías ambiguas. Las fotografías se esperan cargadas antes de capturar. También pasan las 24 pruebas Node de publicación y las tres de marca.

El marcador nativo opcional sólo aparece después de cargar la fuente actual; se reinicia al cargar o fallar y conserva callbacks. No añade texto visible. La revisión de píxeles sigue siendo necesaria para comprobar composición y transición.

Las variantes UGREEN tienen títulos de color, pero sus `options` están vacías. No se reconstruyen colores a partir del título ni se modifica el servidor. Para probar la tarjeta al elegir color se añade estructura `Color` únicamente a una respuesta del navegador local; las fotografías siguen sin clasificar. Las fichas se comprueban con los datos públicos intactos.

Revisiones independientes favorables: presentación en ambos temas, cierre del ancho 320 y criterio de fotos. La nueva evidencia está en `ui-receipt`; las capturas anteriores al último ajuste no se presentan como prueba de ese ajuste.

## Publicación web

Fuente implementada `ab5b877`; solicitud y fuente ejecutable `0df541008de9a7d7a5a38835d640821a63bb6477`.

Publicada una vez el 7 de noviembre a las 14:31 UTC en Workers Free:

- Versión `8496d8a0-bead-4184-9325-77f40c999195`, al 100%.
- BUILD_ID `yd9Rq1GFjFGg70Vk51U6z`.
- Versión previa contrastada inmediatamente antes: `1eea5edb-7ecc-4a97-9a44-595fcdf12dff`, conservada como referencia de recuperación.
- Guardas release/commercial/cloudflare aprobadas. Sólo bindings `ASSETS` y `WORKER_SELF_REFERENCE`; mismo artefacto entre QA y deploy.

**10/10** comprobaciones en el Worker local: SSR sin JavaScript a 320/390/768/1440, ambos temas; foto, título, precio y enlace coinciden con la ficha. **6/6** recorridos públicos posteriores: banners a 390/1440 y fichas BM88/AM8/JUOVI/UGREEN, ambos temas. Cuatro capturas públicas revisadas independientemente sin bloqueos.

El HTML público contiene el BUILD_ID y el banner. El CSS `3dmqi9gjrzy_7.css`, de 62.100 bytes, coincide con el artefacto por SHA256: `60f904f2dfcf4910e8e02c75c7cd843c8bf7e42c385111544d0d11d45f7ef77e`. Se conservan las cuatro cabeceras configuradas y la redirección www301 con ruta y consulta. Estas lecturas no prueban capacidad ni CPU global.

El despliegue incluye la integración funcional ya aprobada que estaba en la rama y usa el backend compatible activo. No repite su SQL ni activa el bloque de pagos/D3.

## Publicación Android

[CI 42381647257](https://github.com/somosoudy-design/marketplace/actions/runs/42381647257), job `128430334946`. Plan Free, cuota disponible, runtime y fuente limpia verificados antes de publicar.

- UUID `01a1b669-c74b-773b-b68d-e24f246f0ce7`.
- Grupo `ff072540-c0f4-481c-8eeb-3b53ebc773e3`.
- Runtime `b691ec2b61ee413fb1d6e7671a1a84446b4cd4f6`.
- Manifest público HTTP200 con esa identidad.
- APK existente `df55b9b8-1ed5-42e6-b42f-8a09b9bce50f`, misma firma y paquete. No se construye otro APK.

El APK recibió el UUID exacto en Android15. La ejecución inicial terminó con fallo de conexión del emulador al abrir Diagnóstico después de capturar el banner y la M con fuente1.6. Los cuatro recorridos claros anteriores pasaron; no hubo una aserción visual fallida en ese punto. Se conservaron 17 PNG y cinco XML. ZIP SHA256 `c8f408bcc92ae57619b530644087d7d3f898b370d22e328c7584326b250834e2`. Root abrió los banners nativos 1.0/1.3/1.6: foto cargada, título completo, 65W unido, precio y CTA legibles.

La comprobación independiente [42382733005](https://github.com/somosoudy-design/marketplace/actions/runs/42382733005), fuente `b09c24f`, recibió la misma OTA y perdió el dispositivo en el mismo punto. Conserva otros 17PNG/cinco XML, cuatro recorridos pasados y el fallo de transporte posterior; ZIP SHA256 `a731fde09704578ff02ff063b4e16bba266f6067362925ca2ce259655fec2066`. La causa raíz de la desaparición del emulador aún no está demostrada: no atribuirla a OOM ni a la app sin evidencia.

Para aislar la acumulación entre casos se prepara una matriz de seis emuladores independientes: claro/oscuro × estándar/fuente1.3/fuente1.6. Conserva las mismas aserciones y verifica el mismo UUID en cada proceso; estándar conserva 21/24/25 y cada fuente ejecuta26. Se exigen 36PNG/diez XML en conjunto. Cada salida conserva memoria del host, lista de procesos sin argumentos, kernel y ADB con timeout; los archivos de crash sólo se inventarían por nombre/tamaño, sin volcar memoria a artefactos públicos. El diagnóstico de salida mantiene el código de error original.

La matriz [42383755747](https://github.com/somosoudy-design/marketplace/actions/runs/42383755747), fuente `b87e65a`, completó estándar y fuente1.3 en ambos temas. Fuente1.6 pierde el emulador al abrir Diagnóstico en ambos temas, incluso aislada. Por tanto no se demuestra que la acumulación entre casos sea la causa. Las capturas1.6 de banner y M sí se guardaron. Kernel/host no muestran OOM; causa exacta aún sin stack del proceso del emulador.

Se encontró un [reporte primario de Chromium](https://chromium.googlesource.com/chromium/src/tools/+/115b3f40ea52dea3dede0f705fa5aaf978562ff0) que retira37.2.13 por caída de ProcessCleanupThread/EglContext y vuelve a37.1.11. Se prepara la misma matriz con Android Emulator37.1.11 Stable/build15917651, obtenido del [archivo oficial de Android](https://developer.android.com/studio/emulator_archive). ArchivoLinux oficial:334378080bytes, SHA256publicado`95771e0ae431897b2a4bd2d97fa095f29a8b0624a7b216baf529f9306161c266`. El input `emulator-build` fija el host y el hook verifica versión/build antes de ejecutar; no cambia Android15/API35, APK, OTA, app ni aserciones. La coincidencia con ese reporte motiva la comparación, sin afirmar todavía la causa del fallo local.

La comparación [42384648761](https://github.com/somosoudy-design/marketplace/actions/runs/42384648761), fuente `a711253`, no permite cerrar: el hook de versión encontró `libpulse.so.0` ausente y dejó el job fallido incluso donde la UI terminaba. En otros casos apareció transporte ADB transitorio (QEMU vivo y ADB recuperado), y una captura1.6 muestra «Pixel Launcher isn't responding» sobre Mayami cargado. No es evidencia de ANR de Mayami. Los artefactos se conservan y no se cuentan como una matriz aprobada.

Se corrige sólo el entorno: instalar `libpulse0`, asignar cuatro CPU y4GB de RAM dentro del mismo runner estándar, desactivar snapshots y esperar transporte/boot estable antes de cada Maestro. La versión/build del emulador se comprueba ahora como comando obligatorio al principio del script; un fallo detiene el caso antes de probar la app. Las mismas diez pruebas/36 capturas siguen siendo obligatorias. Una solicitud nueva de recibo sustituye la comprobación anterior ya obsoleta; el bloqueo de publicación EAS no se cambia ni se publica otra OTA.

Este workflow sólo comprueba el APK y OTA existentes. **Pendiente:** completar la matriz con dependencias y preparación corregidas. La recepción física en el teléfono no se deduce del emulador.

## Evidencia y límites

Evidencia local ignorada: `.local/banners-20261107/`. Resultados `ui-receipt`, `cloudflare-ui-results`, `ui-live` y `data/live-web/receipt.json`; dictámenes en `proposals/review-final.md`, `media-copy-independent-final.md` y `cloudflare-final-review.md`. Referencia aprobada: `.local/comparacion-referencias-20261107/referencia-ancho390.png`.

Dos errores del guion local quedaron corregidos sin cambiar el producto: medir categorías ocultas devolvía un rectángulo nulo; y una expectativa HSTS no correspondía a las cuatro cabeceras existentes. Se conservó la evidencia inicial, se ajustaron las comprobaciones a la configuración real y pasaron las corridas finales. No se cambió seguridad ni CSS para satisfacerlos.

Sin SQL nuevo, compras, cotizaciones, pagos, fixtures remotos ni cambios en asociaciones de fotos. No servicios con cargos, APK nuevo, tiendas ni iOS. La recepción en el teléfono del propietario sigue sin observarse. Si falla únicamente el recibo, inspeccionar el artefacto y la identidad antes de repetir; no publicar otra OTA idéntica.
