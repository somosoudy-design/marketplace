# Preventa, galería por color y selector · 7nov2026

Tres correcciones autorizadas, conservando la estructura actual: «Preventa» para `reservable`, fotos por variante y círculo con nombre legible. Se mantienen `Reservar`, el flujo de reserva y las reglas existentes. Nexode conserva «No disponible». No cambian inventario, precios, anticipos, cuotas ni condiciones de compra.

## Evidencia y causa

Baseline real: 16 contextos de web pública y Expo Web congelado `0df5410`, a390px, claro/oscuro y texto normal/160%; 64capturas. Cambiaba la variante, pero permanecía la portada del color anterior. Los dos UGREEN heredados tenían options vacíos y ninguna asociación de imágenes. La lectura API conserva estos datos; la creación antigua no guardaba opciones y los editores actuales no las recogen. Este encargo no rediseña editores ni inventa atributos.

Doce originales de1600px revisados: HiTune Púrpura H0/H2/H3 y Negro H1/H4/H5; Nexode Gris N0/N2/N3 y Blanco N1/N4/N5. Cada foto muestra la carcasa de un color; ninguna es común. Manifest ignorado `.local/preventa-color-20261107/assets-review/color-evidence-manifest.json`, SHA256 `87fe040d04080953427c8a84af017dd1da30ba167f140e552b3b62022661e557`.

## Implementación y conservación

Aplicado a las16:25UTC mediante cuatro llamadas a `catalog_set_variant_media`, todasHTTP200, con la sesión real del panel, permisos de servidor y control optimista: tres imágenes ordenadas por variante. La lectura pública posterior confirmó12enlaces y0generales. Comparación recursiva con snapshot inmediatamente anterior: todos los campos ajenos a medios/timestamps permanecen idénticos, incluidas imágenes originales, opciones, precios, stock y disponibilidad. El baseline antiguo también recoge cambios del cron de popularidad anteriores al RPC; no se atribuyen a esta corrección. Recibos y contraste en `.local/preventa-color-20261107/data/`. No repetir las llamadas ni restaurar el estado anterior por cambios legítimos de operación.

Se reutilizan los permisos y la auditoría existentes, sin SQL directo, suplantación ni nuevas credenciales. El círculo es decorativo y conserva el nombre accesible, selección explícita, variante y precio existentes. Para legacy sólo se decoran títulos exactos Negro/Blanco/Gris/Púrpura; no se persiste Color ni se analizan nombres compuestos. Valores malformados o aliases ambiguos no provocan crash ni reciben tono inventado. No cambian los tokens globales.

Las imágenes comunes sólo se incluyen si están asociadas explícitamente a cada variante: la ausencia de asociación no acredita neutralidad. La app ya reinicia su galería al cambiar de variante. La foto web se remonta por variante/ruta para evitar que se conserve la portada decodificada anterior.

## Validación y siguiente paso

104pruebas compartidas, 96unitarias móvil/storefront, 30Node/marca y tipos/lint móvil/storefront aprobados. La regresión compartida cubre foto común explícita, cambio desde índice1a0, galería exacta y variante/precio/stock coherentes. Revisión independiente favorable:20/20 UI reales y carrito invitado coherente; cuatro recapturas web confirman todas las miniaturas cargadas. Worker local4/4 también conSSRsinJavaScript,0console.error/pageerror. Publicación única completada: web644930a4-66d3-4a77-9312-1b6f0fcc0ba3 al100%, fuente1425db8 y BUILD_ID KsyknrLpMjpR67ufZz3yq; HTML/BUILD_ID/CSSSHA y redirecciónwww verificados. Android publicado por CI42392010745/fuente8e771aa, UUID01a1b6de-cb54-7f8a-a80b-778c6b1ec2ce, grupo360d104a-62e3-49ea-935e-4ac3f911fb57, mismo runtimeb691ec2b61ee413fb1d6e7671a1a84446b4cd4f6. Manifest públicoHTTP200 confirma la nuevaOTA; el primer recibo del emulador confirmó el UUID exacto a16:40:37UTC; no hubo segunda publicación niAPK nuevo. La recepción en Samsung físico no está observada.

La ficha web ya tenía overflow horizontal a390px en el baseline; se conserva como antecedente fuera de estas tres correcciones. Las ampliaciones CSS de navegador no equivalen al fontScale Android. Los intentos fallidos del runner se conservan y se distinguen de fallos reales del producto.

## Entrega pública y advertencias conservadas

La web activa conserva título/precio/SKU/portada yCSS porhash del artefacto probado, ywww redirige conservando ruta/variante. Cuatro recorridos públicos JS completaron foto2→otrocolor→portada0 y cuatro páginasSSR sinJavaScript aprobaron con todas las imágenes cargadas, revisadas independientemente. Tres PNGSSR públicos coinciden porSHA con el preview y el cuarto también fue aprobado visualmente. Evidencia clasificada: `.local/preventa-color-20261107/worker/public/final-verification.json`. Los recibos crudos del control estricto de consola **siguen fallidos** por `net::ERR_NAME_NOT_RESOLVED` de `static.cloudflareinsights.com/beacon.min.js`; el diagnóstico aislado identifica ese beacon opcional, sin pageerror niHTTP fallido de la ficha. No se oculta ni se presenta como cuatro checks de consola aprobados. La funcionalidad se clasifica por sus estados/IDs/medios/precios y el SSR se verificó aparte.

Se preservan igualmente los primeros timeouts del Worker: la espera de imágenes dentro del navegador conJavaScript desactivado agotó el tiempo; la comprobación externa deDOM verificó después4imágenes completas1600×1600 y susURLs200. El runner final mantuvo esos requisitos y comprobó el estado mediante polling desdeNode. No se modificó el componente por un diagnóstico del instrumento.

Evidencia local: `.local/preventa-color-20261107/{before,after,worker,public,native,proposals}`. Antes/después y revisión independiente guardan capturas, hashes, scripts y límites de cada plataforma. No compras, pagos ni fixtures de producción. Las pruebas de carrito usaron un invitado local; la sesión real del panel realizó las cuatro escrituras de medios descritas.

## Primer recibo Android y corrección del objetivo de prueba

CI42392010745 publicó correctamente, conservó planFree/cuota/runtime/fuente limpia/APK y confirmó recepción del UUID exacto. Terminófallido después, en flow25claro: el assert Negro seleccionado encontró Púrpura. Se conservan log completo, ZIP verificado porSHA y captura/jerarquía del fallo en native/artifact-13581364458. El target Negro estaba enbounds[344,2057][587,2172] y se tocó(465,2114), mientras el resumen fijo Editar selección ocupaba y2088–2130; después la ficha se desplazó a las opciones, con Púrpura aún elegida. La evidencia es coherente con una intercepción del toque por la barra, no acredita selección nativa de Negro ni aprobación de oscuro/fuentes posteriores.

Sólo se añade centerElement:true al scroll de la prueba, para colocar el control fuera de la barra antes de tocarlo; se conserva selected:true. La documentación oficial de Maestro confirma ese comportamiento: https://docs.maestro.dev/reference/commands-available/scrolluntilvisible . Se utiliza una vez el workflow de recibo ya existente sobre el mismo UUID, sin tocar su infraestructura, repetir publicación ni cambiar código del producto. La comprobación de lectura es42393131475, fuente7e4960f, sobre el mismo UUID publicado; su resultado se registrará antes del cierre.

## Cierre confirmado por Oliver

Oliver confirmó que «Preventa» y las imágenes por color funcionan. El ensayo ya iniciado42393131475 terminó5/6: standard claro/oscuro, claro1.3/1.6 y oscuro1.3 aprobados. En ambos standard se comprobó Negro seleccionado, círculo, SKU negro, Preventa, $39 y resumen Negro; los toques centrados quedaron fuera de la barra y selected:true pasó. El único caso oscuro1.6 quedó bloqueado por el diálogo ANR de PixelLauncher, con UUID correcto recibido; no se declara aprobado ese recorrido ni se hace otro ciclo. Seis artifacts verificados porSHA, con extracción segura y logs originales, en native/centered-receipt-42393131475. La recepción física en Samsung no está observada.

Microajustes solicitados para una tanda posterior: reducir círculos de color, retirar texto redundante y ajustar el botón. No se implementan en este bloque ni en modo invitado. Publicación y comprobación cerradas, sin más publicaciones o ensayos de este bloque.
