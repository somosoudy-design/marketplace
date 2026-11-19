# Mayami público en Workers Free — 6 de noviembre de 2026

Estado verificado a 2026-11-06 07:35 UTC. https://mayami.app está abierto sin el acceso exclusivo del propietario. Workers conserva **Free, $0**; no se activó Paid ni otro servicio con cargos. La web publica el catálogo autorizado, pero confirmar nuevas compras está bloqueado mientras falten datos reales de recepción de pagos.

## Publicación y alcance

Fuente ejecutable `116e569ce25c1327ff3aff301337f5da1e066779`, Worker `mayami-storefront`, versión `897b0966-ade6-4799-ad8e-4b250d384ad2`, tráfico 100%. Los commits posteriores a esa fuente sólo documentan el cierre; no requieren otro deploy.

La aplicación Access del Worker se retiró por la autorización expresa de apertura oficial. GET anónimo devuelve200, sin cookie ni sesión. HTTPS raíz/www válido; HTTP y www redirigen301 conservando ruta y consulta. workers.dev y previews siguen desactivados. Los controles propios de cuenta, RLS y compra se conservan.

## Exceso nominal y errores reales

La captura original tenía28 invocaciones,18 sobre10 ms y28 outcome ok. No guardaba estadosHTTP: no se deben inventar28 HTTP 200 ni calificar como cold/warm. No contenía exceededCpu, excepciones ni prueba de1102. Los404 de productos inexistentes/retirados son respuestas funcionales; los302antiguos eran Access.

Las tres series de24 GET (antes, optimizaciónf998 y publicación final) terminaron24/24 HTTP 200, sin1102 ni contenido de fallo. No se registraron pedidos, pagos, compradores ni comprobantes de prueba en Supabase alojado.

Cloudflare documenta10 msCPU nominales en Free y tolerancia ocasional por isolate, sin una cuota de exceso garantizada. Superar10 ms no demuestra por sí solo un fallo. La evidencia de agotamiento real sería1102, outcomeexceededCpu o la métrica correspondiente. [Límites oficiales](https://developers.cloudflare.com/workers/platform/limits/#cpu-time), [errores oficiales](https://developers.cloudflare.com/workers/observability/errors/#error-pages-generated-by-workers).

## CPU por ruta, con datos persistidos

Tres vueltas por ocho rutas, GET secuenciales con cache:no-store, mismo navegador y sin efectuar compras. Base 05:37:20–26UTC; final 07:20:15–19UTC. La tabla muestra CPU enms por ronda, no latencia de red. «—» significa evidencia persistida ausente; no se rellenó con suposiciones.

| Ruta | Antes, por ronda | Publicación final, por ronda |
|---|---|---|
| `/` | —, 47, 27 | 33, 25, 17 |
| `/buscar` | —, 23, 18 | 23, 20, 21 |
| `/p/ugreen-nexode-65w` | 29, 17, 135 | 14, 12, 13 |
| `/cuenta` | 25, 164, 17 | 13, 15, 10 |
| `/carrito` | 26, 16, 24 | 13, 12, 10 |
| `/favoritos` | 81, 40, 51 | 19, 21, 11 |
| `/auth/callback` | 24, 21, 20 | 18, 15, 11 |
| `/icon.svg` | 45, 50, 5 | Static Asset; 3 GET 200 |

Se recuperaron21/21 invocaciones Worker posteriores y los3 GETdelicono comoStaticAssets. La base sólo conserva22 de 24 filas por el límite de50 del panel; dos lecturas no tienen pareja. Sólo los **19 pares completos** de ruta+ronda se comparan: mediana25→14 ms, máximo164→25 ms. La primera mejora f998, con catálogo y Access anteriores, daba25→17 ms en esos19 pares. La publicación también cambia catálogo, metadata y acceso: no atribuir toda diferencia final a una única optimización.

En las21 filas finales,19 superan10 ms; aun así sus respuestas son200. Latencia HTTP mediana215→162,5→147,5 ms en las tres series: incluye red, cachés y Access; no es CPU. No fue una prueba de carga ni se acreditó el estado frío/caliente de los isolates.

## Picos y panel agregado: límite de la conclusión

Fuera del lote hubo un GET a Inicio con 772 ms CPU que respondió200, outcome=ok, sin excepción. No se ocultó al calcular la serie pareada. El panel de últimas 24 h mostraba272 invocaciones / 0 errores,70 de la versión final/0 errores,0 Exceeded CPU,0 Exceeded Memory,0 Internal y0 Uncaught Exception. Su tabla de versión activa mostraba159,07 ms en «Median CPU time»; la leyendaP50delgráfico mostraba73,49 ms. Son agregaciones del panel sobre otro conjunto/ventana; no reconstruimos su cálculo interno ni equivalen a la mediana de19 pares. **No afirmar que toda la aplicación consume14 ms ni que los picos desaparecieron.**

El tail final congelado a las 07:35 tiene 57 eventos: 57 outcome=ok, 0 excepciones y 0 logs de error. 46 HTTP 200 y 11 HTTP 404: 3 productos retirados y 8 peticiones a cuatro rutas `/static/chunks/*.js` sin el prefijo `/_next/`. Esas cuatro rutas mal formadas consumieron 28–475 ms; no se atribuyó su emisor. Los15 CSS/JS realmente enlazados por las páginas usan `/_next/`, responden200 y coinciden por hash con el artefacto. Los nombres relativos coinciden con otherChunks interno de Turbopack; una extracción textual con base errónea es una posibilidad, no una autoría probada.

## Cambios aplicados y propósito

- Se desactivaron las precargas especulativas de57 Links existentes. Conservan navegación de Next y SSR; una visita a Inicio pasó de27 recursos RSC a0, también0enla versión pública. Reduce renderizados de rutas que el comprador no abrió.
- El icono SVG, con idénticos449 bytes y hash, pasó del handlerNext a StaticAssets. SusGET200 ya no producen invocaciones Worker.
- Buscar reutiliza un único cliente anónimo en sus dos lecturas paralelas. Metadata y ficha comparten publicProduct con React.cache por petición, sin caché global de sesión/precio/stock.
- Wrangler minifica el Worker. Bundle original6451,46KiB/gzip1320,48; tras optimización3976,01/1114,54; final comercial4158,74/1144,98. El manifiesto/páginas comerciales agregan código. Son tamaños del Worker, no CPU ni pesoHTML.
- Se conservaron SSR dinámico, lecturas no-store, autoridad de precio/tasa/saldo en el servidor, RLS y verificación manual de pagos. No se sustituyó SSR por una SPA ni se trasladó confianza financiera al cliente.
- La web revalida métodos antes de nuevas operaciones. Un intento nuevo rechazado antes delRPC no finge incertidumbre; un intento que pudo llegar al servidor conserva su clave y recuperación, incluso si los métodos desaparecen. No modifica el motorSQL; clientes anteriores/API directa conservan su comportamiento de creación de pedidos.

## Comparación real con Veyra

Se revisó el checkout actual de Veyra y un GET público6nov 05:36 UTC: Vinext 1.0.0-beta.5 / Vite y backendD1/R2; Inicio entrega AccessGate cliente, sin lecturaSSR de catálogo/tasas, y tabs principales de estadoReact. Mayami usa Next 16.4.5 / OpenNext 1.20.16 y catálogoSSR. Veyra respondió200 y /api/version2.9.3/Beta; TTFB 758 ms incluye red y no esCPU. No se verificó CPU/request, plan ni SHA de producción de Veyra. No extrapolar su coste ni migrar Mayami por suponer equivalencia. No se modificó Veyra.

## Catálogo y datos

Por instrucción del propietario se conservaron40 productos con imágenes preparadas, másDJIMic3:41 publicados. Se suspendieron3 sin fotografía profesional preparada; no se borraron productos ni historial.40 notas registran la aprobación. Tienda de plataforma:Mayami,soporte@mayami.app y políticas coherentes con las páginas publicadas; slugkora conservado.

Ensayo transaccional con excepción intencionada de éxito/rollback y aplicación atómica única. Respaldo completo antes/después;104 imágenes y63 variantes idénticas. Precios, stock, importes y datos financieros intactos. Los53 archivos / 92 asociaciones comerciales mantienen hashes y procedencia; no se atribuyó autenticidad de unidad/SKU ni licencias no acreditadas. El manifiesto público es independiente de _exhibition, bloqueado por los guards.

Se conservan products.is_demo y perfiles/pedidos/reviews históricos para compatibilidad con APK y procedencia. El flag de producto no controla cobros/ledger/envíos, pero sí popularidad y ciertos avisos de producto. Esa alineación comercial necesita una migración separada que conserve APK/historia y no transforme eventosfixture en ranking real. No describirlo como metadata sin efectos.

## Cobros: pendiente real del propietario

Los5 manuales tenían datos ficticios, incluidos números en cero, titularDEMO y correoexample.com. Se cambiaron sólo5 enabled a false, con snapshot exacto de las7 filas, auditoría before/after por código y ensayo previo. Instrucciones/restantes campos intactos; los2 automáticos ya estaban deshabilitados.0 cotizaciones no-demo vigentes y0 pagos pendientes/processing al cambiar;1 pedido con saldo conservado. Órdenes, obligaciones, cotizaciones y pagos se compararon íntegros sin cambios.

La web conserva carrito y recuperación, y bloquea confirmar sin método disponible. Falta que el propietario elija efectivoUSD coordinado o aporte datos reales de recepción para los canales que desee. No se inventaron cuentas ni puntos de retiro. No habilitar un método sólo para aparentar cierre del lanzamiento.

## Contacto y autenticación

soporte@mayami.app tiene reenvío Cloudflare Email Routing Free al Gmail verificado del propietario; enabledtrue,statusready,syncedtrue. MX/SPF/DKIM de recepción conservados. No se afirma una prueba de entrega entrante a soporte ni envío humano «Send as» desde Gmail.

ResendTransactionalFree, $0, sin tarjeta: 3000correos/mes,100/día; al agotar cuota se detiene, sin overages de un planPaid. auth.mayami.app estáVerified; tresDNSonly nuevos sin tocarMXraíz. La integración gestionada se limitó a Marketplace, organización verificada con un único proyecto mimnotafmfasvwrclxan; SMTPcustomtrue,smtp.resend.com465,Mayami/no-reply@auth.mayami.app. Clave cifrada por los servicios, nunca leída/copiada. [Cuotas de Resend](https://resend.com/docs/knowledge-base/account-quotas-and-limits).

Site URL localhost:3000→https://mayami.app; se añadieron únicamente callbacks exactos `/auth/callback` y `/auth/callback?tipo=recuperar`. No se alteró la confirmación de correo preexistente. Se solicitó una recuperación a la cuenta real existente del propietario: API mostró envío correcto y el mensaje llegó a INBOX del Gmail; sólo se comprobaron IDs/metadatos, sin consumir código, cambiar contraseña ni crear cuenta remota. No se declara verificado un cambio real de contraseña/registro de otro comprador ni las plantillasOTP remotas de extremo a extremo.

Conteo Auth:24 usuarios,23 example.com sin privilegios y1 superadmin/owner real;0 fixtures privilegiados. No se borraron cuentas. Lecturas anónimas reales de profiles,orders,payments,addresses,notifications,cart_items yfavorites devuelven401/42501; no exponen filas. No se tocó el proyecto ajeno ni se extrajeron service_role/cookies/tokens de gestión.

## Pruebas y revisión

[CI42178600179](https://github.com/somosoudy-design/marketplace/actions/runs/42178600179):**55/55 UI,24 Node,3 marca**, tipos/lint/build/guards. Compras/pagos sólo en Docker local, con ambos hostsSupabase alojados bloqueados. El fallo anterior52/53 era un selector ambiguo del aviso frente al anunciador de Next; se corrigió sin omitir la aserción. Dos regresiones adicionales cubren primer intento y recuperación sin duplicado.

Auditoría pública independiente:7 páginas200SSR,3 retirados404,53/53 fotos y15/15 CSS/JS con hashes exactos; TLS/redirecciones/headers/robots.12 rutas privadas conX-Robotsnoindex; su metarobots heredado aún diceindex,follow, de modo que no se promete indexación de buscadores. Navegador aislado sin sesión:4 vistas320claro/oscuro aprobadas y SSR sin JavaScript con nombre/precio/vendedor/enlaces. Revisadas8 legales,12 vistas locales/variantes y3 capturas de guardia de CI. La captura completa móvil tiene una superposición preexistente de barra fija/dirección; esa imagen no prueba el scroll. No hubo hallazgo visual bloqueante nuevo.

ZIP de55 UI recuperado con la sesión normalGitHub,9.596.797bytes,SHA256`0b53c5aa3df578065c4795a244770a941abd273edd8cb7c4da9e9b04b7e7b0a8`, coincide conActions. Capturas extraídas sin traces. El preview y tail propios se cerraron tras la verificación; producción sigue funcionando.


Verificación adicional de navegación cliente pública: Inicio → clic NextLink a ficha → variante → logo Inicio → búsqueda GET → Ingresar, sin sesión ni enviar formularios de Auth. 65 respuestas correctas; 27 cargas de chunks sobre15rutas únicas, todas200bajo`/_next/`,0ChunkLoadError/HTTP>=400/pageerror y0mutaciones. Marcadorwindow conservado en ficha/logo/cuenta acredita navegación cliente, no sólo GET directos. Hubo2fetchRSCcancelados al recorrer rutas y2errores de consola por DNS de un beacon externo opcional, static.cloudflareinsights.com; no bloquearon el recorrido. El resolver de este Mac también falló con curl; en cambio1.1.1.1 devolvió direcciones válidas. No se atribuye una caída global al proveedor. No se cambiaron DNS del equipo ni funciones de analítica por ese síntoma. Evidencia:public-client-navigation/.

## Decisión sobre Paid y continuidad

**Mantener Free.** No hay fallo1102, exceededCpu, error de memoria ni agotamiento de cuota probado que justifique contratarPaid ahora. Sí existen CPU nominal excedida y picos: la tolerancia no es una garantía de capacidad futura. Cualquier necesidad posterior debe justificarse con errores/tráfico reales y consultarse antes de generar cargos.

La publicación técnica está cerrada. La próxima acción depende sólo de los datos/elección real de cobro; no repetir autorización del dominio, volver a cerrar Access ni rehacer builds/CI/deploy sin cambios. APK/OTA/iOS y Veyra no se publicaron/modificaron en esta intervención.

Evidencia local ignorada en `.local/mayami-free-20261106/`: before-reads.json,after-perf-reads.json,official-public-reads.json,persisted-cpu-comparison-independent.json,persisted-cpu-final-comparison.json,metrics-final-screen.json,workers-current-plan-proof.json,public-audit-independent/,public-anonymous-visual/,final-ci-guard-images/,smtp-configured-proof.json,mail-final-proof.json,anonymous-private-rls-proof.json y snapshots SQL antes/después. Los respaldos contienen datos de operación y no deben añadirse al repositorio público.
