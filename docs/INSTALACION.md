# Instalación, ejecución y compilación

## Requisitos

- Node 22 (≥ 20) y pnpm 10 (`corepack enable`).
- Postgres 16 o 17 instalado localmente (binarios en `/usr/lib/postgresql/<versión>/bin`) para el stack sin
  Docker, **o** Docker + Supabase CLI para `supabase start`.
- Para compilar apps nativas: cuenta de Expo (EAS) o, en local, Android Studio / Xcode.

## 1. Instalar

```bash
git clone <repo> marketplace && cd marketplace
pnpm install          # instala también Deno (dev) para las funciones del servidor
```

## 2. Backend local

Opción A, sin Docker (la que usan las pruebas y CI):

```bash
pnpm stack:start      # Postgres :54322, Auth, PostgREST, gateway :54321 y funciones :54331
pnpm db:reset         # borra la base LOCAL y aplica migraciones + datos de demostración
```

Las claves locales quedan en `.local/keys.env` (no se versiona). `pnpm stack:stop` detiene todo.

Opción B, con Docker: `npx supabase start` usa `supabase/config.toml`, las mismas migraciones y el seed, y
`npx supabase functions serve` sirve las funciones.

Cuentas de demostración (solo local, clave `Demo-1234`): `admin@example.com`, `vendedor@example.com`,
`comprador@example.com`.

## 3. App móvil

```bash
cp apps/mobile/.env.example apps/mobile/.env.local   # pega la anon key de .local/keys.env
pnpm --filter @kora/mobile start                     # Expo; "a" Android, "i" iOS, "w" web
```

- Emulador Android: `EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:54321`.
- Teléfono físico: usa la IP LAN de tu equipo (`http://192.168.x.x:54321`) y que el gateway sea accesible.
- Funciones que necesitan módulos nativos (push, sesión de pago en el navegador) requieren una build de
  desarrollo (`eas build --profile development`) en lugar de Expo Go.

## 4. Panel web (administración y vendedores)

```bash
cp apps/admin/.env.example apps/admin/.env.local     # anon key local
pnpm --filter @kora/admin dev                        # http://127.0.0.1:3100
pnpm --filter @kora/admin build && pnpm --filter @kora/admin start   # producción
```

Se despliega en cualquier hosting de Next.js (por ejemplo Vercel) con `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` y `NEXT_PUBLIC_STORE_URL`. No necesita ningún secreto.

## 5. Funciones del servidor

```bash
pnpm functions:serve  # ya lo hace stack:start si Deno está instalado
pnpm edge:sync        # tras cambiar packages/core/src/rates o payments
```

## 6. Pruebas

```bash
pnpm test:db          # base de datos (clona la base en kora_test)
pnpm test:e2e         # compra completa por la API pública
pnpm test:functions   # funciones del servidor (Deno)
pnpm --filter @kora/core test && pnpm test:admin
pnpm test:ui          # app (exporta la versión web y usa Playwright, Pixel 7)
pnpm test:panel       # panel entre roles (Playwright, escritorio)
pnpm typecheck && pnpm lint
```

## 7. Compilar Android e iOS (EAS)

El proyecto de Expo es https://expo.dev/accounts/marketplacebrand/projects/marketplace. `config/expo.json`
fija `owner`, `slug` y `projectId`; no uses `eas init`, que podría crear otro proyecto.

El perfil `preview` (APK interno) ya trae en `eas.json` la URL del proyecto Supabase de pruebas y su clave
pública `anon` (la misma que lleva cualquier APK; la seguridad la dan las reglas RLS, nunca una clave de
servicio). Para otro backend, cambia esos dos valores.

**APK desde GitHub (recomendado aquí):** guarda un token de Expo (expo.dev › Access tokens) como secreto
`EXPO_TOKEN` del repositorio y cambia el comentario de `.github/apk-preview-request` en la rama de trabajo
(o sube una etiqueta `apk-preview-N` si tu acceso a GitHub lo permite):

```bash
echo "# 3: motivo de la compilación" > .github/apk-preview-request
git commit -am "Pedir APK de prueba" && git push
```

El workflow `.github/workflows/eas-android-preview.yml` verifica que el token vea ese proyecto exacto y que
el `projectId` coincida, compila en EAS esperando el resultado y deja en el resumen del job la página de
instalación, el enlace del APK y, si falla, el final del registro de EAS. No publica en Google Play.

**Desde tu computadora:**

```bash
npm i -g eas-cli && eas login
cd apps/mobile
eas build --profile preview --platform android       # APK interno para probar
eas build --profile development --platform android   # cliente de desarrollo instalable
eas build --profile production --platform all        # AAB / IPA para tiendas (requiere cuentas de tienda)
```

Cada perfil instala una app distinta (`com.example.kora.development`, `.preview`, producción), así que
pueden convivir en el mismo teléfono. Cambia los identificadores en `config/brand.json` antes de la
primera build pública. Compilar en local (`npx expo run:android`) requiere Android SDK.

## Desplegar en un proyecto Supabase

Requiere un proyecto **nuevo** y autorización (puede tener costo). Nunca el proyecto existente de otros
productos.

Proyecto actual: «Marketplace» (`mimnotafmfasvwrclxan`). Las migraciones 1 a 6 se aplicaron con el conector de
Supabase; de la 7 a la 21 con `tools/supabase-remote/aplicar-migraciones-07-a-21.sql` en el SQL Editor (una sola
transacción, sin datos demo); `20261009153318` (permisos) y `20261009154233` (clave de tareas) otra vez con el
conector. El historial usa las mismas versiones que los archivos, así que `supabase db push` queda coherente.
Funciones desplegadas: `rates-sync` y `push-dispatch`. `payments-start` y los dos webhooks se despliegan cuando
se habilite Binance Pay o PayPal con sus credenciales.

```bash
npx supabase link --project-ref <ref>
npx supabase db push                      # migraciones; NO incluye seed (no usar --include-seed)
npx supabase functions deploy             # las 5 funciones; verify_jwt según config.toml
npx supabase secrets set PAYMENTS_RETURN_URL=kora://pay/result   # y los de cada proveedor cuando existan
```

Luego, en el panel de Supabase:

1. Auth > Hooks: activar *Custom Access Token* con `public.custom_access_token_hook`.
2. Auth > URL configuration: `site_url` del panel y, en *Redirect URLs*, `kora://**`. Sin esa línea los
   correos de confirmación y de contraseña nueva terminan en `site_url` en lugar de abrir la app
   (`kora://auth-callback`, `kora://reset-password`).
3. Auth > SMTP: correo propio. El correo integrado de Supabase solo entrega a miembros del equipo del proyecto
   y pocas veces por hora; para pruebas con varias personas, configura SMTP o desactiva temporalmente
   *Confirm email* (Authentication › Sign In / Providers › Email) y vuelve a activarlo antes de publicar.
4. Database > Extensions: `pg_cron` y `pg_net` (la migración `20261009001600` programa los trabajos si
   existen; si se activan después, vuelve a ejecutar su bloque final).
5. SQL Editor, para que el cron pueda llamar a las funciones (la clave `kora_job_token` la crea la migración
   `20261009154233` dentro de Vault; nunca hace falta copiar la clave de servicio):
   ```sql
   select vault.create_secret('https://<ref>.supabase.co', 'kora_project_url');
   ```
   En «Marketplace» ya está hecho.
6. Crear el primer administrador: registrarse en la app y ejecutar
   `insert into user_roles (user_id, role) values ('<uuid>', 'superadmin');`.
7. Cargar datos reales: tasas (fuentes habilitadas o tasa manual), métodos de pago con datos de cobro
   reales, tarifas de envío, comisiones y categorías.
