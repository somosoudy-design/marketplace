# mayami · veredicto independiente · 5 noviembre 2026

**APROBADO para el incremento revisado:** identidad visible coherente, controles compartidos, semántica de Cuenta y corrección responsive del editor. No equivale a aprobar el logotipo pendiente ni a certificar todo el marketplace o una publicación Android.

El código observado corresponde a6ef6503 en app/web y14d5680 en la corrección final del panel. Root añadió después pruebas portátiles y comprobaciones propias; recepción Android, fingerprint y cambios posteriores de aplicación son gates separados de esta revisión.

## Método y evidencia

Se utilizó realmente Product Design **audit** (`c1/audit`) y su `references/design-audit-framework.md`: captura previa, revisión de coherencia, jerarquía, legibilidad y operabilidad en contexto, identificación del impacto y segunda revisión de los puntos rechazados. No se usó Canvas, no se inventaron fuentes externas y no se tomó el código como sustituto de la inspección visual.

Capturas nuevas mediante Chromium/Playwright local; app8090 antes/app8091 después, storefront3200 y panel3100. Temas claro/oscuro;320/412px en Inicio app,320/1440px en web/panel; acceso, Cuenta, menús y diálogo real de confirmación. El editor se inspeccionó a320px en lista, campos y productos. El header web se adaptó a160% de texto manteniendo320px. Es adaptación de texto en navegador, no fontScale Android.

Los PNG originales de `before/` permanecen intactos:41 archivos, SHA256 comprobado. `comparison.html` presenta pares sin alterar archivos; `evidence-manifest.json` registra todas las capturas. Se comparó la misma cuenta local, contenido, ruta, tema y viewport. Las capturas adicionales de detalle se identifican aparte, no se presentan como pares históricos inexistentes.

## Hallazgos y resolución

| Hallazgo observado | Corrección comprobada | Evidencia principal |
|---|---|---|
| kora/punto coral en app/web y K en panel | mayami tipográfico consistente, sin inventar el logo Work. No reduce búsqueda ni acciones. |01-app-home-320-light;04-web-home-320-light;07-panel-login-320-dark |
| Cuenta web usaba bolsa para avisos y persona para direcciones | Campana y pin; coinciden con app y sus destinos. |06-web-account-320-dark |
| Footer app declaraba nombre provisional | mayami + versión, sin razón social inventada. |03b-app-account-footer-320-dark |
| CTA panel cápsula frente a acciones rectangulares app/web | Jerarquía de acciones coherente en ambos temas; selección contextual conserva su forma. |07-panel-login;12-panel-danger |
| Hover secundario web ilegible | Claro2,31→14,98:1; oscuro1,74→17,63:1. |11-web-secondary-hover PNG/JSON |
| Texto blanco sobre danger oscuro |2,28→7,55:1. Hover con opacidad compuesta6,35:1; claro5,44 y hover4,65:1. |12-panel-danger y12b-panel-danger-hover |
| Buscar web comprimido |35,42×44→46×44px, foco visible3px. |14-web-type160 JSON |
| Editor desbordaba320px | Documento504→320px; acciones y campos accesibles sin desplazamiento horizontal. |before/15 frente aafter-r2/15 |
| Primera solución comprimía nombre y mantenía flechas pequeñas | Ronda2 separa nombre/tono de metadata y acciones; nombres completos, ordenar/quitar44×44. |after/15 frente aafter-r2/15;after-r2/16 y17 |

El incremento conserva la jerarquía comercial existente en Inicio y la densidad propia de cada superficie. La nueva fila del editor usa más altura que la anterior: es un intercambio justificado para identificar la colección y actuar con precisión, sin trasladar esa densidad al catálogo comprador.

## Control independiente y pruebas

- Antes: se reprodujeron en DOM los contrastes defectuosos y el overflow; se inspeccionaron capturas, no sólo métricas.
- Ronda1:17/17 casos técnicos pasaron. Aun así el veredicto fue **CAMBIOS OBLIGATORIOS** por truncamiento y objetivos de19/23px dentro del editor. Root aceptó y corrigió la objeción.
- Ronda2 focalizada:3/3 casos pasaron; PNG revisados de lista/campos/productos y diálogo. Todas las acciones ordenar/quitar observadas miden44×44; scrollWidth320 y scrollX0.
- Menús admin/vendedor conservan foco inicial, cicloTab, Escape, bloqueo del fondo y restauración al disparador. Web conserva salto al contenido y foco de búsqueda. Texto160% no solapa mayami y acciones ni provoca overflow del header.
- Se prepararon cuatro casos portátiles para conservar contraste/reflow/objetivos; root los integró y comunicó4/4 aprobados. Esa ejecución corresponde a root, no se atribuye como una segunda ejecución propia.
- No se guardaron, borraron ni reordenaron colecciones. El diálogo se abrió y canceló; escrituras y destinos remotos bloqueados. La única fixture nueva fue un comprador del backend local para acceso/Cuenta.

## Límites y trabajo pendiente

- Falta recibir/recuperar el archivo del logotipo de Work y aplicar sus variantes autorizadas. La firma tipográfica neutral no se declara logo definitivo.
- Los datos y fotografías visibles son fixtures locales, no una auditoría de catálogo remoto. «Ficha ajustada», tasa demo, correos, métricas y la tienda denominada Kora pertenecen a esas fixtures; no justifican alterar datos comerciales. El backend y su seguridad no se certifican por esta revisión visual.
- El alcance no comprueba todos los controles personalizados o todos los recorridos de compra, ni constituye declaración WCAG integral.
- Los PNG de app son Expo web, no Android físico. El nombre/icono/splash del APK y recepción OTA requieren sus comprobaciones propias. La pestaña del exportExpo decía Kora en la captura r1; root comunicó corrección posterior del título web sin cambiar configuración nativa.
- No hay desacuerdos relevantes pendientes tras la segunda ronda. La revisión de Oliver y el recurso original de Work siguen siendo necesarios para cerrar la identidad definitiva; aprobar el incremento no sustituye esa decisión.
