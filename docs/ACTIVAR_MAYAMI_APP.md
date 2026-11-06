# Activar y mantener mayami.app

## Cobros oficiales configurados · 6nov2026 14:12 UTC

Zelle USD y Binance interna USDT están habilitados con los datos de recepción proporcionados por Oliver. Ambos requieren referencia y comprobante; cada reporte queda en verificación hasta que Mayami comprueba el abono. Binance usa el canal manual nuevo `binance_internal`, con correo, alias, moneda e ID interno completo. Los datos reales viven en la configuración operativa y respaldos privados; las fixtures públicas usan example.com.

Snapshot posterior: 8 métodos, sólo 2 habilitados. Zelle cambia únicamente instrucciones y activación; conserva sus políticas. Binance hereda los parámetros financieros USDT y base divisas. Los otros 6 métodos siguen deshabilitados e intactos. El contenido completo de 36 pedidos, 22 cotizaciones, 6 pagos y 39 obligaciones permanece idéntico. Ensayo con rollback, aplicación única y trigger de auditoría verificados, sin transferencias ni compras remotas.

[CI 42231006870](https://github.com/somosoudy-design/marketplace/actions/runs/42231006870) SUCCESS, fuente `41b5e67`: 57 UI, 24 Node, 3 pruebas de marca, tipos, lint, build y guards. Dos capturas finales a 320 px aprobadas independientemente. Lectura pública real: 2 métodos correctos, 6 tablas privadas con 401/42501 y mayami.app con 200. La revisión de código confirma que API y panel admiten la revisión del nuevo canal manual. Sin APK/OTA ni prueba de pago con fondos reales.

Este bloque está terminado. No repetir la activación ni desplegar el Worker por esta configuración; se conservan fuente ejecutable `116e569` y versión `897b0966`. Workers Free sigue vigente, sin servicios de pago contratados. La siguiente operación corresponde a Mayami: comprobar los abonos reales antes de confirmar cada pago. [Informe y límites](PAGOS_MANUALES_MAYAMI_2026-11-06.md).

## Mayami público en Workers Free · cierre del 6nov2026

Verificado 2026-11-06 07:35 UTC. https://mayami.app está abierto **sin Access exclusivo del propietario**. Fuente ejecutable 116e569, Worker 897b0966-ade6-4799-ad8e-4b250d384ad2/100%; Workers Free $0 confirmado en UI. No Paid ni servicio con cargos. Los commits documentales posteriores no requieren redeploy.

CI42178600179 Success:55 UI,24 Node,3 marca, tipos/lint/build/guards. Auditoría anónima:SSR con/sin JS,7 páginas 200,3 retirados404,53 fotos y15 CSS/JS por hash, TLS/www/HTTP301, seguridad/robots/noindex privado. Capturas públicas claro/oscuro y guardias revisadas independientemente. Sin compras/fixtures/pagos remotos.

CPU: original28 outcome=ok/18 sobre10 ms, no1102. Lote final24 HTTP 200 y21 invocaciones persistidas;19 pares completos25→14 ms (primera optimización25→17), no causalidad exclusiva. Hubo Inicio 772 ms/HTTP200 fuera del lote; el panel activo mostraba159,07 ms en su agregado.272 invocaciones/0 errores globales y70/0 final,0 Exceeded CPU/memoria/excepción. Mantener Free; no prometer14 ms uniforme ni capacidad futura garantizada. RSC 27→0, iconoStaticAssets, clienteBuscar compartido, lectura por petición y minify. [Informe y límites](WORKERS_FREE_MAYAMI_2026-11-06.md).

Catálogo aplicado UNA VEZ:41 publicados,3 suspendidos;40 aprobados con53 imágenes comerciales, DJI intacto. Mayami/contacto/políticas actualizados manteniendo slug; precios/stock/104 imágenes/63 variantes e historia preservados. is_demo conservado por APK/procedencia; tiene efectos en popularidad/avisos que requieren migración separada, no es sólo metadata. No reaplicarSQL aunque el editor muestre Running tras resultados vacíos; estado confirmado por lecturas externas y snapshots.

Contacto: soporte@mayami.app→Gmail verificado, Routing ready/synced. SMTP Resend Free sin tarjeta, auth.mayami.app Verified, remitenteMayami; una recuperación llegó a INBOX sin cambiar contraseña ni consumir token. Site URL y2 callbacks HTTPS exactos activados, sin alterar confirmación preexistente. No se declara cambio de contraseña/registro remoto completo ni envío humano como soporte desdeGmail.

**Cobro resuelto a las14:12 UTC:** Zelle y Binance interna manual están habilitados según el bloque superior y el informe de pagos. La deshabilitación anterior de los cinco métodos ficticios se conserva como antecedente; no volver a dejar cero métodos ni activar canales sin datos autorizados.

Próxima acción: operación oficial con los dos canales manuales configurados; comprobar cada abono antes de confirmar. No repetir publicación, activación ni mediciones cerradas sin cambios. APK/OTA/iOS y otros proyectos intactos.

## Cuenta y configuración comprobadas

- Rama compartida:claude/marketplace-v1. Fuente desplegada 116e569; versión897b0966-ade6-4799-ad8e-4b250d384ad2.
- Cuenta Cloudflare9ea83b61b8f2d27846eaacd60b7c7aa3; zona b772caa3b5334fee506b719f2e7ffbb7; Worker mayami-storefront/81c62893418a4ca384a3742b1ee831f7.
- Custom Domains raíz/www; SSL Full, Always Use HTTPS, www301 conservando ruta/query; workers.dev/previewsfalse.
- Workers Free $0. Sólo ASSETS y WORKER_SELF_REFERENCE; no R2, DO, Queues, Images ni Email Sending Paid activados.
- Se retiró la appAccess cbcf7524-622c-4a2c-b42e-fc1e622476ec. La política del propietario/ZeroTrustFree del alta anterior no convierte esta web en una prueba privada; no reconstruir esa puerta por instrucciones históricas.
- Contacto: soporte@mayami.app por Cloudflare Routing Free.10 DNS: 2 AAAA administrados + 3 MX + SPF/DKIM Cloudflare y 3 registros Resend del subdominioauth. No sustituirMXraíz.
- Supabase únicamente mimnotafmfasvwrclxan. OrganizaciónMarketplace lspwtzxmraagilwwnqrl verificada con ese único proyecto. SMTP gestionado por Resend Free, nunca copiar credenciales aGit/chat.
- Site URL https://mayami.app; redirects exactos https://mayami.app/auth/callback y https://mayami.app/auth/callback?tipo=recuperar. No borrar enlaces nativos existentes ni cambiar identificación APK/iOS.

## Si hay un cambio de código futuro

1. Sincronizar claude/marketplace-v1 sin descartar cambios ni forzar historia; checkpoint antes de build/deploy.
2. Usar sólo NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY públicas del proyecto correcto. El runner local ignorado .local/mayami-domain-20261106/run-storefront-public.py valida el perfil anon y evita heredar otras variables públicas. No leer keyring/cookies/service_role.
3. Ejecutar tipos/lint,24 Node/3 marca y la suite afectada. build:cloudflare + verify:release/commercial/cloudflare; los guards impiden _exhibition/env ajenos. Dryrun fuera de apps/storefront para no lintar código generado.
4. La revisiónCI aislada sólo se solicita con .github/cloudflare-review-request: usa Docker/fixtureslocales y bloquea los hosts alojados. No iniciar EAS/panel/APK por esta tarea.
5. Desplegar con deploy:cloudflare --keep-vars; conservar los dominios declarados y WorkersFree. Verificar versión/HTTP público, SSR, seguridad, datos y medición necesaria. No reactivar Access del propietario ni serviciosPaid sin instrucción nueva.

## Evidencia y continuidad local

[Informe completo](WORKERS_FREE_MAYAMI_2026-11-06.md). Evidencia privada ignorada:.local/mayami-free-20261106/. Backups antes/después y ensayos/aplicaciones atómicas están ahí; **ya se aplicaron catálogo y deshabilitación de métodos, no repetir**. Respaldo posteriorcatálogo SHA3835c67c181971037ad8acf2762aea1afdd20b84eb9bccd95b4234b63886e1b7. Las guardas de versiones evitan sobreescribir ajustes posteriores o el cron de popularidad.

Chrome real se controla porPID57281/tab2055028886 con .local/mayami-domain-20261106/chrome-bridge.js. AppleScript por nombre apuntaba a otra instancia; no pedir de nuevo permisos ni cerrar Chrome ajeno. Cuando un resultadoSQLvacío deja UI Running, consultar el estado independiente; nunca repetir una mutación sólo por el spinner. Los ensayos con excepción intencionada confirman todas las aserciones y revierten las filas; las secuencias pueden conservar huecos normales.

El APK Android mayami y su runtime son una publicación separada; [estado del APK](APK_MAYAMI_2026-11-05.md). No publicar OTA/iOS por mantener el dominio.
