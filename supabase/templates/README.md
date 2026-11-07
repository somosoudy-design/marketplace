# Correos de acceso Mayami

Preparación local del7nov2026. `confirmation.html` y `recovery.html` conservan el OTP `{{ .Token }}` y añaden
el enlace oficial generado por Auth, `{{ .ConfirmationURL }}`. Confirmación y recuperación son propósitos
distintos: no construir `token_hash` directo a una pantalla que sólo entiende code/fragmento de sesión.

La cabecera HTML usa el **logotipo original** Workv3, rasterizado fielmente a PNG para correo. La placa blanca
mantiene el color/proporción y el área libre en ambos temas. El PNG está preparado en public/brand/email;
su URL todavía no está alojada. Antes de instalar los HTML ejecutar `node tools/auth-email/check-logo.mjs`:
exige HTTP200, image/png y SHA exacto. `--local` comprueba sólo el archivo, no autoriza la instalación.

| Plantilla | Asunto preparado | Propósito |
|---|---|---|
| confirmation | Confirma tu correo en Mayami | Verificar correo del registro, signup |
| recovery | Restablece tu contraseña de Mayami | Permitir elegir contraseña nueva, recovery |

Los textos `.txt` son alternativas revisables. El mailer upstream inspeccionado usa text/html; no se afirma
que Supabase alojado envíe multipart ni se inventa un campo de configuración para habilitarlo. Las plantillas
magic_link/email_change anteriores no forman parte de esta renovación. Google OAuth puede completar el acceso
sin correo de verificación: no hay una plantilla de correo Google nueva.

El config.toml es del stack **local** y conserva loopback. No usar `supabase config push` completo contra MIM.
La futura publicación se limita a dos asuntos y dos cuerpos HTML, tras lectura/respaldo/diff y aprobación de
los campos externos necesarios. Estas fuentes no acreditan que ya estén aplicadas en producción.

Antes de publicar, verificar SiteURL/allowlist actuales y el destino real de ConfirmationURL; el HTML no corrige
un SiteURL alojado equivocado. La lectura de configuración MIM está denegada por permiso del proyecto.
No enviar pruebas reales ni ampliar redirects para sortearlo. El generador cliente preparado fija mayami.app
cuando utiliza MIM; sólo las pruebas con backend y cliente loopback conservan URLs locales.

Pruebas: [estado, evidencia y límites](../../docs/ACCESO_GOOGLE_2026-11-07.md). El render en Chromium no acredita
Gmail, Outlook, Apple Mail ni entrega SMTP externa.
