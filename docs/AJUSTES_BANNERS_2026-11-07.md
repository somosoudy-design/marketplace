# Mayami · cierre de tres correcciones · 7 de noviembre de 2026

Tanda cerrada por instrucción de Oliver con la evidencia disponible. Alcance: banner de la app, banners web y texto del comprador. Son correcciones de lo existente; el siguiente grupo se recibe aparte.

## Los tres ajustes publicados

1. **App:** fotografía integrada con el fondo y la base violeta, más espacio para título/precio/botón y adaptación a ancho estrecho o texto ampliado. Cantidad y unidad permanecen juntas para evitar una W aislada. Se conservan fotografía original, producto, precio y destino.
2. **Web:** banner de producto y bloques de categorías ajustados en móvil/escritorio, conservando SSR. Una misma variante determina precio y enlace; no se inventan productos, ofertas ni existencias.
3. **Texto:** se retira «Imagen general del producto» de banners, tarjetas y resúmenes. La clasificación interna se conserva. Una opción activa no muestra un aviso innecesario; ante varias opciones con fotos sin asociar, la ficha mantiene «Las fotos pueden variar según la opción elegida». No se asigna a un color la foto de otro ni se rellena un vacío explícito.

Fuente de implementación `ab5b877`; fuente ejecutable publicada `0df541008de9a7d7a5a38835d640821a63bb6477`. Las fuentes de app/web/core no han vuelto a cambiar desde esa publicación; los commits posteriores son documentación y comprobación nativa.

## Publicación comprobada

**Web:** una publicación en [mayami.app](https://mayami.app), Worker `8496d8a0-bead-4184-9325-77f40c999195` al100%, BUILD_ID `yd9Rq1GFjFGg70Vk51U6z`. Guardas release/commercial/cloudflare aprobadas; sólo `ASSETS` y `WORKER_SELF_REFERENCE`. La versión anterior contrastada era `1eea5edb-7ecc-4a97-9a44-595fcdf12dff`.

HTML público con SSR/BUILD_ID correctos. CSS `3dmqi9gjrzy_7.css`,62.100bytes, SHA256 `60f904f2dfcf4910e8e02c75c7cd843c8bf7e42c385111544d0d11d45f7ef77e`, idéntico al artefacto. Cuatro cabeceras configuradas y www301 conservando ruta/consulta verificadas. Este despliegue incluye la integración funcional previamente aprobada que ya estaba en la rama y usa el backend compatible activo; no repite SQL ni activa pagos/D3.

**Android:** una OTA publicada por [42381647257](https://github.com/somosoudy-design/marketplace/actions/runs/42381647257), con plan Free/cuota/runtime/fuente limpia comprobados. UUID `01a1b669-c74b-773b-b68d-e24f246f0ce7`, grupo `ff072540-c0f4-481c-8eeb-3b53ebc773e3`, runtime `b691ec2b61ee413fb1d6e7671a1a84446b4cd4f6`. Manifest público HTTP200 y recepción de ese UUID exacto en Android15, backend Marketplace y cuenta invitada.

Mismo APK `df55b9b8-1ed5-42e6-b42f-8a09b9bce50f`, paquete y firma; SHA256 `c25bb730ef10c2b2fefa1d72a6ea97e38e9041d9f4da2b8aeb50ecb31ea3310a`. Las comprobaciones posteriores no publicaron otra OTA ni construyeron un APK.

## Validación aprobada y límites

- Tipos/lint móvil y web;101 pruebas core,85 móviles,24 Node y tres de marca.
- 26/26 Playwright finales: app320/360/390/412 y web320/360/390/412/768/1024/1440, ambos temas, más fichas y protección de fotos ambiguas.
- 10/10 del Worker compilado: SSR sin JavaScript, foto/título/precio/enlace coherentes y fichas.6/6 recorridos públicos posteriores, claro/oscuro. Cuatro capturas públicas revisadas independientemente.
- Recepción nativa exacta y capturas originales revisadas de Inicio, scroll con M/Buscar, BM88, AM8, JUOVI y UGREEN. Se revisaron banners con fuentes1.0/1.3/1.6. Esto no certifica toda la accesibilidad o todos los recorridos de la aplicación.

La **matriz ANGLE42386261011 obtuvo cinco de seis casos**: ambos estándares, ambas fuentes1.3 y claro1.6. Son nueve XML aprobados y uno fallido;33 capturas solicitadas más un PNG automático del fallo. Oscuro1.6 quedó bloqueado por «Pixel Launcher isn't responding», con QEMU/ADB vivos y Mayami visible detrás. Un único retry dirigido, job128446336416, repitió ese diálogo. No se llama a esta matriz completa aprobada ni se atribuye ese ANR a Mayami.

Oscuro1.6 tuvo otra ejecución previa aprobada en42385540940: tres PNG, XML y recibo post-scroll válidos. **Ese resultado anterior no sustituye el resultado final de la matriz ANGLE. La recepción en el teléfono de Oliver no está comprobada.**

Al cerrar queda en curso [42387846456](https://github.com/somosoudy-design/marketplace/actions/runs/42387846456), fuente `3640d1e`, con un único ajuste de montaje: `stopApp:false` evita el segundo reinicio que Maestro hacía después del arranque ya realizado por el script. Todas las aserciones permanecen; no se ocultan ni cierran diálogos. Se conservará su resultado por separado cuando llegue, sin cancelarla ni abrir otra cadena de ajustes/repeticiones. El cierre de esta tanda no depende de convertir ese ensayo en una matriz aprobada.

## Evidencia y continuidad

Evidencia ignorada en `.local/banners-20261107/`: `ui-receipt`, `cloudflare-ui-results`, `ui-live`, `data/live-web/receipt.json`, manifiesto público de OTA y ZIP originales con SHA verificados. Dictámenes independientes en `proposals/review-final.md`, `media-copy-independent-final.md` y `cloudflare-final-review.md`.

Los fallos de infraestructura y sus artefactos permanecen separados en `native-evidence`, `native-receipt-final`, `native-matrix`, `native-pinned`, `native-prepared`, `native-angle` y `native-angle-retry`; informes en `proposals/native-*-review*.md`. El ensayo que sigue en curso se archiva en `native-single-launch`. No se borran ni sustituyen fallos por resultados anteriores.

Los fallos observados incluyen transporte ADB, dependencia Linux ausente, un segfault de un hilo del host llamado RenderThread y el diálogo de Pixel Launcher. La línea del kernel no identifica su binario; vincularla con QEMU/backend gráfico es una inferencia. Los ajustes del comprobador quedan documentados en los dictámenes, con [antecedente primario de Chromium](https://chromium.googlesource.com/chromium/src/tools/+/115b3f40ea52dea3dede0f705fa5aaf978562ff0) y [semántica de Maestro](https://docs.maestro.dev/reference/commands-available/launchapp), sin convertirlos en prueba causal de todos los fallos.

El fixture local de colores sólo añade `Color` a una respuesta del navegador para probar una selección explícita con fotos desconocidas; no reconstruye colores ni modifica el servidor. Los SKU del flujo25 corresponden al catálogo de esta fecha: si cambia por decisión del propietario, revisar la muestra, nunca restaurar productos para satisfacer una prueba.

Workers/Expo Free; sin servicios nuevos con cargos, SQL, compras, pagos, tiendas ni iOS. No se vuelve a modificar o publicar la app/web para resolver el emulador durante este cierre. Próxima acción de producto: recibir el siguiente grupo acotado de correcciones del usuario.
