# Entorno: instalar, ejecutar, probar y operar los servicios

Para cualquier agente o persona que continúe Kora. Las reglas de trabajo están en `AGENTS.md`; el estado vivo,
en `docs/ESTADO_ACTUAL.md`. Aquí van los procedimientos.

## 0. Local, GitHub y servicios no son lo mismo

**Nunca supongas que un cambio en GitHub ya está desplegado en Supabase o en Expo.** Cada pieza tiene su propio
estado y se comprueba por separado:

| Pieza | Dónde está la fuente | Dónde está «en uso» | Cómo comprobarlo |
|---|---|---|---|
| Código y documentación | Rama `claude/marketplace-v1` en GitHub (fuente de verdad) | Tu copia local hasta que haces push | `git fetch origin && git status -sb` (sin «ahead» ni «behind») |
| Migraciones de la base | `supabase/migrations/*.sql` | Proyecto Supabase de pruebas, solo las que alguien aplicó | Conector de Supabase `list_migrations`, o `npx supabase migration list` con el proyecto enlazado |
| Funciones del servidor | `supabase/functions/*` | Desplegadas: hoy solo `rates-sync` y `push-dispatch` | Conector `list_edge_functions` / `get_edge_function` (versión y código), o el panel de Supabase |
| Datos | `supabase/seed.sql` (solo local); `supabase/remote-demo/*.sql` (catálogo demo remoto) | Lo cargado en cada base | Consultas de solo lectura (abajo) |
| App en teléfonos | `apps/mobile` | Parte nativa: el APK instalado (cambia solo con un APK nuevo). JavaScript: la última actualización publicada en el canal `preview` | Pantalla `kora://diagnostico` en el teléfono; página del proyecto en expo.dev; resumen del workflow `eas-update-preview` |
| Panel web | `apps/admin` | Solo local (no está publicado) | — |
| Pruebas | `tests/`, `packages/*/src/**/*.test.ts`, `supabase/functions/tests` | Corren en local contra el stack local; no hay CI de pruebas en GitHub | Ejecutarlas (sección 7) |

Consultas de solo lectura útiles en el proyecto de pruebas (conector `execute_sql` o SQL Editor):

```sql
select count(*) from supabase_migrations.schema_migrations;               -- 23 al 2026-10-09
select jobname, schedule, active from cron.job order by 1;               -- 6 trabajos
select source_code, pair, rate, fetched_at from exchange_rates order by fetched_at desc limit 3;
select count(*) filter (where is_demo) demo, count(*) total from products;
```

## 1. Requisitos

- Node 22 (≥ 20) y pnpm 10 (`corepack enable`).
- Postgres 16 o 17 instalado localmente (binarios en `/usr/lib/postgresql/<versión>/bin`) para el stack sin
  Docker, **o** Docker + Supabase CLI para `supabase start`.
- Para compilar apps nativas: cuenta de Expo (EAS) o, en local, Android Studio / Xcode.

## 2. Instalar

```bash
git clone https://github.com/somosoudy-design/marketplace.git && cd marketplace
git checkout claude/marketplace-v1
pnpm install          # instala también Deno (dev) para las funciones del servidor
```

## 3. Backend local

Opción A, sin Docker (la que usan las pruebas):

```bash
pnpm stack:start      # Postgres :54322, Auth, PostgREST, gateway :54321 y funciones :54331
pnpm db:reset         # borra la base LOCAL y aplica migraciones + datos de demostración
source tools/local-stack/env.sh   # DB_URL y puertos en la terminal
```

- Las claves locales quedan en `.local/keys.env` (generadas, no se versionan). `pnpm stack:stop` detiene todo.
- Si el stack ya estaba encendido, `pnpm stack:stop` antes de `stack:start` (si no, PostgREST y las funciones
  fallan con «Address in use»).
- `AUTH_AUTOCONFIRM=true pnpm stack:start` imita el proyecto de pruebas con «Confirm email» desactivado.
- Registros: `.local/logs/` (por ejemplo `functions.log`).

Opción B, con Docker: `npx supabase start` usa `supabase/config.toml`, las mismas migraciones y el seed, y
`npx supabase functions serve` sirve las funciones.

Cuentas de demostración (**solo local**, clave `Demo-1234`): `admin@example.com`, `vendedor@example.com`,
`comprador@example.com`, `tiendas@example.com` (dos tiendas). Nunca existen en un proyecto remoto.

## 4. App móvil

```bash
cp apps/mobile/.env.example apps/mobile/.env.local   # pega la anon key de .local/keys.env
pnpm --filter @kora/mobile start                     # Expo; "a" Android, "i" iOS, "w" web
```

- Emulador Android: `EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:54321`.
- Teléfono físico: usa la IP LAN de tu equipo (`http://192.168.x.x:54321`) y que el gateway sea accesible.
- Funciones que necesitan módulos nativos (sesión cifrada, push, sesión de pago en el navegador) requieren una
  build (`eas build --profile development` o el APK de prueba) en lugar de Expo Go.

## 5. Panel web (administración y vendedores)

```bash
cp apps/admin/.env.example apps/admin/.env.local     # anon key local
pnpm --filter @kora/admin dev                        # http://127.0.0.1:3100
pnpm --filter @kora/admin build && pnpm --filter @kora/admin start   # producción
```

Se despliega en cualquier hosting de Next.js (por ejemplo Vercel) con las variables de la sección 8. No
necesita ningún secreto. Publicarlo requiere a Oliver (cuenta y posible costo).

## 6. Funciones del servidor

```bash
pnpm functions:serve  # ya lo hace stack:start si Deno está instalado
pnpm edge:sync        # tras cambiar packages/core/src/rates o payments
```

## 7. Pruebas

```bash
pnpm test:db          # base de datos (clona la base en kora_test)
pnpm test:e2e         # compra completa por la API pública
pnpm test:functions   # funciones del servidor (Deno)
pnpm --filter @kora/core test && pnpm test:admin
pnpm test:ui          # app (exporta la versión web y usa Playwright, Pixel 7)
pnpm test:panel       # panel entre roles (Playwright, escritorio)
pnpm test:remote-catalog   # catálogo demo del proyecto remoto, en una base aparte
pnpm typecheck && pnpm lint
```

Un solo spec de la app: `pnpm --filter @kora/app-e2e build:web` y luego
`cd tests/app-e2e && npx playwright test --project=app tests/<spec>.ts`. Detalle y casos críticos en
`docs/PRUEBAS.md`.

Revisión visual (obligatoria cuando tocas pantallas): con el stack local y la build web,
`node tools/design/screens.mjs <carpeta> light` y `… dark` capturan Inicio, ficha, carrito, checkout, pedidos,
cuenta y más (con sesión de `comprador@example.com`, solo local).

## 8. Variables de entorno y secretos

Solo nombres y lugares. **Ningún valor secreto va en el repositorio, que es público**, ni en la documentación ni
en la app. La clave `anon` de Supabase es pública por diseño (va dentro de cualquier APK); la seguridad la dan
las reglas RLS y las funciones de la base.

| Variable | Para qué | Dónde se configura | ¿Secreta? |
|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Backend de la app | Local: `apps/mobile/.env.local` (no versionado). Builds: perfil de `apps/mobile/eas.json` | No |
| `EXPO_PUBLIC_PANEL_URL` | Enlaces de la app al panel | Igual que la anterior | No |
| `APP_VARIANT` | `development`, `preview` o `production`: identificador de la app y canal de actualizaciones | `apps/mobile/eas.json` | No |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_STORE_URL` | Panel web | Local: `apps/admin/.env.local`. Publicado: variables del hosting | No |
| `EXPO_TOKEN` | Workflows de EAS (compilar y publicar actualizaciones) | GitHub › repositorio › Settings › Secrets and variables › Actions (ya configurado) | **Sí** |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Funciones del servidor | Las inyecta Supabase en cada función. La service role key no se copia a ningún otro lugar | **Sí** (la service role) |
| `PAYMENTS_RETURN_URL` | Vuelta a la app tras un pago en línea (por defecto `kora://pay/result`) | Supabase › Edge Functions › Secrets, o `npx supabase secrets set` | No |
| `PUBLIC_FUNCTIONS_URL` | URL pública de las funciones, si difiere de la estándar | Igual | No |
| `RATES_USER_AGENT` | Identificación ante las fuentes de tasas | Igual | No |
| `EXPO_ACCESS_TOKEN` | Push con seguridad mejorada de Expo (opcional) | Igual | **Sí** |
| `BINANCE_PAY_API_KEY`, `BINANCE_PAY_SECRET_KEY`, `BINANCE_PAY_PUBLIC_KEY` | Binance Pay (sin configurar) | Igual, cuando Oliver tenga la cuenta de comercio | **Sí** |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_ENV` | PayPal (sin configurar; `PAYPAL_ENV` = `sandbox` o `live`) | Igual | **Sí** (salvo `PAYPAL_ENV`) |
| `kora_project_url`, `kora_job_token` | El cron llama a las funciones con `x-kora-job-token` | Vault de Supabase (el token lo crea la migración `20261009154233`; ya están) | **Sí** (el token) |
| `KORA_TEST_JOB_TOKEN` | Solo las pruebas locales de funciones | Las pone la suite | No |

Cada socio usa sus propias cuentas (GitHub, Expo, Supabase). No se comparten contraseñas ni se dan permisos de
administrador que no hagan falta.

## 9. Compilar Android e iOS (EAS)

El proyecto de Expo es https://expo.dev/accounts/marketplacebrand/projects/marketplace (cuenta
`marketplacebrand`). `config/expo.json` fija `owner`, `slug` y `projectId`
(`9f629f10-d679-4a99-9965-8a9e588afc85`); **no uses `eas init`**, que podría crear otro proyecto.

El perfil `preview` (APK interno) trae en `apps/mobile/eas.json` la URL del proyecto Supabase de pruebas y su
clave pública `anon`. Para otro backend, cambia esos dos valores.

**APK desde GitHub (lo normal aquí):** cambia el comentario de `.github/apk-preview-request` en la rama
compartida y haz push:

```bash
echo "# 6: motivo de la compilación" >> .github/apk-preview-request
git commit -am "Pedir APK de prueba" && git push origin claude/marketplace-v1
```

El workflow `eas-android-preview.yml` verifica que el token vea ese proyecto exacto y que el `projectId`
coincida, compila en EAS esperando el resultado y deja en el resumen del job la página de instalación, el
enlace del APK y, si falla, el final del registro de EAS. Cada APK pasa por `tools/eas/verify-apk.mjs` (backend
correcto, sin direcciones locales, solo clave anon, ninguna clave secreta). No publica en Google Play.

**Desde una computadora con eas-cli:**

```bash
npm i -g eas-cli && eas login
cd apps/mobile
eas build --profile preview --platform android       # APK interno para probar
eas build --profile development --platform android   # cliente de desarrollo instalable
eas build --profile production --platform all        # AAB / IPA para tiendas (requiere cuentas de tienda)
```

Cada perfil instala una app distinta (`com.example.kora.development`, `.preview`, producción), así que pueden
convivir en el mismo teléfono. Los identificadores se cambian en `config/brand.json` antes de la primera build
pública. Compilar en local (`npx expo run:android`) requiere Android SDK.

APK compilados hasta hoy (todos con la misma firma; `tools/eas/inspect-apk.sh` muestra firma, versión, minSdk y
procesadores):

| APK | Build EAS | Resultado |
|---|---|---|
| 1 | `037b11c5` | Abre en el emulador; «App no instalada» en los Samsung S24/S25 Ultra de Oliver |
| 2 | `1a0f1922` (commit `b5eff0c`) | Igual que el 1 |
| 3 | `bd3fa808` (solo ARM) | Se cae al abrir en el emulador; «App no instalada» en los Samsung |
| 4 | `5ee104fe` (versionCode 2, commit `3509547`) | **Instalado en el Samsung de Oliver** (2026-10-09 ~20:40Z). Primero con `expo-updates`: recibe las actualizaciones del canal `preview` |

## 10. Actualizaciones de JavaScript sin reinstalar (EAS Update)

Los APK con `expo-updates` (del APK 4 en adelante) reciben el JavaScript nuevo del canal `preview` si tienen el
mismo **runtime** (huella de la parte nativa). Hoy: `a4682c83c1bb738fc74c73153838ded0656f1912`.

1. Calcula la huella **desde `apps/mobile`** (desde la raíz da otra):
   ```bash
   cd apps/mobile && APP_VARIANT=preview node_modules/.bin/expo-updates fingerprint:generate --platform android \
     | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).hash))'
   ```
2. Si coincide con la línea `runtime:` de `.github/eas-update-request`, cambia la primera línea sin `#` de ese
   archivo (es el mensaje de la actualización), commit y push. El workflow `eas-update-preview.yml` publica.
3. Si no coincide, algo nativo cambió (dependencia nativa, permisos, icono, `app.config.ts`): hace falta un APK
   nuevo y que los testers lo instalen. El workflow se detiene solo para no publicar algo incompatible.

El icono, el splash y el color de notificación siguen la constante `NATIVE_IDENTITY` de
`apps/mobile/app.config.ts`: `'original'` mientras se actualiza el APK 4; `'violet'` en el próximo APK.

## 11. Workflows de GitHub

Se disparan al cambiar un archivo de solicitud en `.github/` de la rama compartida (las etiquetas de git y
`workflow_dispatch` no sirven mientras los workflows no estén en `main`):

| Archivo que se cambia | Workflow | Qué hace |
|---|---|---|
| `.github/apk-preview-request` | `eas-android-preview.yml` | Compila un APK `preview` en EAS y lo revisa |
| `.github/apk-verify-request` | `apk-verify.yml` | Revisa un APK ya compilado (último enlace del archivo) |
| `.github/apk-emulator-request` | `apk-emulator.yml` | Instala y abre los APK listados en un Android 15 limpio, con capturas y registros |
| `.github/eas-update-request` | `eas-update-preview.yml` | Publica una actualización de JavaScript en el canal `preview` |

Resultados: `gh run list --branch claude/marketplace-v1 --limit 5` y `gh run view <id>`. Si `gh run view --log`
responde 403, lee el registro del job por la API (`gh api repos/somosoudy-design/marketplace/actions/jobs/<job>/logs`)
o con la herramienta de registros de jobs del conector de GitHub.

## 12. Proyecto Supabase de pruebas

| Dato | Valor |
|---|---|
| Proyecto | «Marketplace», ref `mimnotafmfasvwrclxan`, us-east-1, Postgres 17, plan gratuito |
| Uso | Entorno de **pruebas**: datos demo rotulados, datos de pago ficticios «No transferir», sin pagos reales |
| Prohibido | `bfuggvbgttvcygbexqyn` es de otros productos de Oliver: no se lee ni se escribe |

Reglas de operación:

- Nunca cargar `supabase/seed.sql` en un proyecto remoto (crea cuentas con clave conocida).
- El catálogo demo remoto se genera con `pnpm catalog:remote` (`supabase/remote-demo/catalogo-demo.sql`, sin
  usuarios ni pedidos, se niega a cargar dos veces) y se quita con `quitar-catalogo-demo.sql`.
- Migración nueva: pruébala en local (`pnpm db:reset && pnpm test:db`), aplícala al remoto con el conector de
  Supabase (`apply_migration`, con el mismo nombre y versión que el archivo) o con `npx supabase db push`, y
  comprueba con `list_migrations`. Un archivo en GitHub **no** está aplicado hasta que alguien lo aplica.
- SQL con `DELETE`, `DROP` o reinicios: el conector de Claude pide una confirmación que Oliver no ve en su app.
  No reintentar ni disfrazar sentencias: se genera un archivo para el SQL Editor (modelo:
  `tools/supabase-remote/build.py`), se ensaya en una base local y Oliver lo ejecuta.
- Cambios de datos importantes, siempre con autorización de Oliver.

Desplegar en un proyecto nuevo (requiere autorización: puede tener costo):

```bash
npx supabase link --project-ref <ref>
npx supabase db push                      # migraciones; NO incluye seed (no usar --include-seed)
npx supabase functions deploy             # las 5 funciones; verify_jwt según config.toml
npx supabase secrets set PAYMENTS_RETURN_URL=kora://pay/result   # y los de cada proveedor cuando existan
```

Luego, en el panel de Supabase:

1. Auth > Hooks: activar *Custom Access Token* con `public.custom_access_token_hook`.
2. Auth > Emails > Templates: los correos llevan solo un código de 6 dígitos que la persona escribe en la app
   (sin enlaces, así nada termina en `localhost`). Pegar el asunto y el HTML de `supabase/templates/`:
   *Confirm sign up* ← `confirmation.html` («Tu código de Kora»), *Reset password* ← `recovery.html`
   («Código para cambiar tu contraseña»), *Magic link* ← `magic_link.html`, *Change email address* ←
   `email_change.html`. En Auth > Sign In / Providers > Email: *Confirm email* activado y *Email OTP length* 6.
   Auth > URL configuration: `site_url` = `kora://auth-callback` y, en *Redirect URLs*, `kora://**`.
3. Auth > SMTP: correo propio. El correo integrado de Supabase solo entrega a miembros del equipo del proyecto
   y unas 2 veces por hora en total; con SMTP propio el límite se ajusta en Auth > Rate Limits.
   **Entorno de pruebas sin dominio (decisión de Oliver, 2026-10-09):** mientras no haya SMTP, el proyecto de
   pruebas va con *Confirm email* desactivado (Authentication › Sign In / Providers › Email) para que cualquier
   tester se registre. La app lo detecta sola (sin APK nuevo): el registro devuelve sesión y entra directo, sin
   pantalla de código. El código de 6 dígitos vuelve al activar *Confirm email*, ya con SMTP. En producción
   *Confirm email* va siempre activado.
4. Database > Extensions: `pg_cron` y `pg_net` (la migración `20261009001600` programa los trabajos si
   existen; si se activan después, vuelve a ejecutar su bloque final).
5. SQL Editor, para que el cron pueda llamar a las funciones (el `kora_job_token` lo crea la migración
   `20261009154233` dentro de Vault; nunca hace falta copiar la clave de servicio):
   `select vault.create_secret('https://<ref>.supabase.co', 'kora_project_url');`
6. Primer administrador: registrarse en la app y ejecutar
   `insert into user_roles (user_id, role) values ('<uuid>', 'superadmin');`.
7. Datos reales (cuando Oliver los dé): tasas, métodos de pago con datos de cobro reales, tarifas de envío,
   comisiones y categorías.

En «Marketplace» ya están hechos los pasos 1, 4, 5 y las plantillas; faltan los clics de Oliver de
`docs/ESTADO_ACTUAL.md` («Pendiente de Oliver»).

## 13. Respaldo y recuperación

- La copia que manda es GitHub. Si tu copia local y el remoto divergen: `git pull --rebase` sobre tus commits;
  nunca `push --force`.
- Las sesiones de Claude del proyecto «TIENDA ONLINE» además copian el estado a los archivos del proyecto con
  `bash tools/backup-to-project.sh` (`/mnt/project-files/marketplace/kora-repo.bundle` con toda la historia y
  `repo/` con el último commit). Recuperar desde ahí: `git clone kora-repo.bundle marketplace`.
- Un commit que rompió algo se deshace con `git revert <commit>` (nueva historia), no reescribiendo la anterior.
