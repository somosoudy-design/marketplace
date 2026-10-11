# Diagnóstico de la instalación iOS existente

Relevo del 2026-10-10 22:29 Caracas (2026-10-11 02:29Z). Proyecto del Mac: **`~/marketplace`**,
rama **`claude/marketplace-v1`**, variante **`.local/ios-personal`**, app **KoraDev / Kora (Dev)**.
Frente A V2 cerrado. Android/APK 5/producción, Firebase/Supabase remoto, motor financiero y panel intactos.

## Diagnóstico comprobado en Mac — 2026-10-10 22:41 Caracas

Ejecución local en `~/marketplace`, rama sincronizada desde `f5efec4`. macOS 27.0.1, Xcode 27.0
(27A266a), SDK iOS 27.0, Node 22.23.3, pnpm 10.28.0, CocoaPods 1.17.0; iPhone físico iOS 27.0.1,
conectado por cable, emparejado y con modo desarrollador activo. Proyecto/scheme KoraDev, Debug existente.

- Se consultaron directamente 17 informes KoraDev del iPhone con `devicectl`, el log Expo de las 22:09
  y los tres activity logs de Xcode. Evidencia privada en `.local/ios-diagnosis/`.
- Cierre de las 22:27:37: `EXC_BREAKPOINT / SIGTRAP`, terminación `SIGNAL / Trace/BPT trap: 5`, hilo principal
  en `___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption_block_invoke`. El Info.plist no tenía
  `UIApplicationSceneManifest`; AppDelegate creaba UIWindow y arrancaba RN con el ciclo antiguo.
  Expo 57.0.27 instalado ya incluye `EXExpoAppSceneDelegate` y `ExpoReactNativeFactoryProvider`.
- Expo compiló correctamente a las 22:09; el intento Xcode de las 22:13 falló en **Bundle React Native code
  and images**, `react-native-xcode.sh:27`, escritura `KoraDev.app/ip.txt: Operation not permitted`.
  Sandbox de scripts activo y fase sin outputs declarados. La fase **Copy generated compatibility header**
  de expo-dev-launcher terminó correctamente; la cabecera generada existe. No se parchea el launcher/Pods.
- Corrección aplicada con `node tools/ios-personal/repair-native-startup.mjs`: manifest de una escena Expo,
  AppDelegate proporciona factory sin arrancar RN dos veces, y salida `ip.txt` declarada en la fase RN.
  Se conserva `ENABLE_USER_SCRIPT_SANDBOXING=YES`, Bundle ID, Team, entitlements, Node local, Pods y datos.
  Originals respaldados en `.local/ios-diagnosis/startup-backup-*`. No prebuild, borrados ni dependencias nuevas.
- Plugin/generador local incorpora la misma corrección para futuras variantes; verificador comprueba escenas,
  AppDelegate y output además de sus guardas anteriores. Pruebas **18/18**, tipos/lint y `--native` aprobados.
  **Checkpoint antes de compilar: build, firma y arranque físico corregidos todavía pendientes.**

Referencias primarias: [requisito UIKit de Apple](https://developer.apple.com/documentation/uikit/transitioning-to-the-uikit-scene-based-life-cycle),
[transformación oficial Expo SDK 57](https://github.com/expo/expo/blob/sdk-57/packages/expo-build-properties/src/iosSceneSupport.ts),
[sandbox de scripts Xcode](https://developer.apple.com/documentation/Xcode/build-settings-reference).

## Antecedente del relevo cloud (superado el acceso al Mac)

Oliver reporta que `npx expo run:ios --device` compiló e instaló, pero la app se cierra inmediatamente y Metro
no recibe solicitudes. También reporta Xcode 27, target `expo-dev-launcher`, fase
`Copy generated compatibility header`, mensaje final `Command PhaseScriptExecution failed`.
Faltan el comando/error interno de esa fase y el informe de cierre del teléfono. Ese resumen de Xcode no
identifica la causa; Metro vacío no basta para localizar el fallo. No se sabe aún si el binario instalado
corresponde a ese intento de build, ni si ambos problemas están relacionados.

El falso rechazo del Bundle ID está corregido: el verificador parsea el proyecto con la dependencia `xcode`
existente y comprueba todas las configuraciones del target principal. Acepta comillas opcionales, rechaza ID
incorrecto/ausente incluso si otro target coincide. Pruebas Linux 11/11, `--native`, proyecto existente copiado
a temporal con IDs sin comillas y tipos/lint aprobados. No se cambió el código que ejecuta la app.

Se revisó `expo-dev-launcher` instalado, versión 57.0.20. Su podspec declara rutas de compatibilidad Swift,
pero no contiene la fase con ese nombre. No hay Pods/proyecto de Pods ni logs del Mac en la nube que permitan
inspeccionar el script generado. No se ha demostrado un fallo de sandbox, cabecera, firma ni dependencia.
No se han aplicado parches al launcher, Podfile o configuración de compilación.

La sesión que preparó este relevo ejecuta Linux en `/workspace/marketplace`, sin `~/marketplace`, Xcode/xcrun,
terminal Mac adjunta o destino de transferencia disponible. La autorización está concedida; el acceso a esa
máquina requiere abrir/continuar la tarea en Codex **local**, con el proyecto existente `~/marketplace`.
Un permiso de macOS no conecta este contenedor al Mac.

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
