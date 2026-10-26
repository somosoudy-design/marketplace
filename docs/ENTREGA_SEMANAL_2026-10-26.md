# Equipo coordinado · semana del26oct al1nov2026

## Entrega aprobada: panel de administración y ventas

Un único integrador escribe y publica. Especialistas reales independientes: catálogo/dirección de arte, auditor de catálogo, UX móvil, administración, vendedor y auditor de release. Lectura y parches en carpetas ignoradas; no commits concurrentes.

**Admin:** carga/error/reintento de movimientos contables ya no aparecen como un vacío falso. Las columnas pueden contraerse en móvil sin desbordar el documento. Sólo lectura: no se modifica el ledger ni sus reglas.

**Vendedor:** segundo guardado actualiza las variantes/fotos ya creadas. Un error posterior conserva IDs y uploads completados para reintentar en el mismo editor. El borrador está separado por tienda; una respuesta tardía no navega ni notifica en otra tienda. Formularios bloqueados durante guardado y filtros por producto/tienda. No equivale a una transacción atómica ni a idempotencia garantizada si se pierde la respuesta o se recarga la página.

**Pruebas:** tipos/lint monorepo,28unitarias admin,16 del gate;8UI sobre export estático(3admin+5vendedor), permisos reales/RLS en backend local. Capturas390/1360 y375/1280, ambos temas; auditor independiente APROBADO. [Evidencia](capturas/equipo-2026-10-26/panel/LEEME.md). Sin migraciones, compras, pagos ni datos remotos modificados. Hosting pendiente de solicitud y recepción exacta; no presentar sólo el build como publicado.

## Móvil en cierre de QA

Carrito distingue referencias/unidades/entregas e importe/precio unitario. Reputación admite texto ampliado. Presentación comercial privada sin avisos Demo repetidos; fuentes y licencias bajo demanda, contexto en Diagnóstico. Galería conserva nuevas fotos propias del vendedor, y sus créditos corresponden a la imagen activa y cargada. Pendientes: pruebas focales finales, auditor, Hermes, OTA preview APK5 y recepción emulador. No nueva APK ni iOS.

## Catálogo: bloqueo concreto, sin ocultarlo

Se revisaron44productos/63variantes/104rutas y38recursos existentes.30referencias renovadas no equivalen a30fotografías auténticas:25generaciones y5derivados CC. Trece productos de marca/18variantes requieren modelo/tono exacto y material de distribución autorizada. Dos agentes investigaron los pendientes y rechazaron genéricos mal correspondientes o amateur. **Cero fotos nuevas integradas en este incremento.** No sustituir por imágenes de comentarios, variantes parecidas ni generaciones de marcas presentadas como fotos. La autorización de publicación ya existe; lo pendiente es material utilizable, no otro permiso rutinario.

## Siguiente trabajo y aceptación semanal

1. Cerrar/publicar este incremento panel y móvil con recepción exacta, sin reeditar la compra progresiva ya cerrada.
2. Integrar el material fotográfico autorizado de las13referencias con correspondencia exacta y comparación Inicio/Buscar/ficha; no otra infraestructura de exhibición.
3. Resolver incidencias concretas de Oliver durante revisión en vivo, reproducir y publicar lotes pequeños, manteniendo un único integrador.
4. Candidato funcional esta semana condicionado a fotos/servicios ya disponibles y recorridos reales de comprador/vendedor/admin; no prometer lanzamiento público ni calidad global sólo por tests verdes.

No BCV, pagos, SQL, backend remoto o configuración nativa en este lote. La corrección BCV sigue prioridad crítica independiente.
