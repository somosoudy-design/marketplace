# Datos, retención y eliminación · Mayami · 7 de noviembre de 2026

Oliver delegó la decisión de retención: «Dedice eso tu». La decisión de producto propuesta se registra abajo. No se aplica un borrado, una migración ni una política de producción en esta tanda. Los textos de la web y la app permanecen como propuesta local para revisión antes de publicar.

## Hechos comprobados con el flujo existente

Fuente publicada 59e88a07. Base exclusiva mayami_play_privacy_audit_20261107 en 127.0.0.1:55437, clon local separado de mayami_guest_mode_20261107. No se modificaron funciones ni otra base. Dos pruebas existentes de eliminación pasaron. Un diagnóstico adicional reprodujo los datos residuales; su resultado positivo describe un defecto, no aceptación de privacidad. Se corrigió sólo un INSERT del fixture con tipo ambiguo; se conserva su primer resultado.

| Datos | Resultado tras aprobar process_account_deletion |
|---|---|
| Perfil | Se conserva la fila y el UID; se vacían nombre, teléfono, referencia de avatar y preferencias; marketing y personalización quedan desactivados. |
| Direcciones guardadas | Se borran las filas del usuario. |
| Favoritos, carrito, alertas e interacciones | Se borran las filas inmediatamente después del procesamiento. |
| Push tokens | Se borra el registro local del token; no se verificó una eliminación en un proveedor externo. |
| Sesiones y refresh tokens | Las filas de las fixtures se eliminan de auth.sessions y auth.refresh_tokens. No se emitió ni se probó un JWT real. |
| auth.users | Se conserva UID/fila, se sustituye email y se configura banned_until; es bloqueo y seudonimización. |
| auth.identities | La identidad de prueba conserva email y nombre originales. No hay borrado completo de identidad. |
| Avatar y comprobante | Permanecen dos registros de storage.objects con rutas por UID. No se subieron bytes reales; la prueba acredita metadatos y permisos, no un archivo físico en el proveedor. |
| Acceso posterior | RLS con las mismas claims SQL permite leer el avatar y repoblar nombre, favorito y carrito después de completed. No es una prueba criptográfica de uso de JWT ni una prueba de inicio de sesión real. |
| Pedidos y entregas | Se conservan importes e historial; ship_to se reduce a región y ciudad, todavía vinculado al UID. |
| Pagos y cotización | Se conservan importes y cotización. Nombre/teléfono de sus campos principales se vacían; banco, referencia y ruta de comprobante permanecen. La tabla de este baseline no tiene payer_details. |
| Notas de pedidos | Permanece texto personal introducido por la fixture. |
| Notificaciones, reclamos y mensajes | Permanece texto personal de las fixtures, incluido un reclamo resuelto. |
| Ledger y reembolsos | El procesador no los modifica; no fueron creados ni alterados por el diagnóstico. No se afirma auditoría contable exhaustiva. |

Los buckets avatars, claims y payment-proofs son privados en la base local. La API usa URL firmada de avatar de 3.600 segundos. El cliente elimina avatares al reemplazar/descartar, pero requestDeletion sólo llama al RPC y el procesador no llama a Storage API ni encola un borrado de bytes. El SDK limpia su almacenamiento al ejecutar signOut; el procesamiento SQL no ejecuta ese SDK ni garantiza borrar cachés en dispositivos.

La solicitud repetida devuelve el mismo identificador pendiente. La aprobación rechaza pedidos placed/in_progress y cuentas con roles/membresías. Esas guardas no sustituyen la verificación humana de titularidad ni una política completa de retención.

## Decisión de retención propuesta por delegación del propietario

Principio: separar la cuenta de uso diario del archivo comercial necesario. El historial financiero no autoriza conservar indefinidamente toda identidad, actividad o copia operativa.

| Categoría | Plazo propuesto | Finalidad y límites |
|---|---|---|
| Identidad de acceso, perfil, avatar personal, direcciones guardadas, favoritos, carrito, alertas, actividad y tokens | Sin conservación adicional después de verificar y completar el cierre, una vez resueltas las operaciones que impidan tramitarlo. | Retirar datos de uso diario y credenciales/identidades; impedir que una autorización previa recree datos. Eliminar los archivos mediante las APIs correctas, no sólo sus rutas. La cuenta no se marca completada hasta acreditar estos pasos. |
| Libros y justificantes contables necesarios de pedidos, pagos, obligaciones y reembolsos | 10 años desde el último asiento del libro correspondiente. | Acreditar las operaciones y conservación contable. Clasificar únicamente los campos y documentos necesarios; archivo restringido, separado del perfil y sin uso para marketing/recomendaciones. El vínculo pseudónimo no equivale a anonimato. |
| Correspondencia mercantil que documenta una operación o disputa | 10 años; se propone computar desde la última comunicación pertinente del expediente. | Conservar evidencia comercial requerida. Clasificar el expediente; no convertir todo texto libre o mensaje de cortesía en un documento contable. El punto de inicio operativo debe quedar registrado. |
| Consultas no mercantiles y justificante mínimo de una solicitud de privacidad | 90 días desde la resolución. | Permitir corregir errores de tramitación y responder seguimiento. Conservar sólo referencia, fechas y resultado indispensables; retirar texto y adjuntos innecesarios. Es una decisión operativa propuesta, no un plazo legal atribuido. |
| Registro mínimo de seguridad de autenticación | 90 días desde el evento, como decisión operativa. | Investigar accesos indebidos/fraude: evento, resultado, fecha y sujeto seudónimo mínimos; no conservar automáticamente correo, teléfono, metadata o texto íntegro. Excepción por incidente concreto documentado. El vencimiento del proveedor y del recibo aún no está demostrado ni automatizado. |
| Una retención legal específica y documentada | Sólo los registros afectados y mientras corresponda a esa causa. | Registrar motivo, alcance y revisión; no extender por defecto la retención de toda la cuenta. No se afirma que exista un requerimiento de este tipo para Mayami. |

Base jurídica consultada: el [artículo 44 del Código de Comercio en WIPO Lex](https://www.wipo.int/wipolex/en/legislation/details/4008) contempla 10 años para libros/comprobantes desde el último asiento y para correspondencia. Eso no establece que todos los datos de una app deban guardarse durante 10 años. El cómputo de expedientes y los 90 días son propuestas operativas de Mayami. El texto se revisa antes de publicarlo; no se ha probado ni implementado una purga por vencimiento. No se inventa un plazo de copias de seguridad o proveedores: esos ciclos no se comprobaron en esta tanda y no puede prometerse su borrado completo.

## Resumen corto para preparar Data safety

Inventario del código y flujo revisados, no un formulario de Play enviado ni una certificación de ausencia de otras recogidas del binario final.

| Grupo candidato de datos | Evidencia y uso observado en fuente |
|---|---|
| Nombre, email e identificadores de cuenta | Registro/Supabase Auth, perfil y acceso a operaciones. La identidad residual del cierre está comprobada localmente. |
| Teléfono y dirección de entrega | Datos introducidos para destinatario y entrega; los registros comerciales pueden mantener datos vinculados. |
| Historial de compras y datos de pagos | Pedidos, pagos, referencias, banco y comprobantes seleccionados. No se revisó un SDK de tarjetas ni se afirma recoger números de tarjeta mediante un formulario dedicado. |
| Fotos y archivos seleccionados | Galería del sistema para avatar, comprobante y catálogo del vendedor; upload a buckets de Supabase. No se observó una función que grabe audio; RECORD_AUDIO está bloqueado en la configuración fuente. |
| Actividad dentro de la app y búsquedas | track_event guarda usuario, tipo, IDs y consulta limitada a 120 caracteres. Retorna sin guardar para invitado o personalización desactivada. El borrado de actividad existe. |
| Identificador/token de notificaciones | registerPushToken vincula token, plataforma y usuario. expo-notifications pide permiso; Expo entrega mediante su servicio y FCM en Android cuando está configurado. No se probó el servicio externo. |
| Sesión y datos locales | Supabase Auth/AsyncStorage y almacenamiento de carrito, favoritos e intentos; incluyen uso invitado. No se comprobó una limpieza remota de todos los dispositivos. |
| Actualizaciones e infraestructura | expo-updates tiene URL de Expo y comprobación al cargar. Supabase y Cloudflare participan según la función. No se midieron en esta tanda los logs, IP o diagnósticos que pueda procesar cada proveedor. |

SDK/fuentes revisados: apps/mobile/app.config.ts; lib/push.ts y lib/auth.tsx; ProfilePhoto.tsx; pay/[orderId].tsx; SellerImage.tsx; packages/api/src/api.ts y la función track_event. No se cambiaron permisos nativos, identidad, firma o configuración del APK. La autorización de notificaciones es voluntaria y se solicita en tiempo de ejecución; las imágenes las selecciona el usuario. Eso no permite marcar todas las categorías como opcionales o «no compartidas» sin clasificar sus finalidades y los proveedores en el formulario final. La política local amplía su alcance a la app y describe estos usos comprobados.

## Siguiente arreglo mínimo y límite de esta tanda

Bloqueante para afirmar eliminación completa: las solicitudes completed todavía conservan identidad y metadatos de archivos, y las fronteras de acceso permiten repoblar datos con las mismas claims SQL. La siguiente tanda debe cerrar ese resultado de finalización, cubriendo tanto RPC como acceso directo/RLS y Storage; cambiar sólo require_user no protege UPDATE directo ni archivos. Debe aplicar la clasificación de retención, eliminar lo que no corresponde mediante las APIs adecuadas y registrar un recibo de limpieza antes de completed. Una solicitud pendiente/recibida no debe presentarse como ese recibo.

No se implementa ese cambio amplio aquí. Hay propuesta de aceptación futura que hoy queda RED, sin .fails/.skip y sin integrar en CI como si pasara. Se mantienen intactos el backend y los datos remotos.

Evidencia reproducible privada: .local/play-privacy-20261107/DELETION_AUDIT.md, audit-evidence.json, deletion-characterization.json, db-tests/results.json, db-tests/first-run y proposals/admin-tools.deletion-residuals.proposed.patch. Las fixtures son nuevas y exclusivamente locales, con example.com. No hubo correo, compra, eliminación real ni nuevo acceso.

## Resultado del módulo mínimo de cierre · 7nov

El nuevo flujo local retira credenciales mediante Auth, archivos mediante Storage y diez ámbitos diarios; bloquea el JWT anterior y evita completed prematuro. Auditoría Auth aún conserva identidad y no hay vencimiento efectivo comprobado: resultado retention_pending. No se confunde la retención legítima mínima de seguridad con guardar todos los datos o con un plazo contable. Ver [entrega, pruebas y límites](CIERRE_CUENTA_SEGURO_2026-11-07.md). La propuesta no se activó en producción.
