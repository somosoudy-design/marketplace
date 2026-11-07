# Acceso Google · preparación, proveedor aún desactivado

Tanda acotada: registro, inicio de sesión y retorno a compra conservando los contratos idempotentes del
carrito/favoritos de invitado. Sin rediseño, cuotas ni cambios en cuentas/permisos. El 7nov2026 a las
19:15:55 UTC, GET público `/auth/v1/settings` de Marketplace (`mimnotafmfasvwrclxan`) respondió200:
Google=false, email=true, signup permitido. No se activó ningún proveedor ni se creó sesión remota.

## Trabajo en curso

Protocolo PKCE S256 manual preparado, sin importar todavía en pantallas y con gate de activación cerrado.
Reutiliza rutas de callback actuales, con nonce `google_flow`. No modifica carrito/favoritos durante la
autenticación. Consume el código una vez, rechaza callbacks ajenos/expirados y verifica el usuario en
servidor antes de la promoción condicional de sesión. No conserva tokens del proveedor Google.

Faltan integración revisada de adaptadores web/nativos, pruebas aisladas, revisión independiente y cierre.
No se declara acceso Google funcional en producción ni recepción en APK. No se publicará un botón operativo
sin configuración comprobada. Workers y Expo Free, sin cargos ni nuevo APK.

## Decisión externa pendiente

Supabase asocia automáticamente una identidad Google a una cuenta por correo verificado coincidente.
Desactivar el enlace manual no desactiva ese comportamiento; el hook de alta tampoco intercepta esa rama.
No se intentará resolverlo en cliente ni se fusionarán dos UUID/cuentas. La política de identidad requiere
decisión explícita antes de activar. Deben verificarse además el proyecto/cliente OAuth Web de Google ya
existentes y los callbacks permitidos exactos. No crear credenciales, configurar secretos, ampliar redirects
ni conceder acceso adicional sin aprobación concreta. El callback Google→Supabase sería
`https://mimnotafmfasvwrclxan.supabase.co/auth/v1/callback`, con datos básicos de identidad, sin Gmail,
Contactos, Drive, Calendar ni acceso offline solicitado por Mayami.

La configuración existente y la aprobación del dominio no acreditan autorización para esos cambios nuevos.
