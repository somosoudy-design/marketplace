# Checkout progresivo · 24 de octubre de 2026

Estado: **publicado y recibido en emulador Android con APK5**. OTA `01a16be3-4827-77bc-bcf4-0f28d5895325`. Revisión física autenticada del Samsung pendiente, sin atribuirla al emulador.

## Decisión y alcance

Oliver solicita una decisión por fase, conservando las posibilidades comerciales. Se amplía `/checkout`, sin otro flujo paralelo: **Dirección → Entregas → Plan de pago → Revisión y confirmación**. Cuando existen varias entregas, se revisan individualmente dentro del paso2. Cada una identifica tienda, productos, modalidad, plazo y costo.

La dirección permanece al principio: `_build_checkout` usa país/región para ofrecer envíos y calcular su costo; éste interviene en el total y calendario. Al final se muestra de nuevo y se puede cambiar. Cambiarla exige revisar los envíos y el plan antes de confirmar. No cambia la lógica financiera.

## Antes y después

Antes: cuatro secciones editables consecutivas, varios envíos abiertos y «Confirmar pedido» visible desde la entrada. `line_count` contaba grupos, pero se rotulaba como cantidad de productos.

Después: una fase editable, progreso compacto, acción explícita para continuar y Atrás por decisiones conservando la selección. Sólo la revisión muestra «Confirmar pedido», junto al importe del servidor y la explicación de que el pago viene después. El resumen final permite corregir dirección, envío y plan. «Productos» deja de mostrar un conteo incorrecto.

No se cambia el plan por un método de pago: método y moneda siguen en Pago después de crear el pedido. No se crean pedidos al avanzar fases. La confirmación envía un snapshot de la selección y mantiene la misma clave de intención durante retrocesos y reintentos.

## Recuperación y accesibilidad

- Un cálculo en curso, error o dato provisional impide avanzar/confirmar; el último snapshot del servidor queda legible y limitado a la cuenta actual.
- Cambiar la dirección efectiva limpia los envíos anteriores. Una tarifa retirada obtiene opciones actuales con selección limpia, muestra el cambio y vuelve a revisar las entregas.
- Un plan retirado consulta elegibilidad con `null` y después solicita un código ofrecido por el servidor; no se calcula un calendario en el cliente. Si se rechaza al confirmar, vuelve al plan y explica el motivo.
- Foco en el título de cada fase, explicación accesible como texto hermano, progreso textual y objetivos táctiles de al menos44px. Atrás nativo/cabecera vuelve por fases; los modales conservan su propio cierre. Se bloquean edición/navegación mientras se crea el pedido.
- Filas de totales/calendario admiten reflujo a320px con texto ampliado. Transición inmediata por fase y scroll sin animación: no depende de movimiento.

## Recursos y revisión

Product Design consultado realmente: `product-design:index`, `product-design:audit`, `user-context` y `audit/references/design-audit-framework.md`. Se aplican evidencia previa, jerarquía de una decisión, recuperación de errores, claridad del compromiso, foco/reflujo y comparación de estados reales. No existe contexto persistido del plugin en esta máquina; la dirección de producto del repositorio y las instrucciones de Oliver son la referencia. No se inventa uso de Canvas ni investigación externa.

UX recomienda cuatro fases en la ruta existente; comercio confirma dependencias dirección→envíos→calendario, planes a nivel del carrito y conteo incorrecto. Revisión independiente exige separar el cuerpo del encabezado accesible y explicar `plan_invalid` fuera del resumen; comercio exige recuperar `shipping_invalid` y reconciliar destino. Se han incorporado; falta cierre sobre la evidencia final. La aprobación interna no sustituye la revisión física de Oliver.

## Evidencia y verificación final

[Comparaciones reales y manifiesto](capturas/checkout-progresivo-2026-10-24/LEEME.md): **44 PNG/hash44/44**, sin edición. Ocho antes +24 después normales +12 después con texto CSS1,6. Backend local existente, mismo cable UGREEN + lámpara de Casa Lumen, dos entregas, precio62,30USD en ambos. No reinicio de datos, fixtures exclusivamente locales.

| Observación medida | Antes412 /320 | Después412 /320 |
|---|---|---|
| Contenido inicial del scroll (viewport892px, área828px) |1210 /1288px |828 /828px |
| Fases editables montadas simultáneamente |4 |1 |
| Entregas abiertas a la vez en este carrito |2 |1 en el paso2 |
| Confirmación desde la entrada |Visible |Sólo en revisión |

No se pretende mostrar más productos en la dirección: aquí se prioriza una decisión comercial. La revisión mantiene todos los productos e importes, con acceso a corregirlos. Las medidas son de este fixture; no se generalizan a todas las direcciones o carritos.

**40 casos UI distintos aprobados:**31 de la suite inicial del bloque + compra completa corregida + ocho de Pago (sesión/deep link, pedido ajeno/inexistente, error de métodos y caché→offline→online, ambos temas). Se conserva el fallo inicial de la regresión de compra: el pago estaba `pending_verification` en el backend local, pero al reabrir se restauraba una copia anterior durante30s. `useOrder` permite refrescar al montar sólo en Pago; la acción de cotizar espera el primer dato vigente, conexión y consulta no pausada/sin error. Prueba original conservada y ampliada: consulta retenida, ninguna cotización habilitada, después panel de verificación. No se modifican precios, métodos ni operaciones financieras.

La prueba real local de confirmación conserva dirección/envíos/plan revisados, total del DTO idéntico al persistido, una sola orden con doble activación, bloqueo de edición/Atrás y salida correcta a Pago. La clave no cambia en el reintento de error. Tipos y lint del monorepo aprobados; web y Android Hermes exportados. No se tocaron SQL, backend remoto, configuración nativa, iOS ni APK.

**Revisión independiente final: APROBADO para preview**, cumplidos los casos focales requeridos. UX confirmó la causa del historial web en Chromium aislado; comercio cerró sus dos objeciones; auditor inspeccionó24 normales, las dos evidencias finales de total412 y12 de texto ampliado, más44hashes. Cerrados los avisos/accesibilidad, envío retirado/default, plan retirado y guard de Pago con caché offline. No se usa pasar tests como aprobación visual.

## Publicación y límites

Se conserva la autorización de Oliver para publicar avances validados en **Android preview**, runtimeAPK5 `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`. Sólo se publica si el guard de fingerprint exacto de CI coincide. No se generan APK ni se publica en `production`.

**Publicación real:** [EAS40057075911](https://github.com/somosoudy-design/marketplace/actions/runs/40057075911), fuente `0ca76990f1fb7cde0a2dc346e00b820a17c52911`, Success en guard exacto APK5, publicar y resultado. OTA Android `01a16be3-4827-77bc-bcf4-0f28d5895325`, publicada **2026-10-24 03:10UTC** (23oct23:10Venezuela).

**Recepción real:** [Android40057284410](https://github.com/somosoudy-design/marketplace/actions/runs/40057284410), fuente `dacf455ab491682801c2e1d5a299a9253290326c`, solicitud47. Flujos17/18, claro/oscuro normal/OS1,6: **4/4 sin reintentos**. Los cuatro diagnósticos ejecutan esa misma OTA/canal/runtime y Marketplace responde114/129/137/104ms, cuenta visitante, sesión cifrada.16JPG derivados por CI, copiados sin más edición/hash16/16; cuatro de instalación excluidos. Procedencia/bytes en [manifiesto nativo](capturas/checkout-progresivo-2026-10-24/native/evidencia.json), rama `ci/capturas@40bcebb20c1010fba4e459f0597ddb2054288a62`.

**Auditor independiente nativo: APROBADO.** Inspeccionó16JPG y hashes, los cuatro diagnósticos y controles/acceso/cart/login en ambos temas/escalas, sin nuevos P1/P2 observables. No repetir revisión web ya cerrada. El flujo autenticado02 se adapta a las fases para futuras ejecuciones, pero no se ejecutó en remoto en este bloque.

**Límite explícito:** el checkout y Pago autenticados se probaron contra el backend local en web; el emulador acredita OTA y acceso visitante con el APK real. No se atribuye una compra autenticada, recepción física en el Samsung ni prueba TalkBack. No se crearon cuentas, pedidos, cotizaciones o pagos remotos. Todo el código móvil actual está incluido en0ca7699; los commits posteriores sólo documentan/verifican esa entrega.

**Siguiente comprobación física concreta:** Diagnóstico → Código arriba; carrito de dos tiendas → dirección → primera/segunda entrega → plan → revisión; cambiar dirección y recorrer de nuevo; Atrás conserva selecciones. Puede detenerse antes de confirmar para no crear un pedido remoto. Las13muestras de catálogo pendientes de material autorizado permanecen en su iniciativa; no se abren otros cambios en este bloque.
