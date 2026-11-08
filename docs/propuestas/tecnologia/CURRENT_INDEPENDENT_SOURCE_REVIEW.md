# Revisión independiente de fuente reconciliada · Tecnología

Dictamen favorable de aislamiento y correspondencia con el JPEG vigente ya descargado. Sólo lectura de fuente/objetos Git y patch; sin suites, HTTP, build o despliegue.

Fuente `064f4729dc8c2680859bb38c1338f274906465c3`, árbol `cef8efa772bca94e28db4f49caa3591dda83fb0c`. Desde b9a09a0e sólo cambian tres paths: helper de categoría, su archivo de pruebas y procedencia. Desde la base pública db41707f hay exactamente los mismos seis paths del ajuste visual. Ningún cambio Google, cuotas, Android, configuración, CSS general o legales.

El helper conserva la conjunción estricta slug `tecnologia` y path exacto. Ahora requiere el JPEG `da3eea0c-d7cc-4afb-bb73-2ad29bfb3184.jpg`. El test positivo usa ese path y el negativo incluye expresamente el path anterior `c6dba434-37f6-4758-91e5-a65a028c2fc2.jpg`; Audio y otras categorías siguen excluidas. Se leyó el test, no se ejecutó en esta revisión.

La procedencia actualiza targetOriginalPath y servedOriginalSha256 a la imagen vigente. Este último coincide con cleanInputSha256 y con el SHA del JPEG ya descargado que se comprobó en CURRENT_IMAGE_IDENTITY_REVIEW.json: `0eb198ff2389e39568eff25de22c7ef0a4afe4898871c483584f53b713576ad8`. No se regeneró imagen ni máscara.

La máscara es byte idéntica al candidato anterior (SHA256 `046d5825ab82a348b98b6c47cc7ff077851f06cdb623c55888aaacd129fa44a2`). Home y ProductPhoto también conservan exactamente sus blobs previos: el img src/RGB original y CSS de máscara alfa no se sustituyen. La reconciliación no cambia layout ni tratamiento de Audio. Su igualdad visual y el fallback se apoyan en la implementación ya revisada; no se repitieron capturas o comparación de píxeles.

`visual-only-current.patch` coincide byte a byte con git diff --binary db41707f→064f4729 y SHA256 `27d5d459bd7547d567e5218300fc3af48119cf8b0ec02b66352f2ab26c45817b`.

Pendiente: revisar identidad e integridad del nuevo manifiesto/artefacto compilado cuando el integrador lo entregue. No usar el artefacto b9a09a0e anterior como si contuviera esta reconciliación. La presente revisión no acredita publicación, ni sustituye la comprobación del destino antes de desplegar.
