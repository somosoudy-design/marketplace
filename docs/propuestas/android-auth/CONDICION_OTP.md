# Condición de correo OTP · propuesta sin ejecutar

El cliente ya usa OTP de6dígitos; falta acreditar que confirmation/recovery hospedados lo muestran. No se modificó Auth ni se consultó el panel en esta tanda.

En otra acción: comprobar ambos correos reales y el recorrido en dispositivo. Si el código ya es visible y funciona, delta de configuración cero. Si no es visible, proponer para aprobación sólo añadir el siguiente bloque a los cuerpos de **Confirm signup** y **Reset password**, conservando todo el resto de la plantilla actual (logo, remitente, links y legales):

```html
<p>Escribe este código en la app Mayami:</p>
<p>{{ .Token }}</p>
```

Revisar el diff contra las dos plantillas actuales antes de guardar; no suponer sus bytes ni sobrescribirlas desde un snapshot local. No cambiar allowlists, SiteURL, Confirm email, SMTP, credenciales, Google o condiciones de seguridad. Ningún bloque fue aplicado ni se enviaron correos de prueba aquí. Si no se autoriza/verifica la entrega del código, esta fuente no debe presentarse como candidato final para la siguiente carga.
