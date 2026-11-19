# BCV/VES — corrección y despliegue autorizado

14 de octubre de 2026. Exclusivamente Supabase Marketplace `mimnotafmfasvwrclxan`.
Oliver autorizó el despliegue bajo condiciones financieras/TLS/reversión. No cobros, APK ni OTA.

## Causa y cambio exacto

`create_payment_quote` usa `current_rate`. La vigencia por horas corridas vencía la observación del viernes9oct antes del sábado/sábado-domingo/lunes12oct feriado. La reproducción con comprador local real, pedido de25USD y la observación registrada875,6505 devolvió `rate_unavailable`.

La migración `20261014202228_bcv_effective_dates` conserva la fecha efectiva hasta el siguiente día bancario en Caracas, reconoce fines de semana y22 feriados trasladados de2026, permite almacenar la próxima Fecha Valor y excluye tasas/snapshots futuros antes de vigencia. Sin calendario completo conocido, falla de forma explícita. El calendario2027 debe cargarse verificado antes de terminar2026; no se inventan festivos futuros.

Se mantiene `observed_at` como Fecha Valor del proveedor y `fetched_at` como recepción. Reconsultar no renueva la fecha. Los adaptadores ahora rechazan fechas ausentes, imposibles o sin zona horaria. DolarAPI transmite Fecha Valor en `fechaActualizacion`, confirmado en su [extractor original](https://github.com/enzonotario/dolarapi.com/blob/main/cron/ve/bcv.extractor.js).

No se modifican importes, márgenes, comisiones, redondeos, fórmula de brecha, precios, obligaciones, verificación ni contabilidad. El paquete local comprobó hashes de fórmulas y de filas existentes antes/después.

## TLS y fuentes

HTTPS/TLS continúa habilitado sin cambios de CA, `rejectUnauthorized:false`, flags inseguros ni sustitución de fuente. El BCV directo continúa reportando `UnknownIssuer`; el respaldo existente DolarAPI queda correctamente identificado en la cotización.

Para comprobar en vivo el certificado desde Codex falta permitir salidaHTTPS a `www.bcv.org.ve` y `bcv.org.ve`. Para probar en vivo el respaldo desde este ejecutor falta `ve.dolarapi.com`; `crt.sh` es opcional para investigar emisor. El bloqueo cloud ocurre antes deTLS y es distinto del fallo de Edge. Se usaron respuestas reproducibles, sin reintentos de esos dominios.

## Pruebas ejecutadas

| Verificación | Resultado |
|---|---|
| Comprador, vigencia, fin de semana, feriado12oct, Caracas, futuro, fallback, datos/calendario ausentes |20/20 SQL local, por RPC real con rol comprador |
| Pagos, motor de precios, privilegios y BCV sobre el paquete exacto aplicado |46/46 en clon local `kora_bcv_release_202610142040` |
| Adaptadores y núcleo financiero |52/52 |
| Funciones del servidor |18/18; incluye `UnknownIssuer→DolarAPI→ambos métodos VES` por REST y Fecha Valor futura por parser+ingest RPC |
| Compra completa por API pública local |12/12 |
| Aplicación/reintento/proyecto equivocado/historia conflictiva/deriva financiera/objetos parciales |6/6; datos financieros existentes intactos |
| Reversión local + pagos y precios |21/21 en `kora_bcv_rollback_202610142044` |
| Typecheck y lint |Aprobados; Deno check y tipos DB posteriores aprobados |

La suite amplia inicial tuvo113/114: búsqueda `lampara-mesa-lino` falla también con las tres funciones originales en clon `kora_bcv_baseline` (12/13). Se confirmó preexistencia y se cerró esa investigación; no se cambió búsqueda.

## Paquete y reversión

- `tools/supabase-remote/aplicar-bcv-ves.sql`: transacción deUNA migración, guardas de proyecto, hashes financieros antes/después, historial y RLS. Generado desde la migración; sin seed/tasas manuales/datos de negocio.
- `docs/BCV_VES_RELEASE.json`: SHA256 exacto de SQL y cierre de archivos de `rates-sync` / `panel-api`. Se conservan `verify_jwt=false` con token de tareas para rates-sync y `verify_jwt=true` para panel-api, además de autenticación propia existente.
- `tools/supabase-remote/revertir-bcv-ves.sql`: revierte vigencia bancaria e ingreso anticipado manteniendo exclusión segura de tasas/snapshots futuros y parsing estricto. No borra observaciones, cotizaciones, pagos, calendario ni historial. Regresa al vencimiento anterior por horas, por lo que VES puede bloquearse de nuevo en feriados; no aplica tasas futuras como efecto de revertir.
- Respaldos Edge anterioresv1 guardados privadamente en `.local/bcv/remote-*-before.bin` y metadata. No se versionan binarios del servidor ni credenciales.

## Resultado remoto — funciona en el servidor

Desplegado con autorización explícita, fuente `2a7265e`. SQLHTTP201; migración20261014202228 registrada. `rates-sync` y `panel-api` ACTIVE/v2; JWT conserva false/true respectivamente.

**REST autenticado real,14oct16:48 Venezuela:** las dos llamadas a `create_payment_quote` devolvieron200, monedaVES, base25USD, comisión0USD, tasa aplicada877,90 y monto21.947,50Bs. Fuente`dolarapi_oficial`, observación14oct00:00Caracas, fallback identificado por`rate_status`, no manual ni futura. Se conservan los TTL:30minutos para Pago Móvil y60minutos para transferencia. Las expiraciones exactas están en la evidencia JSON.

Las fixtures eran un comprador normal nuevo bajo`example.com`, perfil y pedido rotulados`is_demo=true`, una obligación de25USD, sin productos, fulfillment ni acceso a Mi tienda. Se crearon brevemente para validar PostgREST conJWT real y se eliminaron al terminar. Primer intento de limpieza rechazado por nombre de columna incorrecto; transacción no eliminó parcialmente datos. Se corrigió inmediatamente, se comprobó limpieza y se repitió exclusivamente la misma comprobación REST para guardar evidencia completa. Ambas verificaciones quedaron con0 usuarios/pedidos/cotizaciones/pagos de fixture.

Aserciones del servidor: pedido`unpaid`, pagado0USD,0 pagos y0 movimientos de libro. Nunca se invocó`submit_payment`, revisión, proveedor de cobro o transferencia. No modificación de tiendas/productos/stock/configuración comercial, APK u OTA.

[Evidencia sanitizada, respuestas REST y limpieza](BCV_VES_DESPLIEGUE_2026-10-14.json). El error de confianza BCV directo sigue pendiente de poder validar la cadena; el comprador ya cotiza con el respaldo vigente. No es una verificación física Android; para un pedido pendiente basta volver a elegir Pago Móvil/transferencia y obtener una cotización nueva.
