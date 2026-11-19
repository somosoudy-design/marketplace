# mayami · primer incremento de coherencia universal

> Actualización posterior: el bloqueo de acceso al original quedó resuelto. La integración de los vectores
> Work y su validación se documentan en [LOGOTIPO_MAYAMI_V3.md](LOGOTIPO_MAYAMI_V3.md). Lo siguiente
> conserva la evidencia del incremento anterior, cuando todavía se utilizaba el nombre en texto.

Oliver fijó **mayami** y **mayami.app**. Esta entrega hace coherente la identidad de presentación en app,
storefront y panel y corrige errores comprobados de controles y adaptación. Conserva Inicio C, catálogo,
checkout y operaciones existentes. No se presenta como un rediseño integral terminado.

## Qué cambia y por qué

| Hallazgo comprobado | Corrección implementada |
|---|---|
| Kora, K y textos HAYAZGO convivían entre canales | `config/brand-presentation.ts` comparte mayami en las tres interfaces; se retiran K/punto coral antiguos de UI y textos fijos. Cuenta ya no muestra una razón social provisional. |
| Renombrar el archivo de marca podía cambiar runtime y enlaces nativos | Se conserva `config/brand.json` byte a byte. Dominio elegido separado de origen publicado; compartir mantiene `kora://` o el origen web actual. |
| Hover secundario web ilegible: 2,31:1 claro / 1,74:1 oscuro | Hover propio `surfaceSunken/text`: 14,98:1 / 17,63:1 medidos en DOM. |
| Botón destructivo blanco sobre coral en oscuro: 2,28:1 | Token `onDanger`: 7,55:1 oscuro y 6,35:1 con opacidad hover; claro 5,44:1 y hover 4,65:1. |
| Botones principales cambiaban de rectángulo a cápsula entre canales | Radios por función 14/10, objetivos mínimos 44, alturas que admiten contenido. No se cambia toda superficie a una forma única. |
| Buscar web se estrechaba a 35,4 px; Cuenta usaba iconos equivocados | Buscar no se comprime: 46×44. Direcciones usa pin; Notificaciones campana. |
| Editor de colecciones desbordado: 504 px en pantalla de 320 | Grid y contenedores refluibles; nombre completo separado de controles; ordenar/quitar 44×44. Sin ocultar acciones ni cambiar operaciones. |

La tipografía sigue siendo Plus Jakarta Sans. El nombre en texto tiene la misma jerarquía y espaciado
en los tres canales. Electric Violet conserva el papel de identidad, selección y acción; peligro mantiene
su semántica propia. El título de la exportación web de Expo también adopta mayami; la identidad nativa
instalada continúa siendo la de APK 5.

## Logotipo original: pendiente de acceso

Oliver aportó [el archivo de Work en Drive](https://drive.google.com/file/d/150rcWyhjqi4LoXnhs3R33ZD1YZEjTrBB/view).
La política de red de este entorno bloquea la descarga (CONNECT403). No se obtuvo ni inspeccionó el archivo.
Se guardó un borrador de configuración que agrega únicamente `drive.google.com` y
`drive.usercontent.google.com`, conservando los destinos y secretos previos. Requiere revisar y publicar la
configuración desde el entorno; también puede adjuntarse aquí el original.

**El texto mayami no es el logotipo creado por Work.** No se inventó un símbolo sustituto. Cuando se obtenga
el original: inspeccionar formato y proporción, integrar el mismo recurso en las tres interfaces, comprobar
claro/oscuro y tamaño pequeño y publicar la incorporación compatible. Icono/splash/nombre bajo el icono
requieren una build nativa futura, no se cambian mediante esta OTA.

## Evidencia visual comparable

Capturas nuevas del navegador local, mismo backend y estados comparables. La portada local «Ficha ajustada»
es una fixture existente, no prueba de un fallo de contenido remoto. Las imágenes no fueron retocadas.
[Manifest de originales y SHA256](capturas/marca-2026-11-05/manifest.json).

| Pantalla | Antes | Después |
|---|---|---|
| Inicio app, 320 claro | [Original](capturas/marca-2026-11-05/antes/01-app-home-320-light.png) | [Resultado](capturas/marca-2026-11-05/despues/01-app-home-320-light.png) |
| Inicio app, 320 oscuro | [Original](capturas/marca-2026-11-05/antes/01-app-home-320-dark.png) | [Resultado](capturas/marca-2026-11-05/despues/01-app-home-320-dark.png) |
| Inicio storefront, 320 claro | [Original](capturas/marca-2026-11-05/antes/04-web-home-320-light.png) | [Resultado](capturas/marca-2026-11-05/despues/04-web-home-320-light.png) |
| Cuenta web, 320 oscuro | [Original](capturas/marca-2026-11-05/antes/06-web-account-320-dark.png) | [Resultado](capturas/marca-2026-11-05/despues/06-web-account-320-dark.png) |
| Acceso panel, 320 claro | [Original](capturas/marca-2026-11-05/antes/07-panel-login-320-light.png) | [Resultado](capturas/marca-2026-11-05/despues/07-panel-login-320-light.png) |
| Acceso panel, 320 oscuro | [Original](capturas/marca-2026-11-05/antes/07-panel-login-320-dark.png) | [Resultado](capturas/marca-2026-11-05/despues/07-panel-login-320-dark.png) |
| Editor, 320 oscuro | [Original](capturas/marca-2026-11-05/antes/15-panel-editor-320-dark.png) | [Resultado](capturas/marca-2026-11-05/despues/15-panel-editor-320-dark.png) |
| Confirmación destructiva, oscuro | [Original](capturas/marca-2026-11-05/antes/12-panel-danger-320-dark.png) | [Resultado](capturas/marca-2026-11-05/despues/12-panel-danger-320-dark.png) |

También se revisaron Inicio app 412, storefront/panel 1440, teclado, foco, retorno del menú y cabecera web
con texto ampliado a 160%. La prueba de texto ampliado en navegador no equivale a fontScale Android.

## Product Design y control independiente

Recursos realmente consultados:

- `product-design:index` y `product-design:audit`, del complemento instalado.
- `audit/references/design-audit-framework.md`: captura antes de evaluar, jerarquía, coherencia,
  accesibilidad y evidencia posterior. Guió la comprobación en contexto de contrastes, objetivos y reflow.
- `oliver-design-direction/SKILL.md`: coherencia por función, prioridad comercial, densidad apropiada y
  ausencia de decoración sustitutiva. Guió conservar Inicio C y corregir componentes compartidos.

Se usó Chromium/Playwright instalado para capturar la aplicación real. No se afirma acceso a otros chats
de Work, Canvas, Figma o inspección del logo. La revisión no equivale a certificar accesibilidad global.

Root fue el único escritor y publicador. `brand_system` propuso seis intervenciones y revisó siete capturas;
`brand_runtime` comprobó las tres fachadas y los archivos nativos; `brand_auditor` reprodujo los fallos,
capturó estados y revisó de forma independiente. No bastó pasar tests: la ronda 1 terminó en **CAMBIOS
OBLIGATORIOS** porque el editor ya cabía, pero truncaba nombres y mantenía acciones de 19/23 px.
Se reorganizó y se revisó otra vez. Ronda 2: **APROBADO** para este incremento; sin desacuerdos pendientes.
[Veredicto íntegro](capturas/marca-2026-11-05/REVISION_INDEPENDIENTE.md).

## Verificaciones y límites

- Tipos/lint del monorepo, más tipos/lint de los componentes corregidos posteriormente. La pasada móvil
  sin caché detectó un aviso previo en la escritura de valores animados de favoritos; se sustituyó por
  `.set` de Reanimated y se comprobaron las seis regresiones existentes, sin variar la interacción.
- 102 pruebas unitarias: 52 core y 50 panel, incluidas tres de identidad/enlaces.
- Auditor: 17 escenarios iniciales y tres de revisión focal. Cuatro regresiones portátiles conservadas en
  `tests/app-e2e/{panel,storefront}/brand-controls.spec.ts`; no son cuatro funciones comerciales nuevas.
- Builds Next locales, export Expo web y bundle Android Hermes finales. Sin nuevas dependencias.
- [Fingerprint relativo idéntico](capturas/marca-2026-11-05/fingerprint-relativo.json), 63 fuentes;
  Firebase no está presente en este entorno. El guard de CI debe confirmar el runtime exacto APK 5 antes
  de una publicación: `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`.

Sin migraciones, datos remotos, pagos, fórmulas, permisos, iOS ni APK nuevo. No hay prueba física del Samsung
ni emulador disponible. El storefront sigue sin hosting público configurado; los cambios del panel están
en código/build local y su publicación conserva el bloqueo anterior. No confundir esos canales con la OTA.

## Publicación y siguiente paso

Fuentes: `6ef6503`, `14d5680`, `21e6889`, `b8170cc`. Una actualización Android preview publicada con autorización vigente, por [CI41991694643](https://github.com/somosoudy-design/marketplace/actions/runs/41991694643), solicitud `643dd2f`, con guard APK5 y fuente limpia aprobados. ID `01a1aabe-bbe5-71a4-9898-23a967d41a8f`, grupo `e7437246-60e9-4f44-a80a-59d404e2a570`. [Resultado](capturas/marca-2026-11-05/publicacion.json). [Observación41992163529](https://github.com/somosoudy-design/marketplace/actions/runs/41992163529) confirma última compatible, fuente limpia y sin rollback; creada5nov08:06:29UTC. Sin recepción física comprobada. Las13 pruebas del helper de observación también pasaron.

Siguiente tarea concreta: recuperar el archivo original de Work, integrarlo sin recrearlo y revisar sus
variantes de fondo/tamaño. Después activar mayami.app únicamente con hosting/HTTPS/rutas verificados y
planificar identidad nativa cuando Oliver autorice una nueva build. No volver a repetir esta auditoría.
