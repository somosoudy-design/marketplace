# Tiendas operativas · 6 de noviembre de 2026

Oliver establece tres tiendas: **mayami**, **Aroma'top** y **MilyeDent**. El marketplace está en operación; las modificaciones se tratan como cambios sobre datos reales, con respaldo lógico, permisos, ensayo y verificación. No retirar indicadores internos de procedencia ni modificar productos suspendidos por el propietario.

## Coordinación

El agente local del Mac trabaja con Terra en diseño/implementación Android. Este bloque de nube se limita a administración de datos de tiendas y, después, eliminación segura de productos suspendidos. No modifica mobile, storefront, recursos gráficos, configuración nativa, publicación Android o despliegue web. Un único integrador de nube escribe/commitea este bloque; los especialistas sólo revisan y proponen en archivos ignorados. Sincronizar la rama antes de cada checkpoint y conservar los avances del Mac.

## Operación preparada

Proyecto exacto: Marketplace `mimnotafmfasvwrclxan`, confirmado ACTIVE_HEALTHY por Management API. Autenticación mediante secreto vinculado, sin credenciales en Git/chat. El proyecto ajeno sigue excluido.

- Mayami conserva ID `5afbabbf-0678-40ee-a5d8-540f53efe114`, slug `kora`, tipo platform y todos sus campos. No romper enlaces por renombrar su slug.
- Aroma'top: nuevo ID `c0ff9064-ca77-4652-99a3-c58de9f261ed`, slug `aroma-top`.
- MilyeDent: nuevo ID `67791a7e-b246-4ee8-8ecd-34ceab445ecc`, slug `milyedent`.
- Las dos tiendas nuevas son seller/active, sin productos, contactos, fotografías, valoraciones ni propietarios inventados. Falta asignar sus responsables reales por las herramientas administrativas existentes; no se conceden roles a ninguna cuenta.
- Casa Lumen, OdontoPro Suministros, Patitas & Co. y Nova Gadgets se suspenden por sus cuatro IDs exactos. Se conservan registros, productos, membresías e historial. Nova antes estaba pending; las otras tres active.

[SQL de operación](../tools/operations/2026-11-06-stores.sql) **no es una migración ni se aplica automáticamente**: termina en ROLLBACK. Requiere sesión administrativa real y proyecto exacto, inventario/versiones exactos, bloqueo breve de stores (3s de espera máxima), huellas de 29 tablas protegidas y seis eventos de auditoría. Rechaza repetición y cambios concurrentes. No hacer un UPDATE general sobre futuras tiendas ni volver a ejecutarlo tras el cierre.

## Validación previa

- Ensayo en una base local aislada: SQL completo y auditoría pasan; ROLLBACK deja las cinco tiendas iniciales.
- Ensayo remoto con ROLLBACK: cuatro suspensiones, dos altas, seis eventos y 29 huellas idénticas; no se conserva ninguna modificación del ensayo.
- Los contratos existentes ocultan suspended en home/search/perfiles públicos y bloquean compra en checkout. Añadir un ID antiguo al carrito aún puede ser posible, pero el checkout lo identifica como no disponible; no se afirma lo contrario.
- Suspender una tienda no borra fotografías públicas ya compartidas ni revoca acceso del propietario/admin a su historial.

## Aplicación definitiva · cerrada

Aplicada una sola vez después de verificar que el ensayo había revertido. Se sustituyó únicamente el terminador por COMMIT en una copia privada; el archivo versionado sigue en ROLLBACK y rechaza repetición por precondiciones. Persistencia comprobada en lectura nueva: siete registros, tres activos, cuatro suspendidos y seis eventos de auditoría; las29huellas dentro de la operación permanecen idénticas.

Pruebas anónimas reales contra el backend:

- Tabla stores y home_feed devuelven exactamente Mayami, Aroma'top y MilyeDent.
- Los tres store_profile activos devuelven200 con perfil; los cuatro retirados devuelven200/null, sin perfil. No confundir este contrato con un404HTTP.
- Products público conserva exactamente los mismos tresIDs actuales de Mayami. No se reactivó, movió ni eliminó ningún producto.

Las dos altas no tienen miembros: sus responsables todavía no pueden administrarlas. La asignación requiere identificar sus cuentas reales y usar add_store_member con permisos administrativos; no se concedieron roles por el nombre de una tienda. No repetir esta operación ni desplegar web/OTA para un cambio ya persistido en el backend.

## Eliminación de suspendidos · cerrada en bloque separado

Implementado y activado RPC exclusivo para administradores autenticados, con confirmación individual, estado suspended y versión vigente; conserva pedidos/carritos/reseñas y auditoría. No concede DELETE directo ni borra productos masivamente.16DB+2UI/52core/50admin y revisión independiente aprobados; panel recibido por42307651197 Success. [Detalle y evidencia](ELIMINACION_PRODUCTOS_SUSPENDIDOS_2026-11-06.md). No mobile/storefront/OTA/Worker modificados.
