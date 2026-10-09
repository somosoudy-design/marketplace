# Guía de servicios externos

Qué servicio usa el sistema, para qué, qué se necesita para activarlo y qué precauciones tomar. Ningún
servicio de esta lista tiene credenciales reales configuradas. Los secretos van solo en el servidor
(`supabase secrets set`), nunca en la app ni en el panel.

## Supabase (base de datos, Auth, Storage, Edge Functions)

- **Para qué:** todo el backend. Las reglas de negocio viven en la base de datos (RLS + funciones).
- **Necesario:** un proyecto Supabase nuevo y dedicado. **No usar** el proyecto existente
  `bfuggvbgttvcygbexqyn`, que contiene datos de otros productos. Crear el proyecto puede tener costo y
  requiere autorización.
- **Activación:** ver [INSTALACION.md](INSTALACION.md#desplegar-en-un-proyecto-supabase).
- **Precauciones:** nunca ejecutar `supabase/seed.sql` en producción (datos de demostración, tasa "demo").
  Activar el hook de token (`custom_access_token_hook`) en Auth > Hooks, o los roles no llegarán al token.

## Tasas de cambio

| Fuente | Tipo | Cómo se lee | Observaciones |
|---|---|---|---|
| BCV (`bcv.org.ve`) | Oficial | Lectura del portal público | El BCV no ofrece API documentada. Si el formato cambia, el lector falla de forma visible y la política usa el respaldo o deja de cotizar. Consultar con moderación (cada 30 min por defecto). |
| DolarApi (`ve.dolarapi.com`) | Respaldo del oficial | JSON público | Servicio de terceros sin garantía. Solo respaldo. |
| Binance P2P | Referencia de mercado | Búsqueda pública de anuncios, mediana recortada | No es tasa oficial ni universal. No se usa para cobrar salvo que un administrador lo configure. Revisar términos de uso de Binance antes de usarlo en producción. |
| Kraken | Referencia USD/USDT | Ticker público documentado | Sirve para no asumir USD = USDT. |
| Manual | Administrador | Panel > Tasas | Requiere nota y vigencia; queda auditado. |

Políticas (Panel > Tasas): fuente principal, respaldos, antigüedad máxima, margen y redondeo por par. Si
ninguna fuente está vigente, el checkout no cotiza ese método y lo explica; nunca usa una tasa vieja en
silencio. Saltos mayores al 25% se rechazan y piden revisión manual.

## Binance Pay

- **Estado:** implementado y probado contra dobles de prueba; sin credenciales.
- **Necesario:** cuenta Binance Merchant aprobada (Binance decide; no hay garantía para un marketplace),
  API key y secret, y la clave pública de Binance para verificar webhooks (se obtiene con su API de
  certificados y puede rotar).
- **Configurar:**
  ```bash
  supabase secrets set BINANCE_PAY_API_KEY=... BINANCE_PAY_SECRET_KEY=... BINANCE_PAY_PUBLIC_KEY="$(cat binance_pub.pem)"
  ```
  Registrar en Binance el webhook `https://<proyecto>.supabase.co/functions/v1/binance-pay-webhook`.
  Luego, en el SQL Editor (como `postgres`): `update payment_methods set integration_status = 'sandbox' where code = 'binance_pay';`
  y habilitarlo desde el panel. El panel no permite marcar una integración como lista: eso solo lo hace
  el servidor, para que nadie habilite un método sin credenciales.
- **Cómo funciona:** `payments-start` crea la orden con la clave del servidor y devuelve el enlace de pago.
  El pedido se acredita solo cuando llega el webhook con firma válida y el monto y la moneda coinciden.
  Volver a la app no marca nada como pagado.

## PayPal

- **Estado:** implementado y probado contra dobles de prueba; sin credenciales.
- **Necesario:** cuenta PayPal Business, app REST (client id y secret), webhook registrado
  (`PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `CHECKOUT.ORDER.APPROVED`, `CHECKOUT.ORDER.VOIDED`)
  apuntando a `.../functions/v1/paypal-webhook`. Empezar en sandbox. PayPal evalúa cada caso; operar como
  marketplace con fondos de terceros puede requerir su producto de plataformas y una revisión.
- **Configurar:** `supabase secrets set PAYPAL_ENV=sandbox PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=... PAYPAL_WEBHOOK_ID=...`
  y luego `integration_status = 'sandbox'` como arriba.
- **Cómo funciona:** al aprobar, el webhook verificado por PayPal captura la orden; el pago se acredita con
  el evento de captura completada, también verificado.

## Zelle, Pago Móvil, transferencias, USDT y efectivo

Son métodos **manuales**: el comprador ve el monto exacto y los datos de cobro, envía referencia y
comprobante, y un administrador verifica contra el banco o la billetera. Zelle no tiene API pública
universal para comercios. Antes de producción, reemplazar los datos de cobro ficticios desde
Panel > Configuración > Métodos de pago.

## Notificaciones push (Expo)

- **Necesario:** proyecto EAS (`eas init`), credenciales FCM v1 para Android y APNs para iOS (EAS las
  gestiona con `eas credentials`), y una build nativa (Expo Go no recibe push de producción).
- **Servidor:** `push-dispatch` corre cada minuto (cron) y envía las notificaciones pendientes. Las
  notificaciones de prueba (`is_test`) nunca se envían. Opcional: `EXPO_ACCESS_TOKEN` si se activa
  seguridad reforzada en Expo.
- **Limitación v1:** se leen los tickets de envío; los recibos de entrega (segunda fase de Expo) aún no.

## Correo

Supabase Auth envía los correos de confirmación y recuperación. En producción configurar un SMTP propio
(Auth > SMTP) con dominio verificado. Localmente los correos se autoconfirman.

## Dominio y deep links

Reemplazar `kora.example.com` en `config/brand.json` y publicar en ese dominio
`/.well-known/apple-app-site-association` y `/.well-known/assetlinks.json` con los identificadores de la
app y la huella del certificado de firma de Android.

## Tiendas de aplicaciones

Apple Developer Program y Google Play Console tienen costo y requieren datos legales de la empresa. No se
creó ninguna cuenta. Ver [PUBLICACION.md](PUBLICACION.md).
