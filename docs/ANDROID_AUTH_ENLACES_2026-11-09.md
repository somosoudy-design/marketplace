# Frontera de enlaces Android · 9 de noviembre de 2026

**Arreglo local listo; aún no candidato final para Play.** Se partió de la fuente exacta del AAB, no de HEAD compartido. No se creó/subió una app en Play ni se aceptaron declaraciones/App Signing. Sin navegador, nuevoAAB/APK/OTA, firma, backend o configuración remota.

## Qué cambia

El hook anterior adoptaba access/refresh de cualquier URL sin intento ni actor correlacionado; un callback vacío podía devolver ready por una sesiónB ya guardada. Tres caracterizaciones locales reprodujeron adopciónA, falso ready y adopción tras desmontar. Son reproducción del fallo, no aceptación verde ni explotación remota.

La solución mínima es **OTP-only para admisión de enlaces**: auth-callback/reset-password orientan a login/código explícito, sin setSession, exchangeCodeForSession o getSession desde el hook. SDK no auto-adoptaURL en ninguna plataforma. No hay intento asíncrono de enlace que sobreviva al desmontaje, se reactive o reemplace B. Navegación segura existente y estilos se conservan; cambia sólo copy de esos destinos legacy. No se añade PKCE/nonce experimental ni se activan Google/cuotas.

Login/password, signUp con/sin confirmación, verify-email y forgot-password→OTP→NewPasswordForm existentes siguen operando. Enlace viejo, codePKCE no iniciado por esta fuente o cross-device no autentica: iniciar sesión o solicitar **un código nuevo** y escribirlo en la app. Si el link consumió el OTP, no reutilizar ese código. Se puede leer el nuevo código en otro dispositivo. El enlace por sí solo ya no desbloquea confirmación ni edición de contraseña.

## Pruebas y límites

9/9 finales: sesiónB anteURLA, vacío/bare/code/error, replay/desmontaje/cambioURL, ExpoWeb, password, registro con/sin confirmación, OTPsignup, recuperación+PUT explícito ligado al actor y ambas pantallas legacy/fallbacks con retornos seguros. FuenteTS, factory, Provider, formularios, actor-api ySDK2.117.3 reales; React/RN/Expo y transporteAuth enRAM. No se ejecutan efectosguest delProvider. Sin sockets/red externa/credenciales reales, dispositivo, Keystore, render nativo, GoTrue o entrega hospedada.

Tipos móvil/lint focal/diffcheckPASS. El primer check encontró una comilla faltante en copy; se corrigió antes del resultado final y se añadió cobertura sintáctica/de las2pantallas. No se repitieron matricesGoogle, secretos, infraestructuraA/B,16KB o builds. Revisión independiente favorable; ReadyJSON actualizado al hash final tras la corrección.

**Condición pendiente:** las evidencias reutilizadas pruebanOTP conSMTP local, no código visible en correo hospedado. Verificar eso y el flujo en dispositivo antes de dar por final un nuevo binario. Si falta el código, [delta condicionado de correo](propuestas/android-auth/CONDICION_OTP.md), sin aplicar ahora. Por ello no se declara apto el AAB anterior ni final la nueva fuente sólo por esta simulación.

## Fuente y recuperación

- Base `bb3de95871419ac35afb213067d02c9e6cd02835`.
- Fuente `39ffbee1e9bfbaaaba771da35bfa1479bf6044ce`, árbol `46ec34e446545efab5e1e78b6d5e468e8054faad`.
- Patch SHA256 `154c39cc20019db31b660b5b96d7369c0557166b0dda1da9a45bf85dd1c6043c`.
- Bundle SHA256 `745c624d542881c30f1d6f28c5ca7ac4ca48e3b3727373e657c897ae99d2f0e9`.

[Patch de5archivos](propuestas/android-auth/android-auth-only.patch) y [recibo/hash por archivo](propuestas/android-auth/SOURCE_RECEIPT.json). Cuatro fuentes móviles y una prueba; todos los demás blobs de la base intactos, incluidos identidad, paquete/config/lockfile, legales y motor comercial. El AAB existente permanece sin modificar.

Fuente/bundle/logs en `/Users/brandeastudio/.codex/worktrees/mayami-play-privacy/marketplace/.local/android-auth-boundary-20261109`. Caracterización y revisión en `/Users/brandeastudio/marketplace/.local/android-auth-boundary-20261109`; manifiesto SHA256 `eb6630ae62c785a9ddd870633bd87a0135c065157bf63bcada7fc1d23de23d92`. Recuperar bundle sobrebb3 o aplicar patch a esa base; comprobar árbol46ec34e4. No usar HEAD combinado ni el fix web/panel2a como sustituto de este arreglo nativo.

Siguiente decisión: acreditar OTP hospedado, autorizar un nuevo AAB de esta fuente sin Google/cuotas y validar ese candidato en dispositivo antes de la carga final. No se inicia otra tanda ni se cambia ninguna configuración en este cierre. Cuota36%al inicio/35%duranteverificación; límite20%, sin resets. Checkpoints de esta preparación sólo locales, sinpush.
