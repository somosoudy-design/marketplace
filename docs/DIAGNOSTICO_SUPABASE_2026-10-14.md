# Supabase Marketplace — diagnóstico de solo lectura

**14 de octubre de 2026, consultas públicas a las 14:09–14:17, hora de Venezuela (UTC−4).**
Rama `claude/marketplace-v1`, base `40d37ea`. Proyecto objetivo exclusivo: **Marketplace / `mimnotafmfasvwrclxan`**. No se hizo ninguna solicitud al proyecto prohibido. Evidencia pública sanitizada: [JSON](DIAGNOSTICO_SUPABASE_2026-10-14.json).

## Conexión comprobada y límite actual

El ejecutor disponible es **Linux en la nube**, no la PC física del propietario. La CLI **2.120.0** ya instalada funciona mediante `pnpm exec supabase`; no se instalaron ni actualizaron dependencias. No hay conector Supabase accesible en las herramientas de esta sesión ni proyecto CLI enlazado.

Se reutilizó la clave pública anon del perfil preview existente, comprobando URL y claims `ref`/`role` sin mostrar el token. Las consultas de catálogo, tasas y Auth llegan al proyecto correcto. **Esto no es acceso administrativo.** Management API `GET /v1/projects/mimnotafmfasvwrclxan` devuelve **401**; `SUPABASE_ACCESS_TOKEN` está ausente en el proceso y su requisito del entorno tiene `has_saved_binding:false`. El transporte hacia Management API funciona: el bloqueo actual es autenticación, no el antiguo CONNECT403. El nombre visible Marketplace no se pudo reconfirmar por Management API.

Acción necesaria del propietario desde su PC:

1. En su cuenta de [Supabase → Access Tokens](https://supabase.com/dashboard/account/tokens), obtener un token personal temporal autorizado para consultar Marketplace. Si la cuenta ofrece restricción de alcance, usar el mínimo necesario.
2. En **Codex → Configuración del entorno → Secretos**, vincularlo al requisito ya declarado **`SUPABASE_ACCESS_TOKEN`**, limitado a `api.supabase.com`. Guardar/aplicar la configuración. **No pegarlo en chat, Git, variables `EXPO_PUBLIC_*` ni sustituirlo por la clave `service_role` del proyecto.** No hace falta contraseña de la base para este método.
3. Reanudar las consultas protegidas: verificar primero ID/nombre mediante el GET del proyecto exacto y después consultar metadatos/SQL en transacciones READ ONLY. No listar ni conectar otros proyectos.

No se guardó otro requisito duplicado ni se cambiaron scripts o secretos del entorno. Estar conectado al dashboard en la PC no transfiere esa sesión al ejecutor cloud.

## ✅ Servicios que responden

| Área | Evidencia remota | Qué acredita |
|---|---|---|
| Auth | GET health200 | Servicio accesible; no se inició sesión ni creó usuarios |
| Catálogo público | RPC search_products200 | **44 productos visibles**,43 demo y1 no demo;44 publicados en el resultado público |
| Estados de catálogo |29 disponibles,3 en camino,9 por encargo,2 reservables,1 agotado | Datos originales, sin alterarlos; no inventario completo de publicaciones privadas |
| Fotografías públicas | Imagen demo del bucket catalog200,WebP; logo stores200,WebP | Lectura de dos recursos existentes; no permiso para subir/editar |
| Funciones Edge | GET rates-sync/push-dispatch/panel-api devuelve405 | Rutas desplegadas/respondiendo; no se ejecutaron operaciones POST, sincronización ni envíos |
| Vendedor existente | GET seller_dashboard401/42501 | RPC presente y ejecución anónima correctamente denegada; no prueba con vendedor autenticado |
| Métodos VES | Pago Móvil y transferencia habilitados,manuales | Configuración pública; no pago/cotización/conciliación probados |

Las cifras del catálogo son **visibles por anon**, no el total de tablas privadas. El producto no demo ya existía en el backend: confirmar con el propietario su clasificación antes de evaluar ventas públicas; no se cambió ninguna marca.

## ⚠️ Tasas BCV y pagos en bolívares

Estado que **elige el backend** a las 14:09. No presentar estas observaciones como verificación independiente de la publicación oficial BCV.

| Par | Tasa aplicada / base | Fuente elegida | Observación, Venezuela | Estado |
|---|---|---|---|---|
| USD/VES |877,90 /877,9023 |dolarapi_oficial |14 oct,00:00 |available:true; **fallback:true**,manual:false |
| USDT/VES |1.012,43 /1.012,4285 |binance_p2p |14 oct,14:00 |available:true;fallback:false;manual:false |
| USD/USDT |1,001 /1,001021 |kraken_usdt |14 oct,14:00 |available:true;fallback:false;manual:false |

`bcv_official` está registrado/habilitado con adaptador bcv_html, pero la selección USD/VES actual utiliza **el agregador de respaldo**. Su causa no está comprobada: pueden faltar datos válidos, fallar la consulta/parsing, o intervenir la política; hacen falta filas y logs protegidos. La clasificación `kind=official` de DolarAPI en la configuración no acredita haber verificado BCV directamente.

`pricing_today` devuelve snapshot **3**, tomado14 oct01:40, válido hasta15 oct07:40: BCV877,90 desde dolarapi_oficial,USDT/VES1.010,53 desde binance_p2p,USD/USDT1,0011 y brecha15,1076%. Es un snapshot todavía vigente según la respuesta. **valid_until futuro es expiración; no demuestra que haya una tasa BCV futura registrada.** Tampoco se contrastó su vigencia con la política privada vigente.

Tasas futuras/histórico/último fetched_at/políticas/errores por fuente: **sin verificar**, requieren lectura administrativa. Observaciones recientes de Binance/Kraken sugieren ingestión reciente, pero no demuestran que pg_cron ni todas las fuentes funcionen. Un cron “succeeded” puede significar únicamente que encoló HTTP; incluso una respuesta Edge200 puede incluir fuentes fallidas.

Riesgos encontrados **en el código del repositorio**, pendientes de contrastar con el despliegue: BCV usa Fecha Valor como observed_at (`parseBcvHtml`); ingest_rate rechaza observaciones más de10min futuras; current_rate no limita la selección por una fecha de vigencia superior; pricing_snapshot_current filtra expiración pero no taken_at futuro. Esto exige separar fecha de publicación/obtención de fecha de vigencia y probar el cambio de día venezolano. **No es diagnóstico definitivo de la causa remota ni autorización para cambiar esos procedimientos.** No se modificaron tasas/cálculos.

## ❌ Nuevos RPC vendedores no disponibles en la API actual

| Migración esperada | RPC comprobado | Resultado |
|---|---|---|
|20261011172600_seller_product_editor |seller_editor_ready() |404/PGRST202 |
|20261011174200_seller_fulfillment_detail |seller_orders_ready() |404/PGRST202 |
|20261011174200_seller_fulfillment_detail |seller_fulfillment_detail(uuid,uuid),GET |404/PGRST202 |

El control seller_dashboard devuelve permiso denegado en lugar de función ausente. Esto apoya la indisponibilidad de los RPC nuevos; **no certifica que falten sus versiones en schema_migrations**: es necesario consultar historial y pg_proc, pues también existe la posibilidad de caché/despliegue inconsistente. No se llamó seller_save_product, advance_fulfillment, set_product_costs ni ningún RPC mutador.

La app ya conserva lectura/panel cuando los checks devuelven PGRST202; **no repetir VEN-01A, editor, flujos o publicación móvil**. El paquete exacto de activación ya está preparado/probado en `tools/supabase-remote/aplicar-mi-tienda-operativa.sql`, pero **NO se ejecutó**.

## Datos protegidos aún sin verificar

| Comprobación pedida | Estado real |
|---|---|
| Historial de migraciones |No leído remoto. Repositorio/local tienen28; el dato23 del9oct es histórico, no estado actual confirmado |
| Versiones/código/permisos Edge |Solo presencia HTTP; versiones,JWT y configuración no leídos por Management API |
| pg_cron/trabajos/errores |No leídos remoto; no confirmar “6 activos” por documentación antigua |
| Vigentes/futuras/todas las fuentes |RPC público actual comprobado; filas históricas/futuras y políticas privadas pendientes |
| Storage/RLS/grants/aislamiento |Dos archivos públicos200. Listado de buckets con anon200[] **no significa que no haya buckets**; permisos de escritura no verificados |
| Roles vendedores/admin |No simulados, no sesión ajena ni privilegios concedidos |
| Compras completas |No ejecutadas en remoto; no pedidos, pagos ni notificaciones reales |

## Plan de activación para revisar, sin ejecutarlo

0. **Completar autenticación segura y el diagnóstico protegido.** Confirmar proyecto por Management API; consultar historia/funciones/políticas/cron/Storage en READ ONLY. Este paso ya está autorizado como lectura; los cambios posteriores requieren decisión del propietario.
1. **BCV y pagos VES:** determinar por qué no se selecciona BCV directo; verificar última consulta/ingestión, reglas de freshness, Fecha Valor futura y zonaAmerica/Caracas. Comparar snapshot/tasa de cotización y bloquear datos vencidos según las reglas actuales. Preparar corrección mínima y casos de hoy/mañana/cambio de día/source caída **localmente**, sin desplegar, cambiar cifras ni ejecutar pagos.
2. **Vendedor:** verificar ambas versiones y cuatro RPC/grants. Si faltan, presentar el paquete existente de solo esas dos migraciones para autorización independiente; si están, investigar diferencias/cache y presentar la corrección concreta. **No db push general, rerun de todas las migraciones, permisos cliente o nueva OTA como atajo.** No ejecutar siquiera reload schema en esta fase.
3. **Catálogo fotográfico:** UGREEN200 ahora confirma que el bloqueo anterior de red cambió. Supabase público/Storage ya responden. Los15 IDs/capa privada están preparados; siguen faltando modelos/tonos exactos, originales y derechos. No necesita admin para comenzar investigación; uploads/migración de medios a Storage requieren autorización futura. No cambiar los44 productos ni activar exhibición ahora.
4. **Compra integral:** reutilizar suites locales ya existentes tras BCV/vendedor; después definir cuenta/datos/métodos de prueba y revisión Android. Pruebas remotas que creen órdenes o pagos requieren autorización explícita posterior; no ejecutarlas como parte de este diagnóstico.

## Consultas preparadas y verificación

- [Diagnóstico SQL base](../tools/supabase-remote/diagnostico-solo-lectura.sql): historia, RPC/privilegios/hash sin cuerpos, tasas/futuros, snapshots, catálogo agregado, buckets/RLS y disponibilidad de dominios opcionales. **BEGIN TRANSACTION READ ONLY + timeout local + ROLLBACK**. Verificar ID en dashboard/Management API antes de usarlo.
- [Cron/HTTP/Vault metadata](../tools/supabase-remote/diagnostico-cron-solo-lectura.sql): ejecutar cada transacción solo si existe la relación. No imprime comandos cron, mensajes/brutosHTTP, headers, datos de clientes ni secretos descifrados.
- SQL base ejecutado **solo contra PostgreSQL17 local**, con transaction_read_only:on, sin escrituras, seed ni migraciones.23 sentencias verificadas; el opcional13 pasó revisión estructural, cron/net ausentes localmente: **no ejecutar/afirmar validación contra ellos**. No se repitieron UI/core/panel ni pruebas financieras de módulos ya cerrados.
- No hubo cambios a aplicación, backend remoto, precios, tasas, configuración nativa, panel, APK o EAS. No se imprimieron/guardaron credenciales. Se conserva la autenticación pública original y no se extrajeron claves del proxy.
