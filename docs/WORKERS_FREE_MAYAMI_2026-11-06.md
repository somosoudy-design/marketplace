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

## Resultados medidos posteriores a la optimización

19pares completos ruta/ronda con timestamps emparejados:CPUmediana25→17ms, máximo164→30ms. Las21invocaciones posteriores del lote están recuperadas;3iconossonStaticAssets yrespondieron200,noCPU0inventado.24GET200antes/después;errores1102 y contenido de fallo0. Inicio27precargasRSC→0, no navegación suprimida. Red/cachés/isolate no controlados: la mejora es descriptiva, no causalidad exclusiva.

Ruta | CPU después por ronda(ms)
---|---
Inicio|26,30,21
Buscar|27,17,17
Ficha65W|24,11,14
Cuenta|27,14,11
Carrito|18,14,11
Favoritos|17,12,17
Callback|19,11,10

20de21siguenporencima10msnominales y todasrespondieron200. Cloudflaredocumentatoleranciaocasional, nocuotagarantizada: no hay1102realniobligacióndepagarobservada,peronosegarantizacarga/estabilidadfutura.

## Estado verificado · 2026-11-06 06:54 UTC

Workers sigue Free y no se contrató ningún servicio de pago. Fuente89d2708 desplegada en versión923e2489-a867-4c35-84fb-26a35b0570b3; CI42174790119 Success49UI,24Node y3marca, tipos/lint/build/guards/dryrun aprobados. Auditor independiente aprueba8PNG legales y12escenarios Inicio/ficha/variantes320/1440clarooscuro. El deploy comercial aún espera retirar Access, no se declara acceso público comprobado.

Catálogo remoto aplicado UNA VEZ por DO atómico tras ensayo que finaliza con excepción intencionada de éxito/rollback.41publicados/3suspendidos,40notas de autorización y DJI íntegro. Tienda Mayami/soporte@mayami.app/políticas de las páginas reales; slug y restantes campos conservados. Respaldo posterior SHA3835c67c181971037ad8acf2762aea1afdd20b84eb9bccd95b4234b63886e1b7; comparación íntegra44productos confirma sólo estado/nota/fecha cambiados,104imágenes y63variantes idénticas, precios/existencias intactos. AnónimoRLS ve41 y ninguno de los3retirados. NO REAPLICAR aunque el SQLeditor muestre Running tras un resultado vacío: la lectura independiente confirma el commit. BEGIN/ROLLBACK explícitos también dejaban ese estado visual; el ensayo con excepción y SELECT posterior resolvió la verificación sin repetir writes reales.

Comparación CPU persistida completa del lote posteriorf998:21invocaciones Worker emparejadas y3GETicono StaticAssets;24/24HTTP200 sin1102. Sólo19pares completos en ambos lados:mediana25→17ms(-32%descriptivo),máximo164→30ms. PrecargasInicio27→0. No atribuir CPU a red ni declarar cold/warm; no sumar tails parciales. Veyra tiene arquitectura distinta y no se obtuvo CPU/plan comparables. Detalle en WORKERS_FREE_MAYAMI_2026-11-06.md.

Correo: recepción CloudflareRouting Free configurada; auth.mayami.app Verified en Resend Free3000/mes/100día, sin tarjeta.3DNS públicos añadidos y comprobados, MX raíz intactos. Organización SupabaseMarketplace verificada con un único proyecto mimnotafmfasvwrclxan; integración gestionada configura remitente Mayami/no-reply@auth.mayami.app sin extraer claves. Resend informa Ready to send; falta verificar UI SMTP y entrega/retorno real. Ningún otro proyecto tocado.

Pagos: auditoría remota confirma datos ficticios en los5manuales (no sólo una nota),0quotes no-demo vigentes/0pagos pendientes y1pedido no-demo con saldo, que se conserva. Se prepara deshabilitar sólo esos5enabled con guardas y auditoría; no inventar cuentas ni activar efectivo sin respuesta del propietario. Fuente nueva añade bloqueo de confirmación cuando no hay métodos, revalidación antes de RPC y recuperación de pedidos/pagos ya enviados;4UI nuevas y recuperación reforzada pendientes de ejecución (53totales). No es una modificación del motor financiero ni garantía de clientes antiguos/API directa. Tipos/lint de fuente pasan; el primer lint incluyó por error un dryrun generado dentro de app/.local, movido fuera del árbol de lint sin omitir fuente.

Conservar products.is_demo para compatibilidad con APK/boilerplate/procedencia. No controla pedidos/cobros/ledger/envíos, pero SÍ popularidad y avisos de producto: deuda explícita para migración separada sin convertir actividadfixture en ranking real. No afirmar que sea metadata inocua ni cambiar perfiles/pedidos/reviews históricos.

Próxima acción: checkpoint fuente, build/53UI; ensayar/aplicar sólo disabled de métodos, revisar conteos de cuentasfixture privilegiadas, verificar SMTP. Desplegar guardia, retirar Access y comprobar público/SSR/TLS/SEO/53assets/3retirados404, medir misma carga final y documentar. Datos reales de cobro siguen pendientes del propietario; no son motivo para contratar WorkersPaid. Sin APK/OTA/iOS ni transacciones reales.

### Cierre de regresión de recuperación · 07:04UTC

CI42177570967 terminó52/53: el único fallo era un locator ambiguo entre el aviso comercial y el anunciador vacío de Next; se acota al aviso esperado sin omitir la aserción. Revisión independiente detectó además incertidumbre falsa antes de enviar un RPC: se distingue newAttempt sólo en memoria (jamás persistido); un intento nuevo sin método recibe rechazo comercial sin lookup; uno restaurado conserva clave e incertidumbre incluso con lookup vacío. Dos nuevas regresiones elevan la suite a55; tipos/lint pasan, nueva ejecución pendiente.

Los5métodos ficticios se deshabilitaron UNA VEZ tras ensayo con excepción de éxito/rollback y guardas completas; anónimoRLS ve0métodos. Las7filas conservan instrucciones y todo salvo5enabled; pedidos/obligaciones/quotes/pagos se compararon íntegros sin cambios;1pedido pendiente conservado,0quotes/pagos reales en curso. No reaplicar. Conteos Auth:24usuarios,23example.com sinprivilegios,1superadmin/ownerreal y0fixturesprivilegiados. No se borraron cuentas ni historia. SMTPcustomtrue/smtp.resend.com465/remitenteMayami no-reply@auth.mayami.app confirmado en UI sin leerpassword. SiteURL localhost3000→httpsmayami.app y2callbacksHTTPSexactos de registro/recuperación añadidos; confirmaciónpreexistente/autorizacionesintactas. Entrega real aún no verificada.
