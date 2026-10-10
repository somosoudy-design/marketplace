# Estado actual de Kora

> Documento vivo. Lo actualiza el agente que trabaja, en cada checkpoint (cada 20–30 minutos de trabajo, al
> cerrar un módulo y antes de ceder el turno). Si algo de aquí no coincide con el repositorio o con los
> servicios, gana lo que compruebes y corriges este archivo.

**Última actualización:** 2026-10-10 15:48 (Caracas, UTC−4), por Codex (preparación iOS Personal Team).

## Dónde está el trabajo

| Dato | Valor |
|---|---|
| Repositorio | https://github.com/somosoudy-design/marketplace (público: nunca subir secretos) |
| Rama compartida | `claude/marketplace-v1` (todos los agentes trabajan aquí; ver `AGENTS.md`) |
| PR | #1 en borrador hacia `main` (`main` solo tiene el README inicial; no fusionar sin Oliver) |
| Último commit confirmado | `git log -1 origin/claude/marketplace-v1`. Frente A V2: fuente probada/publicada `b60b2cc`, solicitud production `d62b1fa`; cierre documental en el commit de esta actualización. Base `9e4e1f5` |
| Plan vigente | Instalación iOS gratuita: Xcode + Personal Team + compilación local en el Mac de Oliver. Frente A V2 cerrado; sin Frente B |
| Objetivo actual | Auditar iOS SDK 57 y preparar una variante exclusivamente local sin APNs/Associated Domains. Sin alterar APK 5, Android, producción, backend, motor financiero ni panel |
| Panel publicado | **https://kora-panel.expo.app** (EAS Hosting; cuentas reales del proyecto de pruebas, no las demo locales) |
| Respaldo extra | `/mnt/project-files/marketplace` (copia del repo y bundle; solo existe en el proyecto de Claude) |

## Hitos de la Directriz maestra 02

| Hito | Qué es | Estado |
|---|---|---|
| A | Instalar en el Android físico de Oliver | Hecho: APK 4 instalado en su Samsung (2026-10-09 ~20:40Z) |
| B | Catálogo remoto visible y acceso (registro con código) | Hecho: catálogo demo cargado; registro con código probado; registro sin confirmación para testers observado activo el 2026-10-09 22:40Z |
| C | Inicio nuevo e identidad Electric Violet | Hecho y publicado por EAS Update: Inicio de tienda, 20 pantallas revisadas en claro y oscuro, logos de tiendas, panel con la misma tipografía y marca. Identidad nativa violeta en APK 5; Frente A V2 publicado |
| D | Rediseño del recorrido comercial completo | En curso: selector de pago rediseñado y publicado. Ficha, carrito, checkout, cuotas y seguimiento revisados en web; carrito visitante validado V2 en Android. Checkout con cuenta/cuotas/seguimiento esperan revisión actual Android (`PENDIENTES.md` 1.3) |
| E | Validación integral | En curso: V2 visitante en APK 5, claro/oscuro, 6/6 (un reintento). Recorrido con cuenta anterior en revisión 20; no repetido en V2. Teléfono físico pendiente |

## Qué funciona hoy (verificado)

- Backend del proyecto de pruebas en Supabase, comprobado con el conector el 2026-10-09 22:00Z: 23 migraciones
  aplicadas (las mismas 23 de `supabase/migrations`), funciones `rates-sync` y `push-dispatch` activas (versión 1,
  con la validación del token de tareas), 6 trabajos de `pg_cron`, última tasa leída 21:30Z, 43 productos
  demo, 1 usuario (Oliver) y 2 pedidos de prueba.
- Histórico APK 4 en el teléfono de Oliver: canal `preview`, runtime `a4682c83…` (no recibe los updates de APK 5). La
  sesión cifrada en Android quedó corregida en la actualización del 2026-10-09 21:14Z: el emulador Android 15
  con el APK 4 dice «Sesión cifrada: sí» después de reabrir. En un teléfono real todavía no se ha comprobado.
- Últimas actualizaciones publicadas al APK 4 (todas con el runtime `a4682c83…`): sesión corregida, registro
  sin código cuando el proyecto lo permite, etiquetas legibles sobre fotos en oscuro, selector de pago nuevo.
- Tarjetas de producto simplificadas (pedido de Oliver del 2026-10-10 12:57Z, commit `1e3ca57`): solo imagen,
  nombre en una línea con puntos suspensivos y precio; descuento y «Quedan N» discretos arriba a la izquierda de la
  foto. Tienda, disponibilidad y entrega siguen en la ficha. Publicado al APK 5 por EAS Update (runtime sin cambios).
- Selección del método de pago más simple (pedido de Oliver del 2026-10-10 13:17Z): lista compacta con icono, nombre
  y selector (`RadioRow`, el mismo de las opciones de envío); al elegir un método se abre «Pagarás ≈ monto» con la
  conversión o el descuento, la comisión y la nota del método. Los límites siguen en la fila. Mismos cálculos de
  estimación que antes; el monto exacto sigue saliendo de la cotización del servidor. Publicado al APK 5.
- Ficha de producto más clara (pedido de Oliver del 2026-10-10 14:17Z, commit `e18f794`): un solo precio principal
  (con el anterior tachado si hay oferta); sin la píldora de Zelle/USDT ni la línea en bolívares, que se ven al
  elegir el método al pagar; sin «Disponible» fijo: solo se muestra el estado cuando no es el normal («Agotado» en
  una etiqueta sólida con el precio en gris; «Por encargo» o «En camino» con el plazo corto) o «Quedan N». El plazo
  y la fecha estimada pasaron a la fila «Entrega»; «Opiniones» vacía es una línea. Sin cambios de cálculos, carrito
  ni base de datos. Publicado al APK 5 por EAS Update.
- Tiendas: compartir e insignias (pedido de Oliver del 2026-10-10 14:36Z, commit `096828d`, detalle en
  `docs/INSIGNIAS_TIENDAS.md`). La página de cada tienda tiene «Compartir» con el enlace, el menú nativo y «Copiar
  enlace»; el enlace es `/tienda/<slug>` y, sin dominio propio todavía, en la app es `kora://tienda/<slug>` (abre esa
  tienda en la app instalada; sin la app no abre). Insignia reutilizable (`StoreBadge`): dorada para la tienda de la
  plataforma (`kind = 'platform'`, hoy solo «Kora»); la verificada (morada) y la asociada (gris) están diseñadas pero
  ninguna tienda las muestra porque no existe el dato. Se quitó «Vendedor verificado», que salía en todas las tiendas.
  Sin migraciones. Publicado al APK 5 por EAS Update.
- Foto de perfil (pedido de Oliver del 2026-10-10 15:09Z): en Cuenta, tocar la foto (o las iniciales) abre la
  galería con recorte cuadrado y compresión; se previsualiza y se guarda con «Usar esta foto» o se descarta con
  «Cancelar»; con foto, la hoja permite cambiarla o quitarla (vuelven las iniciales). Se guarda en un bucket privado
  nuevo `avatars` (3 MB, JPG/PNG/WebP), una carpeta por usuario; solo el dueño la lee, sube o borra, y el perfil solo
  puede apuntar a su carpeta (migración `20261010151906_avatars`, aplicada en el proyecto de pruebas y comprobada con
  roles simulados). `profiles.avatar_path` ya existía. `expo-image-picker` ya está en el APK 5: basta EAS Update.
  En el emulador Android 15 (revisión 30, run 38064708597), el APK 5 con la actualización `01a1266c` abre el
  selector de fotos de Android desde Cuenta y vuelve sin cambios al cerrarlo. Elegir y guardar una foto real en un
  teléfono queda para la prueba de Oliver.
- **Frente A V2 terminado** (2026-10-10): tarjetas integradas, cabecera con avisos/carrito reales,
  Favoritos en Cuenta/productos, barra Inicio · Buscar · Carrito · Cuenta expandible e Inicio refinado.
  App local 52 + 1 omisión, Android 15 APK 5 claro/oscuro 6/6 (un reintento), capturas comparativas y axe AA.
  EAS preview run 38079470216 y production run 38080468671 **Success**; mismo paquete validado/runtime APK 5.
  Production grupo `92b6bef2-56e7-4a3e-8012-40c030c48434`; inventario EAS: **0 builds production compatibles**.
  APK 5 recibe por preview. Detalle/pruebas/límites: `docs/FRENTE_A_V2.md`. Sin APK nuevo ni servicios alterados.
- UX-04 (HAYAZGO, Frente A, 2026-10-10): barra **Inicio · Buscar · Carrito · Cuenta**; catálogo existente
  `/explore` con encabezado Buscar; retirado el botón contiguo de filtros de Inicio que abría el mismo destino.
  Se conservan filtros, categorías, Favoritos y contexto. Pruebas locales y revisión visual claras/oscuras
  cerradas. Publicado al APK 5 por EAS Update desde `0a34aae`,
  [run 38072209661](https://github.com/somosoudy-design/marketplace/actions/runs/38072209661) en verde;
  guard de runtime `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba` superado antes de publicar. Falta revisión de Oliver.
- APK 5 (build `d1d10c28`, runtime `eb5ed117…`), en el emulador Android 15 de GitHub Actions el 2026-10-10 (revisión
  20, run 38027029394): se instala encima del APK 4, recibe EAS Update, «atrás» de Android vuelve a la pantalla
  anterior, y un aviso push real («Pedido P-… recibido») llega por `push-dispatch`, Expo y Firebase, y al tocarlo
  abre el pedido. Recibo de Expo «ok» (entregado a Firebase). Capturas en
  `/mnt/project-files/marketplace/telefono/capturas-apk5/`.
- En local, con el stack sin Docker: todas las suites en verde en esta sesión (ver «Pruebas»).

## Mejora de UI/UX (hecha el 2026-10-10)

Pedido de Oliver del 2026-10-10 01:30Z: perfeccionar la app sin rediseñarla ni cambiar la identidad, por hitos, con
commit y push al cerrar cada uno y publicación solo por EAS Update compatible con el APK 4 (un APK nuevo, solo con
su autorización). Restricciones: no tocar el motor de precios, ni iOS, ni Firebase, ni agregar funciones al panel,
ni borrar datos demo, ni hacer la interfaz más compacta.

| Hito | Qué | Estado |
|---|---|---|
| 1 | Navegación, Favoritos y accesos al panel | Hecho: cuatro pestañas con nombre (Inicio, Explorar, Carrito, Cuenta); Favoritos es una pantalla aparte que se abre con el corazón junto a la campana del Inicio y desde Cuenta; los accesos «Panel de vendedor» y «Administración» abren https://kora-panel.expo.app (la variable `EXPO_PUBLIC_PANEL_URL` no estaba en el perfil `preview`; va en `UPDATE_ONLY_ENV` del workflow de actualizaciones porque `eas.json` cambia la huella). Runtime sin cambios (`a4682c83…`). En el emulador (APK 4 con la actualización): Favoritos abre bien y el recorrido con cuenta pasó, pero «atrás» de Android cierra la app en vez de volver (desde Favoritos, la ficha o iniciar sesión). Causa nativa comprobada, no de esta mejora: ver «Errores conocidos». La flecha de Favoritos sí vuelve a Inicio |
| 2 | Fichas de producto y presentación comercial | Hecho en código y pruebas web (la píldora de divisas y la línea de bolívares salieron de la ficha el 2026-10-10 14:29Z, ver arriba): marca sobre el título; precio principal con descuento si hay precio anterior; precio especial con Zelle/USDT como píldora verde; bolívares en una línea discreta que abre «Precios y tasa de cambio» (ahora explica el precio en divisas); nota de demostración compacta; cada opción con su precio cuando difieren; tarjeta «Vendido por» con reputación; «Características» y descripción larga plegada; barra con «Agregar» y «Comprar» (agrega y abre el carrito, sin duplicar si ya se agregó). Fórmulas sin tocar |
| 3 | Opiniones y calificaciones más visibles (sin reconstruir el sistema) | Hecho y publicado al APK 4 (actualización de `45f62a0`): la sección «Opiniones» siempre está en la ficha (con «Aún no hay opiniones de este producto» cuando no hay) y dice quién puede opinar; «Calificar tu compra» en la ficha para quien recibió ese producto y no lo calificó; arriba del pedido entregado, «¿Qué tal te llegó?» con «Calificar»; «Compra verificada» con ícono y la respuesta de la tienda en un bloque con su nombre. Sin cambios en la base de datos (consulta nueva `reviews.deliveredItems` con las reglas de acceso existentes) |
| 4 | Preguntas y respuestas | Evaluado, sin implementar en la app: responder exige una pantalla nueva de vendedor, y Oliver pidió no agregar funciones al panel ni botones que no funcionen. Diseño listo y la decisión que falta en `docs/PREGUNTAS_Y_RESPUESTAS.md` |
| 5 | Pulido visual y validación en Android; informe de 7 puntos a Oliver | Hecho en parte: el cambio de bolívares a divisas pesa menos (píldora «con Zelle/USDT», línea de bolívares discreta, «Cómo calculamos los montos» y «Ver cálculo» al pagar, tiempo del monto con unidades), publicado con el hito 3. Emulador (revisión 15): recorrido con cuenta, ficha, Favoritos y flecha de Favoritos bien. Informe enviado a Oliver |

## Trabajo en curso

**iOS Personal Team — preparación en curso.** Base `cf7a1b9` sincronizada, sin WIP ajeno. AGENTS/estado/pendientes/Frente A V2 revisados; Frente A V2 terminado y recepción Android confirmada. Entorno Linux sin Xcode, simulador ni acceso al Mac/iPhone. Configuración actual añade Associated Domains y el plugin `expo-notifications` añade APNs: ambos impiden firma gratuita. Preparar proyecto generado ignorado, sin modificar `apps/mobile` ni el runtime de APK 5. Validación y guía Mac pendientes; no se ha compilado ni instalado iOS.


**Recepción en Android confirmada por Oliver:** «ya se actualizó» (2026-10-10). La entrega al APK instalado
queda confirmada por el propietario; no equivale a haber probado todos los recorridos en su teléfono.

**Aclaración vigente de Oliver:** «producción» significaba que la app de su Android se actualice
directamente. Para su APK 5, las publicaciones autorizadas deben llegar al canal **preview**, ya integrado
en ese APK. No interpretar esa palabra como cambiar al canal EAS production. V2 ya está publicado en
preview y comprobado en el APK 5 del emulador; no hace falta republicar, cambiar configuración ni instalar
otro APK. La publicación adicional en production queda como antecedente, sin consumidor APK 5 por ese canal.

**Frente A V2 cerrado; no hay WIP activo de este agente.** Continuidad desde `9e4e1f5`, últimos cambios
UX-04 revisados y regresión inicial 16/16. El pedido V2 autoriza Inicio/descubrimiento; no autoriza Frente B.
Fuente de la interfaz validada `b60b2cc`; publicación production solicitada en `d62b1fa`.

Tarjetas compartidas integradas y favoritas independientes; cabecera con contadores reales; barra común
expandible de cuatro destinos (44 px mínimo, 180 ms/movimiento reducido); secciones existentes refinadas,
virtualización/tracking conservados y contenido demo rotulado. Electric Violet y marca/configuración nativa
existente conservados. Decisiones/archivos: `docs/FRENTE_A_V2.md`.

Pruebas: tipos/lint sin errores; core **50/50**, API **12/12**, admin **28/28**, app **52 aprobadas + 1 omitida**
(confirmación de correo activa en local), panel **9/9**, guardas production **4/4**. App incluye 13 casos V2 y
6 de navegación UX-04. axe **0 infracciones en 8 pantallas/temas**, 320 px; contraste texto seleccionado AA.
Android 15 con APK 5 existente: **6/6**, visitante oscuro al segundo intento; informe conserva ese fallo inicial
sin identificar su paso. No afirmar seis pases al primer intento. Favoritos/Atrás y carrito visitante comprobados.
Checkout completo/cuenta y distintos estados comerciales probados en local; no compra/pago/push remoto.

Evidencia: `.local/frente-a-v2/comparacion.html`, galería autónoma web antes (40)/después (50) + 10 capturas
Android de ambos temas; `.local/frente-a-v2/android/` copiado de `ci/capturas` run 38079644334.
Diagnóstico al reabrir: OTA `01a12744-8ffc-7c8b-bfb0-b32cfae9a11e`, canal preview, runtime APK 5,
sesión cifrada sí. Capturas muestran el aviso conocido de tasa del día no disponible; no se modifica su lógica.
Recepción Android confirmada por Oliver («ya se actualizó»). Sin prueba física de lector, rendimiento o push en este turno.

Publicación autorizada por Oliver en **production**: [run 38080468671](https://github.com/somosoudy-design/marketplace/actions/runs/38080468671) **Success**.
Grupo production `92b6bef2-56e7-4a3e-8012-40c030c48434`, promovido del grupo preview
`5abecd05-a0e4-4d5c-ae6f-79b30984b4a2` sin reconstruir. El promotor comprobó los runs preview
38079470216 / Android 38079644334 aprobados, commits exactos, APK/recorridos/temas y código/dependencias
idénticos. Runtime `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`.
Inventario EAS: **0 builds Android terminados con canal production y este runtime**. APK 5 (`d1d10c28`)
consume preview, donde también conserva esta versión validada. No cambiar su canal/perfil ni crear un APK.

Sin cambios en motor financiero, SQL, Supabase remoto, Firebase, panel, nombre definitivo, dependencias,
configuración nativa ni Frente B. Registro de cierre en `docs/HISTORIAL_AGENTES.md`.

Pendiente heredado, independiente de UX-04:

Pedido de Oliver del 2026-10-10 03:50Z: «Compilar APK 5 con notificaciones push». Hitos 1 a 5 hechos; solo falta la
prueba de push en el teléfono de Oliver.

| Hito | Qué | Estado |
|---|---|---|
| 1 | Push | Hecho: Firebase `hayazgo` con el paquete `com.example.kora.preview` y clave FCM V1 del mismo proyecto (comprobado por `firebase-check.yml`); canal de Android «Pedidos y pagos»; registro al activar «Avisos en este dispositivo» y al entrar si ya hay permiso; el token se borra al cerrar sesión; tocar un aviso abre el pedido. `push-dispatch` solo envía a los dispositivos del destinatario y nunca avisos demo o de prueba |
| 2 | «Atrás» de Android | Hecho: `predictiveBackGestureEnabled: false` (manifiesto del APK 5 con `enableOnBackInvokedCallback=false`) |
| 3 | Identidad nativa violeta | Hecho: icono, splash y color de avisos (`NATIVE_IDENTITY = 'violet'`). Mismo nombre, paquete y configuración de producción |
| 4 | Compilación | Hecho: build `d1d10c28`, versionCode 4, misma firma que el APK 4, Supabase de pruebas, canal `preview` |
| 5 | Pruebas en el emulador | Hecho (revisión 20): los cinco recorridos pasan al primer intento. Ver «Pruebas» |

Preguntas y respuestas sigue pospuesto por Oliver (`PENDIENTES.md` 2.5). Del relevo anterior siguen abiertos: la
regla comercial del motor de precios (`pricing.import.configured = false`, la define Oliver) y el cambio del
repositorio a privado (lo hace Oliver).

## Próxima acción

Completar `tools/ios/` y `docs/IOS_PERSONAL_TEAM.md`: variante local, guardas de backend/entitlements,
exportación iOS y regresión web local. No publicar ni compilar en EAS. Luego Oliver ejecuta Xcode/Personal Team
en su Mac y verifica el iPhone; el agente cloud se detiene antes de ese paso físico.

## Pendiente de Oliver (solo él puede hacerlo)

1. ~~Desactivar «Confirm email»~~: el workflow del emulador lo encontró desactivado el 2026-10-09 22:40Z
   (`/auth/v1/settings` → `mailer_autoconfirm: true`). Hecho.
2. Supabase › Authentication › URL Configuration › Redirect URLs: agregar `kora://**`.
3. Dar acceso al repositorio de GitHub a Kevin y Heisber si van a trabajar con sus propios agentes.
4. Instalar el APK 5 en su Samsung y probar los avisos push (`que-probar.md`).
5. Más adelante: dominio y SMTP propio (vuelve el código por correo), credenciales de Binance Pay y PayPal. Detalle en `docs/SERVICIOS_EXTERNOS.md`.

## Errores conocidos

- Tasa BCV vencida desde el 2026-10-10 13:20Z: la última de DolarApi («oficial») es del 2026-10-09 04:00Z y la regla
  de `rate_policies` (USD/VES, 2000 minutos) la da por vencida. Mientras tanto no se cotiza en bolívares (Pago Móvil,
  transferencia) y la app lo dice al elegir el método; Zelle y USDT siguen. Es el comportamiento previsto (nunca usar
  una tasa vencida); se arregla solo cuando la fuente publique, o con una tasa manual en el panel. Decisión de Oliver.
- APK 4 (y anteriores): «atrás» de Android cierra la app en Android 13 a 15. Corregido en el APK 5.
- Push comprobado solo en el emulador Android 15; en un teléfono real falta la prueba de Oliver. Los pedidos de
  prueba (también los del emulador automático) avisan a Oliver como dueño de la tienda demo «Kora» cuando tenga
  los avisos activados.
- Maestro a veces pierde el emulador unos segundos y un recorrido falla al empezar (revisión 18): el script
  repite una vez el recorrido que falla y deja el primer fallo en el resumen.
- Sin SMTP propio, «Olvidé mi contraseña» y el código de registro solo llegan a correos del equipo de
  Supabase de Oliver (límite de unas 2 por hora).
- El panel publicado abre las fichas desde las listas con una carga completa la primera vez que se visitan (sitio
  estático); funciona igual.
- Los artefactos de GitHub Actions no se pueden bajar desde el contenedor de Claude: usar la rama `ci/capturas`.
- `pnpm stack:start` sobre un stack ya encendido deja PostgREST y funciones sin arrancar («Address in use»):
  usar `pnpm stack:stop` antes.
- `gh run view --log` a veces da 403 al bajar registros; leerlos con la herramienta `get_job_logs` del
  conector de GitHub o por la API de jobs.

## Pruebas

Validación actual **Frente A V2**, base `9e4e1f5`, mismo stack local: tipos/lint sin errores, núcleo 50/50,
admin 28/28, API 12/12, app **52 aprobadas + 1 omitida**, panel 9/9. App incluye 13 casos V2 y 6 de navegación
UX-04. axe: 0 infracciones en 8 pantallas/temas a 320 px; contraste de texto seleccionado AA. Galería web autónoma
`.local/frente-a-v2/comparacion.html`, 40 capturas antes / 50 después. Guardas del promotor production 4/4.
Preview fuente `b60b2cc`: run 38079470216 Success, runtime exacto APK 5 comprobado. Android revisión 31 **Success**, 6/6 (1 reintento); production run 38080468671 **Success**, grupo `92b6bef2…`, cero builds consumidores compatibles registrados. Sin validación en teléfono ni TalkBack/VoiceOver físicos. Detalle y límites en
`docs/PRUEBAS.md` / `docs/FRENTE_A_V2.md`.

Validación **anterior** UX-04 (2026-10-10, entorno Codex cloud, Node 24.19.0, pnpm 10.28.0, Postgres 17.11,
backend local sin Docker y Chromium; datos demo locales):

| Suite | Resultado |
|---|---|
| Tipos y lint | Sin errores |
| Núcleo / panel unitario | 50/50 y 28/28 |
| API de compra y avatar | 12/12 |
| App Playwright, exportación web Pixel 7 | 39 aprobadas, 1 omitida (`signup-without-email`, requiere `AUTH_AUTOCONFIRM=true`; local usa confirmación) |
| Navegación UX-04, incluidos en la app | 6/6, claro y oscuro |
| Panel Playwright entre roles | 9/9 |
| Revisión visual | Inicio, Buscar, Carrito y Cuenta en claro/oscuro, Pixel 7; Inicio/Buscar también a 340 px |

No ejecutadas para UX-04: suites SQL/funciones (sin cambios en ellas) ni emulador/teléfono.
La recepción de esta actualización en el Samsung queda para la revisión de Oliver.

Resultados históricos (2026-10-09, stack local):

| Suite | Comando | Resultado |
|---|---|---|
| App, Playwright (Pixel 7) | `pnpm test:ui` | 21 pasan, 1 omitida a propósito (`signup-without-email`, corre solo con `AUTH_AUTOCONFIRM=true`; pasó así) |
| Panel entre roles | `pnpm test:panel` | 8/8 |
| Panel unitario | `pnpm test:admin` | 28/28 |
| Núcleo | `pnpm --filter @kora/core test` | 43/43 |
| Catálogo remoto en base aparte | `pnpm test:remote-catalog` | todas pasan |
| Tipos y lint | `pnpm typecheck && pnpm lint` | sin errores |

No ejecutadas en aquella sesión: `pnpm test:db` (76), `pnpm test:e2e` (8) y `pnpm test:functions` (11); pasaron la
última vez que se tocó la base (ver `docs/PRUEBAS.md`) y desde entonces no cambió ninguna migración ni función.

En el APK real (GitHub Actions, Android 15, pantalla de Pixel 6), revisión 15 del 2026-10-10 con el APK 4 y la
actualización de los hitos 1 a 3: `02-cuenta` (registro, carrito, dirección, checkout, métodos, monto, cancelar) y
`01b` (flecha de Favoritos) pasan; `01a` y `01c` fallan por «atrás» de Android (error conocido); `01-visitante`
falló por el toque a la variante. Revisión 16 (`62e393f`): `01-visitante` pasa (variante de 2 m, «Agregar»,
«Comprar» abre el carrito con 12 USD sin duplicar, carrito conservado al reabrir), igual que `01b` y `02-cuenta`.

APK 5 (revisiones 17 a 20 del 2026-10-10, APK 4 instalado y luego el 5 encima): instalación encima «Success»,
actualización recibida al reabrir, `01-visitante`, `01a` y `01c` («atrás» desde la ficha, Favoritos e iniciar sesión
vuelve a Inicio), `01b` y `02-cuenta` pasan. `02-cuenta` ahora también: permiso de avisos rechazado y luego dado
(«Avisos activados en este dispositivo.»), aviso push real del pedido tocado desde otra pantalla que abre el pedido,
sesión conservada al reabrir, cerrar sesión y volver a entrar. En la base: el aviso solo fue al token de la cuenta de
prueba, recibo «ok», y al cerrar sesión el token se borró y se registró de nuevo al entrar.

App, Playwright, 2026-10-10 con el APK 5: 29 pasan, 1 omitida. Con los hitos 1 a 3: 28 pasan, 1 omitida; `pay-divisas.spec.ts` (nueva) pasa sola.

Faltan: pruebas en un teléfono físico
más allá de lo que Oliver prueba a mano.

## Servicios externos (estado vivo)

Resumen; procedimientos en `docs/ENTORNO.md`.

| Servicio | Estado |
|---|---|
| Supabase de pruebas `mimnotafmfasvwrclxan` («Marketplace») | 24/24 migraciones (última `20261009233831_pricing_engine`), 4 funciones (`rates-sync`, `push-dispatch`, `panel-api`, `assets-mirror` de uso único), 7 trabajos de cron (nuevo `kora-pricing-snapshot`, hora :40), brecha del día vigente, imágenes demo en Storage, registro sin confirmación por correo |
| EAS Hosting | Panel en https://kora-panel.expo.app (mismo proyecto Expo `marketplacebrand/marketplace`, plan sin costo) |
| Supabase `bfuggvbgttvcygbexqyn` | **Prohibido tocarlo**: es de otros productos de Oliver (BingoCriollo) |
| Expo `marketplacebrand/marketplace` | APK 5 (build `d1d10c28`, versionCode 4, runtime `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`); Frente A V2 publicado en preview y production; APK 5 consume preview, inventario production compatible 0. `GOOGLE_SERVICES_JSON` (archivo, entorno preview) y clave FCM V1 cargadas por Oliver. El APK 4 ya no recibe actualizaciones |
| GitHub Actions | `eas-android-preview.yml` (APK), `eas-update-preview.yml` (actualización), `eas-update-production.yml` (promoción del bundle validado), `apk-verify.yml`, `apk-emulator.yml` (capturas también en la rama `ci/capturas`), `firebase-check.yml` (Firebase y credenciales de EAS), `panel-deploy.yml` (panel); secreto `EXPO_TOKEN` configurado |
| Google Play / App Store | Nada publicado. Oliver dijo que todavía no |
| Binance Pay, PayPal | Preparados en código, deshabilitados (`pending_credentials`) |

## Cómo retomar

```bash
git fetch origin && git checkout claude/marketplace-v1 && git pull --ff-only
git log --oneline -10
pnpm install
pnpm stack:start && pnpm db:reset      # backend local con datos demo
pnpm test:ui                           # comprueba que la app sigue verde
# luego la «Próxima acción» de arriba o la primera tarea de docs/PENDIENTES.md
```
