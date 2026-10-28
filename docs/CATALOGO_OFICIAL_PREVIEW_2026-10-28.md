# Imágenes oficiales de referencia en preview · 28 de octubre

Oliver señaló que la tarjeta de recientes publicada se veía descompuesta y reiteró que la prioridad eran las imágenes. La tarjeta vuelve a una fila compacta: foto a la izquierda, nombre y precio juntos, favorito independiente. Se descarta la composición previa, que había desplazado el precio debajo de la foto. Se verificaron importes extensos y objetivos de 44 px; texto ampliado se simuló en web.

Se incorporan seis imágenes comerciales originales de fabricantes, sin generar ni alterar sus píxeles, para seis muestras: cargador UGREEN Nexode 100 W gris, soporte de laptop plata, cable USB-C a Lightning de 1 m, batería magnética azul de 10.000 mAh, rubor SHEGLAM coral y set de brochas. Las imágenes coinciden con los atributos generales de esas fichas, pero las muestras no identifican su SKU de fabricante. Por ello son **referencias**, no una confirmación de unidad, acabado o contenido. Se indica bajo la imagen que presentación y accesorios pueden variar; la fuente se consulta en «Información de la imagen».

Oliver autorizó expresamente usar las imágenes necesarias. Esa autorización no se atribuye a los fabricantes: **no hay licencia de redistribución de UGREEN o SHEGLAM acreditada en las fuentes consultadas**. [Registro de originales, URLs y hashes](catalogo-exhibicion/REFERENCIAS_OFICIALES_2026-10-28.json). Son archivos originales de sitios oficiales; que un original sea fotografía de cámara o render no se ha verificado. Mantenerlos fuera de cualquier presentación de producción pública hasta resolver sus derechos y la correspondencia exacta.

Las sustituciones requieren la presentación privada Android `preview`, el backend de pruebas y `is_demo=true` comprobado. Se vinculan a UUID, ruta original y variante; si cambia una ruta o llega una variante no mapeada se conserva la imagen de Storage. El detalle indica la referencia junto a la fotografía y oculta el aviso y créditos si el recurso falla; los demás recursos del vendedor siguen en su galería. No se modificó el backend ni la información comercial. Las siete muestras restantes necesitan referencias de modelo/tono y de derechos; no afirmar catálogo completo.

## Evidencia

Las capturas proceden de Chromium con fixtures locales y precios sintéticos, no del catálogo remoto ni de un Android físico. [Buscar claro](capturas/catalogo-oficial-2026-10-28/buscar-light-320.png) · [Buscar oscuro](capturas/catalogo-oficial-2026-10-28/buscar-dark-320.png) · [ficha cargador](capturas/catalogo-oficial-2026-10-28/ficha-0-dark-320.png) · [ficha rubor](capturas/catalogo-oficial-2026-10-28/ficha-4-light-320.png). [Recientes antes](capturas/catalogo-oficial-2026-10-28/recientes-antes-light-320.png) · [después](capturas/catalogo-oficial-2026-10-28/recientes-despues-light-320.png). [Hashes](capturas/catalogo-oficial-2026-10-28/manifiesto.json).

El auditor independiente revisó los seis originales, correspondencia general, fuentes, `is_demo`, variantes, cambios de ruta, fallo y créditos, así como las fichas y Buscar en ambos temas. Aprobó el incremento de referencia privada con las limitaciones anteriores. Las variantes de tonos amplios en base/labial y los dos productos tecnológicos restantes se dejaron sin asociar, pues no tienen correspondencia exacta; el polvo suelto no representa el compacto.

Pruebas locales: 22 casos UI de galería, carrito invitado, búsqueda, detalle, fallo de imagen, tarjeta reciente, foco y navegación; unitarias de aislamiento por entorno, demo, ruta y variante; tipos/lint y exportación Hermes Android. La revisión web no acredita TalkBack, escala nativa ni recepción en Samsung. El guard de compatibilidad APK5 debe pasar en EAS antes de publicar.

## Publicación

Pendiente de commit, solicitud y resultado EAS Android `preview`. No generar APK ni desplegar backend.
