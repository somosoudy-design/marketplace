# Supabase Marketplace — conexión recuperada y diagnóstico de solo lectura

**14 de octubre de 2026, hora de Venezuela (UTC−4).** La conexión administrativa está recuperada: Management API confirma **Marketplace / `mimnotafmfasvwrclxan` / ACTIVE_HEALTHY**. Consultas protegidas desde las 14:44; última consulta pública a las 14:48. Rama `claude/marketplace-v1`, base del módulo `3305278`. [Evidencia sanitizada](DIAGNOSTICO_SUPABASE_2026-10-14.json).

El token personal quedó vinculado por el gestor seguro del entorno. Se usa en memoria, exclusivamente hacia `api.supabase.com`; no se imprimió, versionó ni incorporó a la app. El ejecutor sigue siendo Linux en la nube, sin acceso a la PC física. CLI 2.120.0 disponible; no fue necesario instalar dependencias, enlazar la CLI ni obtener la clave `service_role` o contraseña de la base. No hay conector Supabase callable en esta sesión.

La respuesta 401 y el requisito sin vincular del primer informe son **históricos y resueltos**. La sesión de lectura administrativa devuelve `supabase_read_only_user` y `transaction_read_only:on`. Cada consulta usa `read_only:true`, BEGIN TRANSACTION READ ONLY, timeout local y ROLLBACK. Ninguna solicitud se dirigió al proyecto prohibido.

## Resumen del estado real

| Estado | Área | Resultado comprobado |
|---|---|---|
| ✅ | Conexión y Auth | Proyecto correcto ACTIVE_HEALTHY; Management API y Auth responden |
| ✅ | Migraciones | **26 aplicadas**, de foundation a avatars; repositorio/local tienen 28 |
| ✅ | Automatización | **7 trabajos activos**; todos tienen ejecuciones succeeded durante las últimas 24 horas |
| ✅ | Fuentes de respaldo/mercado | DolarAPI, Binance P2P y Kraken responden en los resultados del cron |
| ✅ | Storage | 5 buckets; imágenes públicas accesibles y políticas de subida por tienda presentes |
| ✅ | Base de vendedor | seller_dashboard, seller_fulfillments, seller_sales y advance_fulfillment presentes, con restricciones de ejecución |
| ⚠️ | BCV directo | **0 observaciones almacenadas**; las 12 respuestas de sincronización examinadas fallan por certificado TLS |
| ⚠️ | Compras y subida autenticada | Configuración comprobada; no se crearon órdenes, cotizaciones, pagos ni archivos para probar operaciones remotas |
| ❌ | Editor y detalle operativo de vendedor | Dos migraciones ausentes del historial y cuatro RPC nuevos ausentes de pg_proc |
| ❌ | PayPal / Binance Pay | Deshabilitados, pending_credentials; no confundir preparación con integración activada |
| ❌ | Lote fotográfico de exhibición | Infraestructura y 15 IDs preparados; 0 originales/modelos/licencias aprobados en ese lote |

ACTIVE_HEALTHY describe el estado del proyecto, no certifica que todas sus operaciones comerciales funcionen. Una ejecución cron succeeded tampoco certifica éxito de cada proveedor.

## 1. Migraciones y funciones desplegadas

Historial remoto: **26 versiones**, incluyendo `20261009233831_pricing_engine`, `20261010003308_divisas_methods_pending` y `20261010151906_avatars`. No falta ninguna de las primeras 26 versiones del repositorio. Las únicas diferencias de historia frente a las 28 locales son:

| Migración | Historial remoto | Funciones correspondientes |
|---|---|---|
| `20261011172600_seller_product_editor` | **No aplicada** | `seller_save_product`, `seller_editor_ready`: ausentes |
| `20261011174200_seller_fulfillment_detail` | **No aplicada** | `seller_fulfillment_detail`, `seller_orders_ready`: ausentes |

Las respuestas REST 404/PGRST202 quedan corroboradas por la historia y pg_proc: **el bloqueo no es solamente caché PostgREST**. No se ejecutó ningún paquete, migración ni reload schema.

Se revisaron existencia, firmas, SECURITY DEFINER, volatilidad y grants de las funciones relevantes. Los cuatro RPC de consulta/acción de vendedor ya existentes solo conceden EXECUTE a authenticated/service_role; anon queda denegado. `require_store_member` permanece como helper interno. Los 14 hashes de funciones que coinciden con el stack local incluyen los procedimientos financieros y de autorización examinados. `enforce_product_moderation` difiere, coherente con la redefinición incluida en la migración de editor todavía local; no se interpreta automáticamente como un fallo remoto.

### Funciones Edge

| Función | Estado / versión | verify_jwt |
|---|---|---|
| rates-sync | ACTIVE / 1 | false |
| push-dispatch | ACTIVE / 1 | false |
| panel-api | ACTIVE / 1 | true |
| assets-mirror | ACTIVE / 1 | false |

`assets-mirror` también está desplegada: el inventario anterior de tres funciones era incompleto. Los jobs de rates/push emplean el mecanismo existente de token de trabajo; nombres `kora_project_url` y `kora_job_token` presentes en Vault, sin extraer sus valores. Se comprobó metadata de despliegue y resultados ya guardados, no se invocaron POST de sincronización, envío, panel o mirror ni se extrajeron secretos Edge.

## 2. BCV, tasas vigentes y futuras

Respuesta pública a las **14:48 de Venezuela**, con últimas observaciones de mercado de las 14:30:

| Par | Tasa aplicada / base | Fuente elegida | Estado |
|---|---|---|---|
| USD/VES | **877,90 / 877,9023** | dolarapi_oficial | Disponible, respaldo, no manual; observación 14 oct 00:00 |
| USDT/VES | 1.012,00 / 1.012,00 | binance_p2p | Disponible, referencia de mercado, no manual |
| USD/USDT | 1,0011 / 1,001101 | kraken_usdt | Disponible, referencia de mercado, no manual |

Políticas vigentes: USD/VES usa BCV como primaria y DolarAPI como respaldo, antigüedad máxima 2.000 minutos; USDT/VES 120 minutos y USD/USDT 180 minutos. Margen 0 en los tres pares; ninguna tasa manual activa. No se modificó la política ni ninguna cifra.

### Causa remota comprobada: TLS

Las 12 respuestas de `rates-sync` conservadas entre **09:00 y 14:30** muestran HTTP 200 del endpoint, pero **bcv_official: ok=false**. En las tres últimas se extrajo únicamente el fragmento seguro:

`invalid peer certificate: UnknownIssuer`

DolarAPI, Binance y Kraken tienen ok=true en esas mismas respuestas. Por tanto, el cron se ejecuta y llega a Edge; **la consulta HTTPS al BCV falla por confianza del certificado antes del parsing/ingestión**. No se comprobó todavía si la cadena remitida está incompleta o si falta el emisor en el almacén de confianza del ejecutor Edge. No es evidencia de certificado caducado ni justifica desactivar la validación TLS.

La tabla conserva 497 observaciones: 247 de Kraken, 247 de Binance y 3 de DolarAPI; **0 de BCV y 0 observaciones futuras** en todas las fuentes. El fetched_at de la fila DolarAPI actual es 00:30, pero los logs prueban nuevas consultas exitosas a las 14:30: `ingest_rate` devuelve la observación ya existente al repetirse source/pair/observed_at. No deducir ausencia de sincronización del fetched_at de una fila deduplicada.

### Snapshot y fecha de vigencia

Tres snapshots registrados, ninguno tomado en el futuro. El activo es **3**, tomado **14 oct 01:40**, válido hasta **15 oct 07:40**: USD/VES 877,90 desde DolarAPI, USDT/VES 1.010,53, USD/USDT 1,0011 y brecha 15,1076 %. Configuración `pricing.gap`: refresco 24 horas, validez 30 horas. Snapshot y tasa de mercado actual tienen horas distintas; no es por sí solo un error de cálculo.

`valid_until` futuro expresa expiración, **no una tasa BCV futura**. Los hashes confirman que el SQL financiero remoto examinado coincide con el local: ingest_rate rechaza observed_at superior a now + 10 minutos; current_rate no limita por observed_at <= now; pricing_snapshot_current comprueba expiración pero no taken_at <= now. El adaptador del repositorio utiliza Fecha Valor como observedAt. Estos riesgos de vigencia requieren casos de hoy/mañana/cambio de día en el trabajo BCV separado; **no explican el fallo TLS actual ni se corrigieron en este diagnóstico**.

## 3. Automatización

Siete jobs activos: expirar órdenes cada 10 minutos, rates cada 30, push cada minuto, popularidad al minuto 17, snapshot al minuto 40, limpieza diaria y recordatorio diario. La evidencia incluye expresiones cron y resumen completo por job/estado en las últimas 24 horas: **sin estados fallidos en ese intervalo**. La consulta agregada evita que los 100 registros más recientes de push oculten trabajos menos frecuentes.

El job rates registra 48 ejecuciones succeeded en 24 horas. Esto prueba encolado/ejecución SQL; el éxito por fuente se contrastó con `net._http_response`. HTTP 200 con BCV fallido es precisamente el motivo de no declarar saludable toda la sincronización.

## 4. Permisos y fotografías

| Bucket | Acceso | Límite | Objetos registrados |
|---|---|---|---|
| catalog | Público | 5 MiB, JPG/PNG/WebP | 104 |
| stores | Público | 5 MiB, JPG/PNG/WebP | 10 |
| avatars | Privado | 3 MiB, JPG/PNG/WebP | 1 |
| payment-proofs | Privado | 5 MiB, imágenes/PDF | 2 |
| claims | Privado | 5 MiB, imágenes/PDF | 0 |

RLS activo en storage.objects y tablas stores/store_members/products/product_images/product_variants. **Las 21 políticas examinadas tienen los mismos hashes que el stack local.** La política llamada “catalog: store members upload to their store folder” incluye **catalog y stores**, exige tienda/carpeta propia o administración. El nombre no significa que falte subida de logos/portadas. La sospecha inicial se descartó tras comprobar el alcance real.

El grant genérico INSERT de Storage a anon **no omite RLS**: las políticas de subida exigen authenticated. No se cambiaron roles/grants, se simuló sesión de vendedor ni se probaron uploads remotos. Lectura de una imagen pública y un logo comprobada; aislamiento autenticado y persistencia real de subidas quedan para una validación posterior autorizada.

## 5. Catálogo y métodos de pago

**44 productos en la tabla y en el catálogo público, 43 demo y 1 no demo, todos publicados**. Estados: 29 disponibles, 3 en camino, 9 por encargo, 2 reservables y 1 agotado. El producto no demo ya existía; no se cambió su clasificación.

104 filas de product_images: 100 usan rutas de demo y 4 otras rutas. Esa diferencia de ruta **no certifica autenticidad ni derechos**. El lote privado de 15 productos mantiene 0 fotografías autorizadas integradas; no confundir sus recursos vacíos con todos los objetos remotos. UGREEN responde HTTP 200 desde este entorno; otros fabricantes/CDN siguen sin nueva comprobación. La investigación fotográfica puede continuar sin más credenciales Supabase, respetando modelos/variantes/licencias.

Pago Móvil, transferencia VES, Zelle, USDT TRC-20 y efectivo USD están habilitados como métodos **manuales**. PayPal y Binance Pay están deshabilitados, `pending_credentials`. No se crearon cotizaciones/pedidos, verificaron pagos ni consultaron instrucciones bancarias privadas. “live” en la configuración no certifica una compra probada ni verificación automática.

## Plan de activación para revisar

1. **BCV/VES — prioridad crítica:** analizar la cadena TLS remitida y la confianza del runtime Edge, reproducir localmente y preparar una corrección mínima conservando validación TLS. Separar publicación/obtención/Fecha Valor y probar hoy, mañana, Caracas, fuente caída y datos vencidos. Revisar snapshot/quote con los procedimientos existentes. No introducir una tasa manual ni cambiar cálculos para ocultar el fallo. Despliegue posterior solo con autorización.
2. **Vendedor:** presentar para aprobación el paquete exacto ya preparado y ensayado [aplicar-mi-tienda-operativa.sql](../tools/supabase-remote/aplicar-mi-tienda-operativa.sql), exclusivamente las dos migraciones ausentes. Antes de aplicarlo, revisar transacción/guards/historia y el cambio de moderación; después comprobar RPC/grants y probar propietario, otro vendedor y admin con cuentas permitidas. **No db push general, seed remoto ni nueva implementación de los editores.** El perfil y las políticas actuales no necesitan una migración de Storage inventada.
3. **Catálogo fotográfico:** obtener 12–15 originales autorizados y correspondencias exactas; completar el manifiesto y revisar todas las apariciones. El acceso público/Storage funciona. Migrar medios a Storage, activar la capa o distribuir imágenes requiere la decisión posterior correspondiente; no alterar productos ni flags demo como atajo.
4. **Compra integral:** reutilizar las suites locales tras la corrección BCV/activación vendedor. Definir cuentas/datos de prueba y autorización para crear operaciones remotas antes de probar persistencia; no pagos reales ni confirmación automática. Luego comprobar el recorrido Android y guardas comerciales.

## Verificaciones y publicación

- Consultas protegidas reales mediante Management API, rol de lectura y transacciones READ ONLY. [SQL base](../tools/supabase-remote/diagnostico-solo-lectura.sql) y [cron/HTTP/Vault metadata](../tools/supabase-remote/diagnostico-cron-solo-lectura.sql), sin cuerpos de funciones, comandos cron, headers o secretos descifrados.
- Una consulta inicial de RPC en SQL devolvió 42501 para pricing_today: **restricción del rol supabase_read_only_user**, mientras el RPC anon devuelve 200. Se retiró esa invocación del script administrativo; no se modificaron permisos ni se cambió a service_role. Prueba pública aparte y consulta de snapshots resuelven el diagnóstico.
- Versión inicial del SQL base validada en PostgreSQL 17 local a las 14:22. Tras ajustar el script, una repetición local no pudo ejecutarse porque el servidor local estaba detenido; no se reinició/resetó el stack. Los archivos finales completos (base: 22 sentencias; cron: 15) se verificaron contra este proyecto en READ ONLY. No se repitieron suites generales de interfaz ni se presenta lectura como prueba de compra o upload.
- **No migraciones, escrituras de negocio, sync manual, uploads, pagos, APK ni EAS.** La autorización posterior de Oliver para revisar avances en la app no añade un cambio móvil a este bloque de diagnóstico: no hay una mejora visual nueva para publicar. APK 5 utiliza Android preview; production no le entrega OTA. Publicar JS no activa las dos migraciones faltantes. Se mantiene la actualización `01a13354-e5fd-70f0-90bc-feec7f425a03`.

**Siguiente tarea exacta recomendada:** diagnosticar y preparar localmente la corrección TLS/vigencia BCV con esta evidencia, y presentar el cambio concreto antes de desplegar. La conexión segura ya está recuperada; no volver a pedir el token ni repetir este inventario general.
