# MAYAMI: Workers Free y publicación oficial · 6nov2026

Decisión del propietario: Workers Free; ningún Paid ni servicio con cargos. Publicación oficial autorizada, retirando el control exclusivo del propietario al cerrar el catálogo. Este checkpoint prepara optimizaciones; todavía no atribuye mejoras medidas.

## Fallo frente a exceso nominal

Captura original05:24:29–05:25:06UTC:28invocaciones,28outcomeok;18por encima10ms, mediana22,5ms, máximo433ms. No contiene estadoHTTP ni indicador de isolate/coldstart. La primera observación Inicio433ms y la segunda41ms no acreditan por sí solas arranque en frío/caliente. Panel persistido posterior:179invocaciones, errores0, ExceededCPU0, ExceededMemory0 y UncaughtException0; P50CPU16,01ms/P90130ms/P99356ms. No hay evidencia1102 en lo consultado. Los404 de rutas inexistentes y302deAccess no son fallosCPU.

Ruta | CPU original(ms)
---|---
Inicio|433,41
Buscar|119,20,43,51,5,10
Cuenta|185
Carrito|209
Favoritos|97,60
Icono|55
Ficha65W|21,24
Callback|34
Tienda|39

Nueva base:24GET secuenciales (3vueltas por8rutas) terminaron200 sin1102 ni pantalla de error; tail guarda statusHTTP/CPU/intenciónRSC sólo donde capturó el evento. Visita de Inicio produjo27recursosRSC. No confundirlos con navegación deliberada ni mezclar esta carga con el coste de un solo HTML.

## Cambios preparados

- prefetch=false: evita renderizar rutas automáticamente al verse/rozarse links; conserva Link, navegación cliente y SSR.
- SVG original en public/icon.svg y metadata explícita: StaticAssets lo sirve sin ejecutar Next; mismos bytes, securityheaders conservados.
- Buscar reutiliza un único cliente anónimo para las dos lecturas concurrentes; sin sesión ni caché compartida.
- minify:true en Wrangler, como experimento. OpenNext ya minifica parcialmente; no prometer mejora hasta medir.
- ESLint ignora sólo .open-next/.wrangler generados, igual que .next; fuente y tests siguen revisados.
- Prueba UI: HTMLSSR, sin solicitudes especulativas en viewport/hover/scroll, icono y click de ficha funcionales.

## Comparación real con Veyra

Fuentes locales verificados y GETpúblico6nov05:36UTC: Veyra usa Vinext1.0.0-beta.5/Vite y backendD1/R2; Inicio devuelve AccessGate cliente, sin lectura de catálogo/tasasSSR. Navegación principal son tabs de estadoReact. MAYAMI conserva Next16.4.5/OpenNext1.20.16 y catálogoSSR. Veyra root200/TLSválido, TTFB758ms y /api/version2.9.3/Beta; esos tiempos incluyen red y no sonCPU. No se acreditó SHA de producción, CPU/request ni plan de Veyra; no compararlos inventando equivalencia ni migrar arquitectura. WorktreeVeyra limpiofcb9f2f y Downloads7467394 con cambios ajenos, intactos.

## Validación y medición posterior

Pendientes en este checkpoint: build, UIlocal actualizada, despliegue y mismo muestreo después. Registrar n/CPU/status/outcomes por ruta/versión, separar visitasRSC y navegación, estáticos fueraWorker y fallos reales. Supabase alojado no recibe órdenes/registro/pagos de prueba. No recomendar pagar sólo por superar nominalmente10ms: justificar cualquier necesidad con fallos/capacidad observada y consultar al propietario.

Fuentes: [Cloudflare límites](https://developers.cloudflare.com/workers/platform/limits/), [Next Link](https://nextjs.org/docs/app/api-reference/components/link#prefetch), [OpenNext assets](https://opennext.js.org/cloudflare/howtos/assets), [OpenNext rendimiento](https://opennext.js.org/cloudflare/perf). Evidencia local ignorada: .local/mayami-free-20261106/.

## Checkpoint de provisión CI

Build y guards adaptados pasan; nuevo test de navegación/SSR/icono pasa en Chrome local contra workerd. Bundle minificado3976,01KiB/gzip1114,54KiB frente6451,46/1320,48 anteriores. El CI42170567305 quedó esperando instalación de navegador; se usa el Chrome incluido por el runner Ubuntu24.04 (verificado en su inventario oficial), igual que el QA de este Mac, con fallback limitado5min. El nuevo CI sustituye sólo revisiones locales anteriores del mismo grupo; no cancela EAS/panel. No se omite ninguna prueba.

## Checkpoint oficial · 6nov2026 06:32UTC

Optimización desplegada en Workers Free, versión f9980894-124b-4cca-9642-bada20ed1294, fuente8faeea6. CI42171539369 Success47UI contra stack local. Misma serie24GET:24/24HTTP200 antes y después, sin1102 ni contenido de fallo. Inicio pasó de27precargasRSC a0; latencia mediana215→162,5ms (red/caché no controladas). No equiparar latencia a CPU; tabla persistida posterior pendiente de recuperar. Bundle3976,01KiB/gzip1114,54 frente6451,46/1320,48. No hubo contratación Paid.

Fuente preparada para apertura oficial: manifiesto40productos/92asociaciones/53archivos exactos con procedencia, separado de _exhibition; páginas Términos/Privacidad/Devoluciones/Contacto, SEO público y noindex privado, nombre/contacto Mayami, enlaces oficiales conservando identidad nativa. Metadata y ficha comparten lectura React.cache por petición, sin caché de sesión. Pasan24Node, tipos/lint y3pruebas de marca. Nuevo build/49UI y auditoría visual pendientes; este checkpoint no está desplegado.

EmailRouting Free está enabled=true/statusready con regla soporte@mayami.app al Gmail del propietario verificado; sólo se configuró recepción, no se afirma entrega de una prueba ni SMTP saliente. Supabase SMTPcustom=false; configuración pública actual mailer_autoconfirm=true preexistente (no se relajó). Recuperación de contraseña necesita SMTP real; no declarar correo transaccional resuelto. Cinco métodos manuales contienen placeholders; se pidió elegir efectivo coordinado o aportar datos reales. No publicar cuentas ficticias.

Catálogo remoto aún intacto: respaldo íntegro44productos/104imágenes/63variantes hash3d82b1f56cdbee206c55789a9dc2e75b80ac33bcb8f7755d123caf633b136983. Propuesta SQL transaccional10,7KB para suspender3, anotar aprobación40 y cambiar sólo nombre de tienda Kora→Mayami manteniendo slug; guardas exactas/versiones, imágenes/variantes/origen/precios intactos; terminaROLLBACK. Rehearsal y aplicación todavía pendientes. Access aún no retirado; debe quitarse al publicar la versión comercial, no conservar revisión limitada como resultado.

Próxima acción: compilar/probar versión oficial, revisar capturas independientemente; ensayar SQLROLLBACK/aplicarCOMMIT autorizado; desplegar y retirar Access, comprobar público/SSR/seguridad/CPU, cerrar pagos/SMTP sin cargos. No tocar otros proyectos, APK/OTA/iOS ni ejecutar pedidos reales.
