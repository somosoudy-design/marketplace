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

## Corrección posterior: cuenta y logo original

Oliver confirmó que la identidad actual del CLI es incorrecta y señaló la cuenta Supabase esperada. Inició
sesión en el navegador integrado; eso no cambia por sí solo la credencial del CLI/conector. La herramienta
para leer/controlar ese navegador no está expuesta en este chat tras dos búsquedas. Hay plugin Browser oficial
instalado, pero no su ejecutor disponible: no se conectaron sockets internos, leyeron cookies, contraseñas o almacenes de sesión,
crearon tokens o sustituyeron por Chrome. No se repitió la configuración privada denegada con la cuenta errónea.
Identidad y propiedad actual de MIM siguen pendientes de comprobar desde la conexión correcta.

Auditoría de recibos6/7nov: no se hallaron escrituras Mayami en un projectref distinto de MIM. DDL/medios
aplicados tienen destino MIM explícito; ese dato no demuestra el email del administrador ni propietario.
Cloudflare tiene recibo independiente de la cuenta esperada y account9ea83…; Expo conserva su owner técnico
marketplacebrand. No hay evidencia que justifique mover/borrar recursos o historia. La última tanda de
Google/correos no cambió configuración alojada. Informe local: account-correction/ACCOUNT_TARGET_AUDIT.md.

Las dos cabeceras HTML sustituyen ahora el nombre tipográfico por el **logo original Workv3**. PNG fiel al SVG,
1600×404,21.190bytes; placa blanca con área libre62, logo a147.6×28 dentro de imagen160×40.4. Mismo asset ambos
temas; alt Mayami si el cliente bloquea imágenes. SVG maestro intacto; procedencia en
assets/brand/mayami/v3/email-provenance.json.8/8 renders320/390 claro/oscuro y revisión independiente favorables;
motor Go2/2. Sólo cambian las dos imágenes de cabecera: código/CTA/copia/propósito permanecen iguales.

El PNG está preparado en apps/storefront/public/brand/email, **aún no alojado**. Los renders interceptan esa URL
con el archivo local, no acreditan su disponibilidad remota. Antes de instalar los HTML, ejecutar
`node tools/auth-email/check-logo.mjs` sin --local: exige HTTP200,image/png,SHA exacto. --local sólo verifica
integridad del archivo (aprobado); no autoriza publicación/instalación. Vista local actualizada en
EVIDENCIA_CORREOS.html; la anterior se conserva como EVIDENCIA_CORREOS_ANTES_LOGO.html.

## Código preparado

- `packages/api/src/google-auth.ts`: transporte manual S256, RNG/digest seguros, nonce por intento,
  scopes explícitos openid/email/profile, un canje por código y verificación `/user` independiente del
  singleton SDK. Comprueba usuario/issuer/vencimiento; nunca persiste tokens del proveedor Google.
- Intento web temporal por pestaña, nativo sólo en memoria, TTL10min. Un callback ajeno/ambiguo,
  cancelado/consumido o expirado no instala sesión. Se revalida retorno interno; no se tocan selecciones guest.
- Guardas query+fragment `google_flow` separan los callbacks preparados del acceso por correo actual,
  incluida la detección automática en Expo Web. En móvil, un callback vacío, incompleto o que mezcla código y tokens falla antes del SDK: una sesión B existente ya no acredita una confirmación inexistente. No se borra B. No hay botón Google operativo ni conexión al AuthProvider.
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

## Verificación cerrada de esta preparación

| Comprobación | Resultado y alcance |
|---|---|
| Nuevas API/contratos/guardas/URLs | 73/73;29protocolo,15boundary,4web,4nativo,9callbacks,12URLs. Transportes Google simulados. |
| Regresiones móvil/web | 139; excluida la copia ignorada de29tests para no inflar el recuento. |
| Núcleo compartido | 116/116; reglas existentes conservadas. |
| Tipos y lint | Monorepo completo, exit0 después del último guard email. |
| Motor Go de plantillas | 4fixtures web/app/signup/recovery,8ejecuciones reales HTML/TXT offline. |
| Renders desde salida Go | 16/16 a320/390 claro/oscuro, idénticos por bytes a previews aprobados, sin peticiones. |
| Correo/Auth reales locales | Una fixture@example.com en clon mayami_guest_mode_20261107; SMTPsink/GoTrue/SDK reales, sin proveedor externo. |

En el ensayo local: registro sin sesión antes de confirmar, HTML Mayami capturado, OTP incorrecto y propósito
incorrecto rechazados, OTP válido/getUser del mismo actor y replay rechazado. Recuperación: nuevo HTML,
ConfirmationURL→GoTrue303 al callback local correcto con tipo recovery y query tipo=recuperar, sesión aceptada
por SDK2.117.3/getSession/getUser del mismo actor y replay rechazado. La contraseña original siguió válida;
cero updatePassword, pedidos, pagos, mensajes externos o peticiones fuera de loopback.

El recibo final registra16pasos/20peticiones; el arnés completo24HTTP y4SMTP locales, con intentos iniciales conservados aparte. Un health sin versión embebida
y el path de mailer del harness local requirieron ajustar sólo los procesos de prueba; GoTrue usa303, no el302
que asumía la primera aserción. Tras comprobar que el primer enlace ya estaba consumido, se emitió un nuevo
recovery para la **misma única fixture**, sin repetir signup. Son límites/correcciones del ensayo local, no
incidencias acreditadas en producción. El binario retenido se identifica por SHA, con procedencia fuente2.180;
health no confirma su versión. No se ejecutó el callback React ni un navegador de producto en esa cadena. Los asuntos del helper eran sus defaults: los dos asuntos Mayami del config local están preparados, no probados como asuntos SMTP efectivos. Las TXT se probaron con text/template, no como parte MIME independiente.

Revisión independiente favorable **sólo a preparación apagada**; leyó también el último guard email y abrió dos
renders. Ninguna prueba acredita Google real, configuración hosted, Gmail/Outlook/AppleMail, entrega SMTP externa,
recepción física en APK, integración final de sesión/guest o seguridad cross-tab/crash del boundary preparado.
No hay SQL/migraciones ni funciones financieras cambiadas. La cuenta fixture permanece identificada en el clon
local; no se borró historia ni se reinició el PostgreSQL compartido. Los servicios propios del ensayo quedaron detenidos; PostgreSQL PID77431 continúa en55437.

Evidencia privada: proposals/CODE_REVIEW_FINAL.md, proposals/email/GO_TEMPLATE_REVIEW.md,
email-local-e2e/receipt.redacted.json y los reportes/hashes contiguos. Vista autónoma local:
.local/google-access-20261107/EVIDENCIA_CORREOS.html (dos PNG integrados, sin recursos externos).

## Activación pendiente y próxima acción

1. Preparación y pruebas locales cerradas; guardar checkpoint sin desplegar un acceso operativo.
2. Cuenta correcta confirmada por Oliver; conectar la capacidad de lectura del navegador integrado o la conexión autorizada equivalente y comprobar identidad/MIM antes de recuperar lectura de configuración. No cambiar de identidad, recuperar/configurar credenciales ni activar proveedores para eludir la denegación.
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
