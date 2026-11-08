# Redirect de Google: revisión primaria local, sin configuración remota

Fuente primaria local Auth2.180.0: internal/utilities/request.go:67–80 y85–118; internal/api/external.go:76 y103; internal/conf/configuration.go:1134–1138. Rutas absolutas y SHA en CURRENT_WIRING_REVIEW.json. No se ejecutó prueba de servidor ni consulta hosted.

`GetReferrer` valida redirect_to, después Referer, y finalmente usa SiteURL. `IsRedirectURLValid` acepta antes de recorrer la allowlist un destino cuyo Hostname coincida con el Hostname de SiteURL. Esa rama no compara query, path, puerto o protocolo. Para otros hosts/esquemas recorre glob sobre el URL completo.

Por ello, bajo esa implementación y SiteURL=https://mayami.app, el callback HTTPS con ?google_flow=<nonce> se admite por el mismo hostname; no hay evidencia que justifique ampliar la lista web por la query dinámica. Es conclusión de fuente upstream local, no una prueba de la versión/configuración hosted actual. No afirmar que las dos entradas exactas hagan el match ni que ya se probó el retorno real.

`kora://auth-callback?google_flow=<nonce>` tiene otro hostname; según la baseline comunicada de allowlist sin kora no existe permiso correspondiente. El fallback a SiteURL perdería el retorno nativo esperado. Para el diseño actual hace falta proponer una entrada nativa acotada, no kora://** ni un wildcard web.

Patrón candidato de servidor: `kora://auth-callback\?google_flow=*` (un backslash literal en campo de patrón). Confirma la ruta exacta y el nombre de query; * cubre el nonce base64url. Auth2.180 compila con gobwas/glob0.2.3 y separadores . y /; glob.go:20–28 documenta * como secuencia sin separadores y backslash como escape literal, mientras ? sin escape es comodín. No se validó que el Dashboard actual conserve/admita ese texto ni se guardó: esa representación debe comprobarse con el control/config oficial antes de decidir el delta externo definitivo. El cliente debe mantener su comprobación de nonce, ruta, código y parámetros únicos; la allowlist no la reemplaza.

Si el mismo bloque aborda retorno de emails nativos, los candidatos exactos kora://auth-callback y kora://reset-password son de propósito distinto. No sustituyen el patrón Google de query dinámica. Conservar las dos entradas HTTPS actuales; no ampliar por localhost, referencias históricas, screenshots o porque el build compile.

El redirect del cliente Google Web hacia Supabase sigue siendo https://mimnotafmfasvwrclxan.supabase.co/auth/v1/callback. Es distinto del redirect Auth→app/web anterior; esta revisión no lee ni acredita cliente OAuth, consentimiento, secretos o configuración del proveedor.
