# Fuente Android de producción aislada · 8 de noviembre de 2026

Preparación local terminada. Fuente concreta `bb3de95871419ac35afb213067d02c9e6cd02835`, árbol `1f5498524cba222639cc39e2749a9ebbcda13744`, sobre `59e88a07a53338678c29aaf16a824daa7b31d58c`. Configura AAB/production y los enlaces legales ya implementados, sin construir, firmar ni publicar. `app.mayami.marketplace` es sólo propuesta local; no acredita reserva, identidad existente ni autorización de firma.

## Base y delta exactos

Lectura pública del manifiesto de preview: OTA `01a1b758-773b-7a0f-82c5-a96d2bc2fb81`, grupo `db1d3f57-b2b3-4c6e-9507-b9e4f859f0bf`, runtime `b691ec2b61ee413fb1d6e7671a1a84446b4cd4f6`. El recibo CI 42403068492 ancla esa entrega a 73fc75ef; los inputs apps/mobile, packages, config, lock y package raíz son idénticos a 59e88a07. No se usa HEAD compartido, que contiene Google/cuotas aún no publicados.

Nueve archivos frente a 59e88a07: cinco móviles existentes de da9085c (`account`, `settings`, `sign-up`, `LegalLinks`, `legal-links`), test legal existente, dos configuraciones Android de la propuesta y una prueba focal de resolución real. Los cinco móviles y el test legal son byte por byte los ya probados; no rediseño. Cuenta invitado/Preferencias enlazan privacidad, términos y eliminación; registro enlaza aceptación. Acuse de solicitud sin prometer borrado inmediato ni acceso continuo después de tramitarla. Los destinos web publicados se conservan, sin repetir su publicación o verificación ni el cierre de cuenta.

app.config.ts reutiliza exactamente la plantilla revisada. eas.json sólo base/production, distribución store, app-bundle y canal production y variables públicas MIM/panel; sin submit ni presentación privada de catálogo. El placeholder se sustituye **sólo en esta copia** por la propuesta app.mayami.marketplace. Antes de generar un AAB debe confirmarse o sustituirse por la identidad real. Guardas impiden usar esta copia como preview o iOS. No copiar estos dos archivos a la fuente preview.

Resolución Expo real comparada completa: sólo cambian nombre Expo, package Android, hosts Android/router y soporte; extra.router.origin deriva de esa opción del plugin. Todo lo demás idéntico: permisos/blockedPermissions, seguridad, assets, plugins restantes, proyecto/owner, esquema **kora**, retornos de pagos y fingerprint policy. Config/paquetes/lock y rutas de carrito/checkout/producto/auth no se tocan. No incorpora Google, cuotas, backend, editor, panel o storefront.

## Pruebas económicas y conservación de preview

- 3 pruebas Node de resolución **real** de esta fuente (no sólo plantilla): configuración completa; rechazo preview/iOS/identidad ausente o provisional; perfil AAB y anon MIM. Reutilizan la lógica de verificación anterior.
- 5 pruebas Vitest de enlaces canónicos, dispatch y fallos con URL legible. Se excluyó `.local` expresamente tras detectar que el filtro inicial también seleccionaba un snapshot antiguo; sin cambiar producto ni desactivar cobertura.
- Tipos completos móvil y lint focal de los seis archivos TS/TSX modificados aprobados. La comparación completa detectó extra.router.origin derivado del plugin; se añadió al recibo de diferencias autorizadas, sin cambios de código por ese hallazgo.
- Revisión independiente de fuente/delta/recibos aprobada. No se repitieron emuladores, exportaciones/UI, suites financieras o builds. Las capturas/recorridos anteriores corresponden a los mismos cinco archivos; no se afirma una prueba nativa nueva.

Preview activo de la rama compartida intacto. Fingerprint local antes/después `ccbac2f55b3a72ea6cf04871d415813c4ff6690e`, 66 fuentes idénticas, sin descargar/incluir GOOGLE_SERVICES_JSON. **No es el runtime literal del APK instalado**; no se modifican sus inputs ni se fuerza el hash. La copia de producción tiene identidad/config propias y no se usa para OTA de preview. Variables/archivo Firebase de producción y binario final no fueron inspeccionados; no atribuirle paridad de push nativo a este test sin archivo.

## Firma: evidencia real y límites

Una consulta GraphQL oficial de sólo metadata mediante la sesión CLI existente 24.12.1 confirmó proyecto `@marketplacebrand/marketplace`, ID `9f629f10-d679-4a99-9965-8a9e588afc85`. Sólo devolvió applicationIdentifier `com.example.kora.preview`, una credencial predeterminada y keystore ID `ecc427b0-291b-4555-848e-dc58bd5315a3`, creada el 9 de octubre de 2026. Huella pública SHA256 `86bf0698228dd380cb4d7efc454347023fa6392fe3d3780d06f9f278c244df7f`, coincidente con el APK preview documentado.

No apareció identidad de producción **en ese proyecto/consulta**; no prueba inexistencia en Play, otras cuentas o custodios. La consulta seleccionó sólo IDs, identificadores, fecha y huella; no descargó/solicitó claves, contraseñas o tokens. No se abrió `eas credentials`: el fragmento estándar de ese CLI puede solicitar keystore y contraseñas aunque la pantalla muestre sólo huellas. El intento de lectura de este agente no respondió. Posteriormente, la coordinación verificó directamente la sesión correcta de Play: cuenta de desarrollador MAYAMI, personal, con identidad en revisión, verificación de Android físico obligatoria y teléfono pendiente tras la identidad. «Crear app» está deshabilitado con el aviso «Completa las verificaciones de cuenta para crear apps». No se muestran app/package ni certificados en esa cuenta. Éste es el bloqueo vigente; no se volvió a inspeccionar el navegador ni se cambió configuración. No demuestra disponibilidad global del package ni ausencia de apps o claves en otras cuentas.

| Elemento | Qué significa y dónde se custodia |
|---|---|
| Firma preview existente |EAS/marketplacebrand; firma APK interno com.example.kora.preview. Se conserva intacta y no se adopta como firma de producción.|
| Upload key |Firma el AAB que se sube a Play. Debe coincidir con certificado de carga registrado si hay app previa. Una nueva clave exclusiva de producción en EAS sería un recurso nuevo, con keystore/contraseñas cifrados bajo Expo en este mismo proyecto. No se creó/asoció nada.|
| Play App Signing |Google firma los APK distribuidos; la clave/certificados de distribución pueden diferir de la upload key. Su inscripción/condiciones se deciden en Play. Para App Links se usan los certificados de distribución reales, nunca se sustituyen por la huella preview.|

Fuentes primarias consultadas el 8 de noviembre: [identidad Android](https://developer.android.com/build/configure-app-module#application-id), [firma Android](https://developer.android.com/studio/publish/app-signing), [Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756?hl=en), [custodia de Expo](https://docs.expo.dev/app-signing/security/). No se asume una sola huella si Play muestra varios certificados.

## Próximo paso más corto y confirmación precisa pendiente

1. Completar las verificaciones pendientes de la cuenta personal MAYAMI en Play: identidad en revisión, Android físico y teléfono después de la identidad. Hoy «Crear app» está deshabilitado. Cuando se habilite, confirmar la identidad de producción y cualquier certificado de carga/distribución existente mediante lectura, sin crear recursos ni descargar keystores para inventariar. El estado actual no muestra package ni certificados en esta cuenta y no descarta otras cuentas.
2. Confirmar identidad existente o aprobar `app.mayami.marketplace` como package de producción. Cambiarlo después de publicar representa otra app.
3. Si existe upload key, autorizar reutilizar **la identidad/certificado y custodio exactos** comprobados. Si no existe tras esa comprobación, la decisión concreta sería autorizar una **nueva upload key exclusiva de producción** y su asociación al package confirmado en **Expo EAS, organización marketplacebrand, proyecto marketplace/9f629f10…**. EAS custodiaría keystore y contraseñas cifrados; el acceso al proyecto permitiría firmar entregas. Proteger acceso y recuperación es el riesgo/alcance; no es acceso automático a Play. No tocar la firma preview ni crear otro proyecto/organización.
4. Autorizar el primer build AAB por separado, con alcance/coste/cuota vigentes comprobados al ejecutarlo. Un AAB necesita la clave de carga; el alta/términos de Play App Signing y el envío son decisiones distintas, no una condición que deba resolverse generando ahora una clave de Google. No ejecutar builds, OTA o submit a partir de este documento.

No falta otra implementación de enlaces para iniciar ese paso. Aún faltan el AAB firmado y su comprobación API36+/16KB/ELF/ZIP, configuración nativa real necesaria y el estado de Play; no se declaran aprobados sin binario. El correo soporte se trató aparte. La coordinación informa una regla histórica verificada hacia somosoudy@gmail.com, sin mensajes entrantes encontrados ni correo de prueba enviado. No se volvió a investigar en esta tanda.

## Entrega y reproducción

Worktree: `/Users/brandeastudio/.codex/worktrees/mayami-play-privacy/marketplace`, HEAD bb3de958… limpio y exclusivo de Android production (el nombre histórico de la carpeta no indica su fuente). Carpeta persistente `.local/android-production-source-20261108/`: source.bundle, source.patch, SOURCE_VALIDATION.json, config resuelta/comparación, logs y revisión independiente.

SHA256 bundle `5ad391b3a2d08c9643b2b9f4b48409a538bb2b3e97f9a2f68680c457b3fb3f8e`; patch `335f5bc3018cb2de799ae4836c27302600aec6725ee2e33e8ac6e4addb35e4a3`. Git verificó el bundle y su prerrequisito 59e88a07. La rama compartida conserva `source.patch` y `source-validation.json` junto a este documento; sus fuentes activas preview siguen intactas.

Con la base 59e88a07 disponible: `git bundle verify <source.bundle>` y `git fetch <source.bundle> HEAD`; usar FETCH_HEAD en un checkout dedicado. Alternativa: aplicar source.patch a 59e88a07 con `git apply --check` y luego `git apply`, sin integrarlo en preview. Dependencias existentes/fijadas, sin instalar otras en esta tanda. Verificación local: `node --test tools/eas/android-production-source.test.cjs`, `pnpm exec vitest run tests/mobile/legal-links.test.ts --exclude '**/.local/**'`, `pnpm --filter @kora/mobile typecheck`; para config usar entorno production del eas.json y EAS_BUILD_PLATFORM=android, sin archivos dotenv. No se inicia build por resolver config.
