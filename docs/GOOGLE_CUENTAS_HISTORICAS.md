# Vinculación de Google en cuentas existentes

Mayami usa el correo verificado de Google para registrarse e iniciar sesión. El primer acceso crea el perfil mediante el mismo proceso que los demás registros. Una cuenta nueva de Google puede volver a entrar con su misma identidad. El acceso ordinario con Google no genera un segundo código por correo.

## Cuentas anteriores a la confirmación obligatoria

Marketplace autoconfirmaba los registros con contraseña. La migración `20261117050000_protect_historical_google_links.sql` toma una única instantánea de las cuentas confirmadas con contraseña e identidad de correo y sin Google. Una fecha de confirmación histórica por sí sola no prueba quién controlaba el buzón.

Quien ya usaba contraseña puede seguir ingresando con ella. Para vincular por primera vez una cuenta protegida, la persona usa **Recuperar contraseña**, escribe el código de su correo y establece una contraseña nueva desde esa misma sesión. El código actual de Marketplace tiene ocho dígitos. La sesión de recuperación permite seguir comprando mientras vencen las credenciales de sesiones anteriores.

El período de seguridad es de 61 minutos con una vida de token configurada de 3600 segundos. Quien administre Mayami debe comprobar esa duración antes de modificarla y ajustar la migración de seguimiento si se ampliase. La fecha de disponibilidad se muestra al titular después de la recuperación. Si se cerró otra sesión durante el período, cuenta de nuevo desde ese cierre. La función `my_google_link_recovery_status()` exige la misma sesión de correo y no acepta identificadores como parámetros. La vinculación también comprueba identidad de Google y que el correo coincide. Una cuenta con otro método independiente de acceso requiere atención de soporte antes de completar este recorrido.

## Instalación y comprobaciones

1. Verificar el proyecto Marketplace, la entrega SMTP de sus plantillas y el acceso por contraseña y código desde la web y la APK. Activar confirmación de correo antes del censo y mantener Google apagado durante la instalación.
2. Aplicar la migración completa en una transacción. Si expira la espera de bloqueo de cinco segundos, comprobar el estado y repetir después. Registrar la versión de la migración aplicada en el historial de Marketplace.
3. Comprobar esquema privado, triggers habilitados y que el único permiso de ejecución público de la consulta de estado es para el rol autenticado. La aplicación obtiene sólo la fecha de su propia sesión verificada. Confirmar censo mediante conteos y que el acceso por contraseña continúa.
4. Habilitar Google y verificar los retornos del sitio y de la APK contra el servidor real. Separar presentación de consentimiento, retorno efectivo, sesión y entrega de mensajes en el informe de pruebas.

La cobertura local usa PostgreSQL y GoTrue v2.198.0. El ensayo funcional sólo admite hosts de loopback y una base desechable con nombre de QA. Recorre el correo recibido, la rotación y revocación de sesiones, el rechazo de códigos inválidos, la ventana de seguridad, la consulta de estado y la vinculación de cuentas nuevas y recuperadas. El entorno puede adelantar el reloj de elegibilidad sólo en sus cuentas sintéticas.

## Volver al acceso previo

Apagar primero el proveedor Google en Authentication de Marketplace y verificar `external.google=false`. La web y la APK consultan esa configuración. Mantener la confirmación de correo y el código de ocho dígitos, que ya se verificaron de manera independiente. Con Google apagado, la protección puede seguir instalada para conservar el seguimiento sin interrumpir contraseña, pagos ni pedidos.

Si una incidencia exige deshabilitar los triggers, hacerlo en una misma transacción que incluya únicamente los triggers `mayami_google_*` de esta migración, tras comprobar sus nombres y tablas. Conservar el esquema privado y sus registros. Para reactivar, revisar la actividad de cuentas durante la pausa y requerir una nueva recuperación de las cuentas protegidas cuya trazabilidad haya quedado incompleta. No reactivar Google con la barrera suspendida. Las cuentas que ya iniciaron con Google conservan su identidad en Marketplace.
