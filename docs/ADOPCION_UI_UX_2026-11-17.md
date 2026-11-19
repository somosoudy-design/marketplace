# Adopción del sistema de experiencia y oferta

## Entrega local del 17 de noviembre de 2026

Fuente integrada en `/Users/brandeastudio/marketplace`, rama `claude/marketplace-v1`. Se incorporó la presentación web de la fuente publicada `bc3cb7f` y se conservaron las reglas más recientes de cuotas, intención de carrito y autenticación de esta rama. Los cambios de esta entrega son locales. La versión oficial registrada en `ESTADO_ACTUAL.md` conserva su propio historial.

El contrato y las reglas de evolución están en [Sistema de interfaz y experiencia](SISTEMA_UI_UX.md). El primer checkpoint local de este trabajo es `09b2b9b`. El diff completo del encargo parte de `5d8de2a`.

## Inventario de adopción

| Familia y rutas | Contratos y componentes utilizados | Comprobación |
|---|---|---|
| Web inicio `/`, catálogo y búsqueda `/buscar`, categorías mediante consulta, tienda `/tienda/[slug]`, favoritos `/favoritos` | `ProductCard`, selección editorial, foto de variante, precio USD explícito, estado discreto según oferta, nombre comercial de tienda | Render público de cada familia a 390 y 1440, claro y oscuro. Filtros pendientes, Aplicar, orden y retorno incluidos. |
| Web ficha `/p/[slug]` | Galería y panel continuo, `OfferStatus`, `SellerLink`, `DeliveryStage`, `QuantityControl`, `PurchaseHelp`, `ProductContent` | HiTune, Ulanzi y Nexode. Ocho anchos distribuidos entre 320 y 1920. Variante, SKU, foto, URL, cantidades, agregado y recuperación. |
| Web carrito `/carrito` | Oferta actual consultada, condición vigente, modalidad y despacho, límites con corrección explícita, escritura protegida, planes ofrecidos | Invitado público y comprador de pruebas local. Dos Ulanzi suman USD 77,20. Stock, operación pendiente, error y reintento. |
| Web checkout `/checkout`, pedidos `/pedidos` y `/pedidos/[id]`, pago `/pagar/[id]` | `ReviewLine`, moneda, variante comercial, modalidad del pedido, ayuda, retorno autenticado y preferencia de plan | Sesión de comprador del stack local. Pedido existente y pago pendiente de revisión. La revisión conserva ese estado. |
| Web cuenta `/cuenta`, direcciones `/direcciones`, notificaciones `/notificaciones` | `Buyer`, formularios y estados existentes. Eliminar cuenta en Perfil | Cuenta privada y páginas de comprador locales. Acceso desde Perfil y página informativa de solicitud de eliminación revisados. |
| Web acceso `/registro`, `/recuperar`, `/cuenta` y retorno de autenticación | Componentes de acceso vigentes, intento correlacionado, retorno seguro | Render claro y oscuro y pruebas de API/retorno. El alta Google real pertenece a la verificación publicada del acceso. |
| Web ayuda `/contacto`, `/devoluciones`, footer compartido | `PurchaseHelp` en compra, grupo Legal con Términos y Privacidad, grupo Ayuda | Móvil y escritorio en ambos temas, enlaces y ausencia de eliminación en footer. |
| App inicio, explorar, catálogo, tienda y favoritos | `ProductCard`, `MiniProductCard`, `Price`, selección editorial y metadatos de variante | Export Expo web local. Revisión visual y recorridos de catálogo, tienda y oferta. |
| App `/product/[id]` y `/p/[slug]` | Fuente de precio y fotos vigente, atributo explícito, `Stepper`, despacho y llegada separados, descripción por encabezados, `BottomBar` | Export Expo web local. Cantidad, cambio de stock, variante, error, agregado y retorno. |
| App carrito | `guestCartOffer`, catálogo anónimo fresco, grupos por vendedor, subtotal, modalidad, límite, pendientes y recuperación | Casos invitado y autenticado locales en claro y oscuro. Cantidad excesiva visible hasta corrección. |
| App checkout, pedidos y pago | `formatOfferPrice`, `variantDisplayTitle`, planes y validación del servidor existentes | 21 recorridos funcionales de app y 36 capturas finales de inicio, checkout y familias privadas, a 390/1440 en ambos temas. Pedido y pago existentes revisados. |
| App cuenta, ajustes, direcciones y vendedor | Componentes actuales de formulario y acceso, precio/variante comunes en pedidos | Cuenta revisada a 390/1440 en ambos temas. La eliminación se accede desde la cuenta y sus ajustes. Conserva autenticación y confirmación. |
| Administración y vendedor | Formateador compartido de moneda, nombres de variantes en pedidos y opiniones, identidad legible en cabecera | Productos y pedidos de administración, productos, pedidos y ventas del vendedor. 20 capturas a 390/1440 en ambos temas y 67 pruebas. |

Los editores conservan los campos de datos de variante. La ocultación de Única se aplica a la presentación al comprador y a resúmenes de lectura. Las rutas de edición permiten mantener los datos de origen.

## Datos comerciales observados

- HiTune S3 conserva USD 39,00, modalidad preventa y próximo lote de 15–30 días. Púrpura y negro conservan sus identificadores, SKU, fotos y límites respectivos.
- Ulanzi MT-44 conserva USD 38,60, modalidad por encargo y preparación estructurada de 5–10 días. La descripción del vendedor publica entrega de 15–23 días y enumera trípode con pinza. Se muestran ambos hitos con su fuente. Su condición estructurada es desconocida.
- Nexode Air 65 W conserva el estado no disponible y la compra deshabilitada.
- El vendedor se muestra como Mayami. El slug `kora` sigue siendo el destino vigente de la tienda.

## Evidencia y comprobaciones

La evidencia persistente está en `/Users/brandeastudio/Downloads/MAYAMI-sistema-UX-2026-11-17`. Las carpetas `antes`, `despues` y `despues-oscuro` permiten comparar la composición. `final-publico` y `final-privado` registran la fuente integrada. Las pantallas privadas usan sesiones y datos de pruebas del stack local. Las lecturas públicas de catálogo usan el proyecto Marketplace.

| Comando o comprobación | Resultado |
|---|---|
| `pnpm typecheck` | Todas las aplicaciones y paquetes aprobados |
| `pnpm lint` | Web, app y panel aprobados |
| `pnpm --filter @kora/core test` | 190 pruebas aprobadas |
| `pnpm --filter @kora/api test` | 110 pruebas aprobadas, incluidos acceso Google, callbacks e aislamiento |
| `pnpm --filter @kora/storefront test` | 180 pruebas aprobadas, incluidos 30 casos de continuidad de oferta y planes y 13 de consumidores |
| `pnpm --filter @kora/admin test` | 67 pruebas aprobadas |
| `pnpm exec vitest run --config tools/eas/installments-integration.vitest.config.mjs` | 30 pruebas aprobadas de calendario, preferencia y retorno de autenticación |
| `pnpm --filter @kora/storefront build`, con configuración pública comprobada de Marketplace | Compilación aprobada. Ocho rutas servidas localmente con respuesta 200. Catálogo, tienda y fichas conservaron contenido comercial SSR |
| Export de Expo web de la fuente final | Aprobado. 21 casos Playwright de carrito, oferta, stock, metadatos y compartir aprobados |
| Catálogo Playwright | Dos casos existentes y dos recorridos de borrador, cancelar/Escape, Aplicar, orden y regreso aprobados. Incluye móvil con JavaScript desactivado |
| Verificación visual web | 62 vistas iniciales, ocho anchos de 320 a 1920 y ambos temas. Revisión de la integración final con 16 vistas públicas y 22 privadas |
| Recorrido público de oferta | 15 comprobaciones aprobadas sobre la fuente final, incluida compra invitada hasta autenticación |
| Recorrido privado de compra | Dirección, entrega, plan y revisión conservados a 390/1440. Escritura pendiente de carrito bloquea la navegación y luego recupera el destino |
| App y panel visuales | 77 capturas finales, incluidas 20 de panel y 36 de inicio, checkout y familias privadas de la app. Inspección independiente de muestras en claro y oscuro |
| Accesibilidad parcial | 16 análisis automatizados sin infracciones detectadas, 84 pasos de foco sin quedar tapados, ampliación de texto al 200 % y orientación horizontal. Fotografía y lector de pantalla requieren revisión humana adicional |

Los conteos de suites se presentan por separado porque algunas pruebas compartidas forman parte de varias ejecuciones. La matriz de ocho anchos se realizó en la candidata web inicial. La revisión final integra los contratos de cuotas y autenticación y conserva las mismas reglas de composición. Los registros identifican ambas fuentes.

Los nuevos casos duraderos están en `packages/core/test/commerce-presentation.test.ts`, `packages/core/test/guest-offer.test.ts`, `tools/storefront/offer-components.test.cjs`, `tools/storefront/offer-journey.test.cjs`, `tools/storefront/offer-consumers.test.cjs`, `tests/app-e2e/tests/commerce-presentation.spec.ts` y `tests/app-e2e/tests/share-recovery.spec.ts`. Las suites anteriores conservaron sus casos. Se ajustaron los puertos simulados a los imports vigentes y las expectativas de moneda y disposición a la nueva interfaz.

Se corrigieron dos fallos encontrados durante la revisión. La cantidad elegida permanece visible cuando baja el stock y puede reducirse de forma explícita. La confirmación de copiado en web depende del resultado real del navegador, con recuperación si falla. La presentación de Pagas hoy en la app utiliza un único vencimiento explícito del calendario del servidor. Ante varios vencimientos del día o ninguno, el resumen muestra el total del pedido y conserva el calendario completo.

Las pruebas privadas usan datos locales de prueba, incluidos nombres y contactos de fixtures. Los importes y estados reales observados del catálogo público están identificados por separado en esta documentación.

## Límites de la verificación

Las capturas de la app proceden de Expo web local. La compilación y revisión del binario Android o iOS en dispositivo queda pendiente para una futura publicación. La ampliación de texto se comprobó al 200 % mediante estilos, con teclado y orientación horizontal. La revisión de zoom del navegador y lector de pantalla físico queda pendiente. Los análisis automatizados de accesibilidad cubren las rutas registradas y requieren revisión humana adicional de contraste sobre fotografías.

La publicación pública, la sincronización de estos commits con el remoto y la actualización de la APK quedan pendientes del siguiente encargo. El despliegue deberá fijar esta fuente integrada y repetir el recorrido de compra en su destino.
