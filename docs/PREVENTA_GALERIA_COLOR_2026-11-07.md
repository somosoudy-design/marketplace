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

104pruebas compartidas, 96unitarias móvil/storefront, 30Node/marca y tipos/lint móvil/storefront aprobados. La regresión compartida cubre foto común explícita, cambio desde índice1a0, galería exacta y variante/precio/stock coherentes. Revisión visual y publicación única web/OTA compatible en curso. La recepción en Samsung físico no está observada.

La ficha web ya tenía overflow horizontal a390px en el baseline; se conserva como antecedente fuera de estas tres correcciones. Las ampliaciones CSS de navegador no equivalen al fontScale Android. Los intentos fallidos del runner se conservan y se distinguen de fallos reales del producto.
