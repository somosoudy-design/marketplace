# Marketplace — mejoras comprobables de experiencia y robustez

Trabajo sobre la app Expo real, base `b1e79a1`, rama compartida sincronizada. El propietario solicita ampliar la revisión y corregir la experiencia general, con un agente dedicado a imágenes. La propuesta V4 sigue como referencia aislada: no se sustituye la app por una maqueta ni se copian sus cálculos ficticios.

## Método y límites

Product Design `index`, `audit`, `user-context` y `design-audit-framework` consultados. Preflight ejecutado: sin contexto persistente. Capturas nuevas antes de juzgar la interfaz, recorrido, jerarquía, recuperación, accesibilidad y reflujo como criterios. Auditor independiente de lectura; solo Codex raíz edita y hace commits. No hay integración Canvas/Canva disponible. Dirección de arte usa ImageGen real; se declara la edición con IA y se compara con la fuente autorizada.

Entorno cloud Linux, Chromium/Playwright, backend **local** existente conservado. Inicio, Buscar, ficha, tienda, carrito, checkout, Cuenta, acceso, pedidos, favoritos, avisos y direcciones capturados en ambos temas. La primera captura de Inicio mostró skeleton: rechazada como evidencia de composición, pendiente recaptura estable. No confundir exportación web con Android físico. Sin publicación, APK, iOS, cambios remotos o financieros.

## Bloque 1 — recuperación y acciones fiables

Cuatro pruebas nuevas fallan sobre la exportación anterior, confirmando tres caminos defectuosos:

1. Pago desde visitante o pedido inexistente/oculto por RLS: skeleton permanente. Se distingue sesión, carga, ausencia y error sin revelar pedidos ajenos; iniciar sesión conserva el destino.
2. Fallo de métodos de pago: selector vacío sin explicación. Ahora ofrece carga, mensaje/reintento y ausencia explícita; no cotiza con métodos obsoletos o no cargados.
3. Confirmación sensible: «Conservar», X, backdrop y Atrás podían cerrar mientras la cancelación seguía en curso. La hoja bloquea todos los cierres mientras espera; muestra resultado/error y permite volver tras resolver. No se cambia la operación del servidor.
4. Compartir producto apuntaba a `kora.example.com`. Se reutiliza el criterio existente de enlaces de tienda: origen web real o esquema de la app mientras no haya dominio público. Hoja de copia/compartir con error recuperable y aviso cuando requiere app instalada.

Pruebas: `marketplace-quality.spec.ts` **10/10 finales**, ambos temas, acceso/aislamiento/recuperación/confirmación/enlace. Compartir tienda **2/2**, tipos/lint móvil y exportación web aprobados. Primer pase:10/12 aprobadas,2 fallos de fixture por reservas locales acumuladas; un retest iniciado antes de completar limpieza repitió6 fallos de fixture, no de interfaz. Se liberan solo reservas de cuentas `ui-quality-…@example.com` por `cancel_order`, sin alterar existencias manualmente, y se añade limpieza después de cada prueba. Último pase completo sin reintentos. No datos remotos ni transacciones reales.

## Bloque 2 — composición y continuidad implementada

Observado en capturas antes, revisado por auditor:

- Carrito: banner multientrega y cabeceras repiten contexto y desplazan productos. Mantener grupos reales (una tienda puede tener más de una entrega), resumir explicación y dar prioridad a tienda/foto/variante/cantidad/importe.
- Checkout: todas las modalidades de la primera entrega ocultan las siguientes y el resumen. Mostrar selección/costo/plazo y abrir alternativas con «Cambiar», conservando opciones y revalidación.
- Ficha: galería ocupa aproximadamente60% del alto y oculta variantes. Reducir altura conservando objeto completo y priorizar nombre/precio/selección. No prometer anticipo universal: elegibilidad del plan corresponde al servidor.

Resultado implementado: carrito por grupo real con tienda primero, explicación breve, precio junto al producto y retirada explícita con confirmación/rollback/reintento. Checkout resume modalidad/costo/ETA y mantiene todas las alternativas en una hoja por entrega, con nombre/variante/cantidad de productos. Ficha usa galería cuadrada acotada a460px, `contain` y skeleton del mismo tamaño; no promete50% universal en encargo. Barras fijas reportan su altura al scroll para conservar contenido accesible al ampliar texto.

Auditor ronda1 exigió dos cambios: bloquear dirección/envío/plan durante `place_order` y conservar `is_demo` en la tarifa resumida. Ambos corregidos y probados reteniendo la solicitud y examinando selección visible. Pruebas detectaron además Escape ignorado al reabrir una hoja antes de finalizar la animación RN Web: el cierre de teclado responde desde el contenido visible, respeta bloqueo y no instala listeners globales.

**Último pase:22/22 sin reintentos** (12 composición y10 recuperación), tipos/lint móvil y exportación web. Regresión previamente aprobada:6 errores comprador,3 ficha,1 compra completa local y2 compartir tienda. Incidencias de pruebas intermedias: selector de opción con código supuesto corregido a radios reales; simulación offline sustituida por estado real del navegador/antigüedad del caché; decoder de imágenes lazy fuera de pantalla sustituido por espera de las visibles. Un pase se interrumpió tras perder servicios locales al reconstruir la carpeta servida: separado backend del servidor estático y repetido con salud comprobada. No se omitieron ni debilitaron los escenarios.

Evidencia aceptada: [galería antes/después](capturas/calidad-2026-10-23/index.html),26PNG originales y medidasJSON; mismos productos, cantidades y dirección ficticia en ambos temas/anchos. Primera imagen de carrito223→149px(412),241→167(320); galería515→412 y400→320. A412 ambas entregas quedan reconocibles antes de desplazar; a320 la segunda requiere desplazamiento, sin perder contexto. Texto160% web: resumen completo por encima de barra, ambos temas. No equivale a fuenteOS/TalkBack o Android físico.

## Imágenes (en revisión)

Agente `catalog_art` utilizó ImageGen: lector retocado, editorial original y Anker. **Oliver rechazó explícitamente las fuentes documentales/amateur y sus derivados**, aunque la revisión técnica inicial los consideró utilizables en privado. No integrarlos ni repetir esos retoques. El criterio vigente exige packshots profesionales de fabricante o tienda oficial de Amazon, con modelo/variante comprobados.

Obtenidos dos originales de tienda oficial UGREEN para SKU50706: EU1600×1600/239714bytes y DE600×600/44089bytes, sin edición nuestra. Original EU transparente; tarjetasSD/microSD son utilería, no afirmar incluidas. Auditor `catalog_review`: aptos para comparación local; correspondencia exterior fuerte, la foto documental anterior no permite certificar revisión/SKU de aquella unidad. Fuentes `https://eu.ugreen.com/products/50706` y fichaDE en manifiesto ignorado `.local/arte-20261023/oficial/manifest.json`. Derechos de redistribución sin acreditar: sin Git de imágenes oficiales ni OTA.

UGREEN80887 y cargador90314 rechazados por modelo distinto. Samsung/Anker/StarTech devuelvenCONNECT403: política del entorno. Se guardó borrador de red preservando configuración previa y agregando www.samsung.com/images.samsung.com/www.startech.com/media.startech.com/www.anker.com/www.amazon.com/m.media-amazon.com. Herramienta confirmó `saved`, `requires_publish:true`; requiere revisar/guardar/publicar en Configuración del entorno, todavía no aplicado. No se pidieron credenciales ni se eludió el proxy.

Se prepara comparación en app web local con el registro de exhibición existente y lecturas públicas del Marketplace correcto. Overlay temporal solo para exportación local, registro restaurado byte a byte. No implica fotografía incorporada al paquete distribuible; la app publicada conserva recursos anteriores. Canvas/Canva no utilizado porque no está disponible.

## Seguimiento

Hipótesis del auditor: un rechazo excepcional de restauración de sesión podría bloquear arranque. No reproducido; no presentar como vulnerabilidad confirmada ni borrar credenciales para ocultarlo. Evaluar con fallo controlado del adaptador antes de cambiar autenticación.

Pendientes de cierre: dictamen visual ronda2, exportación Android/Hermes y comparación local de la referencia oficial. Luego actualización final de continuidad. No nueva OTA autorizada ni comprobación física de este incremento.
