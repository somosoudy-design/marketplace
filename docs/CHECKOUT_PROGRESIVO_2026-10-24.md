# Checkout progresivo · 24 de octubre de 2026

Estado: implementación local en validación; no hay nueva OTA todavía.

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

## Verificación y publicación

Antes local real capturado con backend Supabase-lite existente, sin reiniciar sus datos: claro/oscuro,320/412, mismo carrito cable UGREEN + lámpara de Casa Lumen, dos entregas. Se preparan comparaciones equivalentes, pruebas de fases/selecciones/errores/planes y compra real sólo en el backend local. Tipos/lint móviles aprobados inicialmente; resultados finales pendientes.

Se conserva la autorización del propietario para publicar avances validados en **Android preview**, runtimeAPK5 `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`. Aún no se ha solicitado esta actualización. No se crean órdenes/pagos remotos ni se modifica configuración nativa. No hay prueba física en el Samsung atribuible a este bloque todavía.

Checkpoint funcional: tipos/lint móviles y tres pruebas UI finales aprobados (dos comparaciones de temas/anchos + una confirmación real local con plan de cuotas, doble activación, Atrás durante espera y una sola orden). El retorno del navegador fallaba porque Expo restauraba el root antes del listener del screen; un guard web instalado desde el layout antes del montaje delega al checkout enfocado, sin fabricar entradas de historial. Prueba original conservada y aprobada; no se sustituyó por un caso menos exigente. Falta ejecutar las suites restantes y cerrar auditor/publicación.
