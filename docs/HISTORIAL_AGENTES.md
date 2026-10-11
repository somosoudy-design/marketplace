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

### 2026-10-11 17:27Z · Codex cloud · Oliver · checkpoint previo a migración local de catálogo
- Bloque 1 completo y push `928494d`. Bloque 2: prueba roja real `seller-moderation-before.log` confirma que corregir rechazo y precio publica automáticamente; exige mantener revisión administrativa.
- SQL preparado, sin aplicar: `20261011172600_seller_product_editor.sql`, historial existente preserva revisión; RPC SECURITY INVOKER agrupa writes del editor web con RLS/triggers existentes, ids estables para reintentos, costos mediante set_product_costs sin cambiar fórmulas. No delete, aprobación o cambio de tienda.
- Siguiente: aplicar solo en copia/local, comprobar atomicidad/aislamiento/moderación/costos antes de enlazar editor. Ningún cambio remoto o publicación. Código incompleto aún sin navegación; tipos/lint del bloque 1 aprobados.

### 2026-10-11 17:25Z · Codex cloud · Oliver · cierre bloque 1 perfil operativo
- Hecho: perfil editable en pantalla existente, logo/portada con picker del APK 5, validación/dirty/back, bloqueo de duplicados, reintento sin perder formulario o rutas ya subidas; cache pública actualizada. Datos guardados en stores con sesión y RLS, sin migración.
- Pruebas: UI 26/26 (22 regresiones + 4 operaciones), ambos temas/320 px; permisos 6/6 en copia nueva, tipos/lint/export web aprobados; capturas perfil/error/página pública revisadas. Upload y contenido público comprobados contra gateway local; permisos Storage SQL contra políticas reales. Teléfono/galería nativa no conectados.
- Primeras corridas: asserts de consulta vacía/offline actualizados para formulario y conservación oculta del draft; guest UPDATE da 42501, correcto; test back web usa enlace real. Un intento intermedio perdió el servidor web reutilizado al cerrar su proceso anterior: ERR_CONNECTION_REFUSED, resuelto iniciando stack/runner juntos; corrida final limpia 26/26.
- Servicios: ninguno remoto, solo fixtures demo locales aditivos y copia nueva. Sin APK/EAS/panel/backend/iOS/finanzas. `[skip ci]` evita auto deploy de API. Panel conserva avanzado; sin limpieza de archivos huérfanos por permisos actuales.
- Siguiente: bloque 2 catálogo operativo; después bloque 3 pedidos. Informe `docs/MI_TIENDA_OPERATIVA.md`. Este commit cierra el módulo y conserva cambios antes de avanzar.

### 2026-10-11 17:15Z · Codex cloud · Oliver · checkpoint Mi tienda operativa
- Nuevo alcance: Oliver probó VEN-01A y autoriza perfil, productos y acciones de pedidos, por bloques y en ese orden. No repetir lectura/carrito/franja.
- Base `887197b` limpia y sincronizada; AGENTS/estado/pendientes/arquitectura/dirección leídos. Un solo agente.
- Perfil en implementación local; tipos/lint aprobados. Contratos revisados del panel/RLS: campos permitidos, estado/slug/kind/rating protegidos, bucket stores 5 MB/JPG/PNG/WebP con solo INSERT. Pruebas de persistencia, galería, error/reintento, permisos y aislamiento preparadas; todavía sin resultado.
- Servicios: ninguno. Este checkpoint solo conserva alcance/documentación antes del build. No EAS, APK, remoto, finanzas o iOS. Cambios API posteriores con `[skip ci]` para evitar panel deploy.
- Siguiente: validar/cerrar bloque 1; después catálogo, después acciones de pedidos. BCV crítico separado.

### 2026-10-11 16:52Z (12:52 Caracas) · Codex (cloud Linux) · Oliver · cierre publicación VEN-01A APK 5
- Autorización: Oliver «Sí, publica». EAS preview run 38156171005 **Success**, fuente `2d00f96`,
  guard runtime exacto APK 5 aprobado antes de publicar. Publicación Android 2026-10-11 16:38 UTC.
- Comprobación real: run 38156560856 **Success**, revisión 35/fuente `098f430`, Android 15/Pixel 6,
  APK 5 existente `d1d10c28`. `05-mi-tienda-acceso.yaml`: 2/2 claro/oscuro, sin reintentos, flujo 41 pasos.
  Visitante sin Mi tienda en Cuenta; cuatro rutas nuevas exigen sesión, flecha/Atrás vuelven a Cuenta,
  login y regreso funcionan. Código móvil/API idéntico al publicado; sin escrituras remotas.
- Recepción: diagnóstico en ambos temas confirma OTA `01a12bd4-1483-7096-b0c2-de39d35f4c15`,
  publicada 16:38 UTC, preview/runtime `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`, backend correcto
  y sesión cifrada. No se afirma recepción o validación en el teléfono físico de Oliver.
- Diseño: 14 capturas nativas del recorrido revisadas, claro/oscuro, sin recortes o superposiciones en
  cabeceras/guardas/login/Cuenta. Evidencia inmutable ci/capturas `61ebb1d`; enlaces en `docs/VEN-01A.md`.
- Pruebas previas con roles/datos: UI 22/22, permisos 6/6, núcleo 50/50, tipos/lint, web/Android JS y
  18 capturas, ya aprobadas sobre este código. No repetir suites generales. Sintaxis YAML aprobada con
  parser ya instalado en pnpm; no se añadieron dependencias. Logs privados de Actions/API no accesibles
  desde este cloud: pasos Success y diagnóstico/capturas son la evidencia; no inventar grupo EAS.
- Servicios: únicamente EAS Update Android preview autorizada y prueba en emulador descartable.
  Sin APK nuevo, production, cambios en Supabase/Firebase/backend/panel, checkout, finanzas, iOS/Xcode,
  cuentas/pedidos/pagos remotos o Frente B. Checkpoints `2d00f96`/`098f430` cerrados; sin WIP funcional.
- Siguiente: revisión física con tienda/roles reales, TalkBack/fluidez/navegador. Confirmar actualización
  `01a12bd4` en Cuenta; no republicar por defecto. VEN-01B solo con nuevo alcance de Oliver.
- Último commit: este cierre documental; comprobar `git log -1 origin/claude/marketplace-v1`.

### 2026-10-11 16:41Z (12:41 Caracas) · Codex (cloud Linux) · Oliver · checkpoint tras publicar VEN-01A
- EAS preview run 38156171005 **Success**, fuente `2d00f96`, publicación finalizada 16:38 UTC.
  Pasos Proyecto/Firebase/Runtime/Publicar/Resultado success; guard exacto APK 5 aprobado antes del envío.
  No APK nuevo, cambios financieros, backend, panel, iOS o publicación production.
- Siguiente comprobación nativa breve: revisión 35, nuevo `05-mi-tienda-acceso.yaml`, claro/oscuro en
  APK 5 existente. Visitante: cuatro rutas nuevas protegidas, Cuenta/flecha/Atrás físico/login y diagnóstico
  OTA. No registro/cuentas/pedidos/pagos o escrituras remotas; no repetir franja/carrito anteriores.
- Código móvil/API idéntico al publicado; nuevo cambio solo de prueba, solicitud del emulador y continuidad.
  Pruebas vendedor/admin/multirrol siguen siendo las locales (22/22); no afirmar verificación nativa completa.
- A medias: esperar run/capturas, comprobar qué OTA ejecuta y cerrar documentos. Teléfono físico de Oliver
  no conectado a esta sesión; no afirmar recepción allí. Último commit: este checkpoint de revisión 35.

### 2026-10-11 16:35Z (12:35 Caracas) · Codex (cloud Linux) · Oliver · checkpoint antes de publicar VEN-01A
- Autorización nueva: Oliver respondió «Sí, publica» tras aclarar que preview actualiza su Android.
  Levantada la pausa de publicación; fases B/C, panel/backend, iOS, finanzas y APK nuevo fuera de alcance.
- Continuidad: rama limpia/sincronizada `a22f84b`, código móvil sin cambios desde la validación
  `5f90e27` (UI 22/22, permisos 6/6, núcleo 50/50, tipos/lint, web/Android JS, 18 capturas).
- Solicitud: cambiado únicamente el mensaje de `.github/eas-update-request`; runtime exacto APK 5
  `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba` conservado. El workflow carga Firebase preview y verifica
  el runtime antes de ejecutar EAS Update Android; no cambiar configuración nativa o crear APK.
- Seguimiento: GitHub API responde Forbidden en este cloud; páginas públicas de Actions y Git HTTPS
  funcionan. Usar esas evidencias sin pedir/exponer tokens o afirmar éxito antes de verlo.
- Servicios: publicación solicitada, todavía sin resultado. Siguiente: confirmar run/guard/grupo y
  documentar publicación y límites de validación Android. No publicar production o desplegar panel.
- Último commit: este checkpoint de solicitud autorizada; obtener con `git log -1 origin/claude/marketplace-v1`.

### 2026-10-11 16:22Z (12:22 Caracas) · Codex (cloud Linux) · Oliver · cierre VEN-01A sin publicación
- Hecho: Mi tienda nativa desde Cuenta, roles/pertenencias reales, selector multitienda, resumen de productos/
  entregas, catálogo paginado, pedidos y configuración solo consulta. Acceso al panel existente para editar;
  compradores, vendedores y admin conservan funciones. Sin quinta pestaña, permisos del cliente o escrituras.
- Commits: alcance `c2a9910`, implementación `cc6db73`, separación de compras por cuenta `5f90e27`;
  este cierre agrega `docs/VEN-01A.md` y actualiza arquitectura/continuidad. Sin WIP funcional pendiente.
- Hallazgo visual corregido: un admin sin compras veía pedidos ajenos por la lectura amplia permitida por RLS.
  Cuatro regresiones antes del arreglo; filtro `buyer_id`/caché por usuario en vista compradora. RLS y herramientas
  administrativas preservadas; API sin filtro conserva su alcance anterior. Admin con una compra real local
  ve solo esa compra; multirrol sin compras no ve pedidos ajenos.
- Pruebas finales: UI 22/22, 1,4 min, claro/oscuro, sin omisiones/reintentos; recorrido 320 × 780 px,
  regreso, cambio de tienda/sesión, cargas/errores/vacíos/reconexión. Permisos + herramientas 6/6 en copia
  local nueva, núcleo 50/50, tipos/lint y exports web/Android JS/Hermes aprobados. Dieciocho capturas
  revisadas; 22 pares de contraste AA, mínimo 4,78:1. Evidencia/reproducción en `docs/VEN-01A.md`.
- Límites: Linux sin dispositivo/emulador; no ejecutar nuevo JS en APK 5, Atrás físico, TalkBack o navegador
  nativo. La prueba del panel intercepta solo el destino externo y valida apertura/URL/sesión móvil;
  no se ejecutaron operaciones del panel. No afirmar recepción en el Android de Oliver.
- Servicios: ninguno remoto. Fixtures locales aditivos/demo, sin pagos/borrados. Sin APK, EAS Update,
  dependencias, configuración nativa, SQL/finanzas, checkout, panel, iOS/Xcode o Frente B. `[skip ci]` evita
  autodespliegue del panel por cambios en API; checks locales ejecutados. No se tocaron solicitudes/workflows.
- Siguiente: esperar confirmación de Oliver sobre el paquete anterior; después publicación/prueba controlada
  de VEN-01A con guard runtime APK 5. VEN-01B solo con nueva instrucción; no duplicar consultas ya hechas.
- Último commit: este cierre documental; comprobar `git log -1 origin/claude/marketplace-v1`.

### 2026-10-11 16:16Z (12:16 Caracas) · Codex (cloud Linux) · Oliver · checkpoint alcance comprador multirrol
- Revisión visual de VEN-01A detectó que un administrador recién creado veía pedidos de otros compradores.
  Cuatro casos fallaron antes del arreglo en ambos temas; RLS permite esas lecturas a administradores.
- Corrección mínima: `api.orders.list(buyerId?)` filtra cuando la vista compradora proporciona su usuario;
  `useOrders` usa ese filtro y una clave por cuenta para evitar reutilizar caché amplia anterior. Las lecturas
  administrativas sin filtro conservan sus permisos. Sin cambios a checkout, cálculos, pagos o RLS.
- Pruebas ampliadas: cuenta admin con una compra real de prueba y cuenta con varios roles sin compras;
  ambas deben excluir compras ajenas. Tipos/lint aprobados. Repetir UI 22 casos y exportar web/Android JS.
- Servicios: ninguno remoto; fixtures aditivos locales, sin pagos ni borrados. Commit `[skip ci]` impide
  despliegue automático del panel; no publicar OTA ni APK. Siguiente: validar y cerrar el relevo VEN-01A.
- Último commit: este checkpoint; consultar `git log -1 origin/claude/marketplace-v1`.

### 2026-10-11 16:06Z (12:06 Caracas) · Codex (cloud Linux) · Oliver · checkpoint implementación VEN-01A
- Implementado: Cuenta con roles/pertenencia reales (`api.account.roles/stores`), Mi tienda nativa,
  selección entre tiendas, resumen, catálogo paginado, pedidos recibidos/cerrados y configuración solo consulta.
  Comprador/administración conservados; panel avanzado abre su destino. Sin quinta pestaña o escrituras nuevas.
- Pruebas: Playwright 22/22 (1,6 min, claro/oscuro); aislamiento/permisos 6/6 en copia local nueva,
  núcleo 50/50, tipos/lint y web aprobados. Contraste de 22 pares AA, mínimo 4,78:1.
- Fallos iniciales UI: 14/18; cuenta admin demo sí tenía tienda y selector encontraba correo en pantalla
  oculta. Fixtures/selector corregidos; siguiente 20/22 por selector de botón oculto. Luego el destino local
  del panel no respondía al popup; instrumentación confirmó `window.open` y destino correctos. La prueba
  intercepta solo navegación externa, sin simular datos de la app o probar operaciones del panel; 22/22 final.
- Un diagnóstico local de arranque quedó con puertos ocupados por procesos propios; stop/start sin reset
  recuperó el stack. Debug eligió primero comprador de pedido en lugar de vendedor; consulta corregida para
  exigir pertenencia. Intentos fallidos no contados como pases. Datos originales/credenciales preservados.
- Pendiente: revisión visual completa de capturas, exportación final Android JS/Hermes y relevo final.
- Servicios: ninguno remoto. Commits `[skip ci]` evitan autodespliegue del panel por cambios en API compartida.
  No EAS Update/APK/iOS/Xcode, checkout, pagos, cálculos, dependencias, panel o fases B/C.
- Último commit: checkpoint de implementación; obtener con `git log -1 origin/claude/marketplace-v1`.

### 2026-10-11 15:38Z (11:38 Caracas) · Codex (cloud Linux) · Oliver · inicio VEN-01A
- Base `da4dd54` sincronizada y limpia; leídos AGENTS, ESTADO, PENDIENTES, ARQUITECTURA y DIRECCION_PRODUCTO.
- Autorización nueva: Mi tienda nativa desde Cuenta, resumen real y consultas de productos/pedidos/configuración;
  mantener funciones comprador y panel avanzado. Fases B/C, editor y escrituras fuera de alcance.
- Backend existente revisado: pertenencia `store_members`, roles `user_roles`, RLS y `require_store_member`.
  No hace falta migración ni servicio nuevo; usar las mismas lecturas/RPC del panel con sesión y anon key.
- Restricción vigente: sin EAS Update mientras Oliver valida el paquete anterior. No repetir franja/carrito/
  checkout, no APK, iOS/Xcode, finanzas, panel o servicios remotos. Próximo: implementación y pruebas focalizadas.
- Último commit: checkpoint de alcance; consultar `git log -1 origin/claude/marketplace-v1`.

### 2026-10-11 14:55Z (10:55 Caracas, UTC−4) · Codex (cloud Linux) · Oliver · cierre publicado y validado 4.3
- Hecho: OTA Android preview autorizada, fuente `41d415f`, EAS run 38148288379 Success; runtime APK 5
  `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba` aprobado antes de publicar. Incluye `adf3c78` (franja)
  y `e9b56a0` (errores carrito/checkout). Sin APK nuevo, canal production o cambios financieros/nativos.
- Prueba real: run 38148610558/revisión 34/fuente `19067d6`, Android 15/Pixel 6/APK 5 existente: 2/2,
  claro/oscuro, sin reintentos. Flujo visitante ampliado `ca0923d`, 39 pasos; Favoritos/Atrás/reentrada,
  Inicio conectado/sin conexión/reconectado. Sin cuentas/pedidos/pagos o escrituras remotas.
- Recepción: diagnóstico al reabrir confirma OTA `01a12b6c-3da0-7ce9-a45b-b2dd018a9c13`, publicada
  2026-10-11 14:44 UTC, preview/runtime APK 5. No se afirma recepción en el teléfono físico de Oliver.
- Diseño: 14 capturas revisadas; espacio duplicado desaparece en ambos temas, contenido/header bajan
  solo por el aviso, Atrás/reentrada y reconexión conservan posiciones. Evidencia «después» en ci/capturas
  `2919b0c`; «antes» en `17a77d7`. Enlaces inmutables guardados en `ESTADO_ACTUAL.md`.
- Pruebas complementarias: geometría 9/9 repetida; web 6/6, tipos/lint y bundles aprobados sobre el mismo
  código de app. Sin repetir suites generales. Manifiesto EAS directo bloqueado por proxy; no contado como pase.
- Continuidad: checkpoints `41d415f`/`19067d6` cerrados, 4.3 retirada de pendientes de implementación.
  VEN-01 solo backlog; iOS pospuesto, sin Frente B. Sin WIP funcional activo.
- Siguiente: Oliver descarga/reinicia la OTA, verifica diagnóstico y modo avión/Atrás/reconexión en su
  Samsung, claro/oscuro; registrar solo un fallo nuevo si aparece. No nuevo APK/publicación por defecto.
- Último commit: este cierre de documentación; obtener con `git log -1 origin/claude/marketplace-v1`.

### 2026-10-11 14:46Z (10:46 Caracas, UTC−4) · Codex (cloud Linux) · Oliver · checkpoint después de preview
- Publicación autorizada: EAS run 38148288379 Success, fuente `41d415f`. Guard APK 5 aprobado 14:43:35Z;
  Android/preview publicado 14:44:36Z, reporte Success. Sin build nuevo, canal production o servicios alterados.
- Prueba solicitada tras Success: revisión 34, APK 5 existente, únicamente flujo 04 ampliado en claro/oscuro.
  Esperar resumen/capturas del commit correcto; diagnóstico debe mostrar OTA nueva ~14:44Z y runtime APK 5.
- Lectura directa de manifiesto EAS bloqueada por proxy 403; no contada como evidencia. Se verifica recepción
  desde diagnóstico del emulador, sin afirmar todavía instalación/recepción en Android físico de Oliver.
- Pendiente: 14 capturas, resultado funcional y evaluación visual real de franja/encabezado/contenido/Inicio.
- Último commit: este checkpoint WIP de prueba nativa tras publicación; cerrar después del resultado.

### 2026-10-11 14:41Z (10:41 Caracas, UTC−4) · Codex (cloud Linux) · Oliver · checkpoint antes de EAS Update
- Autorización: respuesta explícita «Autorizar actualización para APK 5»; pregunta especificaba preview y
  entrega a su Android. Autoriza publicar este paquete pese a la prohibición de la sesión corta anterior.
- Fuente: rama sincronizada `ca0923d`, corrección 4.3 `adf3c78` y errores comprador `e9b56a0`, sin nuevos
  cambios de app. Tipos/lint, geometría 9/9, web 6/6 y exportaciones aprobados; flujo 04 ampliado preparado.
- Solicitud: workflow preview existente, solo Android, runtime APK 5 obligatorio
  `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`. Si no coincide, abortar sin APK nuevo ni eludir el guard.
- Pendiente: publicación real/Success y luego emulador con la OTA nueva; revisar 14 capturas y diagnóstico.
  No afirmar todavía que el fallo está resuelto en APK 5 ni recibido en el teléfono del propietario.
- Restricciones: sin canal production, APK nuevo, iOS/Xcode, Frente B/VEN-01, motor financiero, panel o datos remotos.
- Último commit: este checkpoint WIP de solicitud autorizada; cerrar con resultados de publicación y pruebas.

### 2026-10-11 14:38Z (10:38 Caracas, UTC−4) · Codex (cloud Linux) · Oliver · preparación de validación 4.3
- Continuidad: rama `adf3c78` limpia/sincronizada; últimos 15 commits y AGENTS/estado/pendientes revisados.
  No WIP funcional activo ni cambios de otro agente. Corrección existente conservada, sin duplicar funcionalidad.
- Hecho: flujo 04 ampliado con Inicio conectado/sin conexión/reconectado, manteniendo Favoritos y Atrás.
  39 pasos, siete capturas por tema. Comprobación YAML, modos `disabled/enabled/disabled`, IDs y capturas únicas.
  Sin modificar app, dependencias, workflow o solicitudes que disparan APK/OTA/emulador.
- Pruebas: regresión de geometría 9/9 (289 ms). **Flujo nativo ampliado sin ejecutar**; no repetidas las
  suites web/tipos/lint ya aprobadas sobre el mismo código. No se presenta la revisión 33 antigua como «después».
- Bloqueo: Linux sin ADB/emulador/terminal local operativo; perfil development definido, pero sin APK de
  desarrollo disponible. APK 5 preview no carga Metro. Aclaración pendiente: mantener prohibición de publicar
  o autorizar EAS Update preview compatible; ese canal llega al Android de Oliver. No autorización recibida.
- Servicios: ninguno; sin APK/EAS Update/producción, iOS/Xcode, datos remotos, pagos, motor financiero o panel.
- Siguiente: revisar respuesta; si autoriza, guard del runtime APK 5 antes de preview y luego flujo 04/capturas
  ambos temas. En ausencia de autorización/runtime local, mantener bloqueo y no relanzar OTA anterior.
- Último commit: cierre de este bloque de pruebas/documentación; código de la corrección `adf3c78`.

### 2026-10-11 12:39Z (08:39 Caracas, UTC−4) · Codex (cloud Linux) · Oliver · cierre 4.3 en código
- Continuidad: AGENTS/estado/pendientes revisados, rama sincronizada `2323eb2` sin cambios ajenos. Cerrados
  checkpoints `6c4f1be`/`2323eb2`; no duplicar los arreglos comprador `e9b56a0` ni iniciar VEN-01/iOS.
- Reproducción: revisión 33, run 38113135559 Success, Android 15/Pixel 6/APK 5 existente con OTA anterior.
  Visitante Favoritos, conexión/modo avión/Atrás/reentrada/reconexión: 2/2, claro/oscuro, sin reintentos.
  Ocho capturas revisadas en commit ci/capturas `17a77d7`: navegación correcta, pero espacio adicional bajo
  la franja y contenido desplazado demasiado. Reconexión restaura el diseño. Sin cuentas/pedidos/pagos.
- Causa/corrección: el encabezado nativo conserva inset aunque el contexto JS pase a cero; setter Android
  `setTopInsetEnabled` es no-op en screens 4.26.2. `OfflineNotice.tsx` mantiene inset real y compensa solo
  la reserva superior duplicada en Android; wrapper estable, franja encima, sin otro encabezado/diseño global.
  Helper de geometría y regresión acotada añadidos, sin dependencias o cambios nativos.
- Pruebas: geometría 9/9 (dos fallos Android de la política anterior), tipos/lint, exportaciones web/Hermes
  Android, `buyer-errors.spec.ts` 6/6 en 22,4 s, ambos temas; capturas web revisadas. Un CLI con proyecto
  mal delimitado y un arranque local con puerto PostgREST ocupado no ejecutaron pruebas; corregidos sin reset.
  **Sin ejecutar todavía la corrección en Android**; run/capturas de APK 5 son «antes», no «después».
- Servicios/restricciones: ninguno cambiado; sin publicación/EAS Update, APK nuevo, producción, iOS/Xcode,
  motor financiero/SQL, panel, Supabase/Firebase remotos ni nuevas dependencias. VEN-01 solo backlog.
- Siguiente: validar el JS nuevo en Android local existente, flujo 04 y capturas claro/oscuro de Favoritos e
  Inicio; si no hay runtime local, conservar pendiente sin publicar. No relanzar la OTA vieja como validación.
- Último commit: este cierre de código/documentación; consultar `git log -1 origin/claude/marketplace-v1`.

### 2026-10-11 04:55Z (00:55 Caracas, UTC−4) · Codex (cloud Linux) · Oliver · checkpoint de prueba 4.3
- Resultado de revisión 32: run 38112674559 / `6c4f1be`, parsing fallido en ambos temas, dos intentos cada uno.
  El recorrido no se ejecutó; no es un fallo de HAYAZGO. Solo capturas de instalación/diagnóstico del APK existente.
- Causa/corrección: fuente oficial `YamlSetAirplaneMode.kt` de Maestro `cli-2.11.0` acepta cadenas
  `enabled/disabled`, rechaza booleanos. Corregidos tres comandos y solicitada revisión 33 del mismo flujo.
  Sin cambios de app, dependencias o workflow; sin APK nuevo ni publicación.
- Siguiente: esperar capturas del nuevo commit en `ci/capturas`, revisar ambos temas; no usar las del run fallido.
- Último commit: este checkpoint WIP, pendiente de la ejecución real de la prueba corregida.

### 2026-10-11 04:45Z (00:45 Caracas, UTC−4) · Codex (cloud Linux) · Oliver · checkpoint 4.3
- Continuidad: rama `e9b56a0` limpia/sin cambios remotos; AGENTS/estado/pendientes y cierre anterior revisados.
  iOS pospuesto, VEN-01 solo backlog y dos fallos comprador cerrados; no duplicar ese trabajo.
- Camino de reproducción: workflow existente `apk-emulator.yml`, APK 5 ya compilado. Añadido un flujo breve
  visitante con conexión/modo avión/Atrás/reentrada/reconexión y ocho capturas entre claro/oscuro. Solicitud
  revisión 32 selecciona solo ese flujo; sin modificar el workflow o dependencias ni crear usuarios/pedidos/pagos.
- Pendiente: resultado real de Actions y revisión de capturas del commit correcto en `ci/capturas`.
  No se aplica todavía ningún cambio a franja/layout; una captura web no sustituye esta reproducción.
- Restricciones: no APK nuevo/EAS Update/publicación, producción, iOS/Xcode, motor financiero/panel ni servicios remotos.
- Último commit: el checkpoint WIP de esta reproducción; cerrar tras obtener resultado.

### 2026-10-11 04:38Z (00:38 Caracas, UTC−4) · Codex (cloud Linux) · Oliver · bloque 2
- Hecho: checkout muestra error/reintento si falla direcciones en lugar de skeleton indefinido. Carrito muestra
  aviso si falla guardar cantidad; controles de cantidad/Continuar bloqueados durante guardado y Continuar
  también durante actualización. Reutilizados ErrorState/Banner/Stepper; rollback y cálculos intactos.
- Reproducción: 2 fallos esperados antes del cambio, backend local activo; captura de carga infinita y carrito
  sin mensaje conservadas en `.local/buyer-errors/before/`. Datos locales conservados, sin reset.
- Pruebas: `buyer-errors.spec.ts` 6/6 (20,2 s), errores/reintentos, rollback/bloqueos y franja web/reconexión
  en claro/oscuro. Tipos/lint aprobados; seis capturas revisadas en `.local/buyer-errors/`. Ningún pedido
  confirmado ni pago. Runner temporal app sin panel; arranque general lento interrumpido y primer intento
  sin backend persistente interrumpido; no contados como pases. Sin suites extensas ni pruebas nativas.
- Pendiente: 4.3 Android no reproducible aquí sin ADB/emulador/teléfono; franja/layout conservados. Próxima
  acción exacta en estado: APK 5 actual, Cuenta → Direcciones, modo avión, navegación y ambos temas, restaurar red.
- Continuidad: VEN-01 registrada en `70443c0`, sin implementar; iOS abre y está pospuesto. Sin WIP activo.
  Estado/pendientes/historial actualizados. Cambios guardados sin publicar: APK 5 conserva la OTA anterior.
- Servicios/restricciones: sin actualización/APK, producción, módulos/config iOS/Xcode, dependencias, motor
  financiero/SQL, procedimientos de pago, panel ni cambios remotos Supabase/Firebase.
- Último commit: el cierre de este bloque; obtener con `git log -1 origin/claude/marketplace-v1`.

### 2026-10-11 04:33Z (00:33 Caracas, UTC−4) · Codex (cloud Linux) · Oliver · bloque 1
- Continuidad: rama limpia antes de sincronizar; fast-forward `f5efec4` → `9d22155`, últimos 15 commits y
  AGENTS/estado/pendientes revisados. Cierre iOS físico confirmado en relevo del Mac; iOS pospuesto por Oliver.
- Hecho: VEN-01 registrada con prioridad alta tras estabilizar comprador, fases Mi tienda/roles/navegación,
  productos/fotos/precios/existencias y pedidos/configuración/acciones básicas. Panel avanzado conservado;
  iniciativa sin implementar ni autorización para iniciarla en esta sesión.
- 4.3: revisión acotada de `OfflineNotice.tsx`, root layout y prueba web. Falta reproducción Android del inset
  native-stack; no ADB/emulador/teléfono disponibles. Sin cambios especulativos ni instalación de dependencias.
- Siguiente bloque: reproducir error de direcciones que deja checkout cargando y cambio de cantidad del carrito
  fallido sin mensaje. Corregir presentación/error, probar claro/oscuro y commit/push independiente.
- Servicios: ninguno; sin APK, EAS Update, producción, iOS/Xcode, motor financiero ni panel.
- Último commit: `70443c0` (checkpoint de continuidad y VEN-01).

### 2026-10-11 04:00Z (2026-10-11 00:00 Caracas, UTC−4) · Codex (Mac local de Oliver) · Oliver
- Continuidad: sincronizado `f5efec4`; proyecto `.local/ios-personal` existente, firma y configuración privada
  preservados. Consultados directamente logs Xcode/Expo e informes KoraDev del iPhone.
- Causas: UIKit rechaza ciclo antiguo sin escenas en iOS 27; build Xcode falla por escrituras no permitidas
  del sandbox en scripts RN/CocoaPods. `Copy generated compatibility header` de expo-dev-launcher pasó.
- Corrección: escena Expo SDK 57, provider en AppDelegate sin doble arranque, helper reparador con respaldo;
  compatibilidad de scripts solo target KoraDev Debug. Proyecto global/Release/Pods intactos. Las propuestas
  de outputs CocoaPods que no resolvieron el problema fueron restauradas. Sin dependencias nuevas/prebuild/borrados.
- Checkpoints subidos: `cff0d52`, `12686cb`, `0d30497`, `db33ab9`. Cierre final probado en este commit;
  Git HTTPS no tenía credencial, push completado con la autenticación SSH existente, sin modificar el remoto.
- Pruebas Mac: 19/19, `--native`, tipos/lint, core 50/50, build workspace Debug aprobado y firma verificada.
  Xcode Run instala/ejecuta en el iPhone; Metro entrega Hermes, Inicio/Cuenta observados, reapertura normal
  fuera del depurador aprobada con sesión existente y contador de carrito. Sin nuevos informes del binario nuevo.
- Límites: no validación integral de login/Keychain/fotos/checkout/temas/VoiceOver, Release ni simulador.
  Oliver cambió el alcance: solo abrir para probar, no continuar iOS todavía. iOS ampliado pospuesto.
- Servicios: ninguna publicación, cambio remoto, pago ni operación financiera. Android/APK 5/producción intactos.
- Siguiente: Oliver prueba Kora (Dev) con Metro activo; retomar iOS solo a petición. Evidencia/guía en
  `docs/IOS_DIAGNOSTICO.md`; archivos privados en `.local/ios-diagnosis/`. Sin WIP funcional activo.
- Último commit: consultar `git log -1 origin/claude/marketplace-v1` (cierre de este relevo).

### 2026-10-11 02:29Z (2026-10-10 22:29 Caracas, UTC−4) · Codex (entorno cloud Linux) · Oliver
- Pedido: diagnosticar cierre inmediato de la instalación Personal Team y fallo Xcode 27
  `expo-dev-launcher / Copy generated compatibility header`; corregir también Bundle ID sin comillas.
  Oliver autoriza obtener registros directamente del Mac/iPhone, corregir y probar; no pedirle copiarlos.
- Continuidad: sincronizada `264112b`, últimos commits/AGENTS/estado/pendientes/guía revisados; sin WIP ajeno.
  Instalación reportada por Oliver, funcionamiento pendiente; Frente A V2 cerrado.
- Hecho: eliminado falso rechazo del Bundle ID. Verificador usa parser Xcode ya instalado y valida cada
  configuración del target principal; comillas opcionales, ID exacto obligatorio. Sin nueva dependencia.
  `native-project.cjs` y seis regresiones del parser; documentación vigente y relevo `docs/IOS_DIAGNOSTICO.md`.
- Pruebas Linux: 11/11 (6 nuevas + 5 guardas existentes), `--native` contra archivos existentes aprobado;
  copia temporal del pbxproj real sin comillas, Debug/Release aprobados y original intacto. Tipos/lint aprobados.
- Investigación disponible: podspec expo-dev-launcher 57.0.20 no declara literalmente esa fase; faltan Pods,
  script generado y logs reales para atribuir causa. Mensaje final de Xcode y Metro vacío no son suficientes.
  Sin fix especulativo al launcher, firma, arquitectura o dependencias; no se relacionó el verificador con el crash.
- Bloqueo: `/workspace/marketplace` en Linux, sin `~/marketplace`, Xcode/xcrun, logs del Mac/iPhone, terminal Mac
  adjunta o destino de transferencia callable. Autorización concedida; requiere ejecución local en el Mac,
  no otro permiso en Linux. No se consultaron registros nativos ni se compiló/instaló/reprodujo el cierre.
- Aislamiento/servicios: sin regeneración, prebuild, Pods, borrados, cambios en `apps/mobile`, paquetes/config,
  lockfile/workflows, Android/APK 5/producción, motor financiero/panel ni Supabase/Firebase. Sin publicación/gasto.
- Siguiente: abrir esta tarea en Codex local `~/marketplace`; agente consulta directamente logs de fase e informe
  KoraDev, identifica binario/configuración, corrige causa demostrada y prueba iPhone. Seguir `IOS_DIAGNOSTICO.md`.
  Diagnóstico nativo pendiente, sin WIP de código activo. No avanzar al Frente B.
- Último commit: el de esta corrección/relevo; obtener con `git log -1 origin/claude/marketplace-v1`.

### 2026-10-10 19:59Z (15:59 Caracas, UTC−4) · Codex (entorno cloud Linux) · Oliver
- Pedido: preparar instalación gratuita iPhone con Xcode/Apple ID Personal Team/compilación local; sin EAS
  iOS, TestFlight, ad hoc, Expo Go, gastos, App Store, secretos privados ni Frente B.
- Continuidad: sincronizada `cf7a1b9`, AGENTS/estado/pendientes/Frente A V2 y últimos 15 commits revisados.
  Frente A V2 cerrado y recepción Android confirmada; checkpoint/push `498c051`. No WIP de otro agente.
- Hecho: `tools/ios-personal/` genera copia ignorada `.local/ios-personal` del código actual, backend de pruebas
  existente y ID exclusivamente local. APNs/Associated Domains/OTA retirados solo allí; adaptadores push sin
  registro/listeners, campana/listado conservados. Permiso local de perfil/fotos en español, sin micrófono.
  Plugin final rechaza capabilities inesperadas; guardas de backend/anon/ID/overrides y carpeta administrada.
  Generador repetible conserva ID/proyecto Xcode. Guía completa `docs/IOS_PERSONAL_TEAM.md` y continuidad actualizadas.
- Pruebas Linux: guardas 5/5, config Expo/plists nativos reales (`--native`), rechazo de APNs insertado en
  plist (restaurado), prebuild iOS sin Pods, autolinking 39 Expo Apple/10 entradas RN iOS, 34 dependencias
  cotejadas con SDK sin discrepancias. Mínimo plantilla iOS 16.4; icono 1024 RGB generado.
  Hermes iOS exportado (5,5 MB), tipos copia local/monorepo y lint aprobados; core 50/50 y web comprador 40/40,
  incluidos login/códigos, catálogo, fichas, favoritos, carrito, checkout/pago ficticio local, perfil/sesión,
  13 V2 y 6 navegación claro/oscuro. Primera pasada web detenida: 4 fallos, 1 interrumpido, 35 sin ejecutar
  por gateway apagado al cerrar arranque; segunda con servicios vivos aprobada. Sin alterar/desactivar tests.
- Aislamiento: `apps/mobile`, paquetes/config, dependencias/lockfile y workflows sin cambios; huella Android
  sin Firebase igual antes/después `da033dbf2e656078bbc76aa353ad3ed3088134d1`. No afirmar comprobación del
  runtime completo APK 5 sin su archivo Firebase. Sin APK ni EAS Update/publicación, motor financiero o panel.
- Límites/servicios: cloud Linux sin Xcode, simulador ni Mac/iPhone; Pods/Swift/firma/instalación/Keychain iOS
  no ejecutados. Red bloquea Expo/Apple y lectura Supabase remoto por proxy 403; ninguna escritura remota,
  migración, Firebase, pago o gasto. Comparación SDK offline, no Doctor remoto certificado.
- Siguiente: Oliver sigue guía en Mac, Personal Team, iPhone/modo desarrollador, `npx expo run:ios --device`
  y checklist físico; registrar versiones/fecha/commit/resultados sin secretos. Firma 7 días, renovación local.
  No afirmar instalación hasta comprobarla. Sin WIP de código; no iniciar Frente B ni publicar.
- Último commit: el cierre de esta preparación; obtener con `git log -1 origin/claude/marketplace-v1`.


### 2026-10-10 19:44Z (15:44 Caracas, UTC−4) · Codex (entorno cloud) · Oliver
- Aclaración: «producción» significa recibir la actualización directamente en el Android instalado.
  APK 5 utiliza **preview**; no hay pedido de cambiar su canal nativo ni de crear otro APK.
- Comprobado: rama sincronizada/limpia y sin nuevos cambios; publicación preview run 38079470216 Success,
  fuente `b60b2cc`, ya validada en APK 5 Android 15 (revisión 31). No se repite una publicación ya hecha.
- Documentado: objetivo de entrega Android en estado, pendientes y Frente A V2. La publicación adicional
  production se conserva como antecedente. Sin cambios de código/servicios ni necesidad de repetir pruebas.
- Confirmación posterior de Oliver: «ya se actualizó». Recepción del update en su Android confirmada por
  el propietario, sin nueva publicación ni APK. No equivale a comprobar todos los recorridos físicos.
- Siguiente: revisión visual/funcional de Oliver; conservar pendientes físicos específicos y no avanzar al Frente B.
- Último commit: el de esta aclaración; `git log -1 origin/claude/marketplace-v1`.


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
