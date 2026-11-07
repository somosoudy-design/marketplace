# Acceso Google y correo Mayami · preparación sin activar

## Estado y límites

Tanda acotada: registro Google, inicio Google y retorno a compra, conservando los contratos idempotentes
existentes de carrito/favoritos. Incluye la petición posterior de correos transaccionales Mayami y revisión
de URLs. Sin rediseño, cuotas, nuevo APK, tiendas ni servicios con cargos. No se publicó web/OTA.

GET público `/auth/v1/settings` de Marketplace (`mimnotafmfasvwrclxan`) respondió200 el7nov2026 a las
19:42:25UTC: Google=false, email=true, signup permitido. La lectura privada mediante
`supabase config pull --project-ref mimnotafmfasvwrclxan --dry-run --output-format json` fue denegada:
`ConfigPullReadStatusError`: «Access denied for project mimnotafmfasvwrclxan: your account does not have
permission to view its configuration.» El único reintento de diagnóstico confirmó la misma denegación.
No se cambió de identidad/herramienta para eludirla. Desbloquear el llavero macOS no acredita ese permiso.
SiteURL, allowlist, SMTP y plantillas alojadas actuales quedan **sin verificar**; los valores documentados
el6nov son antecedentes y no sustituyen una lectura actual. No se pide otra autorización de dominio.

## Código preparado

- `packages/api/src/google-auth.ts`: transporte manual S256, RNG/digest seguros, nonce por intento,
  scopes explícitos openid/email/profile, un canje por código y verificación `/user` independiente del
  singleton SDK. Comprueba usuario/issuer/vencimiento; nunca persiste tokens del proveedor Google.
- Intento web temporal por pestaña, nativo sólo en memoria, TTL10min. Un callback ajeno/ambiguo,
  cancelado/consumido o expirado no instala sesión. Se revalida retorno interno; no se tocan selecciones guest.
- Guardas query+fragment `google_flow` separan los callbacks preparados del acceso por correo actual,
  incluida la detección automática en Expo Web. No hay botón Google operativo ni conexión al AuthProvider.
- `google-session-boundary.ts` prueba promoción condicional/cola/rollback para **un propietario local**.
  Está sin instalar: no acredita recuperación entre pestañas, aliases de storage, procesos o tras crash.
  Antes de conectar el cliente primario y listeners/guest deben resolverse y revisarse esas fronteras.
  No llamar setSession/exchange global y añadir luego un guard UI: el SDK ya puede guardar/notificar antes.

Se reutilizan expo-crypto, expo-web-browser y el esquema kora existentes; no se añadieron dependencias nativas.
No se calculó un runtime final ni se construyó APK/OTA de esta preparación; no afirmar compatibilidad publicada.
El gate `GOOGLE_AUTH_ACTIVATED` permanece false. El código de protocolo está preparado, **Google no está terminado
ni listo para activar**. Faltan integración de sesión/UI revisada y pruebas de esa integración, además del bloqueo
externo. No convertir una variable o un mock en prueba de configuración o de consentimiento real.

## Correos y URLs

Preparadas en fuente `supabase/templates/confirmation.html` y `recovery.html`, sus compañeros `.txt` y dos
asuntos del config local: Mayami, código visible, CTA ConfirmationURL, propósito distinto y avisos de error/uso.
Sin recursos gráficos remotos ni suscripciones/campañas. Confirmar correo no afirma contraseña cambiada.
Las plantillas magic_link/email_change anteriores quedan fuera de este diseño; no se sobrescriben a distancia.
Las `.txt` son entregables: no se declara multipart hosted (mailer upstream leído sólo configura text/html).

Los generadores de registro/reenvío/recuperación fijan https://mayami.app/auth/callback cuando el backend es
MIM, incluso si un cliente local usa ese backend. Sólo backend+cliente explícitamente loopback conservan URLs
locales. La APK usa kora://auth-callback y kora://reset-password; Expo Web contra MIM usa el callback web,
con tipo=recuperar cuando corresponde. Se conservan los validadores de retorno interno existentes. El
config.toml con SiteURL127.0.0.1 sigue siendo de pruebas locales: **no hacer config push completo a producción**.

ConfirmationURL lo genera Auth: no se fabrica token_hash directo a un frontend que no lo admite. Antes de
publicar plantillas deben comprobarse SiteURL/allowlist y el enlace realmente generado, incluido propósito y
retorno. La plantilla sola no impide un SiteURL hosted incorrecto. No se afirma que los correos actuales del
servidor hayan cambiado. Google puede completar OAuth sin correo de verificación; no se inventó un mail Google.

Dos GET públicos sin tokens confirmaron200 en /auth/callback y /auth/callback?tipo=recuperar. Prueban existencia,
no canje ni sesión. Ocho renders Chromium320/390 claro/oscuro aprobaron legibilidad, OTP completo, CTA52px y
sin desborde ni red; revisor independiente abrió dos. No es Gmail/Outlook/Apple Mail ni entrega SMTP externa.

## Verificación en curso

70 pruebas API nuevas pasan (protocolo, stores, crypto, aislamiento callbacks y destinos email), 139 regresiones
móvil/web y116 core pasan. Se excluyó la copia ignorada de29tests para no inflar el recuento. Tipos/lint pasaron
antes del último helper; se repiten al cierre. No SQL/migraciones ni funciones financieras cambiadas.
Prueba del motor Go de plantillas y correo→OTP/enlace→Auth local en curso, sólo fixtures@example.com y SMTP sink
loopback; resultados finales pendientes. Ninguna sesión Google real ni compra/pago/correo externo.

## Activación pendiente y próxima acción

1. Cerrar pruebas locales y revisión; guardar checkpoint sin publicar un acceso operativo.
2. Recuperar lectura autorizada del proyecto MIM para contrastar estado actual; no recuperar/configurar nuevas
   credenciales ni activar proveedores para eludir la denegación.
3. Verificar el proyecto y cliente OAuth **Web application existentes** de Google. El antecedente Firebase no
   acredita un client Web. Callback Google→Auth fijo:
   https://mimnotafmfasvwrclxan.supabase.co/auth/v1/callback. Confirmar scopes efectivos, audiencia y callbacks
   actuales exactos. No crear secretos/clientes ni ampliar URLs por suposición.
4. Decidir la política de identidad: Supabase puede adjuntar una identidad Google nueva a un UID existente por
   correo considerado verificado coincidente. No fusiona dos auth.users/UUID, pero cambia el acceso a la cuenta.
   Manual Linking apagado y BeforeUserCreated no desactivan esa rama. No prometer un guard cliente que la evite.
5. Completar/revisar integración de cliente y, con IDs/diff conocidos, pedir **una aprobación delimitada** para
   los campos externos realmente necesarios (Google y/o dos asuntos/dos cuerpos). No presentar una aprobación
   genérica con project/client/redirects desconocidos. Leer/respaldar esos campos antes de aplicar una sola vez.
6. Verificar email y Google por separado con destinatario/pasos aprobados; sólo después plantear publicación
   Free compatible con el APK existente. No aceptar consentimiento Google real por el usuario en estas pruebas.

Documentación primaria revisada: [Google](https://supabase.com/docs/guides/auth/social-login/auth-google),
[PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow),
[identidades](https://supabase.com/docs/guides/auth/auth-identity-linking) y
[plantillas](https://supabase.com/docs/guides/auth/auth-email-templates). Evidencia privada ignorada:
.local/google-access-20261107/. No valores de secretos/tokens en este informe.
