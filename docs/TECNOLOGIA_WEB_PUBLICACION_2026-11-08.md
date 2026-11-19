# Tecnología web: publicación detenida antes de desplegar · 8 de noviembre de 2026

**Antecedente del intento detenido.** La continuación autorizada quedó publicada; ver [resultado vigente](TECNOLOGIA_WEB_ACTUAL_PUBLICACION_2026-11-08.md).

**No se publicó el candidato.** Oliver autorizó el parche exacto d53f464d89713d2af960f46f35ed5c7e90d089dc938d4fc1a79442e409f7b1c0, seis archivos. La comprobación del catálogo actual descubrió que ese guard no se aplicaría a la foto vigente. La tanda termina aquí; no se alteró el guard ni se inició otro bloque.

## Hallazgo decisivo

La fuente pública sigue en BUILD_ID `gXzoqz9BVz7a2MPxDrfwZ`, asociada por recibos a `db41707f0c35e7e4e50373321225b03a2fd6ade0`; no expone SHA Git directamente. Cloudflare confirma deployment `5a856939-a21d-4103-9e4e-ceb56f0b9f10`, versión `3fa586f2-cf50-4ec1-a288-9171ae216591` al100%, idéntica al terminar.

El Home público sirve Tecnología desde `5afbabbf-0678-40ee-a5d8-540f53efe114/b1b4a794-c740-47e9-ae57-1c1e3089b80d/da3eea0c-d7cc-4afb-bb73-2ad29bfb3184.jpg`. El helper del parche sólo acepta el mismo prefijo terminado en `c6dba434-37f6-4758-91e5-a65a028c2fc2.jpg`. Cuatro contextos públicos390/440px, claro/oscuro, muestran el path nuevo, sin máscara y con el cuadro visible. El ensayo HTTP del Worker compilado devuelve200/SSR con su BUILD_ID, pero falla la aserción de máscara presente; no es error1102 ni fallo del servidor, sino incumplimiento del efecto visual previsto.

GET público legítimo del JPEG vigente:504851bytes/SHA256 `0eb198ff2389e39568eff25de22c7ef0a4afe4898871c483584f53b713576ad8`. Coincide exactamente con la portada limpia usada como input de la extracción de alfa. Difiere del JPEG anterior SHA256 `bac462d0317a528b93ded4390311421c997d151f362e82537485641db524622a`. No se cambió el catálogo ni se volvió a generar imagen. Audio conserva su pathPNG3866ab43…; no hay capturas de «después» porque no hubo publicación.

## Candidato conservado, no desplegable para este objetivo

| Dato | Valor |
|---|---|
| Fuente limpia | `b9a09a0e1cc22e5bb7877d1e6713c9a54e4359f6` sobre db41707 |
| Árbol | `6f0b52c4ec80fc4a5c86bb72fdb4146c6a803594` |
| Bundle SHA256 | `c04c1edd38e65b695d5539a9d6a347331ac1a07ecf03028bd91ca4211202fffe` |
| BUILD_ID candidato | `DI7YJ2OpleQHTuunKINa6` |
| Tar |20417404bytes / SHA256 `31644dea4f2ef937382d40760f9e5c4e33576e78e3afadf4218042ac18b5345c`|
| Manifiesto SHA256 | `588780f908efcb7fbd2c82207fb1855d806df943dfbd2e74bfd9d5578eec2947` |
| Máscara |19027bytes / SHA256 `046d5825ab82a348b98b6c47cc7ff077851f06cdb623c55888aaacd129fa44a2`|

El diff contra la base publicada tiene exactamente Home, ProductPhoto, helper, PNG de máscara, procedencia y prueba. Todo otro blob conserva db41707; no se trasladan Google, cuotas ni Android preparados. Configuración/lockfile/runtime/legales yRGB de productos intactos. La procedencia con estado«local-candidate-not-published» registra la preparación y es coherente con no haberse publicado.

Tres focales, tipos y lint PASS. Un único build Cloudflare, gates release/comercial/Cloudflare PASS:2876archivos/68182104bytes;40productos/53archivos/92asociaciones en el catálogo empaquetado, sin afirmar existencias remotas. Extracción portable pasó los tres gates sin recompilar. Revisión independiente verificó2294entradas exactas,21enlaces internos,1584entradas.open-next, SHA del tar/manifiesto/máscara y seis paths. Su dictamen señala que integridad no acredita elegibilidad de la imagen viva.

La revisión visual previa se reutiliza: alfa aproximado apto para63CSSpx/retina, con afinamiento parcial del lápiz; no es extracción exacta. Las comparaciones anteriores Audio/fallback404 e integridad de147originales no se repitieron ni se presentan como mediciones públicas posteriores. Android nativo no probado en esta tanda.

## Próxima acción concreta

Revisar el reemplazo del path exacto c6dba434…→da3eea0c… en `apps/storefront/src/lib/category-navigation-art.ts`, ajustar la prueba focal y los campos targetOriginalPath/servedOriginalSha256 de procedencia. Conservar máscara, JPEG, Audio, layout y guard estricto de slug+path; no habilitar cualquier foto por pertenecer a Tecnología. El cambio propuesto queda dentro de las seis rutas, pero cambia el contenido y SHA del parche que se autorizó. Hay que fijar y revisar ese nuevo delta antes de otra preparación/publicación. No se preparó un segundo artefacto ni se pidió reconectar Chrome, nuevas credenciales o permisos.

## Evidencia y cierre

Persistente en `/Users/brandeastudio/.codex/worktrees/mayami-play-privacy/marketplace/.local/tecnologia-publish-20261108/`: source.bundle, visual-only.patch, SOURCE_RECEIPT.json, tests/typecheck/lint/build/package.log, tar/manifiesto, portable, preview-home.html, INDEPENDENT_ARTIFACT_REVIEW.md y DO_NOT_DEPLOY.md. Preview local detenido. No existe deploy.log ni ejecución del comando de publicación de esta tanda.

En `/Users/brandeastudio/marketplace/.local/tecnologia-publish-20261108/`: PUBLIC_BEFORE.json, deployments/version-before y deployments-at-stop.json, CATALOG_PATH_DRIFT.json, PUBLICATION_STOP_RECEIPT.json, JPEG vigente y public-before/receipt.json/cuatroPNG/RECONCILIATION_REQUIRED.md. Manifiesto de capturas SHA256 `fb100cc5ee38eef0e573515e0fdcf867315cdbcf489a3f800dd17ff5cab40be8`.105GET públicos permitidos;0erroresHTTP/página/consola no opcionales. BeaconGET opcional de Cloudflare abortado deliberadamente y separado de fallos funcionales. La captura440-light fue inspeccionada por el integrador.

Cuota Codex comprobada al inicio58%consumido/42%restante y al cierre59%/41%; sin créditos/resets y sin alcanzar el umbral20%restante. Sin despliegue, cambios remotos, backend, OAuth, roles, cuotas, pagos, credenciales, OTA/AAB ni cargos. La autorización de publicación original se conserva; el bloqueo es la discrepancia material del parche frente a la imagen actual, no falta de sesión de Chrome.
