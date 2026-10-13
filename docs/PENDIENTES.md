# Pendientes de Kora

> Por prioridad. Lo actualiza el agente que cambia una prioridad, termina una tarea o encuentra un bloqueo. Lo
> que se está haciendo ahora mismo va en `docs/ESTADO_ACTUAL.md` («Trabajo en curso»).
>
> Estados: **Lista** (se puede empezar), **Bloqueada** (espera algo externo), **En curso**, **Hecha** (se borra
> de aquí y queda en `docs/HISTORIAL_AGENTES.md`).

**Última revisión:** 2026-10-13.

## UX-ARQ-V2 — arquitectura aprobada; implementación progresiva

Nueva misión de Oliver tras evaluación física insuficiente: dirección integral antes de código. Documento `ARQUITECTURA_EXPERIENCIA_V2.md`, siete esquemas y evidencia en `diseno-v2/`. Product Design realmente consultado; tres especialistas reales de lectura, solo raíz integra/commitea. Ronda1 independiente CAMBIOS OBLIGATORIOS corregidos; ronda2 APROBADO, ecommerce APROBADO y UX acepta, sin desacuerdos importantes. 28 esquemas renderizados y 14 originales actuales; fuentes/costes/límites documentados. Referencias externas bloqueadas; checkout/pago actuales solo por código, sin pruebas autenticadas.

**1A+2A implementado y publicado:** fuente `6df3c7d`, auditor APROBADO tras dos rondas, UI 27+2 y tipos/lint/web/Hermes aprobados. EAS `df823ef` / `38308796610` Success, solo Android preview; Android 39 / `38309209301` **4/4**, ambos temas y fuente OS 1,6, sin reintentos. OTA actual `01a131f4-143f-7afa-a03e-9ac8ffc20573` de 2026-10-12 21:10 UTC, runtime exacto de APK 5. Revisión física de Oliver pendiente.

**Alternativas terminadas, revisión de Oliver pendiente:** A/B/C con Product Design ideate y equipo real, dos rondas; A/B aprobados como conceptos, B recomendada, C **CAMBIOS OBLIGATORIOS por altura**. `ALTERNATIVAS_EDITORIALES_INICIO_V2.md`, tres PNG completos + galería, prompts/procedencia/originales. Solo diseño, ninguna nueva implementación/OTA.

**Próximo incremento propuesto:** B dos productos → colección → otros dos; mismos cuatro SKU/orden/tracking. Requiere elección y aceptación de Oliver de ese cambio de secuencia. C no se acepta como portada predeterminada sin nueva composición revisada. Después 2B de descubrimiento finito, según autorización. No repetir pulido global, Entrega01 o 1A+2A ni publicar por defecto: única autorización de esta sesión ya consumida. BCV crítica y SQL vendedor siguen separados.

## UX-ENTREGA-01 — Buscar y tarjetas (publicada/verificada; revisión de Oliver)

Rediseño significativo autorizado por Oliver tras revisión física del pulido global. Alcance exclusivo Buscar, tarjetas compartidas y adaptaciones imprescindibles. Fuente d945797,29/29 foco, tipos/lint/web/Hermes, axe0/8vistas y50 PNG antes/después/estados aprobados. Cabecera270→164, completas2→4. EAS38297286778 Success publicado19:24UTC; guard APK5 aprobado. Android38/run38297634332 **2/2** claro/oscuro sin reintentos;14 capturas revisadas/OTA `01a13193-1f3f-7f61-8fc6-90f2fa12e20d` recibida. Pendiente exclusivamente revisión física Oliver: diseño comercial, fuentes/TalkBack/fluidez; no repetir auditoría o publicación. No Entrega02/Inicio hasta revisión/nuevas instrucciones de Oliver. Detalle: docs/REDISENO_ENTREGA_01.md.

Antecedente UX global publicado (EAS38291282048 Success); Android37 4/6: enlace `kora://explore` del flujo nuevo queda en Inicio y no llega al buscador. No repetir auditoría general. Oliver confirmó recepción y considera insuficiente el diseño.

## Comprador — bloque cerrado, revisión de Oliver en curso

**Terminada:** error/reintento de direcciones en checkout y error/guardado de cantidades en carrito corregidos;
6/6 Playwright en claro/oscuro, tipos/lint y capturas aprobados. Publicados con autorización de Oliver por
preview compatible APK 5, run 38148288379 Success/fuente `41d415f`.
Sin cálculos/pagos, diseño global, canal production o dependencias. No generar APK.
iOS **pospuesto por el propietario**; la app ya abre en iPhone (cierre local `9d22155`).

**4.3 terminada y publicada:** Android 15/APK 5, run 38148610558/revisión 34, 2/2 sin reintentos y 14
capturas claro/oscuro revisadas. OTA `01a12b6c-3da0-7ce9-a45b-b2dd018a9c13` de 2026-10-11 14:44 UTC
confirmada en diagnóstico. Espacio duplicado eliminado; Favoritos/Atrás/Inicio/reconexión aprobados.
Geometría 9/9, web 6/6, tipos/lint y bundles aprobados. Solo falta revisión física de Oliver de lo publicado,
sin reinstalar, borrar datos ni repetir implementación. Evidencias antes/después en `ESTADO_ACTUAL.md`.

### VEN-01 — Gestión de vendedores dentro de la app

**VEN-01A terminada/publicada; Oliver confirmó y autorizó «Sí, publica».**
EAS preview run 38156171005 **Success**, fuente `2d00f96`, guard runtime APK 5 aprobado.
Revisión 35/run 38156560856 **Success**, visitante 2/2 en Android 15/APK 5, claro/oscuro sin reintentos;
OTA `01a12bd4-1483-7096-b0c2-de39d35f4c15` de 16:38 UTC comprobada, 14 capturas del recorrido revisadas.
Sin cuentas o escrituras remotas. No se afirma recepción en el teléfono físico de Oliver.
Mi tienda y sus secciones de consulta funcionan con roles/pertenencias/RLS reales, conservando compras
propias del usuario incluso con permisos administrativos. Fuentes `cc6db73`/`5f90e27`; UI 22/22,
permisos 6/6, núcleo 50/50, tipos/lint, web/Android JS y revisión de 18 capturas. Detalle: `docs/VEN-01A.md`.
Oliver probó la base de lectura en Android y autorizó Mi tienda operativa; orden obligatorio: perfil, catálogo y pedidos. Posteriormente autorizó publicación: OTA operativa `01a12c4b`, preview 38165223060 Success, Android revisión 36 visitante 2/2. Backend nuevo sin verificar remotamente. Los vendedores administrarán su tienda sin salir
de HAYAZGO; el panel web seguirá disponible para funciones avanzadas. Reutilizar roles/permisos y operaciones
existentes del panel/backend; no duplicar reglas comerciales ni crear permisos decididos por el cliente.

| Fase | Alcance previsto | Estado |
|---|---|---|
| VEN-01A-R | Revisión física de Mi tienda en APK 5: tienda asignada, vendedor/admin/multirrol, cambio de cuenta, TalkBack/fluidez/navegador | Oliver comprobó VEN-01A: funciona como lectura, solicita operaciones. TalkBack/fluidez detallados pendientes. Preview/guard y Android visitante 2/2 aprobados. Confirmar actualización operativa `01a12c4b` al pie de Cuenta; no repetir publicación, franja/carrito o generar APK |
| VEN-01-PERFIL | Perfil editable, logotipo/portada, contacto/políticas | Completado local: UI 26/26 inicial y 4/4 finales, permisos 6/6, tipos/lint/web/Hermes. OTA publicada/guard APK 5 aprobado, prueba física pendiente |
| VEN-01B | Crear, editar y gestionar productos, fotografías, precios y existencias | Completada local: catálogo operativo, UI 30/30 inicial y 8/8 finales, DB 20/20 del bloque. Migración 20261011172600 pendiente de acceso/revisión/autorización/aplicación remota; OTA publicada con fallback de lectura si falta |
| VEN-01C | Detalle y acciones de pedidos recibidos, configuración y acciones comerciales básicas | Completada local: pedidos UI 8/8, DB 10/10 del bloque; perfil/catálogo/pedidos conjunto UI 42/42 + 20/20 operativos + 8/8 pedidos finales, DB 31/31. SQL 20261011174200 solo local, advance_fulfillment intacto, OTA publicada con fallback de consulta |

### VEN-OPS-R — activación y validación pendientes

Código de los tres bloques cerrado y subido, fuente 5a3b884; cierre documental en git log. Informe:
MI_TIENDA_OPERATIVA.md. No repetir implementación ni considerar la exportación una prueba en el teléfono.

1. **Activación remota sin verificar:** acceso Supabase ausente. Paquete exacto preparado en
   tools/supabase-remote/aplicar-mi-tienda-operativa.sql y probado **8/8** más **24/24** permisos/persistencia
   sobre copia local nueva conservada. Solo 20261011172600/20261011174200; identidad Marketplace/Vault,
   transacción, historia conflictiva aborta, registradas se omiten. Revisar/autorización SQL y verificar
   historia/soporte/permisos con cuentas permitidas; sin seed/db push general/build.py antiguo.
   Configuración cloud aditiva guardada pendiente de publicar/valor seguro SUPABASE_ACCESS_TOKEN;
   alternativa operador SQL Editor documentada. No pedir claves por chat.
2. **Publicación cumplida:** preview 38165223060/2a38dfb, guard APK 5, OTA `01a12c4b` de 18:48 UTC.
   Android 15 revisión 36/run 38165564922 visitante 2/2 claro/oscuro, seis rutas protegidas, Atrás/inicio/
   recepción comprobados; 18 capturas revisadas. Sin APK nuevo, cuentas o escrituras remotas.
   Oliver comprueba galería/teclado/formularios/Atrás/sesión/roles/TalkBack/fluidez físicamente.
   No repetir publicación por defecto ni considerar el flujo visitante como guardado nativo autenticado.
3. Panel conserva modo/origen/enlace de costos, variantes automáticas nuevas, operaciones avanzadas,
   importación/lotes, revisión de pagos/cancelaciones/reembolsos/finanzas con los permisos existentes.
   Fotos guardadas no se eliminan por móvil; no hay drafts persistidos en el backend actual.

### BCV — prioridad crítica separada

Pendiente de diagnóstico/corrección específica de tasas BCV. No se investigó, implementó o desplegó en
Mi tienda operativa; conserva su prioridad crítica. No resolver con valores fijos o tasas vencidas silenciosas.
Retomar como bloque independiente cuando Oliver lo indique; no ampliar el alcance vendedor por esta prioridad.

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
| 4.5 | Insignias «Tienda verificada» y «Tienda asociada» | El diseño está hecho; falta un dato que solo ponga un administrador, mostrarlo en la app y otorgarlo desde el panel. Detalle en `docs/INSIGNIAS_TIENDAS.md` |
| 4.6 | Foto de perfil: al eliminar una cuenta, borrar también su archivo del bucket `avatars` | `process_account_deletion` ya deja `avatar_path` vacío, pero el archivo queda en la carpeta privada del usuario (nadie más puede verlo). Hacerlo desde una función con la API de Storage |
| 4.7 | Texto del permiso de fotos en iOS (`app.config.ts`, `expo-image-picker`) | La variante iOS Personal Team ya incluye perfil; la configuración compartida permanece intacta para conservar APK 5. Cambiarla solo con el próximo build autorizado, no por OTA |
| 4.4 | Comprobar la sesión cifrada en un teléfono físico (en el emulador ya dice «Sesión cifrada: sí») | Pantalla `kora://diagnostico` en el Samsung de Oliver |
