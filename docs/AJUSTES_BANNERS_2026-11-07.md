# Mayami · banners y texto del comprador · 7nov2026

Encargo de Oliver: tres correcciones por partes, banner de Android, banners web y texto técnico visible. Se conserva la referencia local aprobada, datos reales, selección, precios y destinos. No se abre otra revisión de producto ni se modifican políticas de negocio.

## Corrección implementada

- El aviso «Imagen general del producto» provenía de clasificación interna, no de generación IA. Se retira de banners, tarjetas y resúmenes. BM88, AM8 y JUOVI tienen una opción activa en la lectura pública actual; su metadata desconocida no justifica un aviso sobre distintas elecciones. La clasificación se conserva, no se reasignan fotografías para silenciarla.
- UGREEN HiTune S3 y Nexode Air sí tienen dos opciones activas y fotos sin asociar. Sus fichas mantienen el aviso comercial «Las fotos pueden variar según la opción elegida». Tras elegir explícitamente un color con fotos desconocidas, la tarjeta móvil no atribuye una foto general a ese color. El vacío explícito no se rellena con otra opción.
- Los banners usan una superficie de estudio continua, base gráfica violeta y una columna de texto más ancha. Se conserva la fotografía original y se une cada cantidad con su unidad para evitar una W aislada. No se generan ni recortan fotografías, no se inventan productos, ofertas, stock ni carruseles. El tratamiento de fondo se hace en la interfaz; en Android10+ se mezcla la capa sobre un papel casi blanco, con respaldo blanco en versiones anteriores.
- La web mantiene SSR y enlaza el producto y la variante que suministran su precio/foto. Los banners de categorías conservan navegación y recursos existentes; no se convierten en ofertas ficticias.

## Comprobación local

Tipos y lint móvil/web aprobados;101 pruebas core y85 móviles aprobadas.26 ejecuciones Playwright pasan: app320/360/390/412 y web320/360/390/412/768/1024/1440, claro/oscuro, más fichas de opción única y ambigüedad. Las fotografías se esperan cargadas antes de capturar.

Los títulos actuales de las variantes UGREEN son Púrpura/Negro o Gris/Blanco, pero sus options están vacías. No se reconstruyen colores a partir del título ni se cambia el servidor. Para probar la protección de la tarjeta al elegir color se añade estructura Color únicamente a una respuesta del navegador de pruebas local; las fotos siguen sin clasificar. El caso de ficha se comprueba con datos públicos intactos.

No hay SQL nuevo, cambios RLS, compras, reportes o pagos reales. El backend compatible anterior permanece activo. Fuente, QA y publicación se registran separadamente.

## Publicación y cierre

Pendiente de terminar revisión visual y el ajuste estrecho final, publicar la corrección web en Workers Free y una OTA Android compatible con el APK existente. La comprobación nativa incluye JUOVI/BM88/AM8, varias opciones y fuentes1.3/1.6 en emulador. No nuevoAPK, tiendas públicas ni servicios de pago. No repetir una publicación si sólo falla su comprobación posterior: consultar primero la identidad vigente.

Evidencia local: `.local/banners-20261107/`. Referencia real: `.local/comparacion-referencias-20261107/referencia-ancho390.png`. No se afirma recepción en el teléfono del propietario sin observarlo.
