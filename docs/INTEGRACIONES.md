# Estado de integraciones

Estado al 2026-10-09. "Probada" significa que hay una prueba automatizada que se ejecutó en verde en este
repositorio (ver [PRUEBAS.md](PRUEBAS.md)). Nada de esta tabla se probó contra un proveedor real: el entorno
de desarrollo no tiene salida a esos servicios ni cuentas comerciales.

| Integración | Estado | Qué está hecho | Qué falta |
|---|---|---|---|
| Supabase Auth (registro, sesión, recuperación, roles en el token) | Operativa y probada (local) | GoTrue con hook de token que agrega roles y tiendas; RLS en todas las tablas | Proyecto Supabase en una cuenta nueva que Oliver está creando (plan gratuito) y SMTP real |
| Supabase Storage (catálogo, tiendas, comprobantes, reclamos) | Operativa y probada (local) | Buckets y políticas por carpeta; tipos y tamaño validados | Proyecto propio |
| Pago Móvil, transferencia en bolívares | Operativa y probada (verificación manual) | Cotización en VES con tasa vigente, referencia, comprobante, verificación por admin, duplicados bloqueados | Datos bancarios reales del comercio (los actuales son ficticios) |
| Zelle | Operativa y probada (verificación manual) | Igual que arriba, en USD | Zelle no ofrece una API pública universal para comercios; seguirá siendo manual salvo acuerdo con un banco |
| USDT (TRC-20) | Operativa y probada (verificación manual) | Hash de transacción como referencia, verificación por admin | Dirección real del comercio; verificación automática en cadena (posible a futuro con un explorador/API) |
| Efectivo en punto de retiro | Operativa y probada (verificación manual) | Instrucciones configurables | Puntos de retiro reales |
| Binance Pay | Implementada, pendiente de credenciales | Creación de orden firmada (HMAC-SHA512), webhook con verificación RSA, idempotencia, conciliación de monto y moneda, cancelación y expiración; probada con dobles de prueba | Cuenta merchant aprobada por Binance (no hay garantía de aprobación para un marketplace), claves y certificado |
| PayPal | Implementada, pendiente de credenciales | Orden con `PayPal-Request-Id`, captura al aprobar, webhook verificado por la API de PayPal; probada con dobles de prueba | Cuenta Business, app REST, webhook registrado; PayPal decide si aprueba el modelo de marketplace |
| Tasa BCV (portal) | Implementada, pendiente de red | Lector del portal con validación y detección de valores implausibles | Probar en vivo; el BCV no publica API oficial y el formato del portal puede cambiar |
| DolarApi (respaldo oficial) | Implementada, pendiente de red | Lector JSON como respaldo | Probar en vivo; es un tercero sin garantía de servicio |
| Binance P2P (referencia de mercado) | Implementada, pendiente de red | Mediana recortada de anuncios; marcada como referencia, no oficial | Probar en vivo; revisar términos de uso antes de producción |
| Kraken USD/USDT | Implementada, pendiente de red | Ticker público; probado el guardado con respuesta simulada | Probar en vivo |
| Tasa manual / valor forzado por admin | Operativa y probada | Con nota obligatoria, vigencia y auditoría | — |
| Sincronización programada de tasas | Implementada, pendiente de despliegue | Función `rates-sync` + cron cada 30 min vía Vault | `pg_cron`/`pg_net` y secretos de Vault en el proyecto real |
| Notificaciones en la app | Operativa y probada | Centro por día, enlaces al pedido o reclamo, preferencias, marcado de leídas; los avisos de datos demo se rotulan y nunca salen por push | — |
| Recomendaciones y su medición | Operativa y probada (interna) | Ranking con pesos configurables y diversidad, impresiones y clics por espacio, métricas en el panel, retención configurable y borrado por el usuario | Tráfico real para ajustar pesos; `pg_cron` para la limpieza diaria |
| Push (Expo) | Implementada, pendiente de credenciales | Registro de tokens, `push-dispatch` con lotes reclamados, reintentos y limpieza de dispositivos | Proyecto EAS, credenciales FCM (Android) y APNs (iOS), build nativa |
| Correo transaccional | Simulado para desarrollo | Auth local con autoconfirmación | SMTP propio en Supabase |
| Importación de productos por URL | Operativa (solo admin), probada con carga manual | Identificación de proveedor, lectura de metadatos permitidos con protección SSRF, edición, derechos de imagen obligatorios, moderación | Probar con red real; cada sitio puede bloquear la lectura y entonces se usa la carga manual |
| Liquidaciones a vendedores | Operativa y probada (manual) | Balance, comisiones, reembolsos, liquidaciones registradas | Transferencia automática: pendiente por requisitos legales y de proveedor (no se custodian fondos de terceros) |
| Deep links (`kora://`, `https://kora.example.com/p/…`) | Implementada, pendiente de dominio | Esquema y filtros de intención configurados | Dominio real y archivos `apple-app-site-association` / `assetlinks.json` |
| Builds nativas (EAS) | Implementada, pendiente de credenciales | Perfiles development, preview y production; prebuild de Android generado sin errores | Cuenta Expo/EAS, Apple Developer y Google Play (tienen costo; requieren autorización) |
