# Activar mayami.app · relevo al Mac · 5 de noviembre de 2026

## Verificación en el Mac · 5 de noviembre de 2026

Esta ejecución sí está en macOS, en `/Users/brandeastudio/marketplace`. Se leyó AGENTS y se conservó el árbol limpio original: avance directo de `9d22155` a `600e538` (233 commits), sin reset, limpieza ni reescritura. Revisión independiente: HEAD coincide con origin; índice/árbol limpios; 375/375 archivos versionados de `apps/` y `assets/` presentes con hash Git correcto.

Las descargas normales fallaron o se interrumpieron por lentitud. La copia local usa ahora un remoto promisor (`remote.origin.promisor=true`, `partialclonefilter=blob:none`) y sparse checkout fuera del modo cone: incluye todo salvo `.png`, `.jpg`, `.jpeg`, `.webp`, `.mp4` y `.pdf` bajo `docs/`. Sólo se aplazaron 1.191 archivos multimedia de documentación; toda la fuente, los recursos de app/marca y los textos están presentes. No son borrados versionados. Para materializar esas capturas cuando haga falta: `git sparse-checkout disable` (descargará sus objetos). Conservar la configuración promisor mientras existan objetos históricos pendientes; consultar algunos archivos antiguos puede requerir red.

**DNS público observado el 5nov a las 19:23 UTC / 15:23 Caracas:** nameservers `morgan.ns.cloudflare.com` y `laylah.ns.cloudflare.com`; raíz sin A/AAAA/CNAME y `www` sin resolución (NXDOMAIN en A/CNAME). La comprobación independiente con 1.1.1.1 y 8.8.8.8 coincide para raíz/www; HTTPS no pudo resolverlos. Esto acredita la delegación pública, no la propiedad de la zona ni el estado dentro de la cuenta. Evidencia de la consulta local a 1.1.1.1, sólo en este Mac: `.local/mayami-domain-20261105/public-dns-before.json`. El contraste con 8.8.8.8 procede del informe independiente de las 19:20 UTC.

**Bloqueo actual:** macOS deniega el control de Chrome: `No tienes autorización para enviar eventos Apple a Google Chrome. (-1743)`. Se solicitó abrir Cloudflare y el panel de Automatización mediante `open`; no se pudo inspeccionar el navegador ni verificar su sesión. No se ha accedido a la cuenta de Cloudflare, iniciado sesión con Google ni leído Gmail. No hay token Cloudflare en las variables del proceso; no se solicitaron ni extrajeron secretos. DNS, TLS y alojamiento siguen sin modificar.

**Próxima acción concreta:** habilitar Codex → Google Chrome en Ajustes del Sistema → Privacidad y seguridad → Automatización. Si Chrome lo exige para el control de la página, habilitar Ver → Desarrollador → Permitir JavaScript desde eventos de Apple. Después verificar el acceso real, usar la cuenta indicada por Oliver y continuar con el inventario de zona/DNS y alojamiento descrito abajo. Oliver ya autorizó configurar el dominio e iniciar sesión con su cuenta Google indicada; no pedir otra autorización genérica. Cualquier segundo factor se completa en el navegador, nunca por chat.

Prueba ejecutada en este Mac: `node --test tools/storefront/inspect-cloudflare.test.mjs`, 5/5 aprobadas con respuestas simuladas. No valida la cuenta real. No se recompilaron web/app ni se hicieron nuevas pruebas de compra. `publicWebOrigin` permanece en `null`.

## Antecedente del relevo desde la nube

Oliver autorizó configurar el dominio y preparar la apertura pública del negocio. Eligió continuar desde **Codex en su Mac, proyecto `~/marketplace`**, para usar su sesión de Cloudflare. La sesión de nube no tiene control de ese Mac ni de su navegador. Se solicitó abrir `https://dash.cloudflare.com/` en el panel de Codex; la herramienta devolvió `queued`, no confirmación de navegador abierto ni autenticación.

## Lo que ya está listo

- Rama `claude/marketplace-v1` sincronizada; web compradora existente en `apps/storefront` con Next16.4.1, SSR y los mismos contratos/backend de la app.
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

Camino mínimo: conservar Next y conectar Cloudflare DNS al origen HTTPS del hosting elegido. Node22 es el objetivo utilizado en CI; no hace falta trasladar el backend ni usar el Mac como servidor público permanente. Workers/OpenNext es una alternativa sólo después de comprobar soporte exacto de Next16.4.1, SSR, bundles y límites de la cuenta; no se instalaron adaptadores ni se asumió compatibilidad.

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

## Validación de esta preparación

Build Next16.4.1, verify:release, tipos y lint aprobados. Dos pruebas UI contra build real/local: tienda visible→catálogo con filtro persistente y tienda inexistente→404/salida. Cinco pruebas del helper Cloudflare aprobadas (sólo GET, zona exacta, cero solicitudes sin token, respuestas parciales/ajenas rechazadas y errores sin secretos). Auditor independiente APROBADO para estos cambios y el relevo. No son pruebas de dominio ni de operación comercial pública.
