# Logotipo original mayami · Work v3

> Revisión posterior de Oliver: la escala144 en cabeceras resultó excesiva. [Ajuste contextual112/96 y
> preparación del arranque nativo](ESCALA_MAYAMI_2026-11-05.md) sustituyen esas medidas en la interfaz.

5 de noviembre de 2026. Implementación inicial `705da3d`; root único integrador. Este incremento incorpora
el original elegido por Oliver en la interfaz existente. No redefine la marca ni cambia el catálogo.

## Original recibido y preservado

Tras aplicar Oliver la configuración de red, se descargó desde su enlace de Drive
`150rcWyhjqi4LoXnhs3R33ZD1YZEjTrBB` el archivo **MAYAMI_Kit_Vectorial_v3.zip**: 18.578.029 bytes,
65 entradas, CRC íntegro y rutas verificadas antes de extraer. SHA256:
`22574beeae113122dfb669149b86e4729dcf87122674a3d54523bc09aae307d1`.

Se leyó LEEME, el brief y la guía PDF. Los maestros y favicon necesarios se preservaron byte por byte en
[`assets/brand/mayami/v3`](../assets/brand/mayami/v3), con [procedencia y hashes](../assets/brand/mayami/v3/provenance.json).
El ZIP completo queda en `.local/logo-original-20261105`, fuera de Git; no se ejecutó su generador ni se
incorporaron referencias de terceros de la guía. La recuperación fue por Drive, no por Library; no se
necesita volver a pedir el archivo al propietario.

## Decisiones aplicadas

| Superficie | Aplicación del original | Motivo |
|---|---|---|
| Inicio app y cabecera al desplazar | SVG blanco, 144 px de ancho, proporción 1476:280 | Legibilidad sobre la composición editorial violeta en ambos temas, sin ampliar la cabecera para alojar una imagen |
| Web comprador | SVG violeta en claro y blanco en oscuro; 144 px móvil, 176 escritorio | Conserva búsqueda, cuenta y carrito; no se tiñe el logo con el color claro de los botones nocturnos |
| Pie de web | 144 px móvil, 160 escritorio | Misma identidad y enlace de regreso al Inicio |
| Panel | 160 px en acceso, 144 en navegación; blanco/violeta según tema | Identidad común con densidad adecuada para gestión, sin cambiar funciones ni permisos |
| Favicon web/panel | Símbolo óptico e ICO originales | Sustituye la K anterior sólo en los sitios Next, sin modificar recursos nativos del APK |

El lettering del original es MAYAMI; los textos y el nombre accesible conservan **mayami**. No se cambian
trazados, proporciones, espaciado entre letras ni colores del archivo. Ancho mínimo 144 px; alto calculado
27,317 px. El área libre equivale a 62 unidades del maestro: 6,05 px alrededor a ese tamaño. La proporcionan
márgenes, separación y centrado dentro de cabeceras de al menos 44 px, sin duplicar espacios vacíos.

A 320 px, la cabecera web autenticada dispone de 288 px interiores: logo144 + separación12 + tres acciones44.
Se retiró el espacio excesivo entre esas acciones; notificaciones, cuenta y carrito siguen visibles.
No se redujeron los objetivos táctiles para conseguir el ajuste.

## Evidencia visual y revisión

Capturas antes y después de la aplicación real sobre backend local, mismos temas, rutas y anchos. Se
mantienen los datos locales, incluidos fixtures e imágenes preexistentes; no son evidencia de un nuevo
catálogo ni capturas de Android físico. Los PNG se conservan completos, sin retoque.

| Estado | Antes | Después |
|---|---|---|
| App 320 px · claro | [Captura](capturas/logo-mayami-v3-2026-11-05/before-01-app-home-320-light.png) | [Captura](capturas/logo-mayami-v3-2026-11-05/after-01-app-home-320-light.png) |
| App 412 px · oscuro | [Captura](capturas/logo-mayami-v3-2026-11-05/before-01-app-home-412-dark.png) | [Captura](capturas/logo-mayami-v3-2026-11-05/after-01-app-home-412-dark.png) |
| Web 1440 px · claro | [Captura](capturas/logo-mayami-v3-2026-11-05/before-02-web-home-1440-light.png) | [Captura](capturas/logo-mayami-v3-2026-11-05/after-02-web-home-1440-light.png) |
| Web con sesión 320 px · oscuro | [Captura](capturas/logo-mayami-v3-2026-11-05/before-04-web-signed-in-320-dark.png) | [Captura](capturas/logo-mayami-v3-2026-11-05/after-04-web-signed-in-320-dark.png) |
| Acceso panel 320 px · claro | [Captura](capturas/logo-mayami-v3-2026-11-05/before-05-panel-login-320-light.png) | [Captura](capturas/logo-mayami-v3-2026-11-05/after-05-panel-login-320-light.png) |
| Menú panel 320 px · oscuro | [Captura](capturas/logo-mayami-v3-2026-11-05/before-07-panel-menu-320-dark.png) | [Captura](capturas/logo-mayami-v3-2026-11-05/after-07-panel-menu-320-dark.png) |

Corrección exigida por el auditor: [checkout rechazado](capturas/logo-mayami-v3-2026-11-05/revision1-checkout-320-light.png) → [checkout corregido](capturas/logo-mayami-v3-2026-11-05/revision2-checkout-320-light.png). También [pago oscuro](capturas/logo-mayami-v3-2026-11-05/revision2-payment-320-dark.png) y [cabecera app con texto160%](capturas/logo-mayami-v3-2026-11-05/app-sticky-type160-320-dark.png).

[Manifiesto de capturas intactas](capturas/logo-mayami-v3-2026-11-05/manifest.json).

## Control de calidad

- Fuente: cuatro pruebas de integridad, igualdad de SVG embebido/servido, favicon y geometría pasiva;
  tres pruebas existentes de identidad visible, compatibilidad y dominio inactivo.
- `pnpm typecheck` y `pnpm lint`; builds Next de web/panel y exportaciones Expo web/Android Hermes aprobados.
- Fuente nativa: fingerprint relativo idéntico, 63 fuentes iguales, configuración y dependencias nativas
  intactas. Esta comparación local no sustituye el guard exacto APK 5 que ejecuta CI con Firebase original.
-14 escenarios únicos de revisión independiente aprobados, más2 regresiones portátiles de cabecera.
  Las22 capturas previas no se modificaron; se preservan16PNG seleccionados en Git.
- Revisión visual independiente: CAMBIOS OBLIGATORIOS por la cabecera de checkout320. Una regla de
  `purchase.css` conservaba gap16 y forzaba una segunda fila: 144+16+132 superaba los288px disponibles.
  Corregida a12; regresión portable incorporada para checkout y pago. Segunda revisión focal aprobada en checkout y pago, ambos temas; logo y las tres acciones comparten centroY35. La regresión portable pasó2/2.

Recursos Product Design consultados: `index`, `audit` y `audit/references/design-audit-framework.md`.
Se aplicaron comparación por captura, coherencia de superficies, nombre accesible, objetivos táctiles,
foco y reflow. La guía del kit determinó los tamaños, proporción y colores. Dos recursos auxiliares del
plugin no pudieron leerse; la inspección ejecutable se hizo con Playwright/Chromium local, no con un
navegador del plugin. No se utilizaron ImageGen, Canvas ni un lettering sustitutivo.

Especialistas: dirección visual revisó los maestros y las reglas de colocación; integración comprobó
invariancia nativa; auditor independiente revisó el render, la navegación y evidencias. Sólo root editó
archivos versionados, hizo commits y publica. La aprobación interna no certifica accesibilidad global
ni recepción en el teléfono de Oliver.

## Publicación y siguiente paso

Auditor independiente **APROBADO** después de corregir la segunda fila y volver a inspeccionar sus capturas. Se validaron marca normal/sticky, búsqueda con foco, web320/412/1440, acceso/sidebar del panel y texto160% en los puntos afectados. Sin discrepancias pendientes en este alcance.

Publicación confirmada por [CI42066926888](https://github.com/somosoudy-design/marketplace/actions/runs/42066926888), fuente `478246b09b0cba2df8901e426894eb12d85e2387`.

- Android `preview`, ID `01a1ac97-6b93-78c5-b24c-e9a64731b476`.
- Grupo `06e50097-a777-4714-bddb-44337f28ae48`.
- Guard exacto aprobado: `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`, APK5.
- [Observación42067593386](https://github.com/somosoudy-design/marketplace/actions/runs/42067593386) confirma
  última compatible, fuente limpia y sin rollback; creada5nov16:42:47UTC.
- [Resultado de publicación](capturas/logo-mayami-v3-2026-11-05/publicacion.json). No recepción física/emulador comprobada.

No se publicó en `production` ni se generó APK nuevo.
El nombre/icono/splash instalados continúan siendo los compilados en APK 5. El hosting del panel y de la
web compradora no se actualiza mediante una OTA; mayami.app sigue sin activar.

Siguiente: comprobar el ID en Diagnóstico cuando Oliver revise su Samsung; no republicar esta fuente.
Retomar después el diagnóstico del fallo de EAS Hosting del panel y preparar hosting Next protegido para
la web compradora. No repetir la recuperación del logo ni migrar la identidad nativa por una OTA.
