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

**Build terminado y validación técnica aprobada:** CI42075794184 y CI42089387629 Success; `df55b9b8-1ed5-42e6-b42f-8a09b9bce50f`, versionCode5, runtime `b691ec2b61ee413fb1d6e7671a1a84446b4cd4f6`, preview. APK real:123.181.823 bytes; SHA256 `c25bb730ef10c2b2fefa1d72a6ea97e38e9041d9f4da2b8aeb50ecb31ea3310a`. Firma válida con huella `86bf0698228dd380cb4d7efc454347023fa6392fe3d3780d06f9f278c244df7f`.

Fallos de verificación resueltos con datos del APK real, sin reconstruirlo: apksigner37 usa `V2 Signer:`, Expo57 resuelve runtime `file:fingerprint` desde assets/fingerprint y AAPT2 imprime JSON con comillas interiores sin escapar.16pruebas del verificador/referencia de firma pasan; se mantienen coincidencias exactas de identidad y firma.

**Validación final CI42092018315 Success**, fuente del verificador `4868d7f`: Android15/API35 en emulador comprobó arranque frío claro/oscuro, launcher, Inicio→Buscar→Atrás, Diagnóstico como invitado y reinstalación del mismo APK conservando apariencia/uid/primera instalación.72PNG+2MP4 originales, hashes comprobados; incluye las11capturas de Maestro. M original y nombre mayami visibles en launcher; splash correcto en ambos temas. Inicio de ambos temas se capturó aún cargando y Buscar claro mientras terminaban de cargar algunas fotos: no presentarlos como catálogo completamente cargado. Buscar oscuro sí muestra contenido; Inicio oscuro cargado se conserva al final del video de la primera ejecución42089387629. No fallo del APK identificado en este alcance; no constituye una revisión general de compra.

La primera recogida42089387629 conservó sólo60frames/2videos/una capturaadb. El auditor exigió corregirla antes de aprobar las pantallas faltantes. Causa confirmada en Maestro2.12.1: takeScreenshot guarda en su bundle de artefactos, no en cwd. Se fijó --test-output-dir porflow y un guard que exige las11capturas por nombre; se registran versión/soporteCLI y se preservan PNG byte a byte. Segunda ejecución completa; no se recompiló la app. **Auditor independiente: APROBADO en segunda ronda para identidad nativa y navegación focal.** Revisó launcher, Inicio, Buscar y Diagnóstico de ambos temas, conservando el límite de las capturas tomadas durante carga. Root contrastó launcher claro, Inicio claro, Buscar claro/oscuro, Diagnóstico oscuro y ambos splash. No se aprueba por extensión todo el marketplace ni compra pública.

[Build en EAS](https://expo.dev/accounts/marketplacebrand/projects/marketplace/builds/df55b9b8-1ed5-42e6-b42f-8a09b9bce50f) · [Descarga del APK exacto](https://expo.dev/artifacts/eas/DrrZrH0SafUCvP45By_T2VCrOrc4ABwtvQFI0PgyAsw.apk) · [Validación final](https://github.com/somosoudy-design/marketplace/actions/runs/42092018315).

[Galería de originales y manifiesto](https://github.com/somosoudy-design/marketplace/tree/ci/capturas/ultima/native-42092018315-1). El APK queda retenido90d en Actions; ZIP de la primera ejecución61.153.591bytes, APK123.181.823bytes. No confundir tamaños ni bundle embebido con OTA recibida: Diagnóstico muestra «el del APK».

Comprobado antes de compilar:

- Tipos y lint móvil; export Android Hermes; prebuild Android sin instalar dependencias.
- Seis pruebas de identidad y conservación de los originales.
- Auditor independiente: proporción de M, margen seguro adaptativo, splash generado y referencias del manifiesto aprobados.
- Trece pruebas del verificador de APK/referencia pública de firma; revisión independiente del harness de Android. Corregida la activación automática de caché pnpm en un job que no instala dependencias.

La comprobación del binario exige canal preview, versión superior a 4, paquete actual, runtime nuevo real, ABI ARM64/x86_64 y firma válida. El certificado se contrasta con el único keystore predeterminado de EAS, creado antes del APK5. No se solicita material de firma privado. **Esa referencia del proveedor no equivale a comparar contra el APK5 histórico**, cuyo archivo ha caducado.

El emulador comprobó arranque en frío claro/oscuro, launcher real, Inicio→Buscar→Atrás, Diagnóstico y conservación de apariencia/identidad de instalación al reinstalar el mismo APK. La evidencia completa de la segunda ejecución permite revisar las pantallas solicitadas, con los límites indicados arriba. Las capturas y videos son originales; una máscara ilustrada en navegador no se presenta como prueba Android. No se realizan pagos, pedidos ni escrituras en cuentas remotas.

## Instalación para Oliver

El binario superó las comprobaciones. Desde el Samsung, abrir el enlace de descarga anterior y el APK descargado, aceptar la instalación como **actualización sobre la app existente**, y abrir mayami. No desinstalar la aplicación anterior. Android puede pedir autorización de instalación para el navegador o gestor de archivos utilizado.

La instalación física requiere una acción del propietario; no se considera realizada desde la nube. La reinstalación comprobada en emulador no prueba por sí sola que una sesión real del APK5 haya migrado.

## Continuidad de actualizaciones

Este APK recibe futuras OTA del mismo canal preview cuando su runtime coincida. El recurso nativo nuevo no puede llegar por OTA al APK5. No forzar el runtime antiguo ni agregar exclusiones al fingerprint.

La solicitud `.github/eas-update-request` conserva el runtime del APK5 como registro de su última publicación. Antes de la siguiente OTA, fijar el runtime observado en el nuevo APK y verificarlo con el mismo archivo Firebase. Cambiar esa solicitud publica: no editarla sólo para documentar este build.

El workflow focal está configurado para conservar el APK verificado durante 90 días en Actions (`mayami-preview-apk`) y la evidencia en `ci/capturas`. Así, una futura prueba de migración no depende únicamente de la caducidad del enlace EAS. La retención del APK y la evidencia se comprobó al finalizar CI42089387629; la segunda ejecución42092018315 conserva también todas las capturas de Maestro.
