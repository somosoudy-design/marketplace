# Estado actual de Kora

> Documento vivo. Lo actualiza el agente que trabaja, en cada checkpoint (cada 20–30 minutos de trabajo, al
> cerrar un módulo y antes de ceder el turno). Si algo de aquí no coincide con el repositorio o con los
> servicios, gana lo que compruebes y corriges este archivo.

**Última actualización:** 2026-10-09 23:20Z, por Claude (sesión de Claude Code en la nube; relevo pedido por Oliver
con las prioridades: Android, panel publicado, push, imágenes a Storage, motor de precios).

## Dónde está el trabajo

| Dato | Valor |
|---|---|
| Repositorio | https://github.com/somosoudy-design/marketplace (público: nunca subir secretos) |
| Rama compartida | `claude/marketplace-v1` (todos los agentes trabajan aquí; ver `AGENTS.md`) |
| PR | #1 en borrador hacia `main` (`main` solo tiene el README inicial; no fusionar sin Oliver) |
| Último commit confirmado | `git log -1 origin/claude/marketplace-v1`. Antes de este checkpoint era `dc93a53` («Publish an update for APK 4: clearer payment picker») |
| Plan vigente | Directriz maestra 02 de Oliver: hitos A a E (abajo) |
| Objetivo actual | Relevo del 2026-10-09 23Z: Android (D/E), panel publicado (hecho), push, imágenes a Storage, motor de precios |
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
- En local, con el stack sin Docker: todas las suites en verde en esta sesión (ver «Pruebas»).

## Trabajo en curso

- Archivos sin commit: ninguno. Commits `WIP:` abiertos: ninguno (el `WIP: Panel as a static export` quedó
  completado por los commits siguientes).
- **Panel publicado** en https://kora-panel.expo.app (workflow `panel-deploy.yml`, EAS Hosting sin costo). Las
  acciones de servidor (importar por URL, publicar importación, «Consultar ahora» de tasas) corren en la función
  `panel-api`, ya desplegada en el proyecto de pruebas (versión 1, `verify_jwt`, comprueba `is_admin`). Fichas
  con id en la dirección (`/admin/pedidos/ver?id=…`, `/vendedor/productos/editar?id=…`).
- **Android:** las capturas del emulador ya se pueden ver (rama `ci/capturas`). El recorrido de visitante pasa
  con la identidad Electric Violet en el APK 4 + actualización. El recorrido con cuenta (`02-cuenta.yaml`) ya
  corre porque el proyecto de pruebas tiene el registro sin confirmación (lo detecta el workflow); revisión 10 en
  curso (la 9 falló porque `clearState` borraba la actualización descargada).
- Ajuste de diseño sin publicar todavía: la barra superior de la ficha y de la tienda se vuelve opaca antes de
  que la foto pase por debajo de los botones (`components/ui/Bars.tsx`). Va en la próxima EAS Update.

## Próxima acción

1. Ver el resultado de la revisión 10 del emulador (`git fetch origin ci/capturas`, carpeta `ultima/`) y
   corregir `02-cuenta.yaml` o la app según lo que muestre.
2. **Motor comercial de precios** (pedido por Oliver, diseño en `docs/PRECIOS.md` cuando exista): costo Amazon por
   variante, flete editable, gastos logísticos, margen, brecha BCV/USDT con instantánea diaria, precio principal
   en USD BCV, Pago Móvil en Bs al BCV, Zelle/USDT con la brecha aplicada una sola vez como factor de conversión
   verificable.
3. Imágenes del catálogo remoto: de `raw.githubusercontent.com` a Supabase Storage (función temporal invocada con
   `pg_net`), antes de proponer a Oliver hacer privado el repositorio.
4. Push en Android: preparar `google-services.json` desde un secreto de GitHub y el APK 5 (identidad violeta).

## Pendiente de Oliver (solo él puede hacerlo)

1. ~~Desactivar «Confirm email»~~: el workflow del emulador lo encontró desactivado el 2026-10-09 22:40Z
   (`/auth/v1/settings` → `mailer_autoconfirm: true`). Hecho.
2. Supabase › Authentication › URL Configuration › Redirect URLs: agregar `kora://**`.
3. Dar acceso al repositorio de GitHub a Kevin y Heisber si van a trabajar con sus propios agentes.
4. Más adelante: dominio y SMTP propio (vuelve el código por correo), credenciales de Binance Pay, PayPal y
   Firebase (push en Android), hosting del panel web. Detalle en `docs/SERVICIOS_EXTERNOS.md`.

## Errores conocidos

- Sin SMTP propio, «Olvidé mi contraseña» y el código de registro solo llegan a correos del equipo de
  Supabase de Oliver (límite de unas 2 por hora).
- Push en Android no funciona hasta tener Firebase (`google-services.json`) en una build.
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

En el APK real (GitHub Actions, Android 15, pantalla de Pixel 6): `tests/apk-flows/visitante.yaml` con Maestro,
en verde (2026-10-09 22:21Z).

Faltan: recorrido en el APK real con cuenta (registro, compra, pago simulado) y pruebas en un teléfono físico
más allá de lo que Oliver prueba a mano.

## Servicios externos (estado vivo)

Resumen; procedimientos en `docs/ENTORNO.md`.

| Servicio | Estado |
|---|---|
| Supabase de pruebas `mimnotafmfasvwrclxan` («Marketplace») | 23/23 migraciones, 3 funciones desplegadas (`rates-sync`, `push-dispatch`, `panel-api`), cron activo, catálogo demo cargado, registro sin confirmación por correo |
| EAS Hosting | Panel en https://kora-panel.expo.app (mismo proyecto Expo `marketplacebrand/marketplace`, plan sin costo) |
| Supabase `bfuggvbgttvcygbexqyn` | **Prohibido tocarlo**: es de otros productos de Oliver (BingoCriollo) |
| Expo `marketplacebrand/marketplace` | APK 4 (build `5ee104fe`, versionCode 2, runtime `a4682c83c1bb738fc74c73153838ded0656f1912`); actualizaciones por canal `preview` |
| GitHub Actions | `eas-android-preview.yml` (APK), `eas-update-preview.yml` (actualización), `apk-verify.yml`, `apk-emulator.yml` (capturas también en la rama `ci/capturas`), `panel-deploy.yml` (panel); secreto `EXPO_TOKEN` configurado |
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
