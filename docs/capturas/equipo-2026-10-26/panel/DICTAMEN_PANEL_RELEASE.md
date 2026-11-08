# APROBADO — solicitar release del panel

Alcance aprobado: estado de lectura/reintento/reflujo en detalle admin y guardado/reintento/borrador por tienda/reflujo del editor vendedor. Fuente admin SHA256 `7196ed958bc732101231fc492e25201c0af9057beca145c7a4d9720c4e739aed`; vendedor `a8c9951d2dad8bb3492ca65d04984f7f2a4f4b625e5d347a795b7de634b4f909`. No aprobar archivos posteriores sólo por compartir commit.

La exportación estática real de raíz fue servida en3101, backend local54321. Se revisaron las configuraciones sin webServer/Next3100, resultados y cuatro PNG estáticos; coinciden byte por byte con sus vistas dev aceptadas. QA comprobó239archivos/hashes del export y el hash del manifiesto como JSON compacto (algoritmo del resumen); registró además el hash de sus bytes formateados. Registro propio: `panel-static-inspeccion.json`.

## Recorridos y permisos comprobados

| Recorrido | Resultado |
|---|---|
| Admin: carga→vacío confirmado; error→reintentar→mismo pedido/dos movimientos |3/3 pruebas versionadas en estático,17,6s; sin cambio financiero. |
| Admin:390/1360, acciones alcanzables y tablas con scroll interno |Correcto; capturas390claro/1360oscuro, sin overflow global. |
| Vendedor: segundo guardado, error de foto, lectura final fallida, tienda durante guardado, producto ajeno |5/5 en una corrida estática,28,8s,0reintentos/omisiones/errores. Persistencia verificada en fixtures locales. |
| Vendedor:375/1280 y validaciones |Reflujo corregido; cuatro capturas estáticas/dev comparables. Catorce PNG finales de viewport ya inspeccionados en la ronda local. |
| Visitante→admin |Redirige a login;0encabezados y0GET ledger. |
| Comprador→admin |Redirige a sin-acceso;0encabezados y0GET ledger. |
| Vendedor→admin |Redirige a vendedor;0encabezados y0GET ledger. |
| Vendedor→edición ajena |Sin guardar; UPDATE local bajo rol vendedor devuelve0 y conserva título. La lectura pública de un producto publicado es permitida por diseño. |
| Miembro de dos tiendas |Nuevo borrador limpio al cambiar y resultado tardío no navega ni notifica en el área nueva. |

Los tests nuevos se inspeccionaron junto a capturas y persistencia; el dictamen no deriva sólo de estar verdes. El gate de release ya está en remoto01baea95 sin haber disparado publicación.

## Condiciones de ejecución y recepción

Raíz puede crear la solicitud sobre el commit aprobado. El workflow debe completar typecheck/lint/tests/build y los guards antes de EAS. La solicitud es un commit con único archivo `.github/panel-deploy-request`, `source:` exactamente HEAD^. Para combinar avances con OTA móvil, usar otro commit de solicitud: no incluir ambos requests en el commit del panel.

La recepción no está comprobada aún: después de publicar, exigir marcador exacto sourceSha+buildVersion en URL inmutable y alias, HTML/JS/404/cabeceras mediante el checker estricto. Si falla tras publicar, no implica reversión automática.

Sin cambios SQL, RLS o contratos backend; no nuevas cuentas/pedidos/pagos remotos. No hay dictamen global de accesibilidad ni de la app móvil. Shell Tab/Escape y tamaños pequeños de controles fotográficos anteriores siguen fuera de este lote. Las escrituras del vendedor continúan secuenciales: no se promete atomicidad ni recuperación tras perder una respuesta/refrescar.
