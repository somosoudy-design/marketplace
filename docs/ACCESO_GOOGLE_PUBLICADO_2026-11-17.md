# Google en la web y en la APK de Mayami

El 17 de noviembre de 2026 se activaron el registro y el ingreso de compradores con Google. Las entradas públicas son [Ingresar](https://mayami.app/cuenta) y [Crear cuenta](https://mayami.app/registro). Google verificó la marca Mayami. La pantalla pública muestra ese nombre y el cliente solicita únicamente OpenID, correo y perfil básico.

## Diseño de ingreso y registro publicado

El 17 de noviembre se publicó el rediseño para compradores. Google aparece antes de los campos y el formulario de correo tiene una acción para revisar la contraseña. Desde el checkout, los enlaces entre registro, ingreso y recuperación conservan el destino. La imagen de escritorio es una composición ilustrativa creada para Mayami, comprimida en WebP de 62.856 bytes y excluida de la vista móvil.

- **Web**. Worker `a445f8a7-2ed7-4508-87f8-2b91e6553ef0` al 100 %, fuente `6a30ae5`. En el dominio oficial se verificaron ingreso y registro con HTTP 200, la visibilidad de la contraseña y la llegada de ambos botones a Google con la marca Mayami. En la versión compilada se comprobaron ambas pantallas en siete anchos de 320 a 1440 px y dos temas. Pasaron los 14 recorridos de Google y recuperación en Chrome y WebKit con proveedor controlado, cuatro recorridos de correo con error, reintento y acceso, dos pruebas de formulario y 115 pruebas del storefront.
- **APK**. Actualización Android `01a1e9a3-c20b-7fe1-bad2-600cdeed166e`, grupo `75c0f3b7-9e41-4246-b458-a73654c1f580`, fuente `cf4dc96`, canal preview, mismo runtime. La APK oficial firmada descargó esa versión y mostró ingreso y registro en Android 16 emulado. El paquete final pasó 13 pruebas de interacción, entre ellas teclado, campos inválidos, apertura de Google, recuperación y letra al 130 %. Pasaron también tipos, lint y 197 pruebas de la app y los contratos de Google. Sigue pendiente el inicio completo en un Samsung físico.
- **Servicios**. La publicación utilizó el Worker y el canal de actualización existentes. Los cambios se limitaron a presentación, ayudas de formulario y pruebas. Las plantillas de correo y la configuración de autenticación son las de la activación inicial.

## Publicación inicial de Google

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
- **Alta y segundo ingreso reales en Chrome.** Antes del alta se verificó en Marketplace que la dirección autorizada no tenía usuario, identidad Google ni perfil. Desde `/registro` se seleccionó esa cuenta y se aceptaron los permisos de nombre, foto y correo en Google. Mayami abrió `/cuenta` con la dirección correcta y conservó la sesión al recargar. Después de cerrar sesión, un nuevo ingreso desde `/cuenta?volver=%2Fcheckout` regresó a `/checkout` con el carrito vacío. En ambas ocasiones el servidor conservó el mismo usuario, una sola identidad Google con correo verificado y el mismo perfil. La prueba terminó en «Mi cuenta».
- **Android físico.** Falta repetir el recorrido en el Samsung. En esta comprobación no había ningún Android conectado por USB o por red. El manifiesto publicado y la exportación Hermes ya se comprobaron.

Cloudflare Workers Free y Expo Free continuaron activos. La actualización se distribuyó a la APK existente sin publicación en tiendas.
