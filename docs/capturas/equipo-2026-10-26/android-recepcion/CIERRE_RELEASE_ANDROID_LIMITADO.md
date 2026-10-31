# Cierre independiente: OTA observada; recepción Android bloqueada

**La OTA está publicada y observada en EAS. La recepción Android de este incremento queda BLOQUEADA y no aprobada.** No se certifica calidad global, catálogo completo ni recepción física.

Publicación [40413225725](https://github.com/somosoudy-design/marketplace/actions/runs/40413225725) completada con éxito, fuente `8233df7b526321c7e0c7dcc7a38bb13a75766c73`. La observación read-only [40416237747](https://github.com/somosoudy-design/marketplace/actions/runs/40416237747) acredita:

- Android ID: `01a17a59-84da-79e1-a24e-ae78498e7c1c`.
- Grupo: `9c671692-ae0a-44c0-ad59-09071ba7d0b7`.
- Runtime exacto APK5: `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`.
- Canal/rama `preview`; actualización compatible más reciente: true.
- `isGitWorkingTreeDirty:true`; `isRollBackToEmbedded:false`.

El job de observación termina en error `ota_dirty_or_rollback` después de emitir la identidad. Se mantiene el flag dirty real. El workflow anterior creaba `eas-update.json` no ignorado al redirigir stdout antes de arrancar CLI: una causa suficiente de suciedad, sin demostrar que fuera la única diferencia. Root corrigió futuras entregas con salida en RUNNER_TEMP, guard de árbol limpio y notice público. Esta corrección no modifica el registro ya publicado ni exige republicar esta OTA.

Recepción nativa revisión50 [40416237632](https://github.com/somosoudy-design/marketplace/actions/runs/40416237632): se validó el build histórico exacto `d1d10c28-1d9e-4123-8487-602dc10b9710`, proyecto Marketplace, commit `cc5b1010691a492745a52e5842a4baaaf8ec3da8`, paquete `com.example.kora.preview`, versionCode4, preview y mismo runtime. EAS informa caducidad `2026-10-24T04:08:34.494Z`. Una consulta fresca devolvió el campo applicationArchiveUrl; el único intento autorizado de descarga respondió **HTTP404** (`archive_http_404`). La presencia de ese campo no significa que el archivo siga disponible.

La API de jobs confirma fallo en **Descargar los APK**. Java, Maestro e **Instalar, abrir y recorrer en Android15** quedaron omitidos. No se instaló ni ejecutó el emulador de este intento; **0 recorridos nuevos ejecutados**. Los pasos finales de artifacts/capturas no acreditan pruebas. No hay una regresión de app reproducida por este fallo: el bloqueo ocurre antes de instalar. Las aprobaciones web/locales previas conservan su alcance y no sustituyen esta recepción.

Se detiene la recuperación: sin más retries, consultas de archivo, compilación nueva, cambios de firma/runtime ni republicación idéntica. Reanudar sólo al disponer de una copia autorizada del APK5 exacto. Entonces deberá confrontarse Diagnóstico con el AndroidID completo indicado arriba y ejecutarse el alcance nativo pendiente; no bastará excluir una OTA antigua.

Evidencia revisada: `receipt-40416237747.jsonl`, `receipt-40416237632.jsonl`, metadatos/jobs de GitHub API y diff de la corrección futura `b434cb9`. Hashes y datos normalizados en `qa/android-final-receipt-review.json`. QA no hizo nuevas consultas EAS, descargas, publicaciones ni cambios versionados para este cierre.
