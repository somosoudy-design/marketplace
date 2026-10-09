# Estado actual de Kora

> Documento vivo. Lo actualiza el agente que trabaja, en cada checkpoint (cada 20–30 minutos de trabajo, al
> cerrar un módulo y antes de ceder el turno). Si algo de aquí no coincide con el repositorio o con los
> servicios, gana lo que compruebes y corriges este archivo.

**Última actualización:** 2026-10-09 22:05Z, por Claude (sesión de Claude Code en la nube, hilo «Marketplace
nativo premium» del proyecto TIENDA ONLINE).

## Dónde está el trabajo

| Dato | Valor |
|---|---|
| Repositorio | https://github.com/somosoudy-design/marketplace (público: nunca subir secretos) |
| Rama compartida | `claude/marketplace-v1` (todos los agentes trabajan aquí; ver `AGENTS.md`) |
| PR | #1 en borrador hacia `main` (`main` solo tiene el README inicial; no fusionar sin Oliver) |
| Último commit confirmado | `git log -1 origin/claude/marketplace-v1`. Antes de este checkpoint era `dc93a53` («Publish an update for APK 4: clearer payment picker») |
| Plan vigente | Directriz maestra 02 de Oliver: hitos A a E (abajo) |
| Objetivo actual | Hito E (validación integral) y cierre del hito D en Android |
| Respaldo extra | `/mnt/project-files/marketplace` (copia del repo y bundle; solo existe en el proyecto de Claude) |

## Hitos de la Directriz maestra 02

| Hito | Qué es | Estado |
|---|---|---|
| A | Instalar en el Android físico de Oliver | Hecho: APK 4 instalado en su Samsung (2026-10-09 ~20:40Z) |
| B | Catálogo remoto visible y acceso (registro con código) | Hecho: catálogo demo cargado; registro con código de 6 dígitos hecho y probado; registro sin confirmación para testers decidido (falta el clic de Oliver, ver «Pendiente de Oliver») |
| C | Inicio nuevo e identidad Electric Violet | Hecho y publicado por EAS Update: Inicio de tienda, 20 pantallas revisadas en claro y oscuro, logos de tiendas, panel con la misma tipografía y marca. Lo nativo violeta (icono, splash) espera al APK 5 |
| D | Rediseño del recorrido comercial completo | En curso: selector de pago rediseñado y publicado. Ficha, carrito, checkout, cuotas y seguimiento revisados en la versión web; falta verlos en Android (`PENDIENTES.md` 1.3) |
| E | Validación integral | Empezando: recorrido automático en el emulador con el APK real (ver «Próxima acción») |

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

- Recorrido de visitante con Maestro escrito (`tests/apk-flows/visitante.yaml`, `tools/eas/emulator-flows.sh`,
  pasos nuevos en `.github/workflows/apk-emulator.yml`) y primera corrida pedida en GitHub (revisión 5 de
  `.github/apk-emulator-request`). **Sin resultado todavía**: si este archivo sigue diciendo esto, mira la última
  ejecución de «APK en emulador» (`gh run list --workflow apk-emulator.yml --limit 1`) y su artefacto
  `capturas-emulador` (carpeta `flujos/`).
- Archivos modificados sin commit: ninguno.

## Próxima acción

**Recorrido automático con Maestro en el emulador del workflow `apk-emulator.yml`** (`PENDIENTES.md` 1.1),
contra el APK 4 con su última actualización y el backend de pruebas. Escrito; falta verlo pasar:

1. Abrir la app, esperar el Inicio con el catálogo remoto (`home-search`, `home-recommended`).
2. `kora://p/ugreen-cable-usb-c-100w`: ficha (`product-title`), elegir variante (`variant-2 m`), agregar
   (`product-cta`, luego `added-to-cart`).
3. Carrito (`cart-subtotal`; `cart-continue` dice «Iniciar sesión» para visitantes).
4. Cerrar y reabrir la app: el carrito de visitante sigue ahí.
5. `cart-continue` lleva a iniciar sesión (`sign-in-email`).

Archivos previstos: `tests/apk-flows/visitante.yaml`, `tools/eas/emulator-flows.sh` (abre la app 25 s para
que baje la actualización, la cierra y corre Maestro; copia capturas a `shots/`) y un paso nuevo en
`.github/workflows/apk-emulator.yml` que instala Maestro antes del emulador. Se dispara cambiando
`.github/apk-emulator-request`. Solo lectura sobre el backend: no crea cuentas ni pedidos. Cuando Oliver
apague «Confirm email», ampliar con registro de una cuenta `@example.com`, compra y cancelación del pedido.

## Pendiente de Oliver (solo él puede hacerlo)

1. Supabase › proyecto «Marketplace» › Authentication › Sign In / Providers › Email › desactivar **Confirm
   email** › Save. Habilita el registro de testers sin correo (solo en este proyecto de pruebas).
2. Supabase › Authentication › URL Configuration › Redirect URLs: agregar `kora://**`.
3. Dar acceso al repositorio de GitHub a Kevin y Heisber si van a trabajar con sus propios agentes.
4. Más adelante: dominio y SMTP propio (vuelve el código por correo), credenciales de Binance Pay, PayPal y
   Firebase (push en Android), hosting del panel web. Detalle en `docs/SERVICIOS_EXTERNOS.md`.

## Errores conocidos

- Sin SMTP propio, «Olvidé mi contraseña» y el código de registro solo llegan a correos del equipo de
  Supabase de Oliver (límite de unas 2 por hora).
- Push en Android no funciona hasta tener Firebase (`google-services.json`) en una build.
- El panel web solo corre en local; no está publicado.
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

Faltan: recorrido en el APK real con cuenta (registro, compra, pago simulado) y pruebas en un teléfono físico
más allá de lo que Oliver prueba a mano.

## Servicios externos (estado vivo)

Resumen; procedimientos en `docs/ENTORNO.md`.

| Servicio | Estado |
|---|---|
| Supabase de pruebas `mimnotafmfasvwrclxan` («Marketplace») | 23/23 migraciones, 2 funciones desplegadas, cron activo, catálogo demo cargado, «Confirm email» todavía activado |
| Supabase `bfuggvbgttvcygbexqyn` | **Prohibido tocarlo**: es de otros productos de Oliver (BingoCriollo) |
| Expo `marketplacebrand/marketplace` | APK 4 (build `5ee104fe`, versionCode 2, runtime `a4682c83c1bb738fc74c73153838ded0656f1912`); actualizaciones por canal `preview` |
| GitHub Actions | `eas-android-preview.yml` (APK), `eas-update-preview.yml` (actualización), `apk-verify.yml`, `apk-emulator.yml`; secreto `EXPO_TOKEN` configurado |
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
