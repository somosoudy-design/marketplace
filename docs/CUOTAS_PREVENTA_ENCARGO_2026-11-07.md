# Tres pagos para preventa y encargo · 7nov2026

La implementación local está terminada y validada. La activación en Supabase y la publicación web/OTA siguen pendientes de acceso autorizado a Marketplace. No se modificó producción ni se construyó otro APK.

## Comportamiento y causa

La lectura pública real de MIM a20:23:53UTC confirmó ocho productos publicados, cinco reservable/on_order, y las dos variantes HiTuneS3 deUSD39. three_parts está activo con anticipo0%,installments3,intervalo15d,recargo0,mínimo de productos60 y flujos local_stock/import_order. Una unidad de39 quedaba excluida por el mínimo; no había una cuarta cuota:0/3 ya produce tres pagos, el primero hoy. Los datos reales no se dedujeron del seed.

La migración conserva el criterio anterior de todos los planes y añade elegibilidad para three_parts cuando todas las líneas válidas del carrito son reservable/on_order. Incluye los flujos existentes sin modificar las filas del plan ni ampliar la elegibilidad de otros productos. Los mixtos conservan la regla previa. El límite aritmético deUSD0,03 evita obligaciones de importe cero; no se crea otro mínimo comercial.

La ficha recibe ofertas por variante y rango de cantidad desde product_detail_commercial, que conserva INVOKER/ACL/RLS. Estima únicamente el producto sin envío y lo explica. El carrito sólo ofrece planes de su resumen servidor; una preferencia de URL no concede elegibilidad. Checkout muestra el calendario final recibido, con importe y vencimiento de cada pago, e incluye el envío. La intención guardada conserva su plan/idempotencia; el retorno de acceso conserva únicamente la preferencia saneada. Si el plan deja de ofrecerse, sólo se elige full automáticamente cuando está ofrecido, con aviso; nunca otra financiación silenciosa.

## Alcance y preservación

Migración20261107203116_mayami_deferred_three_payments creada con CLIlocal y aplicada UNA VEZ al clon mayami_installments_20261107 en127.0.0.1:55437. Tiene guardas de los dos cuerpos previos y de los términos reales del plan. Cambia dos funciones existentes y añade un helper privado sin permisos API. Owner,ACL,seguridad,volatilidad/search_path de las funciones previas permanecen idénticos. Nueve tablas completas de negocio/planes son idénticas antes y después de aplicar la migración; los tests SQL posteriores crean sus propios pedidos locales de prueba. Calendario, reglas de cobro, precios/stock y datos históricos remotos intactos.

Diseño y funciones existentes conservados, sin CSS nuevo. La revisión registra sólo una repetición menor del título del plan; no se abre otra tanda cosmética. Dos selectores Color existentes pertenecen a la base, sin atribuirlos al cambio de cuotas.

## Verificación completada

| Comprobación | Resultado y entorno |
|---|---|
| Core |124/124, incluido cálculo y presentación de calendario|
| Regresiones móvil/web/SQL |175/175; incluye22SQL y14nuevas de navegación|
| Seguridad y compatibilidad SQL |Paridad ficha/carrito/helper, INVOKER/RLS/ACL, stock inválido, replay, concurrencia, revisión obsoleta e históricos; clon aislado|
| Redondeo con envío |44,50→14,83+14,83+14,84 en SQL; tres obligaciones, días0/15/30|
| Web principal |Dos recorridos:1440claro/390oscuro; variante/cantidad, agregar→comprar sin duplicado, acceso/cancelación y revisión|
| Web envío/mixto |Producto39+envío3→total42→14×3; mixto39+19=58 vuelveafull ofrecido conaviso, mantieneplanes legacy|
| Invitado app |Cuatro contextos320/390claro/oscuro; preferencia y bytes de carrito conservados al cancelar/recargar|
| Checkout app |Dos recorridos320claro/390oscuro, acceso y servidor real local;39+3→42→14×3|
| Revisión visual |Independiente favorable; capturas tras fundido y scroll verifican tercera fila sobre barra fija, ambos temas|
| Tipos/lint |Monorepo completo aprobado; tipos finales incluyen tests portables|
| Compilaciones |Next producción local, ExpoWeb y export Android Hermes aprobados; sinAPK ni OTA|

Las pruebas UI usan gateway/PostgREST/GoTrue/Postgres locales reales, no respuestas financieras simuladas. Cero solicitudes de creación de pedidos/pagos en UI. Cuentas y mutaciones de fixtures sólo en el clon aislado. No se probó esta tanda en Android nativo ni en el teléfono; compilar el bundle no equivale a verificar recepción de OTA. No se midió contrasteAA ni texto ampliado. La revisión independiente abrió25PNG concretos; el autor móvil abrió26adicionales/compartidos según manifiestos, sin sumar como imágenes únicas.

Se conservaron los ensayos fallidos por campos/selectores del fixture y las capturas durante fundido. Los complementos estables resolvieron la evidencia visual sin cambios de CSS ni ocultar los originales.

## Fuente, evidencias y publicación pendiente

Fuente ejecutable limpia validada1e8938ad1beedab31514bc52512d4f78fe7ddfa9, en worktree mayami-cuotas-release basado en59e88a07. Google/correo/PNG pendientes están preservados en el checkout principal y en f3a642f9; no hay intersección de archivos de código entre ese WIP y esta tanda. Los checkpoints se conservan en claude/marketplace-v1, con el commit limpio como padre adicional. No desplegar HEAD compartido con WIP Google/correos. Los cierres documentales posteriores no cambian ejecutables.

Evidencia privada reproducible en `.local/installments-20261107/` del checkout principal: LOCAL_RELEASE_EVIDENCE.json; public/; migration-before/after/result.json; portable-tests.json; logs/; ui-web-real/; ui-web-paid-mixed/; ui-web-focal/; ui-mobile-real/; ui-mobile-auth-real/; ui-mobile-auth-steady/; proposals/INDEPENDENT_CORE_TYPES_REVIEW.md e INDEPENDENT_VISUAL_REVIEW.md. Los builds locales contienen configuración loopback y nunca deben publicarse.

El login del navegador comunicado por Oliver no habilitó las herramientas de esta conversación: get_project MIM devolvió MCP-32600 «You do not have permission to perform this action». No se reintentó configpull con la cuenta CLI errónea, se cambiaron credenciales/permisos o se inspeccionaron cookies. Google y los correos no se reabrieron en esta tanda.

Siguiente acción concreta cuando exista conexión autorizada a Marketplace:

1. Confirmar proyectoMIM y acceso esperado de somosoudy@gmail.com. Leer baseline actual de funciones/plan y preservar auditoría de permisos y tablas; sin fixtures ni compras remotas.
2. Aplicar UNA VEZ esta migración con sus guardas y verificar funciones, permisos, datos preservados y oferta pública del producto39. Si las guardas difieren, revisar el cambio concurrente antes de aplicar.
3. Preparar builds públicos nuevos desde fuente limpia, verificar Free y compatibilidad con runtime/APK vigente, y publicar web/OTA sólo tras comprobar backend. Verificar recepción y límites de cada superficie, sin reclamar prueba física no realizada.

No se activó WorkersPaid, se contrataron servicios, enviaron pagos o realizaron compras reales. El impedimento actual es el acceso técnico a Supabase, no una nueva autorización comercial.
