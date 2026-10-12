# Revisión global de experiencia — 2026-10-12

Solicitud: Oliver pide aplicar Product Design a la app y publicar para revisar en APK 5.
Base edae062; conservar Electric Violet, funciones y reglas actuales. Revisión combinada UX/accesibilidad,
primero capturas nuevas de la app real en Chromium local, ambos temas. Sin rediseño desde cero,
backend remoto, panel, iOS, APK nuevo o cambios financieros. Publicación preview autorizada al terminar.

## Auditoría en curso

Objetivo: descubrir productos, comparar, comprar, recuperar errores y alternar comprador/vendedor con
menos fricción. Fuentes: DIRECCION_PRODUCTO.md, DISENO.md, componentes/pantallas existentes.
Product Design index/audit/user-context/design-audit-framework; preflight sin contexto persistente.
Capturas antes/después locales ignoradas en .local/global-ux; no se usan capturas históricas como evidencia.
Los criterios son claridad de la siguiente acción, jerarquía, consistencia, estados, confianza,
etiquetas/objetivos táctiles/foco/contraste/reflujo/movimiento reducido.

## Auditoría inicial — capturas nuevas aceptadas

58 capturas (29 por tema): tools/design/screens.mjs, Pixel 7; audit-global.mjs, 320×780 px.
Archivos .local/global-ux/before/{light,dark}/01..29, inspeccionados en este turno; evidencia DOM/geometría
21..29 en evidence.json. Solo cuentas demo locales; las fotos/demo siguen rotuladas, no se confirmaron
pedidos desde las capturas. No equivale a TalkBack, teclado o permisos de galería en Android físico.

| Paso | Pantallas/evidencia | Salud inicial y mejora priorizada |
|---|---|---|
| 1 Inicio/descubrimiento | 01–03 | Buena: jerarquía/productos/buscador/navbar coherentes. Ver todo pequeño; mejorar objetivo táctil compartido sin reconstruir feed |
| 2 Buscar/comparar | 04,21–23 | Fricción confirmada: Belleza seleccionada, cero accesos Limpiar filtros; búsqueda sin resultados sin acción de recuperación. Chips 34 px. Corregir reset respetando filtros bloqueados, CTA vacío y accesibilidad |
| 3 Ficha/tienda | 05–07,24 | Buena fotografía/precio/CTA; cantidad 36×36 px. Mantener nombre una línea en tarjetas y precios actuales, ampliar controles y evitar colisión de precio/cantidad a 320 px |
| 4 Carrito/checkout | 08,12–13 | Totales/entregas claros y estados anteriores intactos. Ampliar controles/calls to action compartidos, sin cambiar procedimientos o cálculos |
| 5 Acceso/recuperación | 10–11,25 | Formulario claro; mostrar contraseña 48×20 px y sin foco visible en inspección. Mejorar objetivos/foco/relación de mensajes; mantener autenticación |
| 6 Cuenta/preferencias | 09,18,26,29 | Compras/privacidad/negocio mezclados sin títulos de grupo; botón largo de privacidad 36 px. Separar compras/negocio/ayuda y adaptar botones a texto/anchos |
| 7 Posventa/direcciones | 14–20 | Pedidos/favoritos/avisos/direcciones disponibles, demo rotulado; aplicar coherencia compartida de filas/hojas sin nueva lógica |
| 8 Mi tienda | 27–28 | Datos reales locales/moderación y navegación correctos. Beneficiar de controles/filas/hojas compartidos, no reconstruir VEN-01 ni activar SQL remoto |

Prioridades verificables: reset/recuperación de catálogo; controles mínimo 44 px y CTA sin truncar;
hojas con cierre visible junto al título, movimiento reducido y contenido adaptable; agrupación Cuenta
compras/negocio/ayuda y filas coherentes. Electric Violet, tokens, marca, tabs y datos permanecen como base.
Contraste/teclado/semántica se medirán en implementación; capturas solas no certifican accesibilidad.

Pendiente: implementación, pruebas, comparativas y publicación autorizada preview/Android APK 5.


## Implementación en validación

Componentes Button/Chip/IconButton/Stepper con mínimo 44 px, botones adaptables con texto visible durante
carga, foco web :focus-visible en ScalePressable; TextField asocia helper/error y ampliar revelar contraseña.
Sheet compartida con cierre visible, contenido/CTA adaptables y movimiento reducido; ordenar/precio reutilizan
la misma hoja. Catálogo permite limpiar categoría editable conservando consulta; el vacío restablece búsqueda
sin salir de tienda/colección/categoría bloqueada; aviso de datos guardados si falla actualización.
Cuenta separa Tus compras/Tu negocio/Cuenta y ayuda con roles backend existentes; filas con iconos en superficie
violeta suave. Precio/cantidad en carrito admite reflujo a 320 px. Ninguna regla/cálculo/API/permiso cambió.
Tipos/lint aprobados. global-ux.spec.ts prepara 13 casos (claro/oscuro/contextos/errores/targets/carga/roles/foco/
movimiento reducido). Pruebas/capturas después/publicación todavía pendientes.

Validación focalizada: **13/13** (44,4 s), núcleo **50/50**, tipos/lint aprobados. Se probó reset por
categoría y estados vacíos, contexto real de categoría/colección esenciales-tech/tienda, targets/revelar
contraseña/reflujo carrito, opciones/cierre/Escape, errores asociados/limpios al editar/carga con texto,
comprador/seller-admin sin conceder roles y foco/movimiento reducido. Primer pase: 7/13; seis fallos de
aserción/fixture corregidos sin ocultarlos: el cache restaura resultados sin nueva petición, input visible
puede omitir atributo type (su propiedad sigue text) y Escape requiere modal activo tras transición;
colección de prueba cambiada al slug real. Se verifican datos/DOM y dialog activo, sin sleeps arbitrarios.
Pendiente: regresión de pantallas que reutilizan controles, capturas después/contraste y publicación.

Regresión completa inicial: 111 aprobadas, 1 omisión conocida (registro sin confirmación), 2 fallos de fixture
administrador antes de UI por sold_out en juguete-cuerda-perros. Solo la variante demo local agotada recibió
20 unidades aditivas, sin reset/borrados/datos remotos; se repetirán esos casos. Se afina foco violeta exterior
en buscador/campos (evita rectángulo negro interior de captura 22), y prueba de texto grande 1.6x del botón.
Tipos/lint finales aprobados; checkpoint antes de export final. Flujo Android visitante 06-global-ux.yaml y
scanner axe preparado; dependencia axe instalada únicamente en /tmp, ningún package/lock/config nativo cambió.
