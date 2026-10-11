# Pendientes de Kora

> Por prioridad. Lo actualiza el agente que cambia una prioridad, termina una tarea o encuentra un bloqueo. Lo
> que se está haciendo ahora mismo va en `docs/ESTADO_ACTUAL.md` («Trabajo en curso»).
>
> Estados: **Lista** (se puede empezar), **Bloqueada** (espera algo externo), **En curso**, **Hecha** (se borra
> de aquí y queda en `docs/HISTORIAL_AGENTES.md`).

**Última revisión:** 2026-10-11 00:35 (Caracas, UTC−4).

## Sesión corta — prioridad vigente

Cerrar uno o dos errores reproducibles de carrito/checkout, sin modificar cálculos, pagos, diseño global,
producción o dependencias. No generar APK ni publicar actualizaciones. iOS **pospuesto por el propietario**;
la app ya abre en iPhone (cierre local `9d22155`).

### VEN-01 — Gestión de vendedores dentro de la app

**Prioridad alta del backlog, después de estabilizar la experiencia del comprador. Solo documentada;
no iniciar implementación sin un nuevo pedido de Oliver.** Los vendedores administrarán su tienda sin salir
de HAYAZGO; el panel web seguirá disponible para funciones avanzadas. Reutilizar roles/permisos y operaciones
existentes del panel/backend; no duplicar reglas comerciales ni crear permisos decididos por el cliente.

| Fase | Alcance previsto | Estado |
|---|---|---|
| VEN-01A | Acceso «Mi tienda», roles, resumen y navegación | Backlog, no autorizada en esta sesión |
| VEN-01B | Crear, editar y gestionar productos, fotografías, precios y existencias | Después de VEN-01A |
| VEN-01C | Pedidos recibidos, configuración de tienda y acciones comerciales básicas | Después de VEN-01B |

## iOS gratuita — pospuesta por Oliver

Preparación técnica terminada: `tools/ios-personal/` y `docs/IOS_PERSONAL_TEAM.md`, variante aislada con
Supabase de pruebas, sin APNs/Associated Domains/OTA. Guardas 5/5, verificación de configuración/plists,
prebuild sin Pods, exportación Hermes, tipos/lint, core 50/50 y web comprador 40/40. iOS 16.4 mínimo.
No cambios en Android/APK 5/producción ni publicación; Frente A V2 cerrado antes de comenzar.

Arranque resuelto en el Mac/iPhone físico: build Debug, firma, Xcode/Metro, Inicio y reapertura normal
aprobados. 19/19, verificador, tipos/lint y core 50/50. Causas y límites en `docs/IOS_DIAGNOSTICO.md`.
Oliver pidió cerrar tras poder abrir la app para probar y **no seguir todavía con iOS**.

| # | Tarea | Estado | Notas |
|---|---|---|---|
| IOS-F | Validación física ampliada (sesión/Keychain, fotos, temas, compra de pruebas, accesibilidad) | Pospuesta por Oliver | Arranque ya funciona. Solo retomar cuando lo solicite; no se prueba Release ni se publica nada por iniciativa propia |

## Frente A V2 — revisión del propietario

Implementación y publicación terminadas; UX-04 reutilizado y UX-06 incluido por el pedido V2.
Resultados/decisiones en `docs/FRENTE_A_V2.md` y relevo en `docs/HISTORIAL_AGENTES.md`.

| # | Tarea | Estado | Notas |
|---|---|---|---|
| A-V2-R | Revisar tarjetas, cabecera, barra expandible e Inicio en el APK 5 | Pendiente de Oliver | Publicado: preview run 38079470216 / production run 38080468671 Success; Oliver aclaró que quería actualizar su Android directamente: APK 5 consume preview; Oliver confirmó «ya se actualizó». Entrega física confirmada, revisión de experiencia pendiente. Android 6/6 (1 reintento), app 52 + 1 omisión, capturas antes/después. Cero builds production compatibles registrados. Sin WIP ni APK nuevo; no avanzar al Frente B |

## Prioridad 1: Directriz maestra 02 (hitos D y E)

| # | Tarea | Estado | Depende de / notas |
|---|---|---|---|
| 1.3 | Cierre del hito D: ficha, carrito, checkout, cuotas y seguimiento ya se revisaron en la versión web (claro y oscuro) y el selector de pago es nuevo; falta verlos en Android (capturas del artefacto `capturas-emulador`) y corregir lo que aparezca | Lista | `tools/design/screens.mjs` para la web; capturas de Maestro para el APK |
| 1.4 | Validación integral (hito E): repasar la lista de recorridos de `DIRECCION_PRODUCTO.md` («Criterios de calidad») en el APK real, anotando qué se probó y dónde | Lista (parcial) | La parte con cuenta, tras P2.1 |
| 1.5 | APK 5 en el Samsung S24 de Oliver: instalarlo encima del APK 4 y probar un aviso push real | Bloqueada (Oliver) | APK 5 compilado (`d1d10c28`) y probado en el emulador, push incluido (`ESTADO_ACTUAL.md`). Guía: `/mnt/project-files/marketplace/telefono/que-probar.md`. Si dice «listo», aviso de prueba solo a su cuenta |

## Prioridad 1 bis: relevo del 2026-10-09 23Z (pedido de Oliver, en este orden)

| # | Tarea | Estado | Notas |
|---|---|---|---|
| R.1 | Motor comercial de precios | Técnicamente terminado | Faltan solo decisiones de Oliver: recargo, flete, gastos, terminación, efectivo/PayPal en divisas; luego «Regla revisada». `docs/PRECIOS.md` |
| R.2 | Repositorio privado | Autorizado; lo cambia Oliver (la sesión no puede escribir ajustes de GitHub); luego verificar Actions | Imágenes ya en Storage (hecho). Checklist en `docs/ENTORNO.md` §12 bis. **Pedir confirmación a Oliver** antes de cambiar la visibilidad |
| R.3 | Push real en Android | Probado en el emulador; falta el teléfono (P1.5) | Firebase y Expo configurados por Oliver y comprobados (proyecto `hayazgo`); aviso real entregado al emulador con recibo «ok» |

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
| 3.5 | Datos reales: datos de cobro, tarifas, comisiones, catálogo con fotos autorizadas y precios actuales | Bloqueada | Oliver y los vendedores |
| 3.7 | Enlaces de tienda y de producto que abran sin la app | Bloqueada | Dominio y publicar ahí la versión web (decisión de Oliver) más `assetlinks.json`; el enlace cambia solo a https al poner el dominio en `config/brand.json` (`docs/INSIGNIAS_TIENDAS.md`) |
| 3.6 | Publicación en Google Play / App Store | Bloqueada | Oliver lo pidió explícitamente: todavía no. Lista de pasos en `docs/PUBLICACION.md` |

## Prioridad 4: mejoras sin bloqueo

| # | Tarea | Notas |
|---|---|---|
| 4.1 | CI en GitHub Actions con el stack local (hoy las suites corren solo en la máquina de quien trabaja) | El stack sin Docker ya funciona en Linux; falta el workflow |
| 4.2 | Verificación automática de pagos USDT en cadena (TRC20) | Sin custodiar fondos; solo leer la transacción y comparar monto y destino |
| 4.3 | Franja sin conexión en Android real (anula el inset superior del native-stack; verificada solo en web) | Revisada en sesión corta: `OfflineNotice.tsx` desplaza el navegador y cambia `SafeAreaInsetsContext.top`; comprobar su efecto en encabezados nativos antes de corregir. Cloud sin ADB/emulador/teléfono; pendiente reproducir en APK 5 existente, claro/oscuro, con y sin conexión. No instalar toolchain ni generar APK para esta sesión |
| 4.5 | Insignias «Tienda verificada» y «Tienda asociada» | El diseño está hecho; falta un dato que solo ponga un administrador, mostrarlo en la app y otorgarlo desde el panel. Detalle en `docs/INSIGNIAS_TIENDAS.md` |
| 4.6 | Foto de perfil: al eliminar una cuenta, borrar también su archivo del bucket `avatars` | `process_account_deletion` ya deja `avatar_path` vacío, pero el archivo queda en la carpeta privada del usuario (nadie más puede verlo). Hacerlo desde una función con la API de Storage |
| 4.7 | Texto del permiso de fotos en iOS (`app.config.ts`, `expo-image-picker`) | La variante iOS Personal Team ya incluye perfil; la configuración compartida permanece intacta para conservar APK 5. Cambiarla solo con el próximo build autorizado, no por OTA |
| 4.4 | Comprobar la sesión cifrada en un teléfono físico (en el emulador ya dice «Sesión cifrada: sí») | Pantalla `kora://diagnostico` en el Samsung de Oliver |
