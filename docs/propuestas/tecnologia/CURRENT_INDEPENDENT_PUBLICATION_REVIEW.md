# Revisión independiente de publicación · Tecnología

Dictamen favorable sobre correspondencia de los recibos locales, versión publicada e integridad del artefacto. No se hicieron consultas remotas, pruebas, rebuild ni despliegues en esta revisión.

## Publicación reconciliada

Las listas guardadas antes/después contienen exactamente una entrada nueva: deployment `43e54f0e-12be-431b-b921-d6c5e2782565`, creado `2026-11-08T17:33:02.615737Z`, estrategia percentage, con versión `f6c9dfde-10fe-4b3c-bb82-275ffc1d0c06` al **100 %**. La versión previa era `3fa586f2-cf50-4ec1-a288-9171ae216591`. deploy.log termina indicando esa versión nueva y los dominios mayami.app/www.mayami.app. La salida exit0 fue comunicada por el integrador; el archivo log no contiene por sí solo el código de salida del proceso.

Comparación directa de version-before.json y version-after.json: `resources.script_runtime` y `resources.bindings` son idénticos, no sólo los booleanos del resumen. Se conservan ASSETS y la referencia a mayami-storefront. El predeploy vincula la base pública anterior, el path vigente da3eea0c y SHA del JPEG ya comprobado.

PUBLICATION_HTTP_RECEIPT.json registra Home HTTP200 con BUILD_ID `oRxefyBw9hH3OMgOr-mio`, path Tecnología correcto y referencia de máscara en SSR. La máscara responde HTTP200, 19.027 bytes, SHA256 `046d5825ab82a348b98b6c47cc7ff077851f06cdb623c55888aaacd129fa44a2`, igual al artefacto.

## Integridad después del despliegue

Se recalcularon las identidades locales después de publicar: las 2.294 entradas del manifiesto siguen coincidiendo con disco, incluidos enlaces. Tar SHA256 `25c98ea7b88dc52f285c7a6912c49f93028bffcf6f2e57da556b119dde035bea` y manifiesto SHA256 `406086db3cd077b4009c6869aebcfe61541811f9133109f6513e9644903b07d6`, iguales a PREDEPLOY_RECEIPT y la revisión independiente previa. Fuente `064f4729dc8c2680859bb38c1338f274906465c3`, árbol `cef8efa772bca94e28db4f49caa3591dda83fb0c`. No se detectó mutación postdeploy del artefacto ni incorporación de Google/cuotas/Android; el alcance de seis paths conserva la revisión de fuente anterior.

## Recibos de capturas públicas

Ya existen cuatro casos 390/440 px, claro/oscuro: el recibo los marca aprobados, sus cuatro PNG coinciden con los SHA guardados, el resumen registra cero errores inesperados y 113 GET; cuatro beacons opcionales fueron abortados. Se revisaron esos recibos y hashes, sin abrir un navegador ni repetir capturas. La comparación declara máscara aplicada en Tecnología en las cuatro vistas, misma fuente JPEG y geometría/CSS conservados.

**Límite conservado:** Audio no es idéntico por píxel en las cuatro capturas. A 390 px ambos temas son exactos; a 440 px ambos registran diferencia máxima de 1/255 dentro de la región de la fotografía, con cero diferencias fuera. La causa no se establece en estos recibos. Tampoco las cuatro capturas públicas son todas idénticas por SHA a las del Worker local. No se ajustó el producto ni se repitieron capturas para ocultar esos diagnósticos. La revisión visual humana/peer de las imágenes corresponde al revisor web; este dictamen acredita sus recibos e identidades, no una inspección visual independiente de los cuatro PNG.

Detalle: `INDEPENDENT_PUBLICATION_REVIEW.json`. Sin discrepancias bloqueantes en este ámbito. No se afirma publicación de app/OTA/APK, cambios de backend, Google o cuotas.
