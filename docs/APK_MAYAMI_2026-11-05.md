# mayami · identidad nativa Android

Oliver autorizó un nuevo APK el 5 de noviembre de 2026 para completar la sustitución de Kora. La escala de la marca en la interfaz ya está corregida y publicada para APK5: 112 px en Inicio y 96 px en la cabecera al desplazar. Este incremento reemplaza los recursos que Android carga antes de ejecutar JavaScript.

## Cambios

- Nombre instalado: **mayami**.
- M original de Work en arranque claro/oscuro, icono estático, adaptativo, monocromo y notificaciones.
- Arranque con símbolo de 96 px, proporción original, sin una segunda introducción artificial.
- Catálogo privado incluido en el bundle del APK, igual que en las últimas actualizaciones aprobadas.
- Diagnóstico muestra mayami y conserva los datos de canal, runtime y conexión.

Se conservan `com.example.kora.preview`, scheme `kora`, proyecto Expo y configuración Firebase/backend existentes. No se cambian iOS, dependencias, datos remotos ni reglas comerciales. Los identificadores técnicos antiguos no son texto de marca para el comprador.

## Compilación y revisión

Fuente de aplicación: `fc8368f598df3b90fb42b3863a221be47371a40c`.
[Compilación EAS desde GitHub](https://github.com/somosoudy-design/marketplace/actions/runs/42075794184).

**Build terminado:** CI42075794184 Success; `df55b9b8-1ed5-42e6-b42f-8a09b9bce50f`, versionCode5, runtime `b691ec2b61ee413fb1d6e7671a1a84446b4cd4f6`, preview/source clean. La primera validación42081690956 falló porque el parser esperaba `Signer #1` y apksigner37 devuelve `V2 Signer:`. Logs del APK real confirman firma válida y huella coincidente `86bf0698228dd380cb4d7efc454347023fa6392fe3d3780d06f9f278c244df7f`. Parser corregido;14pruebas pasan. Se repite la validación del mismo binario, sin otro build. Arranque/launcher todavía pendientes.

[Build y descarga en EAS](https://expo.dev/accounts/marketplacebrand/projects/marketplace/builds/df55b9b8-1ed5-42e6-b42f-8a09b9bce50f). No se presenta todavía como entrega validada en Android.

Comprobado antes de compilar:

- Tipos y lint móvil; export Android Hermes; prebuild Android sin instalar dependencias.
- Seis pruebas de identidad y conservación de los originales.
- Auditor independiente: proporción de M, margen seguro adaptativo, splash generado y referencias del manifiesto aprobados.
- Trece pruebas del verificador de APK/referencia pública de firma; revisión independiente del harness de Android. Corregida la activación automática de caché pnpm en un job que no instala dependencias.

La comprobación del binario exige canal preview, versión superior a 4, paquete actual, runtime nuevo real, ABI ARM64/x86_64 y firma válida. El certificado se contrasta con el único keystore predeterminado de EAS, creado antes del APK5. No se solicita material de firma privado. **Esa referencia del proveedor no equivale a comparar contra el APK5 histórico**, cuyo archivo ha caducado.

El emulador debe comprobar arranque en frío claro/oscuro, launcher real, Inicio→Buscar→Atrás, Diagnóstico y conservación de apariencia/identidad de instalación al reinstalar el mismo APK. Las capturas y videos son originales; una máscara ilustrada en navegador no se presenta como prueba Android. No se realizan pagos, pedidos ni escrituras en cuentas remotas.

## Instalación para Oliver

Cuando el binario supere las comprobaciones se entregará su enlace de descarga. Desde el Samsung, descargar y abrir el APK, aceptar la instalación como **actualización sobre la app existente**, y abrir mayami. No desinstalar la aplicación anterior. Android puede pedir autorización de instalación para el navegador o gestor de archivos utilizado.

La instalación física requiere una acción del propietario; no se considera realizada desde la nube. La reinstalación comprobada en emulador no prueba por sí sola que una sesión real del APK5 haya migrado.

## Continuidad de actualizaciones

Este APK recibe futuras OTA del mismo canal preview cuando su runtime coincida. El recurso nativo nuevo no puede llegar por OTA al APK5. No forzar el runtime antiguo ni agregar exclusiones al fingerprint.

La solicitud `.github/eas-update-request` conserva el runtime del APK5 como registro de su última publicación. Antes de la siguiente OTA, fijar el runtime observado en el nuevo APK y verificarlo con el mismo archivo Firebase. Cambiar esa solicitud publica: no editarla sólo para documentar este build.

El workflow focal está configurado para conservar el APK verificado durante 90 días en Actions (`mayami-preview-apk`) y la evidencia en `ci/capturas`. Así, una futura prueba de migración no depende únicamente de la caducidad del enlace EAS. La retención se comprobará al finalizar el job.
