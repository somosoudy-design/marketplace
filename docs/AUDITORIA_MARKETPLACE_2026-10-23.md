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

Comparación completada en app web local con registro de exhibición existente y lecturas públicas del Marketplace correcto. **Una referencia de producto probada con packshot oficial**,18PNG originales, InicioC/resultados/ficha en ambos temas y ficha320. Overlay temporal solo para exportación local, registro restaurado byte a byte. Ocho intentos de tracking bloqueados; ninguna escritura remota. Primeras capturas tomadas durante debounce/transición rechazadas y recapturadas después de resultado y opacidad estable. No implica fotografía incorporada al paquete distribuible; la app publicada conserva recursos anteriores. Canvas/Canva no utilizado porque no está disponible.

La comparativa reveló «1 productos» en Buscar: corregido a«1 producto» y probado en dos temas con consulta real local de un único resultado. Tipos/lint/exportación web final y3/3 pruebas adicionales (singular en ambos temas y enlace de tienda) aprobados. **Cobertura consolidada:36 casos únicos locales**:22 nuevos de composición/robustez,2singular,6errores comprador,3ficha,1compra completa,2compartir tienda. No contar repeticiones como casos nuevos. Cuatro grupos de comparación fotográfica son comprobaciones adicionales de lectura web, no casos Android.

## Control de calidad y estado de entrega

`release_auditor`, ronda2: **APROBADO para cerrar este incremento local**, sin P1/P2 abiertos del alcance revisado. Examinó código, nuevas capturas en ambos temas y estrésCSS320/160%; no ejecutó los22tests, que son ejecución del agente principal. Correcciones de ronda1 resueltas: edición congelada durante creación y tarifa demo visible. `catalog_review`: packshot50706 apto para evaluación local, sin aprobar redistribución o SKU de cada variante. No desacuerdos sin resolver; aprobación interna no sustituye revisión de Oliver.

Exportación Android/Hermes final aprobada en fuente funcional **`130d041`** (HBC5,9MB), incluido el singular. Comprobado por hash que ninguno de los dos packshots oficiales sin permiso forma parte de los assets del export nativo. Evidencia sin secretos: [calidad-marketplace-2026-10-23.json](calidad-marketplace-2026-10-23.json). No dependencias/configuración nativa, backend, vendedor, pagos/tasas/cálculos o producción modificados. Runtime APK5 exacto debe verificarse con su archivo Firebase del entornoEAS y guard existente antes de una publicación; no se afirma ese guard ni recepción Android para este bloque.

| Paso | Estado y alcance comprobado |
|---|---|
| 1 Inicio/descubrimiento | EstructuraC conservada; referencia oficial evaluada localmente, catálogo fotográfico profesional aún incompleto |
| 2 Buscar | Capacidades conservadas, singular corregido; referencia/mismoUUID y regreso de ficha comprobados por pruebas existentes |
| 3 Ficha/decisión | Galería más corta sin cortar objeto, variantes antes, encargo sin promesa universal; fotografía oficial local |
| 4 Carrito | Primera foto74px antes en ambos anchos, retirada confirmada con recuperación, datos monetarios del servidor |
| 5 Checkout | Alternativas accesibles con selección resumida, estado/compromiso claros, ediciones bloqueadas durante envío y refresco fallido impide confirmar |
| 6 Pago | Sesión/pedido ausente/error/carga/métodos recuperables; no se cambian cotizaciones ni verificación de pagos |
| 7 Cuenta/posventa | Confirmación sensible compartida protege operación en curso; no auditoría de autorización de todo el backend ni cambios de permisos |

## Seguimiento

Hipótesis del auditor: un rechazo excepcional de restauración de sesión podría bloquear arranque. No reproducido; no presentar como vulnerabilidad confirmada ni borrar credenciales para ocultarlo. Evaluar con fallo controlado del adaptador antes de cambiar autenticación.

Incremento de compra cerrado en código y documentación. **Próximo trabajo:** material profesional oficial del resto de referencias con acceso de red aplicado y base de redistribución, revisión SKU/variantes y publicación únicamente cuando procedan autorización/guard APK5/validación Android. No nueva OTA ni comprobación física de este incremento. Hipótesis de arranque pendiente de reproducción acotada, fuera del cierre actual.
