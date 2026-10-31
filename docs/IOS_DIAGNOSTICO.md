# Diagnóstico iOS local: cierre resuelto

**Cierre:** 2026-10-11 00:00 Caracas (UTC−4). Proyecto `~/marketplace`, rama `claude/marketplace-v1`,
variante `.local/ios-personal`, scheme/target KoraDev, Debug y Personal Team existentes.
Oliver pidió terminar tras poder abrir la app para probar; **no continuar el desarrollo iOS todavía**.
Android, APK 5, producción, panel, servicios remotos y reglas financieras intactos.

## Causas comprobadas

Se sincronizó `f5efec4` y se consultaron directamente los activity logs de Xcode, el log Expo y los
informes KoraDev del iPhone mediante `xcrun devicectl`. Evidencia privada en `.local/ios-diagnosis/`;
no publicar UDID, Team ID, certificados, perfiles o logs crudos.

1. **Cierre antes de JavaScript:** `EXC_BREAKPOINT / SIGTRAP`, terminación `SIGNAL / Trace/BPT trap: 5`,
   hilo principal en `___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption_block_invoke`.
   El proyecto no tenía `UIApplicationSceneManifest` y AppDelegate arrancaba RN con el ciclo antiguo.
   iOS 27 exige escenas al compilar con su SDK; Expo 57.0.27 instalado ya incluye el soporte necesario.
2. **Fallo de build separado:** Expo compiló a las 22:09; Xcode falló a las 22:13 en
   **Bundle React Native code and images**, `react-native-xcode.sh:27`, escritura `KoraDev.app/ip.txt:
   Operation not permitted`. **Copy generated compatibility header** de expo-dev-launcher terminó
   correctamente y la cabecera generada existía; no se parchearon launcher ni Pods.
3. Las reconstrucciones posteriores demostraron más rechazos del sandbox de scripts: archivo temporal
   `resources-to-copy-KoraDev.txt` y rsync sobre archivos dentro de los bundles de CocoaPods. Declarar el
   temporal y añadir `/` final a los outputs no resolvió el acceso interior: Xcode normaliza esas rutas y
   concede permisos literales. Esos cambios de outputs CocoaPods fueron restaurados.

Se correlacionó el último crash de las 22:46:14 con el UUID **del binario antiguo**, distinto del corregido;
no pertenece al arranque nuevo. No hay nuevos informes KoraDev tras instalar y probar la corrección.

## Corrección final

`node tools/ios-personal/repair-native-startup.mjs` repara el proyecto existente sin prebuild ni reinstalar
Pods. Valida el marcador y Bundle ID antes de escribir y respalda los originales privadamente:

- Manifest de una escena con `EXExpoAppSceneDelegate`; AppDelegate adopta
  `ExpoReactNativeFactoryProvider`, conserva factory/links y deja a Expo crear la ventana e iniciar RN.
- Salida Metro `ip.txt` declarada; **solo KoraDev/Debug** sobrescribe
  `ENABLE_USER_SCRIPT_SANDBOXING=NO` por incompatibilidad comprobada de los scripts de CocoaPods.
  Se conservan el valor global del proyecto, Release y el proyecto Pods. No afecta al sandbox de iOS/macOS.
- Plugin/generador/verificador de `tools/ios-personal/` incorporan la corrección para evitar regresiones.
  Sin nuevas dependencias ni cambios de lockfile, SDK, arquitectura, Bundle ID, Team, entitlements o Node local.

Referencias primarias: [migración Expo SDK 57](https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md),
[transformación oficial Expo](https://github.com/expo/expo/blob/sdk-57/packages/expo-build-properties/src/iosSceneSupport.ts),
[limitación del sandbox de scripts Apple](https://github.com/swiftlang/swift-build/blob/main/Sources/SWBTaskConstruction/TaskProducerSandboxing.swift).

## Resultados ejecutados en el Mac y iPhone

Entorno: macOS 27.0.1; Xcode 27.0 (27A266a), SDK iOS 27.0; Node 22.23.3, pnpm 10.28.0,
CocoaPods 1.17.0; iPhone físico iOS 27.0.1 conectado por cable y con modo desarrollador.

| Comprobación | Resultado |
|---|---|
| Guardas/verificador y regresiones de arranque | **19/19**, `--native` aprobado |
| Tipos/lint del monorepo | Aprobados |
| Núcleo compartido | **50/50** |
| Workspace KoraDev Debug, destino físico | **BUILD SUCCEEDED**; Swift/Pods/link/firma completados |
| Xcode Run en el iPhone | Instala encima conservando datos; ejecuta bajo LLDB |
| Firma de la app compilada | `codesign --verify --deep --strict` aprobado; perfil existente de desarrollo, sin APNs/Associated Domains |
| Metro | Servidor existente reutilizado; Xcode registra GET del bundle iOS Hermes y ejecución de `main` |
| Pantalla física | Inicio con catálogo Demo e imágenes; Cuenta observada, sin cierre |
| Reapertura normal fuera de Xcode | Aprobada: Inicio visible, sesión existente y contador de carrito conservados; proceso continúa vivo |
| Registros de cierre finales | Último informe sigue siendo el del binario antiguo; ninguno nuevo después de la instalación corregida |

Capturas privadas: `.local/ios-diagnosis/iphone-home-dark.png` y `iphone-reopened.png`.
No convertir esto en validación integral: **no** se ejecutaron checkout/pagos, fotos, Keychain/login completo,
claro/oscuro integral, VoiceOver, Release ni simulador. Oliver decidió posponer esas pruebas y el resto de iOS.
El aviso heredado «Tasa del día no disponible» se observó; no se modificó su lógica ni el backend.

## Para que Oliver pruebe ahora

Abrir **Kora (Dev)** en el iPhone. Dejar Metro activo en el Mac y ambos en la misma red; si aparece el
launcher, seleccionar el servidor Kora (Dev). La versión instalada es Debug y necesita Metro.
No hace falta regenerar ni compilar otra vez para probar las pantallas actuales.
El perfil gratuito existente vence el **2026-10-17 21:49 Caracas**; no se renovó ni eliminó ningún certificado.

Si Metro se cerró:

```bash
cd ~/marketplace/.local/ios-personal
npx expo start --dev-client --lan
```

Para retomar algún día: sincronizar sin borrar `.local/ios-personal`, leer esta evidencia y la guía
`IOS_PERSONAL_TEAM.md`. Pruebas físicas ampliadas solo cuando Oliver las solicite. No avanzar por iniciativa propia.

## Protocolo del agente local

Oliver autoriza consultar directamente los registros Xcode/iPhone, utilizar herramientas de diagnóstico,
corregir las causas demostradas y compilar/probar. No pedirle copiar logs que estén accesibles localmente.
Pedir acción solo si hace falta desbloquear/conectar el iPhone o conceder un permiso específico que realmente
haya sido denegado; explicar aplicación, recurso y permiso. No pedir contraseñas ni certificados privados.

1. Confirmar ejecución macOS y `~/marketplace`; leer `AGENTS.md`/estado/pendientes. Inspeccionar cambios
   antes de sincronizar; conservarlos, incluidos los nativos ignorados. No regenerar `.local/ios-personal`,
   ejecutar prebuild, borrar Pods/DerivedData, reinstalar la app o actualizar dependencias como primer paso.
2. Sincronizar `claude/marketplace-v1` sin sobrescribir trabajo local. Registrar versiones reales de macOS,
   Xcode/SDK, Node/pnpm/CocoaPods, iPhone/iOS, commit y configuración/scheme. Revisar marcador local y Bundle ID;
   no asumir que el ID del teléfono es el predeterminado del helper.
3. Ejecutar desde la raíz el verificador corregido y sus pruebas. No ejecutar el generador para aplicarlo:
   el script lee el proyecto existente. El PASS verifica archivos, no firma, compilación ni arranque.
4. Obtener el log **completo** del último fallo desde Xcode Report Navigator (⌘9), expandiendo la fase.
   Leer también su script generado en el proyecto de Pods/DerivedData. Registrar primer comando que falla,
   stderr concreto, rutas afectadas, configuración y SDK; relacionarlo con el target/versiones instaladas.
5. Obtener el informe KoraDev del iPhone conectado mediante Xcode → Window → Devices and Simulators →
   View Device Logs, o herramientas locales equivalentes. Revisar además `~/Library/Logs/DiagnosticReports`
   y Console para el proceso concreto. Extraer `Exception Type`, `Termination Reason`, hilo disparador/pila,
   información adicional, versión/UUID del binario y hora. Correlacionar con instalación y compilación.
6. Reproducir una vez con el workspace existente, scheme KoraDev y iPhone seleccionado, bajo el depurador.
   Distinguir fallo de compilación de fallo al lanzar un binario anterior. Elegir la corrección mínima que
   explique los logs; conservar Debug, Personal Team y backend de pruebas. No desactivar módulos, cambiar
   arquitectura o sandbox global ni pasar a Release sin una causa demostrada.
7. Probar el fix con la configuración existente: build Xcode/Expo, arranque físico, conexión Metro si Debug,
   cerrar/reabrir, sesión y checklist de `IOS_PERSONAL_TEAM.md` (claro/oscuro, navegación/Atrás, catálogo,
   fichas/Favoritos/carrito/checkout de pruebas). Simulador si está disponible, identificado como tal.
8. Documentar errores, causas, alcance y resultados reales; checkpoint/commit/push y continuidad. Nunca
   subir logs crudos, UDID, Team ID, rutas personales, tokens, perfiles ni certificados. Mantener evidencia
   privada en `.local/`; al repo solo síntesis sin datos personales.

Comprobaciones locales iniciales (después de preservar cambios y sincronizar):

```bash
cd ~/marketplace
uname -s
git status --short --branch
xcodebuild -version
xcrun --sdk iphoneos --show-sdk-version
node --version
pnpm --version
pod --version
node --test tools/ios-personal/*.test.mjs
node tools/ios-personal/verify-personal-team.mjs --native
```

Estos comandos de Xcode/CocoaPods son instrucciones para el Mac; no fueron ejecutados en la nube.
Abrir **el workspace existente**, no el `.xcodeproj` aislado, para incluir los Pods. Conservar firma/Apple ID
y datos de la aplicación. Firma Personal Team caduca a los 7 días; no asumir que esa es la causa sin registro.
Sin EAS Update/build, APK nuevo, App Store/TestFlight/ad hoc, gastos ni Frente B.
