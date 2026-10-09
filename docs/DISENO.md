# Sistema de diseño "Arena y Jade"

Fuente única: `packages/design-tokens/src/index.ts`. La app la usa directamente (`apps/mobile/src/theme`),
el panel la recibe como variables CSS
(`node --experimental-strip-types packages/design-tokens/scripts/css.ts apps/admin/src/app/tokens.css`) y el generador de imágenes demo usa los mismos tonos. Cambiar un token
cambia los tres.

## Principios

- **La complejidad pertenece al sistema; la claridad, al usuario.** El comprador ve un monto exacto, un
  estado y una acción; las fórmulas, tasas y reglas quedan en el servidor y en el panel.
- **El producto es protagonista.** Fotografía primero, luego nombre, precio y disponibilidad. Nada más en
  la tarjeta salvo que aporte una decisión.
- **Personalidad sin ruido.** Superficies arena cálidas, jade profundo como marca, ámbar para momentos de
  alegría, coral solo para urgencia. Serif editorial (Fraunces) para títulos, sans humanista (Manrope) para
  la interfaz. Nada de blanco clínico ni negro absoluto.
- **Un universo.** Inicio, catálogo, ficha, carrito, checkout y perfil comparten tokens, componentes y ritmo.

## Tokens

| Grupo | Contenido |
|---|---|
| `palette` | jade, ámbar, coral, ciruela, cielo, arena (0–900), noche |
| `colors.light` / `colors.dark` | roles semánticos: fondo, superficie, hundida, elevada, borde, texto (primario, secundario, apagado, inverso), marca, acento, peligro, éxito, aviso, info, editorial, skeleton, barra de pestañas |
| `photoTones` | fondo, fondo profundo, sombra y oscuro para cada tono fotográfico (arena, salvia, rubor, niebla, arcilla, lila, noche) |
| `typography` | displayXL/L/M (serif), title, subtitle, body, bodySmall, label, caption, overline, price, priceLarge, button |
| `space` | escala de 4 px (0–64) |
| `radii` | xs 6, sm 10, md 14, lg 20, xl 28, pill |
| `elevation` | none, low, high (sombras cálidas, nunca negras) |
| `motion` | duraciones 90/160/240/360 ms, resortes snappy/gentle/sheet, escala al presionar 0,97 |
| `imagery` | producto 4:5, portada 16:9, logo 56 |
| `layout` | margen 16, ancho máximo 720, objetivo táctil mínimo 44 |
| `availabilityStyles` | etiqueta y tono de cada estado comercial |
| `storeAccents` | paleta curada para que cada tienda se exprese sin romper la coherencia |

Modo oscuro: automático según el sistema, con los mismos roles semánticos.

## Fotografía

- Una sola proporción en todo el catálogo (4:5 vertical).
- Cada producto se presenta sobre el tono de su categoría (`photoTones`): tecnología en niebla, belleza en
  rubor, odontología en salvia, hogar en arena, mascotas en arcilla. Así el catálogo mezcla productos sin
  mezclar estilos.
- Carga progresiva con `expo-image` (caché en disco y memoria, transición suave, placeholder del tono).
- Las imágenes demo son ilustraciones originales rotuladas "IMAGEN DEMO"; se reemplazan desde el panel.

## Componentes de la app (`apps/mobile/src/components`)

- **ui/**: `Text` (variantes tipográficas), `Button` (primario, secundario, fantasma, peligro; tamaños; estado
  de carga), `IconButton`, `Pressable` (escala al presionar, respeta movimiento reducido), `Chip`, `Badge`,
  `Availability`, `Price` (USD con decimales exactos), `TextField` (etiqueta, ayuda, error), `Skeleton`,
  `States` (`EmptyState`, `ErrorState`, `Banner`, `OfflineState`, `StaleNotice`), `ConfirmSheet` (confirmación
  en hoja inferior, igual en web, iOS y Android; el botón destructivo dice exactamente qué hace y el de volver
  conserva: "Conservar el pedido"), `Layout` (`Card`, `Divider`, `ListRow`, `SectionHeader`,
  `Stepper`), `Icon` (set propio de trazos).
- **catalog/**: `ProductCard`, `ProductGrid` (virtualizada), `ProductImage`, `CategoryTiles`, `StoreCard`,
  `Catalog` (búsqueda, filtros y orden con `OptionsSheet`).
- **checkout/**: filas de opción y de resumen.
- **Barras y hojas:** `Bars` (`useScrollY`, `CollapsingHeader` que aparece al pasar la foto, `BottomBar` fija
  con la acción principal), `Sheet` (hoja inferior con asa, fondo y cierre por gesto).
- **Tasa:** `RatePill` ("BCV · 100,00 Bs. por USD", variantes demo y sin tasa) y `RateSheet` (fuente, hora,
  margen, qué se fija al pagar y qué no).
- **Opiniones:** `reviews/Reviews` (resumen con barras, opinión con respuesta de la tienda, nota en línea) y
  `ReviewSheet` (estrellas y comentario, editable).
- **Catálogo:** `MiniProductCard` para listas compactas; `ProductRail` y `TrackedSection` miden lo que se ve.
- **Sin conexión:** `OfflineFrame` envuelve la navegación; con la red caída muestra una franja de tinta bajo la
  barra de estado ("Sin conexión · ves lo último que cargaste") que empuja las pantallas en vez de taparlas, y
  espera 1,2 s antes de aparecer para no parpadear en cortes breves.
- **Pago en verificación:** tarjeta con método, monto, equivalente y referencia, una explicación de qué pasa
  ahora y un solo camino ("Ver mi pedido"); mientras tanto no se ofrece pagar otra vez.
- `ErrorBoundary` por pantalla y `ConfigMissing` cuando faltan variables públicas.

## Estados comerciales del producto

Una misma estructura visual; cambia la acción principal:

| Estado | Acción |
|---|---|
| Disponible | Comprar |
| Por encargo | Encargar (con plazo estimado calculado por reglas) |
| En camino | Reservar |
| Reservable | Reservar |
| Agotado / No disponible | Avisarme |

Los plazos se calculan con reglas configurables (`lead_time`), nunca con textos fijos, y se muestran como
rango ("Estimado entre … y …"), no como promesa.

## Navegación

- Descubrimiento (Inicio, Explorar, Favoritos, Carrito, Cuenta) con barra de pestañas compacta.
- Ficha de producto sin barra principal: volver, favorito, compartir y CTA persistente.
- Checkout y pago sin distracciones; modales para dirección, acceso y reclamos.
- Al volver al catálogo se conservan búsqueda, filtros, orden y posición (probado).
- Atrás de Android con gesto predictivo, gestos de iOS y enlaces profundos (`kora://`, `/p/<slug>`,
  `/tienda/<slug>`).

## Movimiento y respuesta

- Escala al presionar, transiciones nativas de pila, hojas modales, skeletons en vez de spinners.
- Háptica en selección, añadir al carrito, confirmaciones y avisos.
- Con movimiento reducido activado, las duraciones se reducen a cero.

## Estados obligatorios en cada pantalla

Carga (skeleton con la forma del contenido), vacío (qué pasa y qué hacer), error (mensaje en español y
reintentar), sin conexión y éxito (confirmación clara con siguiente paso). Sin conexión tiene tres casos:
datos guardados (se muestran, con la franja arriba), datos guardados que no se pudieron actualizar (aviso
"No pudimos actualizar. Ves lo último que cargaste; puede haber cambiado.") y pantalla nunca cargada
(`OfflineState`: "Esto todavía no está guardado en tu teléfono. Se carga solo cuando vuelva la conexión.").
Nunca se muestra un código interno en lugar de un texto: si falta el nombre, se muestra un esqueleto.

## Panel web

Mismos tokens vía CSS. Componentes en `apps/admin/src/components`: `ui.tsx` (botones, campos con ayuda y
error accesibles, tablas, insignias, diálogos, pestañas, avisos), `Crud.tsx` (tablas editables de
configuración), `Fulfillment.tsx`, `ProductReview.tsx`, `Claims.tsx`, `Payouts.tsx`, `StockTable.tsx`,
`Shell.tsx`, `Reviews.tsx` (moderación y respuesta de opiniones). El panel prioriza densidad y eficiencia sin
perder la identidad: filtros en la misma línea que las pestañas, cifras tabulares, barras finas para comparar
proporciones (CTR) y avisos honestos cuando los datos son de demostración o la muestra es pequeña. Las
tarjetas de salud (tasa, avisos al teléfono) dicen qué está mal y qué revisar, no solo un número.

## Accesibilidad

Etiquetas reales en controles, `aria-describedby` para ayudas y errores, foco visible, objetivos táctiles
≥ 44, contraste AA en texto, roles y descripciones en elementos presionables, textos en español.
