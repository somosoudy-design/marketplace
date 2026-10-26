# Equipo coordinado · semana del 26 de octubre al 1 de noviembre de 2026

## Entrega aprobada: panel de administración y ventas

Un único integrador escribe y publica. Especialistas reales independientes: catálogo/dirección de arte, auditor de catálogo, UX móvil, administración, vendedor y auditor de release. Lectura y parches en carpetas ignoradas; no commits concurrentes.

**Admin:** carga/error/reintento de movimientos contables ya no aparecen como un vacío falso. Las columnas pueden contraerse en móvil sin desbordar el documento. Sólo lectura: no se modifica el ledger ni sus reglas.

**Vendedor:** segundo guardado actualiza las variantes/fotos ya creadas. Un error posterior conserva IDs y uploads completados para reintentar en el mismo editor. El borrador está separado por tienda; una respuesta tardía no navega ni notifica en otra tienda. Formularios bloqueados durante guardado y filtros por producto/tienda. No equivale a una transacción atómica ni a idempotencia garantizada si se pierde la respuesta o se recarga la página.

**Pruebas:** tipos/lint monorepo,28 unitarias admin,16 del gate;8 UI sobre export estático(3 admin + 5 vendedor), permisos reales/RLS en backend local. Capturas390 / 1360 y375 / 1280, ambos temas; auditor independiente APROBADO. [Evidencia](capturas/equipo-2026-10-26/panel/LEEME.md). Sin migraciones, compras, pagos ni datos remotos modificados. EAS Hosting publicó1480274 en CI40410656172 y el marcador inmutable es correcto. El alias habitual no entrega JSON HTTP200; recepción fallida, no declarar disponible ahí. Se añade diagnósticoCI read-only de metadatos/HTTP, sin otra publicación ni cambios de backend.

## Móvil en cierre de QA

Carrito distingue referencias/unidades/entregas e importe/precio unitario. Reputación admite texto ampliado. Presentación comercial privada sin avisos Demo repetidos; fuentes y licencias bajo demanda, contexto en Diagnóstico. Galería conserva nuevas fotos propias del vendedor, y sus créditos corresponden a la imagen activa y cargada. 15UI específicas,25unitarias, tipos/lint yHermes aprobados. Pendientes: dictamen visual final, OTA preview APK5 y recepción emulador. No nueva APK ni iOS.

## Catálogo: bloqueo concreto, sin ocultarlo

Se revisaron44 productos/63 variantes/104 rutas y38 recursos existentes.30 referencias renovadas no equivalen a30 fotografías auténticas:25 generaciones y5 derivados CC. Trece productos de marca/18 variantes requieren modelo/tono exacto y material de distribución autorizada. Dos agentes investigaron los pendientes y rechazaron genéricos mal correspondientes o amateur. **Cero fotos nuevas integradas en este incremento.** No sustituir por imágenes de comentarios, variantes parecidas ni generaciones de marcas presentadas como fotos. La autorización de publicación ya existe; lo pendiente es material utilizable, no otro permiso rutinario.

## Siguiente trabajo y aceptación semanal

1. Cerrar/publicar este incremento panel y móvil con recepción exacta, sin reeditar la compra progresiva ya cerrada.
2. Integrar el material fotográfico autorizado de las13referencias con correspondencia exacta y comparación Inicio/Buscar/ficha; no otra infraestructura de exhibición.
3. Resolver incidencias concretas de Oliver durante revisión en vivo, reproducir y publicar lotes pequeños, manteniendo un único integrador.
4. Candidato funcional esta semana condicionado a fotos/servicios ya disponibles y recorridos reales de comprador/vendedor/admin; no prometer lanzamiento público ni calidad global sólo por tests verdes.

No BCV, pagos, SQL, backend remoto o configuración nativa en este lote. La corrección BCV sigue prioridad crítica independiente.

## Método y recursos de diseño utilizados

Consultados realmente Product Design `index`, `audit` y `user-context`, y la skill personal `oliver-design-direction`. Se aplicó captura previa → incidencia observable → corrección acotada → mismos estados posteriores → revisión independiente. Las decisiones fueron separar cantidad/importe/entregas por jerarquía, permitir reflujo en reputación, retirar avisos técnicos de la compra y conservar autor/licencia en una hoja accesible bajo demanda. La identidad y el sistema Electric Violet existentes se mantienen; no se rehace el producto por decoración.

La evidencia se obtiene con Expo/Next exportados y Chromium/Playwright locales. No se afirma disponer de Canvas/Canva ni haber seguido herramientas de navegador que no están expuestas en este entorno. La validación Android se documenta por separado tras la OTA. Pasar pruebas no sustituye la inspección visual ni acredita recepción en el Samsung del propietario.
