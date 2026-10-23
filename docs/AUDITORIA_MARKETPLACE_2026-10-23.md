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

## Bloque 2 — composición y continuidad (en curso)

Observado en capturas antes, revisado por auditor:

- Carrito: banner multientrega y cabeceras repiten contexto y desplazan productos. Mantener grupos reales (una tienda puede tener más de una entrega), resumir explicación y dar prioridad a tienda/foto/variante/cantidad/importe.
- Checkout: todas las modalidades de la primera entrega ocultan las siguientes y el resumen. Mostrar selección/costo/plazo y abrir alternativas con «Cambiar», conservando opciones y revalidación.
- Ficha: galería ocupa aproximadamente60% del alto y oculta variantes. Reducir altura conservando objeto completo y priorizar nombre/precio/selección. No prometer anticipo universal: elegibilidad del plan corresponde al servidor.

## Imágenes (en revisión)

Agente `catalog_art`: lector UGREEN CC0 editado con ImageGen para separar fondo y encuadre; editorial original Electric Violet sin SKU ni precio. Anker rechazado por residuos blancos; Samsung original conservado. `catalog_review` revisa fidelidad/procedencia de manera independiente. Aún no se considera integrado ni publicado por haber generado un archivo.

## Seguimiento

Hipótesis del auditor: un rechazo excepcional de restauración de sesión podría bloquear arranque. No reproducido; no presentar como vulnerabilidad confirmada ni borrar credenciales para ocultarlo. Evaluar con fallo controlado del adaptador antes de cambiar autenticación.

Pendientes de cierre: pruebas finales del bloque1, implementación/capturas comparables del bloque2, recursos aceptados/optimizados, revisión final y continuidad. La revisión interna no autoriza una OTA nueva.
