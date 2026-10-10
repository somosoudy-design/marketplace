# Pendientes de Kora

> Por prioridad. Lo actualiza el agente que cambia una prioridad, termina una tarea o encuentra un bloqueo. Lo
> que se está haciendo ahora mismo va en `docs/ESTADO_ACTUAL.md` («Trabajo en curso»).
>
> Estados: **Lista** (se puede empezar), **Bloqueada** (espera algo externo), **En curso**, **Hecha** (se borra
> de aquí y queda en `docs/HISTORIAL_AGENTES.md`).

**Última revisión:** 2026-10-10 04:20Z.

## Prioridad 1: Directriz maestra 02 (hitos D y E)

| # | Tarea | Estado | Depende de / notas |
|---|---|---|---|
| 1.3 | Cierre del hito D: ficha, carrito, checkout, cuotas y seguimiento ya se revisaron en la versión web (claro y oscuro) y el selector de pago es nuevo; falta verlos en Android (capturas del artefacto `capturas-emulador`) y corregir lo que aparezca | Lista | `tools/design/screens.mjs` para la web; capturas de Maestro para el APK |
| 1.4 | Validación integral (hito E): repasar la lista de recorridos de `DIRECCION_PRODUCTO.md` («Criterios de calidad») en el APK real, anotando qué se probó y dónde | Lista (parcial) | La parte con cuenta, tras P2.1 |
| 1.5 | APK 5: avisos push con Firebase, arreglo de «atrás» de Android (`predictiveBackGestureEnabled: false`), identidad nativa violeta y dirección del panel en `eas.json` | En curso (autorizado por Oliver el 2026-10-10 03:50Z) | Código en `5d05346`; compilación en EAS, luego emulador (`02-cuenta` prueba permisos, un aviso push real y la sesión) y prueba de push en el Samsung S24 de Oliver. Tras instalarlo, actualizar la línea `runtime:` de `.github/eas-update-request` |

## Prioridad 1 bis: relevo del 2026-10-09 23Z (pedido de Oliver, en este orden)

| # | Tarea | Estado | Notas |
|---|---|---|---|
| R.1 | Motor comercial de precios | Técnicamente terminado | Faltan solo decisiones de Oliver: recargo, flete, gastos, terminación, efectivo/PayPal en divisas; luego «Regla revisada». `docs/PRECIOS.md` |
| R.2 | Repositorio privado | Autorizado; lo cambia Oliver (la sesión no puede escribir ajustes de GitHub); luego verificar Actions | Imágenes ya en Storage (hecho). Checklist en `docs/ENTORNO.md` §12 bis. **Pedir confirmación a Oliver** antes de cambiar la visibilidad |
| R.3 | Push real en Android | En curso (P1.5) | Firebase y Expo configurados por Oliver y comprobados (proyecto `hayazgo`); falta probar un aviso real en su Samsung |

## Prioridad 2: lo que solo Oliver puede hacer

| # | Tarea | Estado | Dónde |
|---|---|---|---|
| 2.5 | Pantalla «Preguntas» del panel de vendedor, para activar preguntas y respuestas en la ficha | Pospuesta por Oliver (2026-10-10 03:50Z: «no implementes todavía Preguntas y respuestas») | Diseño listo en `docs/PREGUNTAS_Y_RESPUESTAS.md`; se publica por EAS Update, sin APK nuevo |
| 2.2 | Agregar `kora://**` a Redirect URLs | Bloqueada (Oliver) | Supabase › Authentication › URL Configuration |
| 2.3 | Acceso al repositorio para Kevin y Heisber, si van a trabajar con sus agentes | Bloqueada (Oliver) | GitHub › somosoudy-design/marketplace › Settings › Collaborators (permiso *Write*, no *Admin*) |
| 2.4 | Revisar y, cuando quiera, fusionar el PR #1 a `main` | Bloqueada (Oliver) | https://github.com/somosoudy-design/marketplace/pull/1 |

## Prioridad 3: servicios externos (cuentas, credenciales o gasto)

Todo preparado en código y documentado en `docs/SERVICIOS_EXTERNOS.md`; nada simula éxito mientras falte.

| # | Tarea | Estado | Necesita |
|---|---|---|---|
| 3.1 | Dominio y SMTP propio: vuelve el código de 6 dígitos por correo y «Olvidé mi contraseña» para cualquiera | Bloqueada | Dominio y proveedor SMTP (gasto, decisión de Oliver). Luego pegar `supabase/templates/` y activar «Confirm email» |
| 3.2 | Binance Pay y PayPal en línea | Bloqueada | Cuentas de comercio aprobadas y credenciales (`docs/ENTORNO.md` §8); desplegar `payments-start` y webhooks |
| 3.3 | Push en Android | En curso (P1.5) | Firebase listo; el APK 5 lo incluye |
| 3.5 | Datos reales: datos de cobro, tarifas, comisiones, catálogo con fotos autorizadas y precios actuales | Bloqueada | Oliver y los vendedores |
| 3.6 | Publicación en Google Play / App Store | Bloqueada | Oliver lo pidió explícitamente: todavía no. Lista de pasos en `docs/PUBLICACION.md` |

## Prioridad 4: mejoras sin bloqueo

| # | Tarea | Notas |
|---|---|---|
| 4.1 | CI en GitHub Actions con el stack local (hoy las suites corren solo en la máquina de quien trabaja) | El stack sin Docker ya funciona en Linux; falta el workflow |
| 4.2 | Verificación automática de pagos USDT en cadena (TRC20) | Sin custodiar fondos; solo leer la transacción y comparar monto y destino |
| 4.3 | Franja sin conexión en Android real (anula el inset superior del native-stack; verificada solo en web) | Se puede revisar con un recorrido de Maestro en el emulador (modo avión con `adb`) |
| 4.4 | Comprobar la sesión cifrada en un teléfono físico (en el emulador ya dice «Sesión cifrada: sí») | Pantalla `kora://diagnostico` en el Samsung de Oliver |
