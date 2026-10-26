# HAYAZGO · entrega coordinada del 26 de octubre de 2026

## Disponible para revisión

**Android:** publicada en `preview`, compatible con APK 5. Código funcional `ff9784b`, fuente de publicación `8233df7`, [EAS40413225725](https://github.com/somosoudy-design/marketplace/actions/runs/40413225725) aprobado. ID Android `01a17a59-84da-79e1-a24e-ae78498e7c1c`; grupo `9c671692-ae0a-44c0-ad59-09071ba7d0b7`. Publicada a las 18:34 de Venezuela /22:34 UTC. Runtime `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba` comprobado antes de publicar.

- Carrito: distingue productos, unidades y entregas; precio por unidad separado del importe. Conserva cálculos y totales existentes. Los errores de cantidad y eliminación pertenecen a su operación y variante, sin contaminar otra acción.
- Tiendas: reputación y opiniones admiten reflujo; navegación y regreso conservados.
- Presentación comercial privada: sin banners Demo/entorno ni explicaciones técnicas repetidas. El contexto está en Diagnóstico y las fuentes/licencias de imágenes, en una hoja accesible bajo demanda. Metadata y controles comerciales intactos.
- Galería: conserva fotos nuevas de Storage junto al material registrado. El desplazamiento real actualiza página y créditos. Un fallo de override retira la atribución inaplicable; otra variante conserva sus fuentes.

**Panel:** [kora-panel.expo.app](https://kora-panel.expo.app), código `1480274`, deployment `5zogil9zbb`, build `40410656172.1`. Guardados conocidos y reintentos no duplican variantes/fotos; cada tienda mantiene su borrador, controles bloqueados durante guardado y respuesta tardía sin navegar a otra tienda. Las escrituras siguen siendo secuenciales: no se promete atomicidad ni recuperación tras perder una respuesta/recargar. Administración muestra carga/error/reintento reales de movimientos y evita desbordar el documento. Sin modificar contabilidad o reglas.

## Validación y límites

| Superficie | Comprobaciones ejecutadas | Resultado |
|---|---|---|
| Móvil web local | 7 de carrito/reputación +6 de galería/comercial +2 de tiendas;25 unitarias; tipos/lint monorepo y AndroidHermes |15 UI y25 unitarias aprobadas; auditor visual APROBADO al alcance. |
| Capturas web |40 antes+40 después normales,8 de errores,14 de galería,8 de tienda y16 comparativas de voz,320/412, ambos temas y estrés CSS1,6 |126 PNG originales; hashes conservados. Los pares usan DTO comerciales iguales. No equivalen a fuente AndroidOS ni fotografías nuevas. |
| Panel local |3 de admin +5 de vendedor en export estático, persistencia/reintentos/RLS/roles;28 unitarias admin |8 UI y28 unitarias aprobadas; auditor independiente APROBADO. |
| Hosting real |Marcador SHA/build en ambas direcciones,22 rutas/JS/404 y protección CSP/cabeceras |[40414613732](https://github.com/somosoudy-design/marketplace/actions/runs/40414613732) aprobado;24 tests del verificador. |
| EAS Update |Fuente, canal y runtime APK5 exactos; consulta real de ID/grupo/fecha |Publicada y observada. No es evidencia de recepción física. |
| Android nativo |Descarga del mismo APK5 desde metadatos frescos |**BLOQUEADO antes de instalar:**40416237632 devuelve404;0 recorridos/0 capturas. No aprobación Android. |

[Comparaciones móviles](capturas/equipo-2026-10-26/movil/LEEME.md), [panel](capturas/equipo-2026-10-26/panel/LEEME.md), [recepción Hosting](capturas/equipo-2026-10-26/panel/recepcion-hosting.json) y [límite Android](capturas/equipo-2026-10-26/android-recepcion/LEEME.md).

El enlace del APK5 histórico venció el 24 de octubre a las 04:08UTC. EAS confirma su identidad exacta; se intentó una sola descarga de `applicationArchiveUrl` refrescado y devolvió404. No generar un APK nuevo ni repetir solicitudes idénticas: para completar el emulador se necesita una copia autorizada del mismo archivo conservada en otro almacén. La app instalada puede recibir esta OTA sin reinstalar. En el teléfono comprobar **Cuenta → Diagnóstico → Código** con el ID Android arriba; no hay evidencia física nueva adjunta.

La metadata EAS conserva `dirty:true`, `rollback:false`. El workflow creaba `eas-update.json` no ignorado antes de que CLI calculase ese indicador; root reprodujo que eso basta para marcar el árbol. Se movió el reporte a `RUNNER_TEMP`, se añadió guard de fuente limpia y notificación pública de ID para futuras publicaciones. No se oculta el flag histórico, no se certifica su limpieza y no se republicó JS idéntico para cambiarlo.

## Catálogo: pendiente concreto

**Cero fotografías nuevas integradas en esta entrega.** Se mantienen38 recursos existentes:30 referencias renovadas son25 generaciones y5 derivados CC, no30 fotos auténticas ni un catálogo completo. Trece productos de marca/18 variantes necesitan identidad exacta y material autorizado. Dos especialistas descartaron modelos parecidos, material amateur y permisos no acreditados. [Ficha exacta por UUID/variante](catalogo-exhibicion/recepcion-2026-10-26/LEEME.md).

No se cambia el catálogo para ajustarlo a una fotografía ni se presentan generaciones como originales del fabricante. Los UUID de la semilla local difieren del registro remoto: los pares locales pueden conservar ilustraciones antiguas con texto incrustado y no prueban renovación de fotografías. La galería corregida evita ocultar futuras fotos propias del vendedor, sin otra infraestructura.

## Coordinación, revisión y criterios

Un único integrador escribe, commitea y publica. Seis especialistas reales: catálogo/dirección de arte, auditor de catálogo, UX móvil, administración, vendedor y auditor independiente. Los agentes preparan propuestas en carpetas ignoradas; root las inspecciona e integra. Se rechazaron capturas prematuras, el fallback con crédito incorrecto, el scroll que no actualizaba el indicador y fotografías de correspondencia/calidad insuficientes. Las correcciones se revalidaron antes de solicitar la OTA. La aprobación web no se convierte en aprobación nativa; el cierre Android es BLOQUEADO.

Se consultaron realmente Product Design `index`, `audit` y `user-context`, además de `oliver-design-direction`. Método aplicado: capturar antes → defecto observable → corrección acotada → mismo estado posterior → revisión independiente. Decisiones: jerarquía de cantidad/importe/entrega, reflujo útil, voz comercial normal, atribución secundaria accesible y continuidad de la galería. Se conserva Electric Violet. No Canvas/Canva disponible ni afirmación de usar herramientas de navegador ausentes; la evidencia local procede de Expo/Next exportados y Chromium/Playwright.

## Próximo trabajo exacto

1. Incorporar material fotográfico autorizado de las13 referencias según ficha, sin repetir investigación genérica. Comparar Inicio/Buscar/ficha y variantes reales antes de publicar el lote.
2. Resolver incidencias concretas de Oliver sobre la OTA indicada, mediante reproducción y bloques pequeños. No rehacer la compra progresiva cerrada ni volver a publicar código idéntico.
3. Si se recupera una copia del APK5 existente, ejecutar sólo19/20 claro/oscuro y OS1/1,6; contrastar UUID exacto en Diagnóstico e inspeccionar las capturas. No generar otro APK para sortear la restricción.
4. Mantener continuidad y un único escritor. La preparación funcional de esta semana depende del material y de los recorridos efectivamente comprobados; no se declara el marketplace entero terminado ni un lanzamiento público.

Sin migraciones, Supabase remoto, pagos, tasas BCV, iOS, nueva APK o configuración nativa en este lote. BCV continúa como prioridad crítica separada.
