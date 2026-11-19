# OTA de producción y pendientes de código · 8 de noviembre de 2026

El AAB 44d confirma que la fuente bb3de958 compila; todavía no reúne todos los cambios preparados. La siguiente prioridad independiente era separar su camino OTA del promotor antiguo. Se añadió un validador local de fuente, sin publicación, export o cambios de canales. No hace falta esperar la identidad de Google para continuar el código.

## Estado real de actualizaciones

El runtime real del AAB es `b6ccf6e187d74e4c38c968346618a194df34d4df`, resuelto mediante el recurso nativo `file:fingerprint` y los 40 bytes de assets/fingerprint. Tiene canal production, proyecto 9f629f10 y Updates habilitado. La consulta oficial del 8 de noviembre a las 11:22 de Venezuela muestra production→production, mapping único y no pausado; última OTA Android APK5/eb5ed117… del 10 de octubre, ninguna para b6cc… . El JS embebido funciona como versión inicial; no se publicó una OTA idéntica.

`tools/eas/promote-update.mjs` exige APK5, sourceBranch preview, runtime eb5ed117 y sus runs concretos; su workflow fija APP_VARIANT=preview. Cambiar el request de `.github/` dispararía publicación real y no se hizo. El flujo preview tampoco se toma como validación de production. Las dos herramientas, requests, workflows, permisos y credenciales existentes permanecen intactos.

## Código nuevo y alcance exacto

`tools/eas/prepare-production-update.mjs` y su test fijan el AAB consumidor 44d, proyecto, package y runtime reales. Exigen source SHA explícito, checkout limpio del mismo repositorio, descendiente de bb3de958 y distinto de la rama compartida. Rechazan mezcla preview/production, iOS, Firebase preview, otros proyectos, package, canal o entorno, cambios de configuración/dependencias nativas y runtime forzado. Resuelven Expo config y calculan el fingerprint real con entorno público production, sin dotenv ni credenciales heredadas. Nunca sustituyen un runtime para hacerlo pasar.

La ejecución real sobre bb3de958 produjo VALIDATED_SOURCE_PLAN.json: hash b6cc… exacto, sourceTree 1f549852…, `stage: source-validated-only`, `exported:false`, `published:false`, `remoteMutations:0`. No es un candidato OTA exportado ni una publicación preparada completamente. No hay código de red, EAS publish, republish, submit, build o edición de mapping en el preparador.

```bash
node tools/eas/prepare-production-update.mjs   --source-root /Users/brandeastudio/.codex/worktrees/mayami-play-privacy/marketplace   --source bb3de95871419ac35afb213067d02c9e6cd02835   --output .local/mi-plan-production.json
```

El output es nuevo y no sobrescribe uno existente. Pasan siete pruebas focales nuevas y una ejecución real de Expo config/fingerprint. Revisión independiente favorable. En los seis tests legacy, cinco pasan y uno falla porque su fixture lee el registry actual no vacío donde espera uno vacío; ambos archivos legacy son idénticos a HEAD previo. Es un fallo local reproducido que no se ocultó ni se arregló rebajando el control. No se declara el conjunto completo verde.

Para un incremento JS/assets revisado, el siguiente paso de release será export local desde snapshot inmutable, controles de catálogo, manifiesto/hash de todos los archivos y validación compatible. Después requiere autorización de publicación concreta y lecturas vigentes de Free/cuota/mapping. No reutilizar runs APK5 como prueba de este package ni quitar sus guardas. El validador es una primera etapa local segura; no sustituye esas condiciones. Una modificación nativa que cambie fingerprint necesita otro AAB autorizado. [Expo](https://docs.expo.dev/eas-update/runtime-versions/).

Si el AAB final incorpora cambios nativos, se renovará la referencia del preparador a partir del binario y runtime verificados. No se cambia sólo el hash para aceptar código incompatible.

## Auditoría corta, sin otra matriz

| Área | En el AAB bb3de958 | Preparado o pendiente comprobado |
|---|---|---|
| Google |No incluye módulos nuevos; no se activó Google|En 17710ac, GOOGLE_AUTH_ACTIVATED=false y los puertos no están conectados. Los 73 casos y 15 de boundary documentados usan transportes/storage simulados; no prueban consentimiento Google real.|
| Correo y callbacks |Mantiene el flujo anterior; no incorpora el endurecimiento nuevo de callbacks|Hay HTML con logo y PNG locales, y recibo published=false/remotelyVerified=false. Resend Free y una recuperación recibida el 6 de noviembre son un antecedente distinto. Las plantillas viven en Supabase, no se instalan publicando un AAB. El nuevo rechazo de callback vacío/incompleto/mezclado y los retornos kora fijos siguen fuera de esta fuente. La rama antigua puede dar ready por sesión existente: observado en código, sin reproducción nativa nueva en esta tanda. Allowlist hosted actual no revalidada.|
| Tres pagos |No incluye el incremento local de cuotas|Fuente 1e8938ad y migración 20261107203116: tres pagos totales, incluido hoy; días 0/15/30, sin cuarto anticipo. 124 core y 175 regresiones documentadas, 22 SQL en clon aislado; nueve tablas conservadas. No hay evidencia revisada de aplicación MIM/recepción nativa, sin afirmar ausencia global actual.|
| Firebase/push |Sin archivo GOOGLE_SERVICES_JSON en production según metadata y log del build|No se valida push real ni se crean claves. Una configuración nativa nueva cambiará runtime y exigirá el AAB final; no copiar el archivo de preview.|

Fuentes: Git bb3de958/59e88a07 frente a 17710ac, cuotas 1e8938ad, docs/CUOTAS_PREVENTA_ENCARGO_2026-11-07.md, docs/ACTIVAR_MAYAMI_APP.md, .local/google-access-20261107/logo-email/asset-publication-gate.json, .local/installments-20261107/LOCAL_RELEASE_EVIDENCE.json y migration-result.json. Son recibos anteriores y código; no se volvieron a probar proveedores, compras, emuladores o cierres. No se confunde un fallo reproducido de una prueba legacy con un fallo observado de la app en producción.

## Siguiente bloque concreto

Integrar sólo el endurecimiento de callbacks de correo en una fuente production limpia, separado de la activación Google, con sus pruebas focales de enlaces. Después integrar cuotas desde su fuente limpia, sin activar SQL remoto dentro de ese bloque. No se modificó otra área en esta tanda.

Las acciones externas futuras deben delimitarse: OAuth Google exige configuración/credenciales reales por el flujo oficial y comprobación de callbacks; no pedir secretos por chat. Las plantillas de marca ya tienen autorización de producto: falta aplicar y verificar su delta exacto en MIM/hosting cuando se tome ese alcance, sin volver a pedir una aprobación comercial genérica. Para cuotas, la actuación remota concreta es únicamente 20261107203116 en Marketplace/mimnotafmfasvwrclxan, después de contrastar sus guardas y preservar datos/planes; esta tanda la excluye. Firebase requiere una configuración de app.mayami.marketplace en el proveedor correcto, no reutilización silenciosa de preview; no está autorizado aquí.

Para Play no se hace otra auditoría ni se exige observar la sesión antigua de la APK de prueba como condición de Google. Se conservan como pendientes: pruebas reales de 16 KB y ZIP de APK derivado auténtico, integración funcional anterior y condiciones de la cuenta/entrega que correspondan entonces. La identidad en revisión informada por Oliver no impide terminar el código; no se repiten solicitudes basadas en estados antiguos.
