# Estado actual de Kora

> Documento vivo. Lo actualiza el agente que trabaja, en cada checkpoint (cada 20–30 minutos de trabajo, al
> cerrar un módulo y antes de ceder el turno). Si algo de aquí no coincide con el repositorio o con los
> servicios, gana lo que compruebes y corriges este archivo.

**Última actualización:** 2026-10-10 13:30Z, por Claude (sesión en la nube, hilo «Marketplace nativo premium»).

## Dónde está el trabajo

| Dato | Valor |
|---|---|
| Repositorio | https://github.com/somosoudy-design/marketplace (público: nunca subir secretos) |
| Rama compartida | `claude/marketplace-v1` (todos los agentes trabajan aquí; ver `AGENTS.md`) |
| PR | #1 en borrador hacia `main` (`main` solo tiene el README inicial; no fusionar sin Oliver) |
| Último commit confirmado | `git log -1 origin/claude/marketplace-v1`. Antes de este checkpoint era `3e6ff38` (emulador con las tarjetas simplificadas) |
| Plan vigente | «Compilar APK 5 con notificaciones push» (Oliver, 2026-10-10 03:50Z), hitos 1 a 5. Antes, «Mejora profesional de UI/UX» (hecha) y Directriz maestra 02 |
| Objetivo actual | APK 5 compilado y probado en el emulador (push real incluido). Falta que Oliver lo instale en su Samsung S24 y pruebe un aviso push |
| Panel publicado | **https://kora-panel.expo.app** (EAS Hosting; cuentas reales del proyecto de pruebas, no las demo locales) |
| Respaldo extra | `/mnt/project-files/marketplace` (copia del repo y bundle; solo existe en el proyecto de Claude) |

## Hitos de la Directriz maestra 02

| Hito | Qué es | Estado |
|---|---|---|
| A | Instalar en el Android físico de Oliver | Hecho: APK 4 instalado en su Samsung (2026-10-09 ~20:40Z) |
| B | Catálogo remoto visible y acceso (registro con código) | Hecho: catálogo demo cargado; registro con código de 6 dígitos hecho y probado; registro sin confirmación para testers decidido (falta el clic de Oliver, ver «Pendiente de Oliver») |
| C | Inicio nuevo e identidad Electric Violet | Hecho y publicado por EAS Update: Inicio de tienda, 20 pantallas revisadas en claro y oscuro, logos de tiendas, panel con la misma tipografía y marca. Lo nativo violeta (icono, splash) espera al APK 5 |
| D | Rediseño del recorrido comercial completo | En curso: selector de pago rediseñado y publicado. Ficha, carrito, checkout, cuotas y seguimiento revisados en la versión web; falta verlos en Android (`PENDIENTES.md` 1.3) |
| E | Validación integral | En curso: recorrido de visitante automático en el APK real, en verde. Falta el recorrido con cuenta (espera «Confirm email») |

## Qué funciona hoy (verificado)

- Backend del proyecto de pruebas en Supabase, comprobado con el conector el 2026-10-09 22:00Z: 23 migraciones
  aplicadas (las mismas 23 de `supabase/migrations`), funciones `rates-sync` y `push-dispatch` activas (versión 1,
  con la validación del token de tareas), 6 trabajos de `pg_cron`, última tasa leída 21:30Z, 43 productos
  demo, 1 usuario (Oliver) y 2 pedidos de prueba.
- APK 4 en el teléfono de Oliver recibe las actualizaciones de JavaScript (EAS Update, canal `preview`). La
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
| 2 | Fichas de producto y presentación comercial | Hecho en código y pruebas web: marca sobre el título; precio principal con descuento si hay precio anterior; precio especial con Zelle/USDT como píldora verde; bolívares en una línea discreta que abre «Precios y tasa de cambio» (ahora explica el precio en divisas); nota de demostración compacta; cada opción con su precio cuando difieren; tarjeta «Vendido por» con reputación; «Características» y descripción larga plegada; barra con «Agregar» y «Comprar» (agrega y abre el carrito, sin duplicar si ya se agregó). Fórmulas sin tocar |
| 3 | Opiniones y calificaciones más visibles (sin reconstruir el sistema) | Hecho y publicado al APK 4 (actualización de `45f62a0`): la sección «Opiniones» siempre está en la ficha (con «Aún no hay opiniones de este producto» cuando no hay) y dice quién puede opinar; «Calificar tu compra» en la ficha para quien recibió ese producto y no lo calificó; arriba del pedido entregado, «¿Qué tal te llegó?» con «Calificar»; «Compra verificada» con ícono y la respuesta de la tienda en un bloque con su nombre. Sin cambios en la base de datos (consulta nueva `reviews.deliveredItems` con las reglas de acceso existentes) |
| 4 | Preguntas y respuestas | Evaluado, sin implementar en la app: responder exige una pantalla nueva de vendedor, y Oliver pidió no agregar funciones al panel ni botones que no funcionen. Diseño listo y la decisión que falta en `docs/PREGUNTAS_Y_RESPUESTAS.md` |
| 5 | Pulido visual y validación en Android; informe de 7 puntos a Oliver | Hecho en parte: el cambio de bolívares a divisas pesa menos (píldora «con Zelle/USDT», línea de bolívares discreta, «Cómo calculamos los montos» y «Ver cálculo» al pagar, tiempo del monto con unidades), publicado con el hito 3. Emulador (revisión 15): recorrido con cuenta, ficha, Favoritos y flecha de Favoritos bien. Informe enviado a Oliver |

## Trabajo en curso

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

Esperar a Oliver: instala el APK 5 encima del APK 4 en su Samsung S24 y prueba los avisos con
`/mnt/project-files/marketplace/telefono/que-probar.md`. Si dice «listo» sin hacer un pedido, enviarle un aviso de
prueba solo a su cuenta (`select public.notify(<su id>, 'system', …)` con el conector de Supabase) y comprobar el
recibo en `push_tickets`. Si el aviso no llega, mirar `notifications.push_status`/`push_error` y `push_tickets`.

## Pendiente de Oliver (solo él puede hacerlo)

1. ~~Desactivar «Confirm email»~~: el workflow del emulador lo encontró desactivado el 2026-10-09 22:40Z
   (`/auth/v1/settings` → `mailer_autoconfirm: true`). Hecho.
2. Supabase › Authentication › URL Configuration › Redirect URLs: agregar `kora://**`.
3. Dar acceso al repositorio de GitHub a Kevin y Heisber si van a trabajar con sus propios agentes.
4. Instalar el APK 5 en su Samsung y probar los avisos push (`que-probar.md`).
5. Más adelante: dominio y SMTP propio (vuelve el código por correo), credenciales de Binance Pay y PayPal. Detalle en `docs/SERVICIOS_EXTERNOS.md`.

## Errores conocidos

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

Ejecutadas en esta sesión (2026-10-09, stack local):

| Suite | Comando | Resultado |
|---|---|---|
| App, Playwright (Pixel 7) | `pnpm test:ui` | 21 pasan, 1 omitida a propósito (`signup-without-email`, corre solo con `AUTH_AUTOCONFIRM=true`; pasó así) |
| Panel entre roles | `pnpm test:panel` | 8/8 |
| Panel unitario | `pnpm test:admin` | 28/28 |
| Núcleo | `pnpm --filter @kora/core test` | 43/43 |
| Catálogo remoto en base aparte | `pnpm test:remote-catalog` | todas pasan |
| Tipos y lint | `pnpm typecheck && pnpm lint` | sin errores |

No ejecutadas en esta sesión: `pnpm test:db` (76), `pnpm test:e2e` (8) y `pnpm test:functions` (11); pasaron la
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
| Expo `marketplacebrand/marketplace` | APK 5 (build `d1d10c28`, versionCode 4, runtime `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`); actualizaciones por canal `preview`. `GOOGLE_SERVICES_JSON` (archivo, entorno preview) y clave FCM V1 cargadas por Oliver. El APK 4 ya no recibe actualizaciones |
| GitHub Actions | `eas-android-preview.yml` (APK), `eas-update-preview.yml` (actualización), `apk-verify.yml`, `apk-emulator.yml` (capturas también en la rama `ci/capturas`), `firebase-check.yml` (Firebase y credenciales de EAS), `panel-deploy.yml` (panel); secreto `EXPO_TOKEN` configurado |
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
