# Primer AAB de Mayami: generado y verificado · 8 de noviembre de 2026

El primer AAB autorizado terminó y su copia entregable está en Descargas. Es una referencia de compilación, **no la versión final con todos los pendientes integrados**. Hubo una sola clave nueva y un solo build; no se publicó en Play, no hubo OTA ni cambios de mapping. Preview permanece intacto. Expo Free y coste total observado $0.

## Artefacto y firma

| Dato | Resultado |
|---|---|
| Archivo |`/Users/brandeastudio/Downloads/Mayami-AAB-2026-11-08/MAYAMI-0.1.0-vc2.aab`|
| Tamaño |86.912.363 bytes|
| SHA256 |`cff66915bdb89a0ea42ce67fe00fd199dba7bd5ee70ca8bcb68650145f0d197d`|
| Build |[44d230e2-fd34-4772-bf72-55c79f4ea69e](https://expo.dev/accounts/marketplacebrand/projects/marketplace/builds/44d230e2-fd34-4772-bf72-55c79f4ea69e), FINISHED|
| Fuente |`bb3de95871419ac35afb213067d02c9e6cd02835`, árbol `1f5498524cba222639cc39e2749a9ebbcda13744`|
| Identidad |`app.mayami.marketplace`, nombre mayami, versión 0.1.0, versionCode 2|
| SDK real del manifiesto |target 36, min 24|
| Proyecto |`@marketplacebrand/marketplace`, `9f629f10-d679-4a99-9965-8a9e588afc85`|
| Clave de carga nueva |EAS ID `a869aa32-a1b3-4c24-936b-55b074a9198a`|
| Certificado público SHA256 |`b0d0254f2831caf26e73c2951b1aab1c0c5bb1e8adb5a47f02108d23a4af2a85`|

Oliver autorizó el package, la clave exclusiva custodiada en EAS y este primer build con límite $0. El flujo oficial no interactivo evitó copiar credenciales legacy. Sólo se registraron IDs y certificados públicos, sin exportar keystore o contraseñas. Metadata anterior/posterior conserva la clave preview `ecc427b0…` y su huella `86bf…df7f`. No se usó HEAD compartido. La asignación de versionCode de 1 a 2 fue el autoIncrement remoto, no otro build.

Compilación: 10:39→11:04 de Venezuela. Cuota final observada a las 11:08:55: Android 2/15, iOS 0/15, Free, facturación medida desactivada y sobrecoste 0. La copia de Descargas conserva el hash del artefacto; incluye LEEME.txt y VALIDACION.json. No se subió una copia adicional a Space desde este frente.

## Comprobaciones del binario

| Comprobación ejecutada | Resultado |
|---|---|
| bundletool validate, estructura AAB |PASS, herramienta existente 1.18.1, sin instalar dependencias|
| ZIP |1.549 entradas, sin duplicados y CRC correctos; tamaño HTTP recibido completo|
| Identidad, versión y SDK |PASS por manifiesto del AAB, coinciden con metadata del build|
| Firma |JarFile verificó los 1.546 payloads completos y exigió el certificado EAS esperado; 3 entradas de metadata de firma|
| Bibliotecas nativas |104 total: 26 por ABI arm64-v8a, armeabi-v7a, x86 y x86_64|
| ELF64 / 16 KB estático |52/52 con LOAD >= 16 KB, congruencia y rangos RELRO sin conflicto de escritura|
| Directiva de empaquetado |AAB solicita PAGE_ALIGNMENT_16K para bibliotecas sin comprimir|
| ZIP de APKs derivados auténticos |No ejecutado; no hay APK distribuido por Play ni se generó uno con otra firma|
| Ejecución en dispositivo de 16 KB |No ejecutada; el análisis estático no la sustituye|
| Aceptación y publicación de Play |No ejecutadas|

El lector inicial clasificó cuatro RELRO con padding como incompatibles. La revisión con LLVM objdump y el código primario de Bionic confirmó falsos positivos: RELRO puede cubrir el LOAD y padding sin invadir bytes RW ajenos. Se conservaron lector/resultado iniciales; el corrector separado pasó nueve controles y las cuatro bibliotecas focales, y después el análisis del AAB completo pasó. No se modificaron dependencias, producto o bytes del AAB. [Bionic](https://android.googlesource.com/platform/bionic/+/main/linker/linker_phdr.cpp), [guía Android](https://developer.android.com/guide/practices/page-sizes#check-the-relro-security-flag).

JBR emitió advertencias por certificado autofirmado, ausencia de timestamp y MANIFEST.MF al final para JarInputStream. La verificación JarFile de todos los payloads y la huella coinciden; no se atribuye compatibilidad con cualquier lector por streaming ni aceptación de Google. keytool falló por un formato de locale español; la lectura en inglés pasó. MD5 del proveedor no disponible: se verificaron SHA256 local, copia, CRC y firma, sin inventar un checksum remoto.

## Actualizaciones de este AAB

El recurso nativo expo_runtime_version contiene `file:fingerprint`; `base/assets/fingerprint` contiene exactamente 40 bytes: `b6ccf6e187d74e4c38c968346618a194df34d4df`. Coincide con el fingerprint local calculado desde bb3de958. Updates está habilitado, URL `https://u.expo.dev/9f629f10-d679-4a99-9965-8a9e588afc85`, header `expo-channel-name: production`, comprobación ALWAYS y espera 0.

Sí puede recibir OTA JavaScript/assets compatibles con ese runtime. No implica que cualquier bundle preview sea compatible ni que lo publicado se haya recibido en un dispositivo. Cambios nativos, permisos, dependencias o configuración Firebase requieren un nuevo AAB y su distribución por Play. [Compatibilidad oficial de Expo](https://docs.expo.dev/eas-update/runtime-versions/).

Consulta oficial a las 11:22:22 de Venezuela: production mapea sólo a branch production, sin pausa. Su último Android es del 10 de octubre, grupo 92b6bef2…, fuente b60b2cc2…, runtime APK5 `eb5ed117…`; no hay una OTA publicada para b6cc… en esa branch. El AAB arranca con su JS embebido; no necesita una OTA idéntica. El publicador legacy sólo promueve APK5/preview y no sirve para este runtime. [Preparador local y auditoría corta de pendientes](OTA_PRODUCCION_LOCAL_2026-11-08.md).

La cuenta de Play no bloquea el trabajo local de código. Este AAB no incorpora Google/correos nuevos ni las cuotas locales; Firebase/push de production no está configurado ni validado. No se creó una credencial Firebase/OAuth. No confundir compilación con producto terminado.

## Evidencia persistente

`/Users/brandeastudio/marketplace/.local/android-aab-20261108/`: INTENT, BUILD_ATTEMPT, preflight/FINAL_EAS_METADATA, DOWNLOAD_RECEIPT, DELIVERY_RECEIPT, AAB_VALIDATION, AndroidManifest.xml, BundleConfig.json, JAR_PAYLOAD_SIGNATURE, certificados públicos, ELF_REPORT inicial/V2, relro-independent y updates. Se conservan los fallos de herramientas y las correcciones. Revisión independiente de identidad, integridad, firma y RELRO favorable. Fuente y recursos de preview intactos; sin nuevas claves, builds o publicaciones posteriores.
