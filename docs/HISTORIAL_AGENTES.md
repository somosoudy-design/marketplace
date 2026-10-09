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
