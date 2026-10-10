# Historial de agentes

Registro de relevos entre agentes (Claude, ChatGPT u otros) y personas. Cada turno que termina agrega una entrada
arriba de la bitácora, con este formato:

```
### AAAA-MM-DD HH:MMZ · <agente> (<dónde trabajó: sesión en la nube, computadora de Kevin, …>) · <persona que lo dirigió>
- Hecho: lo terminado y probado, con los commits.
- A medias: lo que quedó con `WIP:` y qué falta.
- Pruebas: qué se ejecutó, dónde y con qué resultado; qué no se pudo ejecutar.
- Servicios: qué se cambió fuera del repositorio (migraciones aplicadas, funciones desplegadas, builds,
  actualizaciones publicadas, datos cargados).
- Siguiente: la próxima acción concreta.
- Último commit: `<hash>`.
```

## Relevos

### 2026-10-10 19:41Z (15:41 Caracas, UTC−4) · Codex (entorno cloud) · Oliver
- Pedido: **Frente A V2**, tarjetas integradas, cabecera, barra dinámica e Inicio/descubrimiento. Amplía el
  alcance anterior de solo UX-04. Publicación autorizada por Oliver; eligió explícitamente **production**.
- Continuidad: base sincronizada `9e4e1f5`; AGENTS/estado/pendientes y últimos cambios revisados, regresión
  inicial 16/16. Sin trabajo pendiente de otro agente. Checkpoints/push `c12b46b`, `9efedb8`, `05abb86`,
  `3ec5600`, `622e227`; fuente visual validada/OTA `b60b2cc`; Android `ade80e6`; promotor `27ab49c`;
  resultados `5466e74`; solicitud production `d62b1fa`. No hay WIP activo al cierre.
- Hecho: una superficie foto/nombre de una línea/precio/indicadores/favorito compartida en Inicio/Buscar/
  colecciones; favorito independiente de la ficha. Cabecera marca/avisos y carrito con datos reales/buscador;
  Favoritos en Cuenta y productos, también para visitantes. Barra Inicio · Buscar · Carrito · Cuenta,
  activa expandida/inactivas icono, 180 ms/movimiento reducido, 44 px mínimo y etiquetas accesibles.
  Secciones/carruseles existentes refinados con Electric Violet; demo rotulado sin falsa oferta/escasez.
  Carrito inferior conservado para acceso desde todas las pestañas; superior contextual en Inicio.
- Pruebas locales: tipos/lint sin errores, core 50/50, API 12/12, admin 28/28, app **52 pasan + 1 omisión**
  (confirmación de correo local activa), panel 9/9, promotor 4/4. App incluye 13 casos V2 y 6 UX-04; checkout,
  favoritos/avisos con cuenta y estados comerciales en local. axe **0 infracciones en 8 pantallas/temas**
  a 320 px; contraste texto seleccionado AA. Virtualización conservada; observación web, sin afirmar FPS físicos.
- Android: APK 5 existente, Android 15/Maestro 2.11.0, revisión 31/run
  [38079644334](https://github.com/somosoudy-design/marketplace/actions/runs/38079644334) **Success**.
  Tres recorridos de visitante en claro/oscuro, **6/6**; visitante oscuro necesitó segundo intento automático.
  Primer fallo conservado en resumen, paso inicial no identificado. Capturas comprueban V2/navegación/carrito/
  Favoritos/Atrás. Diagnóstico al reabrir: OTA `01a12744-8ffc-7c8b-bfb0-b32cfae9a11e`, runtime APK 5,
  canal preview, sesión cifrada sí. Cuenta muestra aviso conocido de tasa no disponible; regla sin cambios.
- Diseño/evidencia: 40 capturas web antes/50 después, ambos temas + 320 px; galería autónoma
  `.local/frente-a-v2/comparacion.html` también incorpora 10 capturas Android/ambos temas y controles verificados.
  Evidencia Android en rama `ci/capturas`, copia `.local/frente-a-v2/android/`. Informes/límites en
  `docs/FRENTE_A_V2.md` / `docs/PRUEBAS.md`. No se comprobó Samsung, TalkBack/VoiceOver/FPS/push físicos.
- Servicios: EAS preview [38079470216](https://github.com/somosoudy-design/marketplace/actions/runs/38079470216)
  **Success**, guard runtime `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba` superado.
  Production [38080468671](https://github.com/somosoudy-design/marketplace/actions/runs/38080468671) **Success**,
  grupo `92b6bef2-56e7-4a3e-8012-40c030c48434`, promovido del grupo `5abecd05-a0e4-4d5c-ae6f-79b30984b4a2`
  sin reconstruir, con runs/commits/código/huella/APK/recorridos/temas comprobados. Inventario EAS:
  **0 builds Android terminados con canal production y este runtime**. APK 5 (`d1d10c28`) consume preview;
  conserva allí la misma versión; no se cambia su canal. Sin APK nuevo ni cambios de perfil/backend.
  Sin Supabase/Firebase remotos, pedidos/pagos/cuentas/favoritos/push remotos, motor financiero, SQL, panel,
  dependencias, identidad nativa o Frente B. Las pruebas del panel fueron regresión local, no trabajo en el panel.
- Siguiente: Oliver revisa Frente A V2 en su APK 5 y la galería. No repetir funciones ni despliegues completos;
  ajustar solo este frente si lo pide. Pendientes comerciales/físicos heredados siguen en PENDIENTES.
  **No avanzar al Frente B sin nueva instrucción.** Documentos de continuidad actualizados y push a la rama compartida.
- Último commit: el cierre documental de esta entrada; obtenerlo con `git log -1 origin/claude/marketplace-v1`.


### 2026-10-10 17:35Z (13:35 Caracas, UTC−4) · Codex (entorno cloud) · Oliver
- Pedido: Frente A de HAYAZGO, **solo UX-04**; UX-06 espera revisión. Sin APK nuevo, motor financiero ni panel.
- Continuidad: sincronizada `claude/marketplace-v1` desde `9e50d2a`; leídos AGENTS/estado/pendientes y últimos
  commits. Regresión inicial de navegación, Favoritos, foto de perfil y compartir tiendas: 10/10.
  Checkpoints y push: `8d9cf56` (alcance), `03c92ec` (implementación antes de exportar), `0a34aae` (validación/OTA).
- Hecho: Inicio · Buscar · Carrito · Cuenta en layouts nativo/web. Encabezado Buscar, misma ruta `/explore`;
  eliminado solo el botón de filtros contiguo al buscador de Inicio porque abría el mismo catálogo. Se conservan
  categorías, filtros, contexto, Favoritos y contador. Decisión y archivos en `docs/UX-04.md`.
- Pruebas locales: tipos/lint sin errores; núcleo 50/50, panel unitario 28/28, API compra/avatar 12/12,
  app Playwright 39 aprobadas y 1 omitida por confirmación de correo activa; panel entre roles 9/9.
  Seis casos nuevos de navegación en claro/oscuro. Primeros fallos de pruebas nuevas: selectores alcanzaban
  pantallas ocultas retenidas; ajustado su alcance, suite completa en verde sin desactivar casos.
- Diseño: exportación web reconstruida; capturas con `tools/design/screens.mjs` en `.local/ux04/light/` y
  `.local/ux04/dark/`. Revisados los cuatro destinos a tamaño Pixel 7; Inicio/Buscar también a 340 px.
  Electric Violet conservado. No probado este cambio en emulador ni teléfono físico.
- Servicios: EAS Update Android `preview` desde `0a34aae`,
  [run 38072209661](https://github.com/somosoudy-design/marketplace/actions/runs/38072209661) **Success**;
  comparación con runtime APK 5 `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba` superada antes de publicar.
  Sin APK/build nuevo ni cambios en Supabase remoto. No se comprobó recepción en el Samsung.
- A medias: nada de UX-04. Pendiente la revisión de Oliver; UX-06 no se inició. Los pendientes heredados se conservan.
- Siguiente: Oliver revisa navegación/estado en APK 5; ajustar si lo pide y solo después retomar UX-06.
- Último commit: el de esta entrada de cierre documental; checkpoint funcional/publicación `0a34aae`.

### 2026-10-10 16:05Z · Claude (sesión de Claude Code en la nube, proyecto «TIENDA ONLINE») · Oliver
- Foto de perfil en el emulador: la revisión 29 falló porque el selector de fotos de Android se abre como hoja
  inferior y el nombre de la cuenta seguía visible; `03-foto-perfil.yaml` ahora espera las pestañas del selector. En la
  revisión 30 (run 38064708597) pasa: se abre el selector y al cerrarlo Cuenta queda igual.
- En la misma revisión, `02-cuenta` falló esperando el aviso push «Pedido P-100124 recibido»: `push-dispatch` lo
  envió a Expo (ticket sin error) pero el emulador no lo mostró y perdió adb. Misma intermitencia que la revisión 27.
  Comentado en el PR #1; relanzado una vez, pasó completo (intento 2), aviso push incluido.
- Último commit: el de esta entrada en `claude/marketplace-v1`.

### 2026-10-10 15:30Z · Claude (sesión de Claude Code en la nube, proyecto «TIENDA ONLINE») · Oliver
- Pedido: foto de perfil (Oliver, 15:09Z). Antes se cerró compartir tiendas: emulador revisión 28 en verde (run
  38062623777), con `kora://tienda/patitas`, «Enlace copiado», el menú de Android y la insignia de Kora.
- Hecho: bucket privado `avatars` con permisos solo del dueño y una restricción para que el perfil apunte solo a su
  carpeta (`supabase/migrations/20261010151906_avatars.sql`, aplicada en `mimnotafmfasvwrclxan`); `uploadAvatar`,
  `setAvatar`, `avatarUrl`, `discardAvatar` en `packages/api`; `components/account/ProfilePhoto.tsx` en Cuenta. El
  emulador local de Storage (`tools/local-stack/gateway.mjs`) ahora firma enlaces, borra y respeta el límite por bucket.
- Pruebas: `avatars.test.ts` (API local, 4), `profile-photo.spec.ts` (web), 33 pruebas web pasan y 1 omitida; en el
  proyecto de pruebas, permisos comprobados con roles simulados dentro de una transacción deshecha.
- Servicios: migración aplicada en Supabase; EAS Update al APK 5.
- Siguiente: revisión 29 del emulador con `03-foto-perfil.yaml`; PENDIENTES 4.6 y 4.7.
- Último commit: el checkpoint de la foto de perfil en `claude/marketplace-v1`.

### 2026-10-10 15:00Z · Claude (sesión de Claude Code en la nube, proyecto «TIENDA ONLINE») · Oliver
- Pedido: compartir tiendas e insignias de tienda (Oliver, 14:36Z).
- Hecho (`096828d`): `StoreBadge` y `storeTier` (`components/catalog/StoreBadge.tsx`), `storeLink`
  (`lib/links.ts`), compartir y copiar en `store/[slug].tsx`, sello en `StoreCard.tsx`; Inicio ya no dice
  «Vendedores verificados». Qué falta para la verificada y la asociada, y para enlaces sin la app:
  `docs/INSIGNIAS_TIENDAS.md` (PENDIENTES 3.7 y 4.5).
- Pruebas: Playwright de la app, 32 pasan y 1 omitida (nueva `store-share.spec.ts`: el enlace copiado abre la misma
  tienda; la insignia solo en Kora). Capturas en claro y oscuro. Emulador revisión 27 pedido con `kora://tienda/patitas`.
- Servicios: actualización por EAS Update al APK 5 (run 38060972803). Sin migraciones.
- Siguiente: revisar el resultado de la revisión 27; decisiones de Oliver (tasa BCV, dominio, dato de verificación).
- Último commit: el checkpoint de tiendas en `claude/marketplace-v1`.

### 2026-10-10 14:40Z · Claude (sesión de Claude Code en la nube, proyecto «TIENDA ONLINE») · Oliver
- Pedido: optimizar la ficha de producto (Oliver, 14:17Z): un precio, sin precios por método ni «Disponible» fijos,
  menos texto, y descripción, vendedor y entrega a mano.
- Hecho: solo `apps/mobile/src/app/product/[id].tsx` (y su prueba `product.spec.ts`) (`e18f794`). `Price` sin
  `vesRate` ni `divisas` en la ficha; estado solo si no es «Disponible»; plazo y fecha en «Entrega»; «Pagos» dice que
  cada método muestra su monto al pagar; opiniones vacías en una línea.
- Pruebas: Playwright de la app, 30 pasan y 1 omitida; capturas web en claro y oscuro de un producto disponible, uno
  con opciones, uno por encargo, uno en camino y uno agotado. Antes, la revisión 26 del emulador (run 38058515793)
  pasó en verde con el aviso de tasa BCV vencida y el cambio a Zelle.
- Servicios: actualización por EAS Update al APK 5 (runtime `eb5ed117…`).
- Siguiente: la decisión de Oliver sobre la tasa BCV vencida y su prueba de push en el Samsung.
- Último commit: el checkpoint de la ficha en `claude/marketplace-v1`.

### 2026-10-10 13:30Z · Claude (sesión de Claude Code en la nube, proyecto «TIENDA ONLINE») · Oliver
- Pedidos: simplificar las tarjetas de producto (Oliver, 12:57Z) y la selección del método de pago (13:17Z).
- Hecho: `ProductCard` muestra imagen, nombre en una línea y precio; el descuento y «Quedan N» van sobre la foto;
  se quitó la prop `showStore`, que ya no se usaba (`Catalog`, página de tienda) (`1e3ca57`).
  Pago: lista compacta con `RadioRow` (ahora con icono y estado deshabilitado) y el detalle del método elegido
  (`MethodDetail` en `pay/[orderId].tsx`), sin tocar cálculos ni la cotización.
- Pruebas: Playwright de la app, 29 pasan y 1 omitida (antes, `pnpm db:reset`: el stack local había agotado el
  stock de prueba); capturas web en claro, oscuro, 340 px y 1280 px; emulador con el APK 5 y la actualización.
- Servicios: dos actualizaciones por EAS Update al APK 5 (runtime `eb5ed117…`).
- Siguiente: la prueba de push de Oliver en su Samsung (`PENDIENTES.md` 1.5).
- Último commit: el checkpoint de las tarjetas en `claude/marketplace-v1`.

### 2026-10-10 05:35Z · Claude (sesión de Claude Code en la nube, proyecto «TIENDA ONLINE») · Oliver
- Pedido: «Compilar APK 5 con notificaciones push» (Oliver, 2026-10-10 03:50Z), hitos 1 a 5.
- Hecho:
  - Firebase y Expo comprobados sin mostrar secretos (`tools/eas/check-firebase.mjs`, `firebase-check.yml`):
    proyecto `hayazgo`, paquete `com.example.kora.preview`, clave FCM V1 del mismo proyecto, firma del APK 4 (`77662c3`).
  - Push en la app: registro con permiso, canal «Pedidos y pagos», tocar un aviso abre el pedido, token borrado al
    cerrar sesión; «atrás» de Android corregido; identidad nativa violeta; URL del panel en `eas.json` (`5d05346`).
  - Las huellas incluyen el contenido de `google-services.json`: los workflows de APK y de actualización traen
    `GOOGLE_SERVICES_JSON` con `eas env:pull` (`cc5b101`).
  - Recorrido con cuenta que prueba permisos, aviso push real, sesión y volver a entrar (`50b5478`, `b01dd83`); el
    script del emulador repite una vez un recorrido que falla y lo deja dicho en el resumen (`6175693`).
- Pruebas: emulador Android 15, APK 4 y APK 5 encima, revisión 20: los cinco recorridos pasan al primer intento.
  Aviso «Pedido P-100111 recibido» en la bandeja y abierto al tocarlo. Recibo de Expo «ok». Playwright de la app: 29
  pasan, 1 omitida. Sin probar: un teléfono real.
- Servicios: APK 5 compilado en EAS (build `d1d10c28`, versionCode 4; el intento `54b2be4f` se detuvo antes de
  compilar). Primera actualización al runtime `eb5ed117…` publicada. Ningún cambio en Supabase (solo consultas de
  lectura).
- Siguiente: prueba de push de Oliver en su Samsung (`PENDIENTES.md` 1.5).
- Último commit: el checkpoint «APK 5 delivered» en `claude/marketplace-v1`.

### 2026-10-10 02:50Z · Claude (sesión de Claude Code en la nube, proyecto «TIENDA ONLINE») · Oliver
- Pedido: «Mejora profesional de UI/UX en la app móvil» (Oliver, 2026-10-10 01:30Z), hitos 1 a 5.
- Hecho:
  - Hito 1, navegación: cuatro pestañas; Favoritos con el corazón del Inicio y desde Cuenta; accesos al panel
    publicado (`2dc0d89`).
  - Hito 2, ficha: marca, precio con descuento, píldora de divisas, bolívares discretos con la hoja de tasa,
    precio por opción, «Vendido por», «Características», descripción plegada, «Agregar» y «Comprar» (`09ba8dd`).
  - Hito 3, opiniones siempre visibles; calificar desde la ficha o el pedido entregado; «Compra verificada» y
    respuesta de la tienda (`5b901e8`).
  - Hito 4 evaluado y documentado, sin implementar (`docs/PREGUNTAS_Y_RESPUESTAS.md`).
  - Pago con la tasa y la brecha a un toque (`e5e8b50`).
- Pruebas:
  - Playwright de la app: 28 pasan y 1 omitida; nueva `pay-divisas.spec.ts`.
  - Emulador Android 15 con el APK 4 y las actualizaciones (revisión 15): cuenta, ficha, Favoritos y flecha de
    Favoritos bien.
  - «Atrás» de Android cierra la app: causa nativa comprobada (`PENDIENTES.md` 1.5).
- Servicios: tres actualizaciones por EAS Update al APK 4, todas con el runtime `a4682c83…` (hito 1, hito 2,
  hito 3 con el pago). Ningún APK nuevo, ningún cambio en Supabase.
- Siguiente: decisiones de Oliver sobre el APK 5 (P2.6) y la pantalla «Preguntas» (P2.5).
- Último commit: el checkpoint «Hand-off after the UI/UX milestones» en `claude/marketplace-v1`.

### 2026-10-09 22:10Z · Claude (sesión de Claude Code en la nube, proyecto «TIENDA ONLINE») · Oliver
- Hecho: adopción del protocolo de continuidad multiagente pedido por Oliver. `AGENTS.md` (manual universal),
  `CLAUDE.md`, `docs/ESTADO_ACTUAL.md`, `docs/PENDIENTES.md`, `docs/ARQUITECTURA.md`,
  `docs/DIRECCION_PRODUCTO.md`, `docs/ENTORNO.md` (antes `INSTALACION.md`) y este historial. Reemplazan a
  `docs/CONTINUIDAD.md`, cuyo contenido quedó repartido entre ellos.
- Antes, en el mismo turno: hitos A, B y C de la Directriz maestra 02, selector de pago nuevo (hito D) publicado
  al APK 4 por EAS Update (`dc93a53`).
- Pruebas: las de la bitácora del día; los documentos no cambian código.
- Servicios: ninguno en este relevo. Estado remoto comprobado con el conector a las 22:00Z (ver
  `ESTADO_ACTUAL.md`).
- Después del protocolo, en el mismo turno: primer recorrido automático en el APK real (Maestro en el workflow
  «APK en emulador», `tests/apk-flows/visitante.yaml`), en verde a las 22:21Z.
- Siguiente: recorrido con cuenta cuando Oliver desactive «Confirm email»; cierre del hito D en Android.
- Último commit: el checkpoint «Maestro visitor flow passes on the real APK» en `claude/marketplace-v1`.

## Relevo 2026-10-09 22:30Z → 2026-10-10 00:05Z (Claude, sesión en la nube)

- Pedido de Oliver: Android, panel publicado, push, imágenes a Storage, motor de precios. Se detuvo por créditos.
- Hecho: panel publicado en https://kora-panel.expo.app (EAS Hosting) con `panel-api`; capturas del emulador visibles
  en la rama `ci/capturas`; recorrido con cuenta en el APK hasta cotización y cancelación; imágenes demo del proyecto
  de pruebas movidas a Storage (`assets-mirror`); motor de precios en base (aplicado), núcleo, panel y app
  (`docs/PRECIOS.md`); arreglos: texto «Reembolsado» en pedidos cancelados sin pago, barra superior de la ficha,
  ayudante `signUp` de las pruebas de funciones.
- Pruebas (local): db 82/82, e2e 8/8, funciones 16/16, núcleo 50/50, app 21 (+1 omitida a propósito), panel 9/9 (con
  servidor) y 8/8 en la exportación estática (antes de la ficha de costos), catálogo remoto 11/11.
- Falta: EAS Update + emulador (rev. 12), push Android, decidir repo privado. Ver `ESTADO_ACTUAL.md`.

## Bitácora anterior (de `docs/CONTINUIDAD.md`)

Todas las entradas son de Claude en la sesión de la nube del proyecto «TIENDA ONLINE», dirigido por Oliver.

- 2026-10-09 — Base de datos, motor financiero, app móvil, panel admin y vendedor; todas las suites en verde.
  Primer commit; respaldo en `/mnt/project-files/marketplace/kora-repo.bundle` y `/mnt/project-files/marketplace/repo`.
  Push a GitHub rechazado (app de Claude sin acceso al repo); pedido a Oliver.
- 2026-10-09 — Funciones del servidor (pagos en línea, webhooks, tasas, push) con migración `001600`; pago en
  línea en la app (iniciar, retomar, cancelar); marca del panel desde `config/brand.json`; ESLint en app y
  panel; base reconstruida desde cero y 138 pruebas en verde; documentación final en `docs/`.
- 2026-10-09 — Ronda de profundidad tras la directriz de Oliver ("implementar no es terminar"): opiniones
  verificadas con calificaciones derivadas, perfil de tienda, barras fijas, inicio editorial con feed continuo,
  hoja de la tasa, reclamos como conversación con escalado, centro de notificaciones por día con avisos demo
  seguros, formulario de dirección por secciones, carrito vacío con sugerencias, medición de recomendaciones,
  panel de opiniones y de recomendaciones, validación de parámetros en la base (migración `001800`).
  Cada pieza con prueba y revisión de pantalla (claro y oscuro). Push a GitHub sigue rechazado (403).
- 2026-10-09 — Segunda ronda: tarjeta de pago en verificación, gestión de direcciones con promoción de la
  principal (`001900`), app sin conexión (persistencia selectiva, franja, estados honestos, reintentos en una
  sola capa), hojas de confirmación multiplataforma, recibos de push y salud del canal en el panel (`002000`),
  importador protegido contra DNS rebinding (undici + `guardedLookup`). GitHub ya acepta el push: rama subida
  y PR #1 en borrador. 167 pruebas en verde.
- 2026-10-09 — Parámetros del panel con formularios propios y vista previa de precio, precio sugerido en el
  importador, contacto de soporte configurable (`002100`). 171 pruebas en verde. Oliver aprobó aplicar el
  esquema al proyecto «Marketplace»: 6 migraciones aplicadas; las 15 restantes, en un archivo ensayado para el
  SQL Editor. App vinculada a Expo marketplacebrand/marketplace, perfil `preview` contra ese backend y
  workflow de EAS por etiqueta; esperando el SQL ejecutado y `EXPO_TOKEN`.
- 2026-10-09 — Backend remoto operativo: 21 migraciones verificadas, revisión de seguridad corregida
  (`153318`), tasas y push programados con un token en Vault en vez de la clave maestra (`154233`). Enlaces de
  correo dentro de la app (contraseña nueva, confirmar cuenta), inicio para catálogo vacío, mensajes para
  invitados. EAS por archivo de solicitud; APK 1 compilado, revisado por `verify-apk.mjs` y entregado con
  `que-probar.md`. Catálogo de demostración remoto preparado y ensayado contra una base solo con migraciones
  (compra y reporte de pago de un comprador nuevo); se carga solo con el visto bueno de Oliver. 179 pruebas.
- 2026-10-09 — Directriz maestra 02. Registro y recuperación con código de 6 dígitos dentro de la app (sin
  enlaces a localhost), sesión cifrada con AES-256-GCM y clave en el Keystore, EAS Update por canal y pantalla
  de diagnóstico (`kora://diagnostico`). APK 4 instalado en el Samsung de Oliver. Catálogo de demostración
  cargado en el proyecto remoto. El emulador mostró que en Android la sesión cifrada se leía con 16 bytes de
  más (expo-crypto devuelve el búfer completo al descifrar): corregido recortando al largo del texto cifrado.
  Segunda causa, vista con el diagnóstico paso a paso: en Android `AESSealedData.fromCombined` solo acepta
  bytes (en iOS también base64), así que la sesión guardada no se podía abrir y la app la borraba: Oliver
  quedaba fuera de la cuenta, y el carrito decía «Revisa tu conexión» porque `ErrorState` mostraba ese texto
  ante cualquier error. Corregido por EAS Update al APK 4 (bytes a `fromCombined`, descifrado en base64,
  mensajes según el error y vuelta al modo visitante si el servidor pide iniciar sesión; `session.spec.ts`).
  Registro sin confirmación por correo en el entorno de pruebas, por decisión de Oliver (sección 5).
  Hito C, repaso de 20 pantallas en claro y oscuro (`tools/design/screens.mjs`, ahora también con sesión):
  etiquetas sobre fotos legibles en oscuro, logos demo de tiendas con la identidad nueva (Kora con la marca
  de la app; aplicado también en el proyecto de pruebas con un UPDATE de `logo_path`, `cover_path` y el
  acento de Kora), y el panel web en Plus Jakarta Sans con la marca de la app.
  Identidad Electric Violet (Plus Jakarta Sans, violeta #6D42E8, tinta #1C1928, coral #FF746B) e Inicio de
  tienda (buscador, categorías, colecciones, recomendados, tiendas destacadas, populares; sin bloques de tasa
  ni de confianza). Lo nativo violeta queda para el próximo APK.
