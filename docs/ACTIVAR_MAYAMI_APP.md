# Activar mayami.app · relevo al Mac · 5 de noviembre de 2026

## Checkpoint oficial · 6nov2026 06:32UTC

Optimización desplegada en Workers Free, versión f9980894-124b-4cca-9642-bada20ed1294, fuente8faeea6. CI42171539369 Success47UI contra stack local. Misma serie24GET:24/24HTTP200 antes y después, sin1102 ni contenido de fallo. Inicio pasó de27precargasRSC a0; latencia mediana215→162,5ms (red/caché no controladas). No equiparar latencia a CPU; tabla persistida posterior pendiente de recuperar. Bundle3976,01KiB/gzip1114,54 frente6451,46/1320,48. No hubo contratación Paid.

Fuente preparada para apertura oficial: manifiesto40productos/92asociaciones/53archivos exactos con procedencia, separado de _exhibition; páginas Términos/Privacidad/Devoluciones/Contacto, SEO público y noindex privado, nombre/contacto Mayami, enlaces oficiales conservando identidad nativa. Metadata y ficha comparten lectura React.cache por petición, sin caché de sesión. Pasan24Node, tipos/lint y3pruebas de marca. Nuevo build/49UI y auditoría visual pendientes; este checkpoint no está desplegado.

EmailRouting Free está enabled=true/statusready con regla soporte@mayami.app al Gmail del propietario verificado; sólo se configuró recepción, no se afirma entrega de una prueba ni SMTP saliente. Supabase SMTPcustom=false; configuración pública actual mailer_autoconfirm=true preexistente (no se relajó). Recuperación de contraseña necesita SMTP real; no declarar correo transaccional resuelto. Cinco métodos manuales contienen placeholders; se pidió elegir efectivo coordinado o aportar datos reales. No publicar cuentas ficticias.

Catálogo remoto aún intacto: respaldo íntegro44productos/104imágenes/63variantes hash3d82b1f56cdbee206c55789a9dc2e75b80ac33bcb8f7755d123caf633b136983. Propuesta SQL transaccional10,7KB para suspender3, anotar aprobación40 y cambiar sólo nombre de tienda Kora→Mayami manteniendo slug; guardas exactas/versiones, imágenes/variantes/origen/precios intactos; terminaROLLBACK. Rehearsal y aplicación todavía pendientes. Access aún no retirado; debe quitarse al publicar la versión comercial, no conservar revisión limitada como resultado.

Próxima acción: compilar/probar versión oficial, revisar capturas independientemente; ensayar SQLROLLBACK/aplicarCOMMIT autorizado; desplegar y retirar Access, comprobar público/SSR/seguridad/CPU, cerrar pagos/SMTP sin cargos. No tocar otros proyectos, APK/OTA/iOS ni ejecutar pedidos reales.


## Publicación oficial y Workers Free · instrucción vigente del 6nov

Oliver decide mantener Workers Free y prohíbe activar Paid u otros servicios con cargos. Solicita optimizar y medir fallos reales, comparación verificable con Veyra y publicación oficial sin acceso limitado. Aprueba retirar del catálogo los productos sin fotografía profesional y oficializar el resto, con ajustes comerciales posteriores a su cargo. Confirma Mayami como nombre comercial y encarga correo @mayami.app y términos/privacidad/devoluciones. No volver a pedir autorización genérica de dominio/publicación ni de Paid: Paid está descartado.

Trabajo en curso: la captura anterior tiene28outcomeok,18sobre10ms nominales; no demuestra1102. Métricas persistidas reales del Worker:179invocaciones,0errores (incluidos0ExceededCPU/Memory/UncaughtException), P50CPU16,01ms en últimas24h desde su creación. Nueva base controlada:24GET secuenciales200 y27recursosRSC tras una visita a Inicio. Los RSC son precargas, no27acciones del comprador. Se prepara prefetch=false en57Links, icono en StaticAssets con mismos bytes, un cliente anónimo en Buscar y minifyWrangler experimental. MantenerSSR, no-store y controles de compra/sesión. Aún no hay medición después ni deploy de esta mejora.

Catálogo consultado sin mutaciones:44visibles,43is_demo y1DJIreal; inventario de53packshots para40productos con hashes correctos,3sin recurso. La instrucción nueva permite su promoción comercial, conservando procedencia/disclosures y sin inventar licencias ni unidad/SKU auténticos. Se retirarán3por estado servidor, sin borrar historia. Preparar manifiesto comercial separado de _exhibition, que seguirá bloqueado en release. El conector Supabase deniega permiso incluso SELECT; se comprueba acceso normal al dashboard del proyecto correcto, sin extraer service_role. EmailRouting Free y contenido legal pendientes de implementación. Access aún protege la revisión del cambio; retirarlo al cerrar el catálogo y publicar, no convertirlo en solución permanente.

Siguiente: terminar y probar mejoras CPU, publicar artefacto verificado, comparar misma carga por versión; completar catálogo/contacto/políticas y retirar Access según autorización oficial. No cambiar Veyra ni proyectos ajenos. Evidencia ignorada en .local/mayami-free-20261106; ver WORKERS_FREE_MAYAMI_2026-11-06.md.

## Estado verificado · 6nov · dominio activo para revisión privada

**mayami.app ya está conectado y funciona por HTTPS.** El propietario entró desde la sesión real de Chrome con el IdP Cloudflare existente, sin leer Gmail ni copiar cookies/tokens. Raíz y www son Custom Domains del Worker `mayami-storefront`; www redirige301 al dominio principal conservando ruta/query. Always Use HTTPS está activado y SSL de zona sigue Full. No se contrató ACM ni R2. DNS inicial era0; sólo se añadieron los dos registros AAAA100:: proxied que administra Cloudflare para estos dominios. No había correo/MX/TXT y no se modificó ningún otro subdominio.

Cuenta `9ea83b61b8f2d27846eaacd60b7c7aa3`, zona `b772caa3b5334fee506b719f2e7ffbb7`, Worker inmutable `81c62893418a4ca384a3742b1ee831f7`, versión desplegada `6d377642-9baf-4bea-93ef-db1d3655b801`. Primero se desplegó con cero endpoints; luego se aplicó Access y finalmente los Custom Domains. `workers_dev=false`, `preview_urls=false`; GET anónimo al alias workers.dev404. La configuración versionada declara ahora ambos dominios para que un deploy posterior no los retire.

**Protección:** Access de un solo Worker, destino `worker`, alcance All traffic, sesión24h. App `cbcf7524-622c-4a2c-b42e-fc1e622476ec`; política reutilizable `fc173fab-3a96-4c6a-a822-7ba1c89991dd` («Mayami - propietario»): Allow con un único Include Emails del correo exacto del propietario (verificarlo en su sesión de Cloudflare), require/exclude vacíos. Sólo existe el IdP Cloudflare `40482053-fd6b-47c4-bd54-bec5befadea7`, restringido a miembros de esta cuenta; no crear GoogleOAuth/IdP duplicado. allowed_idps vacío permite los proveedores disponibles, que actualmente sólo incluyen ése. La regla sigue exigiendo el correo exacto aunque cambien miembros. No añadir otro IdP o política amplia sin revisar este perímetro.

**Zero Trust Free activo:** checkout confirmado0/mes/50usuarios. Oliver autorizó expresamente posibles cargos por exceder límites a la tarjeta guardada; no pedir de nuevo esa autorización. Organización `frosty-lab-a534.cloudflareaccess.com`. Wrangler OAuth con keyring funciona; nunca copiar sus credenciales. Workers permanece Free0 en la comprobación05:26UTC. Se planteó al propietario elegir Paid desde$5/mes+consumo por el margen de CPU; esa contratación sigue pendiente de respuesta, no está incluida en la aprobación de ZeroTrust.

**CPU y alcance:** 28invocaciones observadas con tail sanitizado:4–433ms CPU, mediana22,5ms,18por encima de10ms nominales Free; todas outcomeok. Tras cerrar tail, Inicio/Buscar/ficha volvieron200 sin1102. Se acredita funcionamiento de esta muestra, no estabilidad prolongada/carga. Free tiene tolerancia ocasional; no presentar esa tolerancia como capacidad garantizada ni afirmar un fallo1102 inexistente. No se compró Workers Paid.

**Artefacto:** Next/eslint16.4.5 sólo storefront, OpenNext1.20.16 y Wrangler4.148.0 fijados; Node22.23.3. SSR conservado, sin export estático/vinext ni caché R2/DO/Queues/Images. Fecha2026-10-13 coincide con workerd incluido; no omitir el check de versiones. Se preserva buildrelease y ambos guards. El adaptado rechaza exhibición/env/variables compiladas no aprobadas, sólo permite enlaces pnpm de directorios internos de dependencias bajo server-functions/default. `_headers` conserva seguridad estática. Dryrun final6451.46KiB/gzip1320.48KiB/49assets; no confundir el agregado standalone con bundle.

Sólo las dos variables públicas NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY del backend Marketplace `mimnotafmfasvwrclxan` se usaron en el proceso de build. Fuente local existente intacta, JWTanon/ref y healthGET verificados. Copia ignorada0600 en `.local/mayami-domain-20261106/storefront-public-config.json`; no subirla. Sin service role, SQL/Auth/redirects/SiteURL ni datos remotos modificados, compras/pagos/signup/uploads reales, nuevoAPK/OTA/iOS. El proyecto ajeno permanece intocable.

**Pruebas completadas:**18Node, tipos/lint, build adaptado y guards locales aprobados. CI[42167460733](https://github.com/somosoudy-design/marketplace/actions/runs/42167460733) Success con46/46UI de compra contra workerd y stack/fixtures exclusivamente locales, hosts alojados bloqueados; no publica nada. ZIP13479059739 descargado y SHA2560943b6de368d0d1abcb7c35a6acaa57d1473143293fe254a01803361ce54e14b comprobado. Revisión independiente APROBADA para12capturas Inicio/Buscar/ficha390/1440claro/oscuro y14capturasCI compra/pago/pedido320/1440. No son prueba de compra remota real. Login se prueba funcionalmente en CI; no hay PNG específica del formulario. Revisión atenuada por animación permite revisar geometría, no contraste final.

**Alojado:** propietario llega a Inicio con25/25imágenes cargadas, CSS y sin overflow/exhibición. GET con la sesión normal: Inicio/Buscar/ficha200, producto/tienda inexistentes404, tienda/kora conduce al catálogo, callback200, CSS200immutable. Dinámicas private/no-store y headers nosniff/DENY/noindex; callback es shell estático cliente con s-maxage, sin datos personales SSR. No afirmar no-store de todas las rutas. Anónimo: raíz/rutas/callback/CSS302Access, sin catálogo; TLS validado. www301 conserva ruta/query y aliasworkers.dev404. Revisión pública independiente aprobada para su muestra previa a la redirección; comprobación final local la incluye.

**Evidencia sólo en este Mac:** `.local/mayami-domain-20261106/` contiene snapshots antes/después, owner-access-policy.json, worker-access-applied.json, cloudflare-zone-final.json, hosted-owner-verification.json, hosted-without-tail.json, public-final-verification.json, live-cpu-summary.json, visual/results.json y ci-42167460733. No se versionan respuestas de sesión/credenciales.

**Continuidad:** ScriptingBridge por PID selecciona Chrome visible; AppleScript por nombre apuntaba a otra instancia headless. No repetir permisos ni cerrar procesos ajenos. `publicWebOrigin=null`: la web es revisión privada, no apertura comercial ni destino para compradores de APK/panel. No repetir despliegue/CI por trabajo ya validado. Si se cambia la fuente, construir con las variables públicas aprobadas y ejecutar `build:cloudflare`, guards y dryrun antes de `deploy:cloudflare`; conservar Access All traffic antes de exponer cualquier endpoint. El workflow nuevo sólo verifica en local, activado por `.github/cloudflare-review-request`.

**Siguiente decisión:** elección de plan CPU del propietario. La activación técnica del dominio está completada para revisión privada. Apertura comercial sigue condicionada al catálogo vendible/fotos autorizadas, operador/políticas/contacto reales y retornos web de proveedores descritos abajo. Deuda preexistente no bloqueante: metadata de ficha deriva del slug y puede no coincidir con producto renombrado; las capturas muestran Samsung donde slug conserva UGREEN. No atribuirlo al adaptador ni a caché de sesiones.

## Primera comprobación del 6nov · corregida por selección de instancia

**Permiso de macOS resuelto.** Oliver confirmó que lo habilitó y AppleScript ya puede consultar ventanas, pestañas, URL y título de Chrome. La rama se revisó y sincronizó al retomar: `7d5b909`, árbol limpio y remoto al día. Se abrió una pestaña real en `https://dash.cloudflare.com/`; el título observado es «Un momento…». No demuestra sesión iniciada ni acceso a la cuenta.

**Diagnóstico inicial de la instancia headless (resuelto):** al intentar consultar la página, Chrome devuelve el error 12: «La ejecución de JavaScript mediante AppleScript está desactivada». Su mensaje indica activar **Ver → Desarrollador → Permitir JavaScript para eventos de Apple**. Se solicitó esa acción al propietario. No repetir el permiso de Automatización de macOS ya resuelto, ni asumir acceso al contenido por poder leer el título/URL. Tras habilitarlo, verificar el control real y continuar con la sesión/cuenta indicada. No se inició Google ni se leyó Gmail en esta continuación.

DNS público actualizado a las **04:12 UTC / 00:12 Caracas del 6nov**, resolutor 1.1.1.1: Morgan/Laylah siguen como NS; raíz sin A/AAAA/CNAME y www NXDOMAIN en A/CNAME. Evidencia local ignorada: `.local/mayami-domain-20261106/public-dns-before.json`. Sin cambios DNS, TLS, hosting, backend, app o configuración de enlaces. No se repitieron builds ni pruebas de compra para este bloqueo de acceso; los tests previos del helper siguen siendo pruebas simuladas.

## Verificación en el Mac · 5 de noviembre de 2026

Esta ejecución sí está en macOS, en `/Users/brandeastudio/marketplace`. Se leyó AGENTS y se conservó el árbol limpio original: avance directo de `9d22155` a `600e538` (233 commits), sin reset, limpieza ni reescritura. Revisión independiente: HEAD coincide con origin; índice/árbol limpios; 375/375 archivos versionados de `apps/` y `assets/` presentes con hash Git correcto.

Las descargas normales fallaron o se interrumpieron por lentitud. La copia local usa ahora un remoto promisor (`remote.origin.promisor=true`, `partialclonefilter=blob:none`) y sparse checkout fuera del modo cone: incluye todo salvo `.png`, `.jpg`, `.jpeg`, `.webp`, `.mp4` y `.pdf` bajo `docs/`. Sólo se aplazaron 1.191 archivos multimedia de documentación; toda la fuente, los recursos de app/marca y los textos están presentes. No son borrados versionados. Para materializar esas capturas cuando haga falta: `git sparse-checkout disable` (descargará sus objetos). Conservar la configuración promisor mientras existan objetos históricos pendientes; consultar algunos archivos antiguos puede requerir red.

**DNS público observado el 5nov a las 19:23 UTC / 15:23 Caracas:** nameservers `morgan.ns.cloudflare.com` y `laylah.ns.cloudflare.com`; raíz sin A/AAAA/CNAME y `www` sin resolución (NXDOMAIN en A/CNAME). La comprobación independiente con 1.1.1.1 y 8.8.8.8 coincide para raíz/www; HTTPS no pudo resolverlos. Esto acredita la delegación pública, no la propiedad de la zona ni el estado dentro de la cuenta. Evidencia de la consulta local a 1.1.1.1, sólo en este Mac: `.local/mayami-domain-20261105/public-dns-before.json`. El contraste con 8.8.8.8 procede del informe independiente de las 19:20 UTC.

**Bloqueo del 5nov (resuelto el 6nov):** macOS denegaba el control de Chrome: `No tienes autorización para enviar eventos Apple a Google Chrome. (-1743)`. Se solicitó abrir Cloudflare y el panel de Automatización mediante `open`; no se pudo inspeccionar el navegador ni verificar su sesión. No se ha accedido a la cuenta de Cloudflare, iniciado sesión con Google ni leído Gmail. No hay token Cloudflare en las variables del proceso; no se solicitaron ni extrajeron secretos. DNS, TLS y alojamiento siguen sin modificar.

**Acción indicada el 5nov:** habilitar Codex → Google Chrome en Ajustes del Sistema → Privacidad y seguridad → Automatización. Si Chrome lo exige para el control de la página, habilitar Ver → Desarrollador → Permitir JavaScript desde eventos de Apple. Después verificar el acceso real, usar la cuenta indicada por Oliver y continuar con el inventario de zona/DNS y alojamiento descrito abajo. Oliver ya autorizó configurar el dominio e iniciar sesión con su cuenta Google indicada; no pedir otra autorización genérica. Cualquier segundo factor se completa en el navegador, nunca por chat.

Prueba ejecutada en este Mac: `node --test tools/storefront/inspect-cloudflare.test.mjs`, 5/5 aprobadas con respuestas simuladas. No valida la cuenta real. No se recompilaron web/app ni se hicieron nuevas pruebas de compra. `publicWebOrigin` permanece en `null`.

## Antecedente del relevo desde la nube

Oliver autorizó configurar el dominio y preparar la apertura pública del negocio. Eligió continuar desde **Codex en su Mac, proyecto `~/marketplace`**, para usar su sesión de Cloudflare. La sesión de nube no tiene control de ese Mac ni de su navegador. Se solicitó abrir `https://dash.cloudflare.com/` en el panel de Codex; la herramienta devolvió `queued`, no confirmación de navegador abierto ni autenticación.

## Lo que ya está listo

- Rama `claude/marketplace-v1` sincronizada; web compradora existente en `apps/storefront` con Next16.4.5 (parche de compatibilidad del6nov), SSR y los mismos contratos/backend de la app.
- Marca original mayami integrada. No volver a pedir el ZIP ni cambiar identidad.
- Corregida la ruta compartida `/tienda/[slug]`: consulta la tienda con el cliente anónimo y RLS existentes; redirige al catálogo ya implementado conservando el filtro. Tienda no visible/inexistente devuelve404; un error de conexión tiene reintento.
- `tools/storefront/inspect-cloudflare.mjs` preparado para inspeccionar **sólo mayami.app** mediante GET: zona, estado, nameservers y A/AAAA/CNAME de raíz, www, preview y panel. No cambia DNS, correo, TLS ni hosting; no imprime token ni registros TXT/MX.
- El helper requiere `CLOUDFLARE_API_TOKEN` únicamente si se usa API. No es requisito para gestionar la cuenta desde el navegador local autenticado. Nunca enviar contraseñas, códigos de segundo factor ni tokens por chat.

## Primeros pasos en el Mac

1. Confirmar que el agente está realmente en macOS y tiene acceso a `~/marketplace`; leer AGENTS y este documento. Revisar estado Git antes de sincronizar. Si hay cambios locales, conservarlos; no resetear, limpiar ni sobrescribir archivos.
2. Con árbol limpio: `git fetch origin`, `git switch claude/marketplace-v1`, `git pull --ff-only`. Con cambios o divergencia, inspeccionar e integrar respetando el protocolo antes de continuar.
3. Abrir Cloudflare desde las herramientas de navegador disponibles. Usar la cuenta indicada por Oliver en la conversación. Si se requiere login/2FA, Oliver lo completa en el navegador; el agente no solicita ni extrae secretos.
4. Verificar que **mayami.app realmente existe en esa cuenta**, su estado y nameservers. Registrar los DNS actuales antes de tocar nada. No dar por comprado/activo el dominio sólo por su elección de nombre. No contratar un dominio o plan de pago sin decisión del propietario.
5. Verificar el alojamiento ya disponible en esa cuenta. Cloudflare DNS y hosting son componentes distintos: DNS por sí solo no ejecuta la web. No publicar mediante el workflow del panel, que despliega otra aplicación.

## Arquitectura de despliegue recomendada

La web usa SSR en Inicio, Buscar, ficha y enlace de tienda. Requiere **un runtime Next/Node**, o un adaptador compatible verificado. No convertirla a export estático para hacerla caber en Pages o en el EAS Hosting estático del panel: perdería comportamiento existente.

Camino mínimo: conservar Next y conectar Cloudflare DNS al origen HTTPS del hosting elegido. Node22 es el objetivo utilizado en CI; no hace falta trasladar el backend ni usar el Mac como servidor público permanente. Se preparó OpenNext1.20.16 con Next16.4.5 porque su peer actual exige ese parche. Build exacto, SSR workerd, bundle, dominio/TLS y acceso privado quedaron comprobados el6nov; la muestra CPU excede el límite nominal Free, según el estado superior. No se usa export estático ni se migra a vinext.

Preparación actual de una release, desde la raíz:

```sh
pnpm install --frozen-lockfile
pnpm --filter @kora/storefront build
pnpm --filter @kora/storefront verify:release
```

El build necesita `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` del backend destinado al despliegue; sólo clave pública anon. No subir `.env.local`, tokens de gestión ni service role. Las variables públicas se incorporan al build: cambiar sólo el entorno del proceso después no basta.

El script `start` existente usa3200. Un hosting que proporciona `PORT` debe ejecutar después del guard:

```sh
pnpm --filter @kora/storefront verify:release
pnpm --filter @kora/storefront exec next start --hostname 0.0.0.0 --port "$PORT"
```

Configurar PORT en el proveedor; no inventar un origen, dirección IP o CNAME. Primero comprobar HTTPS y rutas del origen, después asociar el dominio con los registros que ese proveedor requiera. Preservar correo/MX/TXT y demás subdominios. No usar TLS Flexible. Tras conectar: comprobar certificado válido, redirección www→raíz, rutas compartidas,404, sesiones, registro/recuperación y ausencia de caché compartida para respuestas personales.

`config/brand-presentation.ts` conserva `publicWebOrigin=null` hasta esa comprobación. No activarlo antes: afecta enlaces compartidos desde app y panel. La app nativa no se cambia ni publica por configurar DNS.

## Apertura comercial: bloqueos concretos

La autorización de Oliver para preparar la publicación está registrada. Lo pendiente son condiciones operativas reales, no otra autorización genérica:

1. **Catálogo de evaluación comprable.** `is_demo` no se filtra en search/RLS/cart_set; una muestra published de tienda activa puede entrar en compra. Es el comportamiento actual de evaluación. Conectar el dominio no transforma existencias, precios o muestras en ofertas comerciales. Antes de abrir pedidos debe existir catálogo vendible autorizado y política de servidor que respete ese estado; no borrar ni falsear flags.
2. **Fotos privadas.** `build --release` y `verify:release` eliminan el registro/archivos de exhibición. No retirarlos para que se vean las fotos de Android: quedan pendientes fotografías comerciales autorizadas en el catálogo definitivo.
3. **Operador y condiciones.** Faltan rutas web de privacidad, términos, devoluciones y contacto con datos reales. Los datos legales/correo de `config/brand.json` son provisionales. El correo de acceso a Cloudflare no se convierte automáticamente en correo comercial público. Pedir al propietario los datos del comercio cuando se prepare ese contenido; no inventarlos.
4. **Retornos de pago.** El fallback automático del backend es nativo (`kora://pay/result`). Validar el contrato web de los proveedores que se habiliten; DNS no lo corrige. No cambiar tasas, importes o conciliación ni hacer pagos reales para probar presentación.
5. **Acceso de evaluación.** La web tiene noindex, pero no un control de acceso. Si se expone el storefront de revisión, proteger todo el origen y sus alias, no sólo el dominio principal. Una portada institucional propia puede ser pública sin exponer catálogo/registro/checkout antes de cerrar los puntos anteriores.

No desplegar una simple bandera visual que oculte botones como sustituto de controles de servidor. El proyecto `bfuggvbgttvcygbexqyn` sigue fuera de alcance. No ejecutar seed remoto ni activar un entorno de ventas con cuentas de fixtures.

## Si se retoma desde la nube

Borrador de entorno guardado (no aplicado): acceso a `api.cloudflare.com`, `dash.cloudflare.com`, `developers.cloudflare.com`, `mayami.app`, `www.mayami.app`, `preview.mayami.app` y `panel.mayami.app`, preservando los destinos previos. Requisito opcional `CLOUDFLARE_API_TOKEN`, secreto personal dirigido sólo a `api.cloudflare.com`. Para inspección basta Zone Read y DNS Read; para configurar DNS posteriormente, DNS Edit limitado a la zona mayami.app. No usar Global API Key ni pedir el token en el chat.

Ese camino exige guardar/publicar el borrador desde la configuración del entorno y comprobar su estado; no se ha realizado. **Oliver eligió el Mac**, así que no se le debe pedir aplicar este camino alternativo como condición para continuar allí.

```sh
# Sólo cuando la credencial esté vinculada de forma segura y la red habilitada.
NODE_USE_ENV_PROXY=1 node tools/storefront/inspect-cloudflare.mjs
```

En la sesión de nube anterior, la inspección remota se detuvo antes de enviar solicitudes por ausencia del token. No se verificaron entonces propiedad del dominio, DNS, TLS ni hosting. No se cambiaron datos remotos ni se publicó web/OTA.

## APK anterior, independiente del dominio

No reiniciar el trabajo nativo. Build `df55b9b8-1ed5-42e6-b42f-8a09b9bce50f` terminado; CI42092018315 **Success** valida binario y emulador Android15 del mismo APK. Corregidos los parsers con salida real, sin reconstruirlo. [Informe, revisión visual e instalación](APK_MAYAMI_2026-11-05.md). El dominio no requiere compilar otro APK, publicar OTA ni tocar iOS. Instalación física en Samsung todavía no comprobada.

## Validación histórica de la preparación anterior al alojamiento

Build Next16.4.1, verify:release, tipos y lint aprobados. Dos pruebas UI contra build real/local: tienda visible→catálogo con filtro persistente y tienda inexistente→404/salida. Cinco pruebas del helper Cloudflare aprobadas (sólo GET, zona exacta, cero solicitudes sin token, respuestas parciales/ajenas rechazadas y errores sin secretos). Auditor independiente APROBADO para estos cambios y el relevo. No son pruebas de dominio ni de operación comercial pública.
