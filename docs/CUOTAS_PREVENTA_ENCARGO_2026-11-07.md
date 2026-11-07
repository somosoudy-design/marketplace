# Tres pagos para preventa y encargo ·7nov2026

## Alcance autorizado

Todos los productos reservable/preventa y on_order/por encargo deben ofrecer tres pagos totales, incluida la
inicial. Conservar términos vigentes, diseño, guest, inventario/precios del servidor e históricos; sin compras
ni pagos reales. Mixtos no deben financiar productos ajenos por una inferencia nueva.

## Datos comprobados

Tres GET públicos MIM a20:23:53UTC respondieron200: three_parts activo, anticipo0,installments3, intervalo15d,
recargo0,mínimo60,flujos local_stock/import_order. Deposit50 tiene mínimo40,una posterior30d;full100/0.
8productos publicados,5reservable/on_order, HiTuneS3 dos variantes activasUSD39. El bloqueo de39 es el mínimo,
no una cuarta cuota actual:0/3 ya genera3pagos, primero hoy. No usar el seed como prueba de datos actuales.

## Implementación en curso

Nueva elegibilidad: conservar criterio previo de mínimos/flujos, o permitir three_parts para carrito de sólo
líneas válidas reservable/on_order. No bajar mínimo global ni ampliar flujos de productos no objetivo.
Mixtos conservan regla anterior. Planes/calendario/cobros existentes intactos; no se transforma installments
ni se añade otra inicial. Sólo el límite aritmético de3centavos evita tres obligaciones con importe cero.

Ficha conserva product_detail_commercial INVOKER/ACL/RLS, añade ofertas por variante/rango de cantidad desde
servidor. Preview sobre productos sin envío usa espejo core ya existente; checkout confirma importe final.
Helper nuevo privado sin GRANT público; builder conserva seguridad y calendario. Sin RPC público nuevo.

Módulo SQL/core en copia limpia: migración20261107203116 creada porCLIlocal y aplicada UNA VEZ en clon
mayami_installments_20261107/127.0.0.1:55437. Guardas de2cuerpos previos + términos del plan antes de modificar.
9tablas de negocio/planes idénticas antes/después, sólo2funciones modificadas y1privada nueva; seguridad,
owner,ACL,volatilidad/search_path originales idénticos.124core/tiposcoreAPI pasan. PruebasDB/UIen progreso.

## Fuente separada

Worktree técnico mayami-cuotas-release parte de59e88a07 (última tanda visual cerrada). Excluye el WIP Google,
correo y su PNG, conservado completo en checkpointf3a642f9 y checkout principal. Los checkpoints de cuotas
se incorporan a la rama compartida sin reescribir historia, y conservan un commit fuente limpio como padre
adicional para revisión/publicación futura. No desplegar HEAD compartido con WIP por accidente.

Sin cambio remoto aplicado. Para activar: verificar conexión correcta a Marketplace y contraste/fingerprint
antes de aplicar sólo esta elegibilidad futura. No usar cuentaCLI errónea, cambiar permisos/credenciales,
consultar configuración denegada ni activar Google. Publicación web/OTA sólo con fuente limpia validada,
Workers/ExpoFree y APK/runtime existentes; sin binario nuevo.

Próxima acción: completar pruebas DB y las seis pantallas preservando preferencia de plan por URL/retorno
seguro, rechazar planes no ofrecidos y mostrar pagos exactos. Después revisión independiente y cierre.
Evidencia privada: .local/installments-20261107 en checkoutprincipal.
