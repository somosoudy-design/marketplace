# Rediseño Android Mayami · 6 de noviembre de 2026

Oliver pidió continuar en la APK con la dirección elegida para la web: propuesta 2 con cabecera violeta de la 3. Adaptar su jerarquía al tamaño táctil, sin copiar el escritorio ni inventar ofertas, imágenes, stock o precios. El catálogo está en transición: Oliver suspendió productos para subir artículos reales; no restaurarlos.

## Plan

1. **Inicio y navegación:** cabecera violeta con marca original, búsqueda visible y accesos actuales; apertura compacta con producto o colección realmente publicados, categorías navegables y tarjetas comerciales. Preservar búsqueda fija al desplazar, zonas seguras, notificaciones y carrito.
2. **Catálogo y ficha:** mejorar legibilidad y presentación compartida, con fotos, disponibilidad y precios procedentes del catálogo. Preservar filtros, favoritos, variantes, stock, condiciones y toda la lógica del servidor.
3. **Estados y accesibilidad:** revisar cero, uno y múltiples productos, carga, error y datos desactualizados; claro/oscuro, ancho 320/360/390/412 y texto del sistema ampliado. Evitar falsas promociones y elementos sin destino.
4. **Pruebas:** tipos, lint, exportaciones web y Android, recorridos críticos con datos locales aislados y revisión visual independiente. El emulador se distingue del dispositivo físico y no se prueban pagos reales.
5. **Entrega Android:** verificar primero firma, canal y fingerprint del APK Mayami existente (`df55b9b8`, runtime `b691ec2b61ee413fb1d6e7671a1a84446b4cd4f6`). Una actualización JS solo podrá llegar a un binario compatible; no forzar el runtime antiguo. Revisar la presentación `private-preview` para no distribuir fotos de exhibición como catálogo oficial. No publicar en tiendas ni contratar servicios con cargos sin autorización; no asumir que la instalación en el Samsung ya ocurrió.

Estado: primera etapa validada con 55 recorridos y 12 pruebas de política en CI 42288014461, revisión independiente 320/412 claro/oscuro y texto ampliado, y export Android local. Las imágenes de exhibición se desactivan solo en Android; se conservan la configuración textual previa y las reglas financieras, por lo que fotos de Storage y tarifas se deben evaluar por su origen real. Expo Free/cupo verificado en 42283919634 y fingerprint compatible en 42286410080. Se solicita actualización del canal preview: publicación y recepción en el APK quedan pendientes de resultados. La web publicada sigue independiente.
