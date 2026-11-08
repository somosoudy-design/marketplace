# Tecnología web publicada · 8 de noviembre de 2026

Se publicó únicamente el ajuste de la tarjeta Tecnología en [mayami.app](https://mayami.app). El cuadro de fondo desaparece usando una máscara alfa sobre el JPEG original vigente. Audio, textos, dimensiones, navegación, categorías y catálogo se conservan. Esta continuación terminó; no abre otra tanda ni acredita preparación completa de Google Play.

## Publicación exacta

Oliver autorizó continuar el mismo arreglo, reconciliar guard/test/procedencia con la foto vigente y publicar sólo el ajuste. Antes de subir se comprobaron de nuevo la versión pública, ruta y hash del JPEG: no cambiaron. Se usó una sola vez la sesión Cloudflare existente mediante `deploy:cloudflare`, con `--keep-vars`, sin recompilar durante el despliegue.

| Dato | Valor |
|---|---|
| Base pública, por recibos | `db41707f0c35e7e4e50373321225b03a2fd6ade0` |
| Fuente publicada | `064f4729dc8c2680859bb38c1338f274906465c3` |
| Árbol | `cef8efa772bca94e28db4f49caa3591dda83fb0c` |
| Patch SHA256 | `27d5d459bd7547d567e5218300fc3af48119cf8b0ec02b66352f2ab26c45817b` |
| Bundle SHA256 | `5f6f68d5dcfb74b09f277e8a31b220942a520252c802022f73eaa26dc3bfc4ff` |
| Artefacto | 20417415 bytes; SHA256 `25c98ea7b88dc52f285c7a6912c49f93028bffcf6f2e57da556b119dde035bea` |
| Manifiesto SHA256 | `406086db3cd077b4009c6869aebcfe61541811f9133109f6513e9644903b07d6` |
| BUILD_ID anterior | `gXzoqz9BVz7a2MPxDrfwZ` |
| BUILD_ID publicado | `oRxefyBw9hH3OMgOr-mio` |
| Worker anterior | `3fa586f2-cf50-4ec1-a288-9171ae216591` |
| Worker nuevo | `f6c9dfde-10fe-4b3c-bb82-275ffc1d0c06`, 100% |
| Deployment | `43e54f0e-12be-431b-b921-d6c5e2782565` |
| Publicación | 8nov2026 17:33:02.615UTC /13:33 Venezuela |

La lectura oficial muestra exactamente una nueva deployment. Código de salida0 y versión de CLI coinciden con el control de Cloudflare; GET público confirma el BUILD_ID y máscara200/hash exacto. Se subieron siete assets nuevos/modificados;92 ya estaban subidos. Runtime y bindings comparados directamente antes/después son idénticos: ASSETS y WORKER_SELF_REFERENCE. Configuración/lockfile y todo blob ajeno a los seis paths conservan db41707. No se desplegó HEAD compartido ni el candidato detenido anterior.

## Reconciliación y alcance

Tecnología vigente usa el path `5afbabbf-0678-40ee-a5d8-540f53efe114/b1b4a794-c740-47e9-ae57-1c1e3089b80d/da3eea0c-d7cc-4afb-bb73-2ad29bfb3184.jpg`:504851bytes, SHA256 `0eb198ff2389e39568eff25de22c7ef0a4afe4898871c483584f53b713576ad8`. Es exactamente el input limpio de la extracción alfa anterior. Se reutiliza la máscara PNG448×448 de19027bytes, SHA256 `046d5825ab82a348b98b6c47cc7ff077851f06cdb623c55888aaacd129fa44a2`. Ninguna nueva generación ni edición de originales.

Frente a b9a09a0 sólo cambian helper, test y procedencia: path exacto vigente, rechazo explícito de la ruta anterior y targetOriginalPath/servedOriginalSha256 correctos. La condición exige slug+path, nunca sólo categoría. Home, ProductPhoto y máscara siguen idénticos al candidato anterior; seis paths totales frente a db41707. El RGB mostrado sigue siendo el JPEG original, no el generado. Las rutas diferentes quedan sin máscara y el fallback por fallo inicial de carga se conserva.

La fuente/preparación anterior conserva el campo de procedencia «local-candidate-not-published» como estado histórico de creación del asset; esta publicación se acredita en este informe y recibos. El alfa es una silueta aproximada que afina parte del lápiz; revisión favorable a63CSSpx, no una extracción exacta de todos los contornos.

## Validación y límites

- Tres pruebas focales PASS, incluida la ruta anterior rechazada; tipos/lint storefront PASS. Un único build limpio de esta continuación, tres gates PASS y overlay extraído aprobado sin rebuild. Gate Cloudflare:2876archivos/68182104bytes; catálogo empaquetado40productos/53archivos/92asociaciones, sin atribuir existencias remotas.
- Revisión independiente de fuente y artefacto:2294entradas/21enlaces válidos,1584entradas.open-next, SHA/tamaños/compilado exactos. Integridad completa y tar/manifiesto inmutables revalidados después del despliegue. Código/configuración preparados de Google/cuotas/Android no se trasladan.
- Worker local real:4vistas390/440px claro/oscuro, máscara cargada y geometría/src/hrefs/CSS correctos. Máscara200/hash exacto y eliminación200/SSR mediante GET adicional. Preview detenido al cerrar.
- Web pública:4vistas390/440px claro/oscuro,113GET permitidos,0erroresHTTP/página/consola/no opcionales y0solicitudes prohibidas. BeaconGET opcional de Cloudflare abortado deliberadamente y separado. JPEG vigente conservado y máscara aplicada, cuadro eliminado. Integrador abrió440claro/oscuro; revisor independiente abrió4PNG y aprobó. Audio completo y coherente en440;390 sólo acredita la parte visible del rail, no la oculta.
- Comparación de Audio: en Worker3vistas exactas y440oscuro con delta máximo1/255; en público390ambos temas exactos y440ambos temas2598píxeles/3314canales distintos, máximo1/255 dentro de su foto64×64, fuera0. Source/hash, textos, fondo, bordes y geometría permanecen iguales. El comparador estricto conserva exit1/strictAudioPixelEquality=false; no se borró el diagnóstico ni se repitieron capturas para obtener igualdad. La causa de esa diferencia mínima de raster no está demostrada. No se cambió producto para ponerla en verde.

No es prueba de Android físico, APK/AAB/OTA, OAuth, pagos, RLS o rendimiento CPU global. No se repitieron matrices ajenas a este ajuste. Sin backend, catálogo/categorías, roles, credenciales/permisos o servicios con cargos nuevos. Workers Paid no fue activado. Cuota consultada al inicio59%usado/41%restante y última lectura60%/40%; respetar parada20%restante, sin resets.

## Evidencia y recuperación

Artefacto y fuente persistentes en `/Users/brandeastudio/.codex/worktrees/mayami-play-privacy/marketplace/.local/tecnologia-publish-current-20261108/`: source.bundle, visual-only-current.patch, SOURCE_RECEIPT.json, logs de tests/typecheck/lint/build/package/deploy, tar/manifiesto, portable, PREDEPLOY_RECEIPT.json, POSTDEPLOY_ARTIFACT_RECEIPT.json y revisiones de fuente/artefacto. Recuperar commit con bundle sobre db41707 o aplicar el patch a esa base y verificar árbol cef8efa7. No usar HEAD compartido como fuente de publicación.

En `/Users/brandeastudio/marketplace/.local/tecnologia-publish-current-20261108/`: initial/predeploy GETs+ruta/hash/lectura oficial, versions/deployments antes/después, PUBLICATION_WORKER_RECEIPT.json, PUBLICATION_HTTP_RECEIPT.json, FINAL_RECEIPT.json, revisiones, worker/ y public-after/ con PNG/recibos/comparación. Manifiesto público SHA256 `eca2cb2ac96a9249fb2d8b83d7b5b0abdf0bee7bd2019773aa54578ea5d3de97`.

Publicación terminada sin otra tanda. Los pendientes de Google, cuotas y Play continúan separados en el estado general. El [intento anterior detenido](TECNOLOGIA_WEB_PUBLICACION_2026-11-08.md) permanece como antecedente, no como estado de esta publicación.
