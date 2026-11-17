# AAB de prueba con fronteraOTP · 9 de noviembre de 2026

Checkpoint previo a compilar. Fuente39ffbee1e9bfbaaaba771da35bfa1479bf6044ce, árbol46ec34e446545efab5e1e78b6d5e468e8054faad, base exactabb3de958. Se reutilizan9regresiones/tipos/lint; no nueva auditoría ni cambios de producto. Nuevo AAB autorizado sólo de prueba, sin Play/OTA/web. Perfilproduction usa app.mayami.marketplace, app-bundle/STORE, autoIncrementremoto; no cambia preview.

Free y coste0 comprobados por metadata oficial fresca: Android2/15; claveupload existente a869aa32/certb0d025… y previewecc427b0/cert86bf… cotejados. El comprobador inicial rechazaba recurringCentsnull; el reciboFree anterior acredita que ese null representa ausencia de importe recurrente junto a precio0. Se corrigió sólo ese chequeo y la lectura fresca pasó. No hubo solicitud de permisos/credenciales ni build antes de ese resultado. Evidencia en /Users/brandeastudio/marketplace/.local/android-aab-test-20261109/preflight/.

Siguiente: única invocaciónCLI con --freeze-credentials y --no-wait, sin auto-submit; no crear ni exportar key. Si falla o es incierto reconciliar metadata antes de cualquier otra acción; no relanzar. Quedan pendientesvalidación binaria y correo/dispositivo, sin afirmar listo público. Fuente no se reconstruye ni se mezcla con HEAD compartido.

Herramientas previas: bundletool1.18.1(read-onlywrapper), VerifyAab.java/JarFile y lectorELFV2 corregido. Usar esas herramientas sobre el nuevo archivo, sin APK derivado con firma nueva ni repetir sus matrices.

## Intento único iniciado

Build `e25d3cdf-4652-462c-9cc1-16723c1739e0`, CLI0, IN_QUEUE por lectura oficial. Fuente39ff limpia, app.mayami.marketplace, versionCode3, production/STORE y runtimeb6cc verificados. Carga de fuente6min4s, sin otro intento o firma nueva. No relanzar; monitor exclusivo de eseUUID. Aún sin AAB terminado.

## Resultado de la única ejecución

EAS terminó correctamente el 9nov2026 a las 16:42:53.799 UTC. Cola desde15:47:23.635; worker activo desde16:24:49.523 (aprox.37min26s de cola y18min04s de compilación). No se relanzó ni canceló el build.

- Fuente exacta: `39ffbee1e9bfbaaaba771da35bfa1479bf6044ce`; árbol `46ec34e446545efab5e1e78b6d5e468e8054faad`, limpio antes y después.
- Build: `e25d3cdf-4652-462c-9cc1-16723c1739e0`, production/STORE.
- AAB: `/Users/brandeastudio/Downloads/Mayami-AAB-Prueba-2026-11-09/MAYAMI-0.1.0-vc3.aab`.
- Tamaño: **86.911.369 bytes**.
- SHA256: `eb8243732509e141fb3e4211be539a702afd063bbb21dcde49872362a3570f23`.
- Identidad: `app.mayami.marketplace`, 0.1.0 / versionCode3, target36 / min24.
- Certificado de carga existente: `b0d0254f2831caf26e73c2951b1aab1c0c5bb1e8adb5a47f02108d23a4af2a85`.
- Runtime: `b6ccf6e187d74e4c38c968346618a194df34d4df`.

`bundletool validate` termina0. ZIP CRC correcto; JarFile verifica los1546 payloads con el certificado esperado (3 entradas de metadata de firma); 104 bibliotecas nativas, 52 ELF64 pasan LOAD y RELRO a16KB. BundleConfig declara PAGE_ALIGNMENT_16K. Se reutilizaron exactamente bundletool1.18.1, VerifyAab.java y lectorELFV2 corregido; sin instalar herramientas, construir APK derivado o nueva firma.

Cada ejecución guarda exit code y hash de salida en TOOLS_RECEIPT.json, ligado al hash del AAB antes/después. El finalizador exige los cinco resultados, UUID exacto y hashes antes de copiar la entrega; copia de Descargas rehasheada. Los avisos de protobuf/JBR sobre sun.misc.Unsafe están conservados en stderr y no produjeron fallo. No se cambió el binario para silenciarlos.

Lectura posterior oficial: Free, precio0, meteringfalse y coste0; Android3/15, quedan12. Coinciden IDs/defaults/huellas de todas las claves antes/después, incluida preview. El procedimiento no solicitó, generó, rotó ni exportó material privado; la comparación de metadata acredita continuidad de configuración, no audita exportaciones ajenas al procedimiento.

Evidencia local completa en `/Users/brandeastudio/marketplace/.local/android-aab-test-20261109/`. Resumen persistente: [VALIDACION.json](propuestas/android-aab-test-20261109/VALIDACION.json) y [TOOLS_RECEIPT.json](propuestas/android-aab-test-20261109/TOOLS_RECEIPT.json). También se entregan VALIDACION.json y LEEME.txt junto al AAB. AAB anterior conservado.

Límites: verificación16KB estática; no ejecución en teléfono16KB, instalación física, zipalign de APK derivado, correo/OTP hospedado completo o aceptación de Play. La coordinación maneja correos/cuenta de revisión por separado. Sin subida a Play, OTA, web, cambios OAuth/cuotas remotas, creación de usuarios o servicios con cargos. No es candidato público final. Trabajo de binario terminado; no iniciar otra compilación en esta tanda.

Revisión independiente local conforme: copia/original con igual SHA y tamaño, 1549 entradas ZIP únicas/CRC, cinco exit0 y hashes de outputs concordantes; identidad, fingerprint y snapshots públicos cotejados sin nuevas consultas o reejecución de matrices. Firma/ELF revisados mediante sus recibos vinculados. MD5 del proveedor no disponible, sin presentarlo como verificado; tamaño de transporte y SHA256 local sí comprobados. Fuente39ff/árbol46ec se mantuvieron limpios después de la entrega. Última cuota Codex:32%restante, umbral20%, sin resets ni créditos. Checkpoint documental local, sinpush según alcance de esta tanda; no incluye cambios de producto.
