# Eliminación individual de suspendidos · 6 de noviembre de 2026

Solicitud de Oliver: poder eliminar productos suspendidos si no interfiere con el diseño que desarrolla el Mac con Terra. No es una orden de borrar todos los productos ni su historial. Se implementa sólo en administración; mobile, storefront y el diseño en curso no se modifican.

## Comportamiento

En el panel: Productos y moderación → Suspendidos → abrir producto → Eliminar producto → confirmar. Sólo un administrador autenticado real puede ejecutar la operación. El servidor vuelve a comprobar estado suspended y updated_at; los permisos no dependen de que el cliente muestre el botón.

- Sin pedidos, carritos ni opiniones vinculados: elimina ficha y variantes, relaciones de catálogo dependientes y costes de ese artículo según las FK existentes. No se cambian reglas de precios, tasas, pagos o saldos.
- Con referencias: rechaza la eliminación y conserva el producto suspendido. Pedidos y sus snapshots permanecen íntegros.
- Auditoría privada conserva producto, variantes, fotografías, moderación y costes. No borra archivos de Storage: evita perder recursos usados en historial o referencias anteriores.
- Confirmación explícita, guard contra doble toque, diálogo ocupado durante envío y errores recuperables. No concede DELETE directo a authenticated, administrador ni vendedor. Los vendedores todavía no pueden eliminar por este RPC.

[Migration aditiva](../supabase/migrations/20261106000100_admin_delete_suspended_product.sql): una función nueva, sin modificar políticas ni funciones financieras. Bloqueos NOWAIT sobre producto, variantes, imágenes y costes, y lock_timeout500ms dentro de la función; un conflicto devuelve product_busy y revierte todo. La auditoría queda en la misma transacción que DELETE.

## Pruebas ejecutadas

- 11 pruebas funcionales SQL en clon local exclusivo: eliminación/persistencia y auditoría, aislamiento de otro catálogo, repetición, permisos anon/comprador/vendedores/admin, DELETE directo denegado, estado/versión, carrito intacto, historial de pedido íntegro, bloqueos de producto/variante/imagen/costes y reversión ante una FK adicional.
- 5 pruebas de privilegios: RPC incluido explícitamente en allowlist; no acceso anon/service_role al nuevo RPC, search_path fijo y helpers privados conservados.
- 2 recorridos Playwright del panel con administradores locales propios,320 claro/390 oscuro: cancelación, mensaje ante rechazo por pedido, un único envío real tras doble clic, Escape bloqueado durante operación, toast, eliminación SQL y persistencia tras recarga.
- Cuatro PNG originales en `.local/tiendas-operativas-20261106/captures`. Las capturas deleted son el skeleton de la recarga; el éxito/persistencia se acreditan mediante toast y consultasSQL, no mediante esa imagen.
- Tipos, lint y build del panel comprobados. Auditor independiente APROBADO tras correcciones de costes e imágenes; root también inspeccionó ambos mensajes de protección.

Los primeros intentos UI fallaron por servicios locales que terminaron al salir del comando de arranque; se corrigió su ciclo de vida y se usaron cuentas propias, sin resetear cuentas existentes. Una segunda incidencia detectó rolealert duplicado; se eliminó el wrapper redundante, sin debilitar la aserción. No son fallos remotos de autenticación.

## Estado del checkpoint

Función activada una sola vez en Marketplace y migración20261106000100 registrada, después de ensayo remoto con ROLLBACK.29tablas protegidas idénticas antes/después; cero productos reales eliminados. Lectura nueva verifica función/registro y permisos: authenticated tiene EXECUTE con autorización interna; anon y service_role no. Llamada anónima real al RPC devuelve401/42501 sin ejecutar el borrado. No reaplicar migración ni modificar productos por esta activación.

Publicación del panel pendiente de recepción. CI42306389893 sobre fuente fcf5a32 se detuvo en la comprobación previa: faltaban los9hints nuevos en ERROR_MESSAGES. Se añadieron exclusivamente esos mensajes al sistema compartido, retirando el mapeo duplicado del componente.52core+50admin, tipos/lint y2UI finales aprobados; no cambian mensajes existentes ni diseño del Mac. Se prepara una nueva solicitud sólo del panel; no desplegar Workers ni Android.

El último despliegue de panel registrado es41205620181/intento2, fallo en EAS Hosting. Consulta actual de logs fallidos devolvió archivo vacío; no se atribuye causa inventada. Un despliegue nuevo debe revelar su resultado y conservar el error real si falla. No tocar el despliegue Workers de mayami.app ni publicar OTA para este bloque.
