# Correos de cuenta de Mayami

Las cuatro plantillas muestran el logotipo original violeta sobre su placa blanca y un código de un solo uso. El remitente y la entrega en el buzón dependen del SMTP configurado en Marketplace. La cabecera tiene texto alternativo para clientes que bloquean imágenes. Los enlaces apuntan a soporte@mayami.app y a la página pública de contacto.

| Acción que solicita la persona | Plantilla de Supabase | Destino del código |
|---|---|---|
| Registro por correo | confirmation | Verificación del registro en curso |
| Recuperación de contraseña | recovery | Pantalla de recuperación de Mayami |
| Acceso por código | magic_link | Solicitud de acceso por OTP |
| Cambio de dirección | email_change | Confirmación del cambio pendiente |

El código se escribe en el flujo donde se solicitó. Abrir un correo o su enlace de ayuda conserva el código. Google autentica al comprador en la ventana de consentimiento de Google. Supabase no emite un OTP de registro por email por ese acceso. Las notificaciones opcionales al vincular/quitar métodos de acceso son eventos distintos. Estas plantillas no cambian su configuración.

## Aplicación al proyecto alojado

1. Publicar el PNG original incluido en el storefront y comprobar sus bytes, MIME y hash desde la URL HTTPS usada en las plantillas con `node tools/auth-email/check-logo.mjs`. La opción `--local` verifica la copia del repositorio.
2. Obtener la configuración Auth actual del proyecto Marketplace (`mimnotafmfasvwrclxan`) mediante la sesión autorizada. Respaldar únicamente los cuatro asuntos y cuerpos en almacenamiento privado.
3. `python3 tools/auth-email/template-payload.py` genera las ocho claves exactas del PATCH a `/v1/projects/mimnotafmfasvwrclxan/config/auth`. Compararlas con lo instalado. El payload sólo contiene asuntos y HTML, no modifica SMTP, redirects, linking, proveedores ni la política de confirmación.
4. Leer de nuevo esas ocho claves y comparar con el payload. Un envío solicitado a una dirección controlada permite comprobar remitente, recepción, logo y código del mensaje realmente entregado. Guardar recibos sin OTP, enlaces privados o credenciales.

## Reproducción local

En el stack de desarrollo con confirmación de correo activa, `node tools/auth-email/test-delivery.mjs` crea cuentas de prueba example.com y ejercita los cuatro correos y sus códigos contra Auth y el buzón SMTP del repositorio. Las variables opcionales `MAYAMI_QA_AUTH_URL`, `MAYAMI_QA_MAIL_URL` y `MAYAMI_QA_ANON_KEY` permiten usar puertos o gateway locales alternativos. El ensayo exige destinos loopback. Compose/CLI lee los asuntos de config.toml y el stack sin Docker define los mismos asuntos en start.sh.

Documentación de [plantillas transaccionales y de notificación](https://supabase.com/docs/guides/auth/auth-email-templates) y [Google OAuth](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).
