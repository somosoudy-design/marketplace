# Google en la web y en la APK de Mayami

El 17 de noviembre de 2026 se activaron el registro y el ingreso de compradores con Google. Las entradas públicas son [Ingresar](https://mayami.app/cuenta) y [Crear cuenta](https://mayami.app/registro). Google verificó la marca Mayami. La pantalla pública muestra ese nombre y el cliente solicita únicamente OpenID, correo y perfil básico.

## Publicación

| Destino | Versión comprobada |
|---|---|
| Web mayami.app | Worker `58f48ad5-54f5-44e8-b5db-a57f1c0e7c0e` al 100 %, fuente `3b04a4e` |
| APK Android existente | Canal preview, actualización `01a1e7f3-c9eb-72cc-ac8e-700bf4845885`, grupo `b2927762-7dc7-4e7e-b7d1-5dc071669c64`, fuente `61817cd` |
| Runtime Android | `b691ec2b61ee413fb1d6e7671a1a84446b4cd4f6`. El manifiesto público devuelve la actualización correcta para este runtime |
| Supabase Marketplace | Confirmación por correo y Google activos. Migración `20261117050000` registrada, seis triggers habilitados |
| Correo | Cuatro plantillas desplegadas con el logotipo v3, enlace a contacto y correo de soporte. La recuperación llegó a Gmail desde el dominio de autenticación y pasó SPF y DKIM |

La web sirve el retorno con `Referrer-Policy: no-referrer` y sin caché. Sólo el intento iniciado en el navegador o la aplicación puede instalar una sesión. Cancelar permite volver al acceso o al destino de compra. Las cuentas de contraseña anteriores a la confirmación obligatoria tienen un recorrido de [recuperación antes de su primera vinculación](GOOGLE_CUENTAS_HISTORICAS.md).

## Comprobaciones

- **Producción.** Ambas entradas web abrieron Google desde un navegador sin sesión. El consentimiento público mostró Mayami. Se devolvió la respuesta de rechazo del proveedor al intento real y se comprobó cancelación, limpieza de URL y reintento. El servicio de autenticación mantuvo el destino y el identificador del intento tanto para la web como para el esquema de la APK. También se verificaron el PNG por tipo y hash, los enlaces de contacto y la entrega externa de recuperación. Google ya verificó el correo de su usuario, por lo que ese método de ingreso no genera un código adicional de Mayami.
- **Entorno aislado.** Se probaron altas e ingresos aceptados con proveedor controlado, reintento, cancelación, error, retorno ajeno, sesión previa, códigos con cero inicial y respuesta de servidor. Se verificaron 14 recorridos en Chrome y WebKit, los cuatro envíos con Auth y SMTP locales, 100 casos de protocolo y SDK, 148 pruebas de base de datos y 12 de compra/API. El servidor de recuperación se probó con GoTrue v2.198.0. Se ejecutaron 24 transacciones en cuatro combinaciones concurrentes sin bloqueos mutuos.
- **Verificación pendiente.** Falta observar la aceptación del consentimiento por una persona con una cuenta autorizada y su sesión final en producción. También queda el recorrido en un Android físico. El manifiesto publicado y la exportación Hermes se comprobaron por separado.

Cloudflare Workers Free y Expo Free continuaron activos. La actualización se distribuyó a la APK existente sin publicación en tiendas.
