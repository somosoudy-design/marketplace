# HAYAZGO en iPhone con Apple ID gratuito

Preparación del 2026-10-10. Método: **Xcode + Personal Team + compilación local + iPhone físico**.
Frente A V2 está cerrado y Oliver confirmó la recepción en Android (`cf7a1b9`). Este trabajo no reabre
el diseño ni inicia Frente B. La marca provisional sigue siendo **Kora** en `config/brand.json`;
la app de prueba aparecerá como **Kora (Dev)**, con el icono Electric Violet existente.

**Estado:** configuración y generación del proyecto iOS verificadas en Linux. La compilación de Swift/CocoaPods,
firma gratuita, simulador e instalación física deben comprobarse en el Mac de Oliver. No hay una app iOS
instalada por este agente ni una IPA para descargar. No se usa EAS Build, TestFlight, distribución ad hoc o Expo Go.

## Auditoría de compatibilidad

| Elemento | Resultado y límite |
|---|---|
| Expo / React / React Native | Dependencias fijadas: SDK 57 (`expo ~57.0.27`), React 19.2.3, RN 0.86.3. 34 dependencias comparadas con `expo/bundledNativeModules.json`: ninguna discrepancia. Comprobación local, no certificación de compilación Xcode |
| Versión mínima de iPhone | **iOS 16.4**, comprobada en el Podfile y `IPHONEOS_DEPLOYMENT_TARGET` de la plantilla generada. No reducirla para instalar en un iPhone antiguo |
| Xcode y Mac | Usar Xcode estable más reciente que soporte el iOS del teléfono y un macOS compatible con ese Xcode. El helper RN declara mínimo 16.1, pero eso no verifica SDK 57 ni sus binarios precompilados con esa versión; no se garantiza un Xcode antiguo. Versión efectiva pendiente del Mac |
| Módulos nativos | Autolinking Apple resuelve 39 módulos Expo; configuración RN iOS resuelve 10 entradas, incluida Expo. Crypto, SecureStore, fotos, navegador, imágenes, haptics, Reanimated/Worklets, Gesture Handler, Screens/Safe Area y SVG presentes. Pods/enlace binario aún no ejecutados |
| Inicio y Frente A V2 | Tarjetas/barra expandible usan componentes compartidos y módulos ya presentes; sin dependencia exclusiva de Android. Incluidos en exportación Hermes iOS. Web local prueba claro/oscuro y pantallas pequeñas; safe areas/gestos/VoiceOver deben probarse en iPhone |
| Identidad nativa | Icono/splash violeta existentes, sin renombrar el producto. Xcode genera el recurso AppIcon de 1024 px |
| Backend | Solo Marketplace de pruebas `mimnotafmfasvwrclxan`; URL HTTPS y clave pública anon tomadas del perfil preview existente. No se toca el otro Supabase, ni se copian claves privadas |
| Inicio de sesión | Email/contraseña y código Supabase: no requieren capability Apple. Las cuentas del seed son **solo locales**, no sirven en el backend remoto. SMTP/recuperación y redirect `kora://**` conservan sus bloqueos heredados |
| Sesión cifrada | Crypto AES + Keychain SecureStore disponibles en iOS; no se añade Keychain Sharing. Confirmar «Sesión cifrada: sí» después de reabrir en iPhone; exportar JS no prueba el Keychain |
| Catálogo/fichas/favoritos/carrito/checkout | Código compartido conservado; pruebas funcionales web contra stack local. Backend remoto/iOS físico pendientes; cálculos y autorización siguen en servidor |
| Fotos y cámara | En la variante local, galería incluye foto de perfil, comprobantes y reclamos en el texto del permiso. Cámara conserva uso para comprobantes/reclamos. No se declara micrófono. Probar seleccionar/cancelar/denegar en iPhone |
| Navegador y enlaces | `expo-web-browser`, menú compartir y esquema `kora://` permanecen; no requieren Universal Links. Dominio `kora.example.com` es provisional; no hay enlaces universales verificados. PayPal/Binance siguen pendientes de credenciales, sin simular éxito |
| Avisos | Campana/listado/contador del backend siguen disponibles. **Push remoto APNs desactivado** en esta copia local; requiere membresía y configuración de Apple. Firebase Android intacto |
| OTA | EAS Update desactivado exclusivamente en el proyecto generado. Desarrollo usa Metro; Android APK 5 conserva preview/runtime y no se republica |

La configuración normal contiene Associated Domains y `expo-notifications` añade `aps-environment`.
Personal Team no firma esas capabilities. La variante elimina ambas y `remote-notification`; su plugin final
rechaza capabilities nuevas inesperadas. Las dependencias originales no cambian: el módulo de notificaciones
puede seguir autolinkado, pero la copia local no registra tokens ni monta listeners push.

## Cómo se aísla la variante

Desde la raíz, `node tools/ios-personal/prepare-personal-team.mjs` crea **`.local/ios-personal/`**, ignorada por Git:

- Copia `src`, `assets` y tsconfig de la app actual; comparte las dependencias instaladas con un enlace local.
  La misma profundidad de carpetas conserva `config/brand.json` y paquetes del monorepo.
- Genera configuración solo iOS, bundle identifier propio y sin APNs, Associated Domains o EAS Update.
  Conserva icono, splash, esquema, colores y pantallas actuales.
- Sustituye únicamente en la copia `lib/push.ts` y `components/PushBridge.tsx` por adaptadores sin push.
  Activar el ajuste informa que push iOS requiere Apple Developer de pago, sin simular activación.
- Escribe las tres variables públicas del perfil preview en `.env.local`; no ejecuta EAS ni cambia la base.
  Rechaza otro backend, una clave que no sea anon del proyecto, variables exportadas conflictivas y destinos
  no creados por este generador. Nunca imprime la clave.
- Reejecutarlo actualiza la copia de pantallas y assets, **sobrescribiendo ediciones hechas en esa copia**.
  No edites allí funcionalidades: haz cambios autorizados en la fuente. Conserva `ios/` y el bundle ID ya
  generado; no cambia la firma privada ni el Team seleccionado. Si regeneras nativo, vuelve a revisar la firma.

No se modifica ningún archivo de `apps/mobile`, `eas.json`, `config/`, dependencias/lockfile, APK 5,
Firebase Android, Supabase remoto, motor financiero o panel. Esta preparación no dispara workflows de publicación.

## Instalación paso a paso en tu Mac

Los siguientes comandos **son para el Mac**, no para el contenedor Linux. No requieren suscripción de Apple
ni iniciar sesión en Expo. No compartas contraseñas o certificados: el Apple ID se introduce solo en Xcode.

### 1. Instalar y abrir Xcode

1. Instala **Xcode completo**, gratuito, desde el Mac App Store. Las Command Line Tools solas no bastan.
2. Ábrelo, acepta la licencia y permite instalar los componentes. En Settings → Components (o Platforms,
   según versión), instala la plataforma iOS y un simulador compatible.
3. En Terminal selecciona la instalación normal:

```bash
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
sudo xcodebuild -runFirstLaunch
xcodebuild -version
xcrun --sdk iphoneos --show-sdk-version
```

Si Xcode tiene otro nombre/ruta, usa su ruta real. Si tu macOS no permite el Xcode que necesita tu iPhone,
ese es un bloqueo del Mac, no un problema que se resuelva con una IPA de EAS o cambiando el deployment target.

### 2. Node, pnpm y CocoaPods

Con [Homebrew](https://brew.sh/) instalado, en esa Terminal:

```bash
brew install node@22 cocoapods
export PATH="$(brew --prefix node@22)/bin:$PATH"
npm install --global pnpm@10.28.0
node --version
pnpm --version
pod --version
```

Activa esa misma ruta de Node en cada Terminal que utilices. CocoaPods y estas herramientas son gratuitas.

### 3. Sincronizar el código y preparar iOS local

Si aún no tienes el repositorio:

```bash
git clone --branch claude/marketplace-v1 https://github.com/somosoudy-design/marketplace.git
cd marketplace
```

Si ya lo tienes, entra en `marketplace`, conserva cualquier cambio propio y, con el checkout limpio, ejecuta:

```bash
git fetch origin
git checkout claude/marketplace-v1
git pull --ff-only
```

En la raíz del repositorio:

```bash
pnpm install --frozen-lockfile
unset EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY EXPO_PUBLIC_PANEL_URL
IOS_PERSONAL_BUNDLE_ID=com.somosoudy.hayazgo.oliver.local node tools/ios-personal/prepare-personal-team.mjs
node tools/ios-personal/verify-personal-team.mjs
cd .local/ios-personal
npx expo prebuild --platform ios
node ../../tools/ios-personal/verify-personal-team.mjs --native
open ios/KoraDev.xcworkspace
```

El bundle ID es **exclusivamente local**; conserva el mismo después. Si Apple dice que no está disponible,
elige uno propio acabado en `.local` **antes** del primer prebuild (por ejemplo añadir tu inicial al segmento
`oliver`). No cambies `config/brand.json` ni el identificador Android. El generador no cambia el ID si ya
hay un proyecto Xcode; revisa el bloqueo antes de recrear tu copia local.

`prebuild` instala Pods en el Mac. Abre **`.xcworkspace`**, no solo `.xcodeproj`. Si Pods fallan, lee el primer
error y comprueba Node/CocoaPods/Xcode/red; no borres el lockfile compartido ni actualices librerías a ciegas.
No ejecutes `eas init`, `eas build`, `eas submit` o `eas update` para este recorrido.

### 4. Apple ID y firma gratuita

1. Xcode → Settings → Accounts (o Apple Accounts) → `+` → Apple ID. Inicia sesión **en tu Mac**.
2. En el workspace, selecciona el proyecto **KoraDev** y su target principal **KoraDev**.
3. Signing & Capabilities → activa **Automatically manage signing**.
4. Team → selecciona **tu nombre (Personal Team)**. No pulses opciones para comprar la membresía.
5. Verifica `com.somosoudy.hayazgo.oliver.local` y un certificado **Apple Development** administrado por Xcode.
   Revisa Debug y Release si luego compilas ambos.
6. No deben aparecer **Push Notifications**, **Associated Domains**, App Groups, iCloud o Sign in with Apple.
   En esta variante el archivo `KoraDev.entitlements` queda vacío. Si una capability reaparece, detente y
   ejecuta la verificación/configuración local; no quites capacidades de la app Android o producción.

No necesitas entregar certificados o claves al agente. Xcode crea y mantiene la firma en tu Mac.

### 5. Conectar y preparar el iPhone

1. Conéctalo por cable de datos, desbloquéalo y acepta **Confiar en este ordenador**.
2. Xcode → Window → Devices and Simulators: espera a que el iPhone quede disponible. Instala cualquier
   componente solicitado; si indica iOS no admitido, actualiza Xcode/macOS según corresponda.
3. iPhone → Ajustes → Privacidad y seguridad → **Modo desarrollador** → activar. Reinicia y confirma.
   La opción puede aparecer después de la primera conexión/intento de desarrollo con Xcode.
4. Si al abrir la app aparece «Desarrollador no fiable», en Ajustes → General → **VPN y gestión de dispositivos**
   confía en tu Apple ID de desarrollo cuando iOS lo solicite. No instales perfiles externos.

### 6. Compilar e instalar la aplicación nativa

En Terminal, aún dentro de `marketplace/.local/ios-personal`:

```bash
npx expo run:ios --device
```

Selecciona **tu iPhone físico**, no un simulador. Expo usa Xcode para compilar Debug, firmar con el Team elegido,
instalar la app nativa y arrancar Metro. La primera compilación puede tardar. Mantén la Terminal abierta.
También puedes seleccionar el iPhone como destino en Xcode y pulsar Run; el código de desarrollo necesita Metro.

Para volver a usarla después de cerrar Metro, en una nueva Terminal:

```bash
cd marketplace/.local/ios-personal
export PATH="$(brew --prefix node@22)/bin:$PATH"
unset EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY EXPO_PUBLIC_PANEL_URL
npx expo start --dev-client --lan
```

Mac e iPhone deben estar en la misma red. Permite la red local en el iPhone y el acceso de Node en el firewall
del Mac. Abre **Kora (Dev)** y selecciona el servidor Metro; si no aparece, utiliza la dirección LAN que
muestra la Terminal, nunca `localhost` en el iPhone. Se abre la app nativa propia, sin Expo Go.
El backend sigue siendo Supabase HTTPS de pruebas; solo Metro usa la red del Mac.

### 7. Opción para abrirla sin Metro

Después de comprobar Debug y su firma, puedes instalar localmente una configuración con JS incluido:

```bash
cd marketplace/.local/ios-personal
npx expo run:ios --device --configuration Release
```

Selecciona el mismo iPhone y Personal Team (comprueba también la firma Release en Xcode). No es una publicación
ni distribución: sigue siendo una compilación local firmada para tu dispositivo, con la misma caducidad gratuita.
Necesita internet para Supabase. EAS Update sigue desactivado. Debug es el recorrido principal; **esta opción
Release no se ha compilado ni probado en la nube**.

## Qué verificar después en tu iPhone

Usa tu cuenta del **proyecto de pruebas**. No copies `Demo-1234` ni cuentas del seed al remoto. No hagas una
transferencia real; los medios de cobro demo dicen «No transferir». Para esta primera validación física llega
hasta el resumen de checkout sin confirmar un pedido; el flujo de creación/pago ya se prueba solo en local.
No cambies el motor para sortear una tasa vencida o un proveedor deshabilitado.

| Recorrido | Comprobación física pendiente |
|---|---|
| Arranque | Abre Kora (Dev), catálogo rotulado Demo, sin ConfigMissing/crash; claro y oscuro |
| Inicio de sesión | Login de prueba, error con clave incorrecta, cerrar/reabrir mantiene sesión; logout elimina sesión |
| Diagnóstico | Cuenta → tocar línea de versión: Sistema iOS, backend `mimnotafmfasvwrclxan.supabase.co`, conexión responde y **Sesión cifrada: sí**. Canal/OTA pueden figurar `—` porque se desactivaron; el texto histórico «APK» del diagnóstico es compartido y no describe un APK iOS |
| Catálogo/ficha | Buscar, filtros, categorías, colecciones, precios/estados por producto, volver conserva contexto |
| Navegación V2 | Inicio/Buscar/Carrito/Cuenta expanden sin saltos; flecha y gesto Atrás; teclado, safe area, scroll, lector VoiceOver y movimiento reducido |
| Favoritos | Desde Cuenta y tarjetas; añadir/quitar con sesión, abrir ficha no activa favorito; datos solo de tu cuenta de prueba |
| Carrito | Añadir, cantidad, quitar, contador real en Inicio/barra; pasar de visitante a cuenta conserva líneas |
| Checkout | Sesión exigida, direcciones/opciones de entrega y resumen coherentes; no confirmar pedido/transferir en esta primera prueba física |
| Perfil/fotos | Galería, cancelar, denegar/permitir permiso; el aviso incluye foto de perfil. Cámara si se utiliza para evidencia |
| Avisos | Campana/listado/contador siguen funcionando; el ajuste push informa la limitación de Personal Team |
| Rendimiento | Pantalla pequeña, texto ampliado, claro/oscuro, transiciones y regreso desde segundo plano sin problemas |

Registro para el siguiente agente: modelo/iOS del iPhone, macOS/Xcode, commit, Debug o Release, fecha de
instalación y resultados reales por recorrido. Las capturas no deben mostrar contraseñas, tokens o datos privados.

En el Mac, un simulador se puede probar antes con `npx expo run:ios` desde la misma copia local, seleccionando
un simulador. No sustituye la firma Personal Team, permisos y Keychain del iPhone físico. Linux no tiene ese simulador.

## Caducidad y funciones que requieren membresía de pago

La firma/provisioning gratuito de Personal Team **caduca a los 7 días**. La app puede dejar de abrir;
vuelve a conectar el iPhone y ejecuta el mismo `npx expo run:ios --device` para firmar e instalar otra vez.
Conserva Team/bundle ID y evita desinstalar para conservar los datos de la app. No es una instalación permanente.
Apple limita también los App IDs y dispositivos de Personal Team; no generes identificadores nuevos cada semana.

| Función | Con Personal Team |
|---|---|
| Compilar e instalar en tu iPhone desde Xcode | Sí, gratuitamente y con caducidad; Metro en Debug o bundle local en Release |
| Catálogo, login Supabase, favoritos, carrito, checkout, cámara/galería y Keychain propio | No requieren por sí mismos Apple Developer de pago |
| Push remoto APNs y su configuración de proveedor | Requieren Apple Developer de pago; desactivados en esta variante |
| Associated Domains / Universal Links verificados | Requieren membresía/capability; desactivados. `kora://` sigue disponible |
| App Store, TestFlight y distribución ad hoc | Requieren membresía; fuera de este método y sin publicación |
| Capabilities futuras como iCloud, App Groups o Sign in with Apple | Revisar membresía/entitlements antes de agregarlas; no se usan en esta variante |

Esta tarea no compra ni contrata nada. Android/APK 5 conserva su instalación y actualización habitual.

## Evidencia ejecutada en cloud

Resultados finales se registran también en `docs/ESTADO_ACTUAL.md` y `docs/HISTORIAL_AGENTES.md`.

- Guardas `node --test tools/ios-personal/personal-team.test.mjs`: **5/5**; backend/anon, ID local, overrides de entorno,
  capabilities y aislamiento de configuración.
- Generador reejecutado y `node tools/ios-personal/verify-personal-team.mjs`: configuración real con plugins conservados,
  splash violeta, permiso de perfil, sin micrófono, entitlements vacíos, sin tokens/listeners push y OTA desactivado.
  `--native` comprueba también los plists guardados: APNs insertado temporalmente se rechaza y se restauró el archivo.
- `expo prebuild --platform ios --no-install`: proyecto Xcode generado y plists revisados; **sin Pods ni compilación**.
- Tipo de la copia local (`tsc --noEmit`), tipos/lint de monorepo y núcleo **50/50**: aprobados.
- `expo export --platform ios --clear`: **Hermes iOS exportado**, 5,5 MB. Prueba de bundle JS/assets, no binario iOS.
- Resolución Apple/RN y las 34 versiones cotejadas con SDK instalado: aprobadas. `expo install --check` online
  falló por proxy HTTP 403; offline dijo actualizado. No se afirma auditoría remota de Expo Doctor.
- Huella Android sin archivo Firebase: antes/después **`da033dbf2e656078bbc76aa353ad3ed3088134d1`**, idéntica.
  No es la huella completa del APK 5 (requiere el archivo Firebase de EAS); el código/configuración de la app
  original queda sin cambios, lo que conserva sus inputs. Sin publicación ni nuevo APK.
- Regresión web local de comprador: **40/40 aprobados**, sin omisiones (1,9 min), exportación web reconstruida.
  Incluye login/códigos, catálogo/fichas, Favoritos, carrito/checkout completo de prueba, perfil/sesión,
  13 casos V2 y 6 de navegación claro/oscuro. No equivale a ejecutar iOS.
  Primera pasada detenida por backend local apagado: 4 fallos, 1 interrumpido y 35 no ejecutados. Diagnóstico:
  gateway dejó de escuchar al cerrar el proceso de arranque; segunda pasada con backend en el mismo
  proceso de pruebas aprobada. No se cambiaron ni desactivaron tests.
- Supabase remoto y documentación oficial Apple/Expo: solicitudes de solo lectura bloqueadas por proxy HTTP 403.
  No se cambiaron servicios remotos; confirmar conectividad/configuración en el Mac con diagnóstico de la app.

Artefactos ignorados: `.local/ios-personal/ios/`, `dist-ios/` y `.local/logs/ios-personal-*.log`.
No afirmar compilación Xcode, funcionamiento de Keychain nativo, ejecución en simulador o instalación en iPhone
hasta obtener evidencia del Mac/teléfono. El siguiente paso obligatorio es físico y corresponde a Oliver.

Referencias oficiales para consultar desde el Mac (no accesibles desde este proxy):
[membresías Apple](https://developer.apple.com/support/compare-memberships/),
[capabilities](https://developer.apple.com/help/account/reference/supported-capabilities-ios/),
[Modo desarrollador](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device),
[compilación local Expo](https://docs.expo.dev/guides/local-app-development/).
