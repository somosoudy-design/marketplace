# Sistema de interfaz y experiencia de Mayami

## Dirección

La oferta reúne identidad, vendedor, importe, estado, selección y compra. Se conserva el logotipo original, Plus Jakarta Sans, Electric Violet, tinta y lavanda. Los tokens existentes siguen en `packages/design-tokens` y en las hojas generadas de cada aplicación.

La ficha web usa un ancho máximo de 1320 px y una separación de 32 px entre galería y panel. La proporción inicial es 58/42 y se adapta a tablet. El título conserva el nombre completo, con marca o categoría secundaria y referencia de variante independiente. Favorito y compartir se agrupan en la galería. El panel tiene una superficie continua.

En móvil, la galería ocupa una altura controlada y la compra emplea una sola barra inferior con precio, modalidad, cantidad, acción y resultado. Su altura medida reserva espacio al final del documento. El teclado de búsqueda y la orientación horizontal se contemplan mediante reglas específicas. El resto de rutas conserva su navegación. La app Expo reutiliza `BottomBar`, `Stepper`, `Price`, `AvailabilityBadge` y sus reglas existentes de área segura.

## Contrato de oferta

`packages/core/src/product-selection.ts` sigue resolviendo variante, precio, stock, máximo, condición, fotos y posibilidad de comprar. `packages/core/src/commerce-presentation.ts` concentra su presentación.

| Responsabilidad | Regla y componente |
|---|---|
| Importe | `formatOfferPrice` muestra la moneda explícita con el redondeo existente. USD, VES y USDT conservan su identidad. `formatMoney` y los cálculos financieros permanecen como fuente matemática. |
| Modalidad | `presentAvailability` define disponible, por encargo, en camino, preventa, agotado y no disponible. `presentOfferAvailability` incorpora el estado de selección sin transformar la modalidad del producto. |
| Condición | Proviene del campo comercial vigente. Un `null` actual conserva el significado desconocido aunque una copia antigua dijera nuevo. |
| Variante | `variantDisplayTitle` omite el literal técnico Única y usa atributos explícitos si existen. Conserva el ID, SKU, foto, selección y enlace. `variantAttributeLabel` usa los atributos publicados. |
| Cantidad | `quantityControlState` recibe cantidad, máximo, editabilidad y operación pendiente. Una cantidad superior al máximo sigue visible y puede reducirse. La eliminación conserva su confirmación separada. |
| Preparación | `describeDispatchStage` comunica el hito anterior al transporte con `lead_min_days` y `lead_max_days`. La modalidad determina si se trata de despacho, disponibilidad o próximo lote. |
| Llegada | `describeEtaDates` utiliza las fechas calculadas por la opción de transporte con destino. |
| Descripción | `sourceDescriptionSections` estructura encabezados y listas explícitos. Las afirmaciones siguen atribuidas al vendedor. La descripción no modifica condición, stock, SKU ni estimaciones estructuradas. |
| Vendedor | Se muestra el nombre comercial de la respuesta. Los identificadores y slugs siguen determinando las relaciones y las rutas existentes. |

El Ulanzi MT-44 observado tiene preparación estructurada de 5–10 días. Su descripción publica entrega de 15–23 días y enumera trípode con pinza. Las imágenes acompañan esa oferta. El contenido enumerado determina lo que se presenta como incluido. El campo de condición observado es desconocido.

## Componentes y continuidad

En web, `offer.tsx` contiene `OfferStatus`, `SellerLink`, `DeliveryStage`, `PurchaseHelp` y `ProductContent`. `quantity-control.tsx` sirve a ficha y carrito. El formateador de `lib/format.ts` sirve a las tarjetas, resúmenes, pedidos y pagos. `ReviewLine` conserva la identidad de la selección en checkout y pedidos. Cada familia mantiene su composición apropiada.

El carrito invitado vuelve a consultar las ofertas. La selección guardada conserva identidad y cantidad. Los importes vigentes y límites proceden de la lectura actual. Ante fallo, los productos siguen accesibles y el recorrido comunica la comprobación pendiente. El checkout mantiene autenticación, retorno e intención de compra. El servidor valida los importes y el pedido.

Las operaciones pendientes bloquean la acción correspondiente. La confirmación de agregado y el acceso al carrito pertenecen a la misma zona de compra móvil. Las respuestas fallidas ofrecen reintento y mantienen el contexto. Los cambios de variante actualizan SKU, imagen, precio, límite y URL conjuntamente.

Los filtros de escritorio anuncian cambios pendientes hasta Aplicar. El panel móvil mantiene un borrador que se descarta al cancelarlo. URL, consulta, orden, selección y resultados comparten el contexto aplicado. La ordenación conserva los filtros y vuelve a la primera página. El formulario mantiene su envío nativo cuando JavaScript está desactivado.

Eliminar cuenta se accede desde Perfil en Cuenta. El footer agrupa Términos y Privacidad bajo Legal y Devoluciones y Contacto bajo Ayuda. La página web de eliminación expone el procedimiento de solicitud. La app mantiene su confirmación autenticada existente.

## Accesibilidad y adopción

Los controles principales usan 44 px como criterio táctil interno. Se comprueban foco, teclado, anuncios de estado, reflujo, texto ampliado y movimiento reducido. WCAG 2.2 distingue el objetivo de 44 px del criterio AA de tamaño mínimo de 24 px y sus excepciones. Las comprobaciones parciales se registran por ruta y entorno. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

Una pantalla nueva reutiliza los contratos y componentes anteriores. Las excepciones se documentan con el consumidor afectado y su necesidad. Antes de retirar una implementación duplicada, se migran sus consumidores y se comprueba su comportamiento. El inventario y la evidencia de esta adopción están en `ADOPCION_UI_UX_2026-11-17.md`.
