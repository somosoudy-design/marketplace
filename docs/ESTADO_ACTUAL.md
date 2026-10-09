# Estado actual de Kora

> Documento vivo. Lo actualiza el agente que trabaja, en cada checkpoint (cada 20–30 minutos de trabajo, al
> cerrar un módulo y antes de ceder el turno). Si algo de aquí no coincide con el repositorio o con los
> servicios, gana lo que compruebes y corriges este archivo.

**Última actualización:** 2026-10-10 00:05Z, por Claude (sesión en la nube). Oliver pidió detenerse para cuidar los
créditos: este es el checkpoint de cierre del relevo.

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

## Trabajo en curso (checkpoint de cierre, 2026-10-10 00:05Z)

Archivos sin commit: ninguno. Nada a medio escribir. Qué quedó, por bloque:

- **Panel publicado:** https://kora-panel.expo.app (EAS Hosting, sin costo). Se vuelve a publicar solo con cada push
  que toque `apps/admin`, `packages/*` o `tools/panel` (workflow `panel-deploy.yml`). Acciones de servidor en la
  función `panel-api` (desplegada). Fichas con id en la consulta (`/admin/pedidos/ver?id=…`).
- **Android (APK 4 en emulador):** el recorrido de visitante pasa; el de cuenta llega hasta la cotización de Pago
  Móvil y la cancelación (revisión 11). Corregido después en el repo (sin volver a correr el emulador): la aserción
  final del recorrido y el texto «Reembolsado» de un pedido cancelado sin pagar (ahora «Cancelado»).
- **Imágenes a Storage: HECHO en el proyecto de pruebas.** 110 archivos copiados (100 fotos, 5 logos, 5 portadas) con
  la función `assets-mirror`; filas de `product_images`, `stores` y `order_items` apuntan a `demo/…` en Storage;
  comprobado que Storage los sirve (HTTP 200). Ninguna referencia a GitHub queda en datos visibles (solo en
  `audit_log`, historial). El generador del catálogo remoto ya produce rutas de Storage.
- **Motor de precios: avanzado, NO publicado a los teléfonos.** Base de datos aplicada en el proyecto de pruebas
  (migración `20261009233831_pricing_engine`, mismas definiciones que el repo), tarea horaria activa y primera
  brecha tomada sola (23:40Z: BCV 875,65, P2P 1.016,00, 16,03 %). Desde entonces, **en el proyecto de pruebas Zelle y
  USDT ya cotizan con el descuento de la brecha**. Panel (Costos y precio, Brecha del día en Tasas, regla y brecha
  en Configuración, importador) en el repo y probado en local; se publica solo con este push. App (precio en
  divisas, montos por método, explicación de la cotización): en el repo y probada en web, **sin EAS Update**.
  Diseño en `docs/PRECIOS.md`.
- Cambio de regla a revisar con Oliver: el margen ahora se aplica sobre el costo puesto en Venezuela (costo + flete +
  gastos), no solo sobre el costo, y el precio principal incluye la brecha.

## Próxima acción (para el siguiente agente, en este orden)

1. `git fetch origin && git checkout claude/marketplace-v1 && git pull --ff-only`; crear `apps/mobile/.env.local` y
   `apps/admin/.env.local` (ver `docs/ENTORNO.md` §4) y `pnpm stack:start && pnpm db:reset`.
2. Comprobar que el último `panel-deploy` quedó en verde (`gh run list --branch claude/marketplace-v1 --limit 3`) y
   que https://kora-panel.expo.app/admin/tasas muestra «Brecha del día».
3. Publicar la app al APK 4: comprobar el runtime (`docs/ENTORNO.md` §10), cambiar la primera línea sin `#` de
   `.github/eas-update-request`, push. Luego una corrida del emulador (`.github/apk-emulator-request`, revisión 12) y
   ver `ci/capturas/ultima/`: debe pasar `02-cuenta.yaml` y la ficha debe mostrar el precio con Zelle/USDT.
4. Revisar con Oliver la regla de precios (margen sobre costo puesto) y cargar costos reales en «Costos y precio».
5. Push en Android (Firebase de Oliver), APK 5 con identidad violeta.
6. Proponer a Oliver pasar el repo a privado (checklist en `docs/ENTORNO.md` §12 bis); **pedir confirmación antes**.

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
| Supabase de pruebas `mimnotafmfasvwrclxan` («Marketplace») | 24/24 migraciones (última `20261009233831_pricing_engine`), 4 funciones (`rates-sync`, `push-dispatch`, `panel-api`, `assets-mirror` de uso único), 7 trabajos de cron (nuevo `kora-pricing-snapshot`, hora :40), brecha del día vigente, imágenes demo en Storage, registro sin confirmación por correo |
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
