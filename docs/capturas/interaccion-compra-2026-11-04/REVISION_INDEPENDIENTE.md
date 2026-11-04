# Revisión independiente · favoritos y compra compacta · 4 noviembre 2026

**Veredicto: APROBADO para integrar el incremento comprobado de favoritos, carrito, revisión agrupada y carga/transiciones.** No hay correcciones obligatorias abiertas dentro de ese alcance. Cupones sigue pendiente: no se aprueba ni se presenta como entregado. La publicación, compatibilidad y recepción Android corresponden a los controles del integrador y no se certifican con estas pruebas Chromium.

Auditor: agente independiente `/root/reference_reviewer`. El integrador fue el único escritor de código y commits. Este agente escribió únicamente pruebas, evidencias e informe en `.local/reference-20261104/review/` y no publicó. Fuentes: antes `6139009`; app después `55e6aaa`; storefront después `3f05e84`, que incluye la corrección del contenido de diálogo oculto. Servicios: exports separados 8090/8091 y storefront 3200 reconstruido. Backend de pruebas exacto local, sin operaciones remotas ni compras ejecutadas por el auditor.

## Método y evidencia

Se aplicó Product Design `audit` y su `references/design-audit-framework.md`: capturar primero, establecer criterios por tarea y severidad, reproducir errores observables, inspeccionar personalmente el después y medir cambios de composición. Los criterios previos están en `CRITERIOS.md`. El vídeo de X no fue accesible (403); no se afirma haber observado su animación ni copiarla. La referencia son los cinco objetivos escritos por Oliver.

Inspeccioné personalmente 25 PNG originales, detallados en `evidencia-inspeccionada.json`. Incluyen capturas propias de fallos de favoritos/carga y comparaciones generadas por el agente UX con la misma cesta local de 3 referencias, 4 unidades, 2 entregas y total 106,30 USD. No son renders ni montajes. Las capturas largas web no prueban por sí solas la posición real del pie; se inspeccionó además el viewport 320×960 y el final desplazado de revisión.

## Hallazgos antes y correcciones comprobadas

| Hallazgo identificado | Impacto | Resultado después |
|---|---|---|
| Segundo toque de favorito durante POST lanzaba DELETE; liberando POST después quedaba guardado contra la última intención. | Estado visual y backend podían discrepar. | Una escritura por producto pendiente, control deshabilitado, estado accesible y persistencia comprobados. |
| Rollback de lista completa podía borrar otro favorito guardado concurrentemente. | Se perdía el contexto de una operación independiente. | Rollback por producto; el favorito B permanece aunque A falle después. |
| Respuesta tardía podía afectar contexto tras cambiar de cuenta. | Contaminación de estado entre sesiones. | Prueba de cambio de sesión sin recargar durante petición pendiente: cuenta B no hereda favoritos de A. |
| Reintentar tras fallo de escritura y posterior lectura podía recuperar sólo la consulta. | Acción parecía recuperada sin ejecutar el guardado original. | Reintentar recupera datos y ejecuta el segundo POST; guardado real consultado en DB local. |
| Quitar desde Favoritos podía desmontar la tarjeta/control que contiene el error. | Fallo sin explicación o sin recuperación contextual. | Tarjeta retenida mientras está pendiente; error visible, reintento y vaciado real tras éxito. App y web. |
| Placeholder a 412 px medía 291,5 px de alto frente a producto de 246 px. | Salto de 45,5 px por fila al cargar. | Carga/producto coinciden: 184×246 a 412, 138×200 a 320. Diferencia de altura 0. |
| Barra de revisión competía con productos y repetía desglose. | En 320 y texto ampliado ocupaba el 46,3% del viewport. | Total y acción quedan fijos; desglose y explicación permanecen en cuerpo alcanzable. |

Las reproducciones ejecutadas sobre ANTES fueron la carrera POST/DELETE y el salto del placeholder. Los otros riesgos de favoritos surgieron de la inspección y se comprobaron mediante regresiones sobre DESPUÉS; no se atribuye una reproducción antigua que no se ejecutó.

La primera fila y los controles del carrito se perciben como una unidad: fotografía/identidad primero, importe y cantidad/quitar alineados en su pie. En revisión, un solo contenedor agrupa la cesta sin fusionar artificialmente las dos entregas: se conservan tienda, modalidad, método, coste, ETA y Cambiar. El resumen web deja de repetir el inventario.

## Comparación visual comprobada

- App carrito 320: filas **178/160/160 → 152/142/142 px**. Los tres productos y controles quedan completos antes del pie inicial; antes se cortaba la tercera referencia.
- App revisión: primer producto **Y290 → Y248**, 42 px más cerca.
- Pie de revisión 320×892: **210 → 113 px**. A 320×740 y texto 1,6× DOM: **342,375 → 179 px**.
- Final desplazado: último aviso termina en Y755 y pie empieza en Y779 (24 px libres); con texto 1,6×, Y536,84 frente a Y561 (24,16 px). Dirección, plan, desglose y aviso son alcanzables.
- Web carrito 320: contenido **1122 → 989 px**. Resumen desktop ya no se estira hasta la altura de toda la lista.
- Web revisión 320: contenido **1520 → 1439 px**. Su primer producto aparece unos 51 px después por el encabezado de conteo/entrega: se acepta por eliminar inventario duplicado y aclarar agrupación, no se presenta como ahorro vertical universal.
- Claro/oscuro mantienen jerarquía; no se detectó desbordamiento horizontal en las condiciones capturadas. Los datos comerciales no se sustituyeron para mejorar el después.

## Pruebas independientes ejecutadas

**10 casos después aprobados**, sin confundirlos con las dos reproducciones del antes:

1. App: bloqueo de doble toque, un POST, estado y persistencia; objetivo táctil ≥44×44.
2. App: fallo desde tarjeta, rollback, error recuperable y retry; no navegación involuntaria a ficha.
3. App: dos productos concurrentes, fallo tardío de A conserva B.
4. App: logout/login B sin recargar con petición A pendiente; aislamiento de sesión.
5. App: fallo POST y GET; retry recupera consulta y guarda intención original.
6. App: eliminar desde Favoritos mantiene tarjeta/Sheet durante fallo y permite reintentar.
7–8. App: geometría de carga estable a 320/412; preferencia de movimiento reducido sin pulsación de opacidad en la muestra observada.
9. Web: guard de doble toque, fallo POST+GET y retry con persistencia; diálogo accesible a 320 oscuro, sin overflow, cierre ≥44 px y sin alertas montadas inactivas tras éxito.
10. Web: error al quitar desde `/favoritos`, tarjeta y diálogo conservados, retry elimina realmente y muestra vacío.

Logs: `final-tests.log` (7 casos, 35,2 s), `favorites-remove.log` (1 caso, 2,8 s), `web-favorites.log` (2 casos, 13,7 s). Antes: `baseline.log`, `loading-before.log`; son reproducciones de defecto, no pruebas de aprobación. Cada fixture usa host local exacto y se abortan peticiones a Supabase remoto. No se invocó place_order por el auditor.

Las regresiones adicionales de compra, planes, cambio de dirección/entrega, permisos y publicación las registra el integrador; no se suman a los 10 casos independientes. Las cinco capturas automatizadas y mediciones complementarias del especialista UX son evidencia adicional, no casos independientes atribuidos a este auditor.

## Correcciones exigidas durante la revisión

Se devolvió la rama de recuperación de favoritos porque recargar la lista sin ejecutar la intención no resolvía el fallo. El integrador corrigió la secuencia asíncrona y consultó el estado real del query después del await; las pruebas 5 y 9 la validan. Se pidió conservar el control al eliminar desde Favoritos; pruebas 6 y 10 validan recuperación. El integrador corrigió además el contenido de alerta montado en diálogo cerrado; prueba 9 comprueba que ya no existe tras éxito.

No se aceptó presentar un campo de cupón con éxito ficticio, cálculos de descuento en cliente o validación sin contrato de backend. Queda fuera del incremento hasta definir alcance, elegibilidad, concurrencia y cálculo autoritativo. Tampoco se aceptó utilizar sólo screenshots para afirmar fluidez: se verificaron estado, guard y carga, y se mantuvieron los límites de plataforma.

## Límites y pendientes no bloqueantes

- **Cupones: pendiente funcional**, no una mejora implementada. Debe decirse expresamente en la entrega.
- Vídeo inaccesible: ningún dictamen de fidelidad a su interacción.
- Chromium/export app no equivale a Android físico; no se certifican FPS, TalkBack, fontScale real, contraste WCAG completo ni recepción OTA.
- El texto de la pestaña Carrito se trunca con simulación 1,6×; preexistente, icono/estado siguen identificables. Registrar revisión nativa específica, sin disminuir tamaño de texto o áreas táctiles para ocultarlo.
- Carrito desktop puede aprovechar mejor el ancho; no bloquea la mejora móvil ni afecta controles.
- Imágenes de fixture local no representan el catálogo remoto y no se valoró renovación fotográfica en este incremento.

**Sin desacuerdo relevante abierto tras las correcciones.** El APROBADO se refiere a la implementación y evidencia descritas, no a que los cinco deseos estén completos ni sustituye la evaluación de Oliver en su Android.
