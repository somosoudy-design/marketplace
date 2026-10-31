# APROBADO — carrito, presentación comercial y galería

Se aprueba solicitar la OTA **Android preview/APK5** de `ff9784b`, con guard de runtime antes de publicar y recepción nativa posterior. QA comprobó que los archivos móviles actuales coinciden exactamente con ese commit: `mobile-approved-source.json`. No hay P1/P2 nuevas pendientes del alcance web revisado.

## Hallazgos resueltos y recorrido

1. **Carrito: conteo e importes — correcto.** Dos referencias/tres unidades ya no se anuncian como un producto. Se separan9USD por unidad y18USD de importe para dos unidades; una unidad evita repetir precio. Grupos, subtotal, cantidades y navegación conservados. QA comparó16pares de DTO idénticos.
2. **Tiendas con/sin opiniones — correcto en web.** Altura mínima y reflujo contienen nota/contador a320/412 claro/oscuro y CSS1,6. Se inspeccionaron40PNG normales posteriores y tres anteriores representativos, sin repetirlos tras cambios de estados.
3. **Error de cantidad frente a quitar — corregido.** La hoja ya no hereda el fallo de otra operación/variante; conserva el error real de quitar y no muestra el banner de cantidad en esa operación. Ocho PNG finales inspeccionados;7/7casos UX,0omisiones/reintentos.
4. **Galería de fotos propias — corregida.** Una ruta Storage nueva sobrevive junto al mapping; sólo se oculta demo/ histórica cuando hay reemplazo. El indicador y la atribución siguen la página activa con scroll real. Sin mapping o fuera de la presentación interna, el DTO no se recorta.
5. **Fallback y atribución — corregidos.** Fallar un override atribuido retira todo su crédito: Storage no hereda el autor Commons. Cambiar a una fuente/variante válida recupera su información sin afectar otra página. Catorce PNG finales inspeccionados y6/6casos de galería,0omisiones/reintentos. Spec versionado cotejado SHA256 `f82ec4fb2fcef38fc6cad4a513c133239081b0ad11cf4763f06e4296a55b031f`.
6. **Presentación comercial — aceptada en el alcance.** Se retiran avisos de entorno del recorrido normal; el nombre/precio quedan al frente. Fuente/licencia y naturaleza digital permanecen accesibles en Información de la imagen tras descripción. Enter abre y Escape cierra la hoja en ambos temas. Se revisaron cuatro pares reales de Inicio/Buscar/ficha; los ocho pares documentados conservan los DTO comerciales.
7. **StoreHeader — corrección final comprobada.** La constante de descripción está en el ámbito correcto. Dos pruebas de tienda reales sobre8103, ocho PNG inspeccionados de Kora/Patitas, ambos temas: descripción/productos/regreso sin errores JavaScript. La fuente actual coincide con el hash observado `2c0a21a8652535e13b2597311256cd5ae6284caf74dc5b641c5b46caf86e28c1`.

Se revisaron además los cinco tests del helper comercial: preserva productos no demo, otras configuraciones y texto significativo. Raíz confirma tipos/lint,25unitarias y export Android Hermes finales correctos. No hubo cambios en cálculos, is_demo, permisos o backend para conseguir las capturas.

## Evidencia y límites

`mobile-final-inspeccion.json` registra **38PNG nuevos abiertos/hash comprobado**:14galería+8errores+8tienda+8de cuatro pares comerciales. Complementa los40normales ya aprobados en `DICTAMEN_MOVIL_NORMAL.md`. Los7UX+6galería se probaron en8102; sólo la constante de StoreHeader cambió después y se verificó focalmente en8103 con2casos. No se repitió una auditoría general.

La comparación real usa UUIDs del seed local, distintos del registro remoto: conserva ilustraciones anteriores, incluso marcas incrustadas y textos de fixtures. Acredita retiro de avisos de interfaz sobre datos iguales; **no acredita fotografías nuevas ni catálogo fotográfico completo**. Las13referencias pendientes siguen sin nuevo material que cumpla identidad/derechos/calidad;0integraciones fotográficas nuevas.

Falta recepción Android con los nuevos flujos19/20, ambos temas y OS1,6, y cotejar el Código con la OTA exacta. CSS1,6 no sustituye esa prueba; tampoco se acredita TalkBack, Samsung físico o compra autenticada nativa. Los casos de compra/persistencia y permisos fueron locales; no se crearon cuentas/pedidos/pagos remotos.
