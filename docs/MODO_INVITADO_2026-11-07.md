# Modo invitado: carrito y favoritos ·7nov2026

Oliver autoriza completar una sola mejora funcional en app y web, conservando diseño y componentes. No se incluyen círculos/textos/botón de la tanda anterior, OAuth, cuotas, dominio del panel ni servicios con cargos.

## Resultado requerido

Agregar, quitar y consultar carrito/favoritos sin identidad; conservar productos, variantes y cantidades al navegar, recargar y volver a abrir. Solicitar login/registro sólo al proceder con compra. Tras identificación, combinar con contenido existente de la cuenta sin pérdidas ni duplicados por reintentos; cancelar/fallar identificación conserva la selección. Aislar cuentas y logout, sin importar datos privados a otro usuario. Servidor conserva validación de stock, precio, disponibilidad y totales; una selección local nunca es pedido/pago.

## Base existente y plan

1. Reutilizar el carrito invitado móvil durable (reserva ligada a actor) y `cart_merge_intent`, cuyo journal privado y lock por comprador ya están activos. No usar el merge legacy parcial/no idempotente. Compartir lógica pura con web sin importar módulos nativos.
2. Completar favoritos invitados con almacenamiento local y combinación por unión de IDs. Reutilizar favoritos conPK usuario/producto y upsert idempotente; revisar actor capturado, reservas, reintentos y cambios de cuenta antes de introducir nuevo backend.
3. Conectar los controles y listados actuales de web/app, contadores y retorno seguro de login/registro/OTP. Mantener acciones y distribución; retirar sólo las obligaciones prematuras de identificación de estos dos recorridos.
4. Probar persistencia, selección/variantes/cantidades, cuenta no vacía, respuesta perdida/reintentos, cancelación, logout y cambio de cuenta en entorno aislado. Revisión focal claro/oscuro móvil/escritorio. Publicar sólo tras pruebas, con Free y APK compatible; ninguna cuenta, fixture, compra o pago de prueba remotos.

Auditorías paralelas sólo lectura en `.local/guest-mode-20261107/proposals`; un único integrador modifica versiones y publica. No resetear el stackPG55437 compartido por trabajos anteriores; preparar aislamiento para pruebas mutadoras. Si hace falta backend no cubierto, declarar función/migración/destino exactos antes de activarlo.

## Estado

Inspección iniciada. App ya permite carrito invitado y tiene sincronización de carrito ligada a actor; favoritos aún exigen cuenta. Storefront exige identidad para ambos y pierde `volver` entre algunos pasos de registro/OTP. Auditorías concluidas. Se comparte la lógica pura del carrito, manteniendo su import móvil, y se añade almacenamiento invitado de favoritos. Reservas separadas poractor y en lotes50 evitan que una cuenta reclame las líneas pendientes de otra, incluyendo migración WALlegacy.113core y96unitarias móvil/storefront, tipos core/API/móvil aprobados. Falta integrar superficies/auth, pruebas aisladas de servidor/UI y publicación. Favoritos requiere RPC+recibo privado específico para que una respuesta perdida y un off posterior no provoquen reinserción al reintentar; no se altera el journal del carrito ni se activó nada remoto.

## Checkpoint de integración local

Lógica compartida revisada:116core y96unitarias existentes aprobadas, incluidos WAL/restarts, reservas A/B separadas, batches50, writes fallidos y validación de edición.13casos adicionales de crash/ACK/multiinstancia aprobados independientemente. Móvil integrado conservando layout; se retiran gates de favoritos, se muestra estado de disco, se preserva retorno y se bloquea checkout nuevo ante cartSyncError propio. Carrito y estado transitorio de producto se remontan por actor, sin placeholders entre cuentas. Tipos/lint pasan.

Migration preparada `20261107171748_guest_favorites_merge_intent.sql`: sólo schema privado favorites_private, journal y RPC autenticado por require_user; no modifica favoritos existentes/toggles/cartjournal/finanzas. Aplicada únicamente al clon local mayami_guest_mode_20261107;12SQL y8definiciones protegidas idénticas. GoTrue2.180.0 real compilado con toolchain verificada, Auth/REST/SMTP sólo loopback;5pruebas API reales con OTP/password/unión/replay/RLS/precio servidor pasan. A/B locales preparados en cuenta no vacía. Ningún fixture, usuario, pedido o pago remoto creado.

Pendientes: integrar delta web tras revisión independiente, ejecutar UI focal real contra stackaislado y revisar capturas; concretar activación de RPC nuevo antes de publicar clientes. No repetir fixtures/preparadores API mientrasUIusa A/B. No publicar este checkpoint incompleto.
