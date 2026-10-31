# Compra web operativa · 30 de octubre de 2026

Oliver pidió completar la web, sin detener el trabajo en catálogo/carrito. El recorrido principal ya se realiza enteramente dentro de `apps/storefront`, con el mismo backend y cuentas de la app. No se reconstruyó el motor ni se desplegaron servicios remotos.

## Funciones reales

| Ruta | Operación |
|---|---|
| `/registro`, `/cuenta` | Crear cuenta, verificar código de correo, entrar y salir |
| `/recuperar`, `/auth/callback` | Código real de recuperación, nueva contraseña y callback de enlaces compatibles |
| `/direcciones` | Crear, editar, eliminar con confirmación, dirección principal y errores sin perder formulario |
| `/checkout` | Dirección → Entregas → Plan → Revisión, sólo una fase visible; Atrás conserva selección |
| `/pagar/[id]` | Métodos habilitados, cotización del servidor, instrucciones, referencia/comprobante privado y estado real |
| `/pedidos`, `/pedidos/[id]` | Compras propias, productos, historial visible, entregas/guía, calendario, pagos y cancelación permitida |

Checkout conserva importes y selección mientras confirma. Una respuesta perdida se busca por **comprador+clave exacta**; la misma intención se conserva en `sessionStorage` incluso recargando. Comprobar sólo lee; reintentar conserva selección/clave. Resultado validado antes de navegar; éxito tiene salida explícita a pago/pedido. No se decide el éxito por un HTTP200 vacío.

Cambiar dirección reinicia envíos. Si deja de ser válido un envío o plan, se vuelve a la fase correspondiente con aviso para revisar; no se acepta una sustitución silenciosa. Controles muestran inmediatamente lo elegido, pero no permiten avanzar mientras el servidor está actualizando. Fechas estimadas proceden de las fechas calculadas por backend. El vencimiento muestra fecha y hora del mismo instante en America/Caracas, incluso al cruzar medianoche.

Pago muestra el importe, comisión y vencimiento de `create_payment_quote`, sin reconstruirlos. Conserva la clave por intención/cotización y la ruta del comprobante en reintentos. Ante respuesta perdida, recupera el pago exacto del pedido propio. En verificación/proceso bloquea otro selector; enviar información **no confirma ni liquida** el pago. El saldo informativo parcial usa la misma resta de pagado/exonerado de la app, con Decimal compartido; la cotización sigue decidiendo el importe real. No muestra nombres técnicos de fuentes de tasa al comprador.

Los templates actuales envían **códigos de seis dígitos**, no enlaces: registro y recuperación se adaptaron a ese contrato sin cambiar SMTP/plantillas remotas. El callback adicional no es necesario para esos códigos. Sesión independiente en cada origen/dispositivo, misma cuenta y datos.

## Seguridad y continuidad técnica

- `api.account.addressesForBuyer(buyerId)` filtra propietario en la consulta. El método antiguo `addresses()` conserva su firma sin argumentos: la comprobación global detectó que un parámetro opcional rompía callbacks ReactQuery móviles, y se corrigió sin editar Android.
- `orders.detail(id,buyerId)` añade filtro comprador. También para administradores en modo comprador: sus permisos más amplios no mezclan direcciones/pedidos ajenos. Lista/detalle/caché/subárbol se aíslan por usuario.
- Precios, stock, planes, envío, permisos, cotizaciones y pagos se validan por las operaciones existentes. Sin SQL, migraciones, tasas, pagos verificados, datos comerciales remotos, iOS/APK, panel ni OTA modificados.
- Comprobante JPEG/PNG/WebP/PDF ≤5MB, bucket privado y ruta propia. Auditor observó415 con File/multipart en el stack local; se pasa `ArrayBuffer` por el API existente, manteniendo MIME/RLS. Verificado upload200 y persistencia.
- `build --release` excluye las referencias privadas de exhibición; `start` exige `verify:release`. Las imágenes de evaluación no pasan al despliegue público por accidente. No se añadieron dependencias.

## Pruebas y revisión

**Resultado final:**27/27 UI sobre build de producción local;52core+11unitarias del helper de confirmación; tipos/lint monorepo, build y exclusión de exhibición aprobados. Las27 son casos distintos de la suite, no la suma de sus repeticiones. Además, cuatro escenarios de captura secuencial de fases320/1440 claro/oscuro; no equivalen a pruebas físicas.

Se comprobó con backend local y SQL: registro/código/contraseña nueva; carrito, cuatro fases y varias tiendas; cambio de dirección/Atrás; pedido único tras doble clic y respuesta perdida con recarga; errores de preview/dirección sin éxito falso; plan/envío invalidados vuelven a revisión; comprador administrador no consulta datos ajenos; pago normal/proof válido y perdido, exactamente un pago en verificación y `paid_usd=0`; sesión/favoritos/catálogo de regresión.

Expiración y saldo parcial se verificaron con **DTO de lectura sintético**: no se alteró un ledger ni se aceptó un pago para fabricar el escenario. El resto de las compras/subidas comprobadas fue real contra el stack local, con datos ficticios `example.com` y metadata de muestra.

Un intento de suite agotó el juguete seed compartido. Se corrigieron los fixtures: cada prueba de pago crea su propio producto/variante con precio/datos copiados y unidades exclusivas; lo suspende al generar el pedido para no contaminar el catálogo. No se repuso stock del SKU compartido, ni se omitió el caso de agotado.

Auditor independiente: **CAMBIOS OBLIGATORIOS → APROBADO**, dos rondas. Exigió recuperar envío/plan en su fase, cabecera operativa compacta, miniaturas/importe integrado, estado de verificación coherente y botón de retry no-submit. Observó el415 y validó su corrección. Ejecutó3/3 casos independientes y revisó7PNG originales. Director integró y ejecutó la suite final27. La aprobación no acredita hosting público ni pagos reales.

Fuente final `c579bc4`;27UI en ese build y26PNG originales. Capturas y SHA: [galería](capturas/web-compra-2026-10-30/manifest.json). Cuatro fases completas, revisión/pago/pedido en320/1440 claro/oscuro y recuperación de pago. Son **fixtures locales**: no acreditan fotografía comercial definitiva, recepción Android ni datos del Samsung. Las capturas del catálogo Marketplace remoto del primer incremento siguen separadas en `capturas/web-comprador-2026-10-30`.

Evidencia ignorada `.local/web-compra-20261030/`: `tests-final-27.log`, `build-final.log`, `release-final.log`, `typecheck-all-final.log`, `lint-all-final.log`, `core.log`, `confirmation-unit.log`, `captures-final.log`. Revisión `.local/web-commerce-review/REVISION.md`; recursos y contratos inspeccionados por dos especialistas de sólo lectura. Un único integrador escribió/commiteó.

## Ejecutar y preparar el lanzamiento

Guía de arranque/variables: [WEB_COMPRADOR.md](WEB_COMPRADOR.md). No confundir el servidor local3200 con una URL publicada. La suite mutadora usa exclusivamente el gateway54321 y cuenta fixtures; bloquea peticiones al Marketplace compartido. Nunca probar un pago real para demostrar que una pantalla funciona.

La evaluación puede correr en desarrollo local con Marketplace correcto+anon y opt-in de exhibición; antes de tests volver a backend local. El buildrelease usa las imágenes normales de Storage, no las referencias privadas. Todavía no se publicó sitio ni actualización móvil.

**Dependencias externas de lanzamiento:** alojamiento Next/HTTPS y dominio, acceso protegido si es evaluación, redirects/correo del dominio y contenido/medios autorizados. El entorno actual no expone una URL web pública ni tiene un despliegue Next configurado. No inventar un enlace de revisión, ni desplegar con el workflow del panel. Proveedores automáticos están preparados para las operaciones existentes, pero el regreso web requiere `PAYMENTS_RETURN_URL` configurado por operador antes de habilitarlos; no se probó transacción real ni se activaron.

**Alcance exacto:** recorrido principal comprador operativo para evaluación. No se declara paridad total con opiniones/reclamos/Mi tienda nativa; las herramientas avanzadas de administración y venta continúan en su panel existente. Antes de lanzamiento comercial se requiere revisión de Oliver en navegador real, contenido/legales, configuración del alojamiento y validación de los servicios que se habiliten. No volver a implementar checkout/auth ni rediagnosticar Supabase para retomar.
