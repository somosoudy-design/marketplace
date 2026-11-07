# Actualización Mayami · 7nov2026

Oliver pidió terminar la compatibilidad, publicación y validación Android que seguían pendientes. Esta instrucción amplía el alcance local anterior. Workers y Expo permanecen en Free; no se autorizó contratar servicios, publicar en tiendas, construir otra APK ni alterar reglas comerciales pendientes.

## Candidato y cambios

Fuente integrada: `45743f9955985e8c192f47fc0888d03c601c27ad`. Publicación y comprobación nativa solicitadas por `3a3539bc8c3d3bfe67264014cb7ba234724ff86d`.

Se conectaron las pantallas a selección coherente de variante/foto/precio, metadatos de condición y SKU, carrito por intención persistente, revisión de checkout y guardado de vendedor protegido contra formularios obsoletos/reintentos. La portada amplía la foto existente y conserva su procedencia; cabecera compacta, M durante scroll, categorías bajo portada y cuatro etiquetas inferiores visibles. Se conserva Buscar. No se copian una peana, productos, ofertas o indicadores de carrusel ficticios del mock.

Los JPEG del catálogo permanecen sin edición. Las ilustraciones existentes de categorías sólo sirven de navegación. Los productos disponibles dependen del catálogo publicado por Oliver; no se restauran suspendidos ni se llenan secciones con artículos inventados. La portada elige mercancía publicada vigente y puede cambiar al incorporarse productos reales.

## Backend activado

Proyecto exclusivo: `mimnotafmfasvwrclxan` (Marketplace). Migración `20261107130620_mayami_reviewed_catalog_cart_checkout_seller.sql`, SHA256 `0f0ff51d9c6509834e2b6552db48366ce34a3c2625d04f32bfcac75fc48992e4`. Registrada en `supabase_migrations.schema_migrations` dentro de la misma transacción que los cambios. Confirmación HTTP201 con `applied=true`, 7nov2026, recibo local13:18:56UTC.

Antes de aplicar, se guardaron definiciones, owners/ACL, columnas, políticas, triggers y constraints. La base remota coincidía con la base local ensayada:147 funciones públicas de aplicación,646 columnas,95 políticas,50 triggers y316 constraints; la única función local adicional era el refresco de fixtures. Una guarda transaccional contrastó los147 cuerpos y rechazaba objetos nuevos parciales o una migración repetida. Se usaron límites de espera y una sola confirmación atómica, con recarga de PostgREST.

Después, las168 funciones públicas de aplicación coinciden en definición/owner/ACL/atributos con el release local. Se verificaron RLS y ausencia de USAGE/SELECT/INSERT/UPDATE/DELETE de anon/authenticated/service_role sobre los dos journals privados. El lector público de metadatos respondió200 y las tres fichas comerciales consultadas respondieron200.

Se excluyó **todo el bloque de pagos/D3** de la propuesta anterior: ni columna `payments.intent_request_hash`, ni nueva función `submit_payment`, ni regla de rechazo por método deshabilitado. Ningún consumidor nuevo necesita ese bloque. La definición de `submit_payment` permanece idéntica. Las huellas de pagos, métodos, pedidos, líneas históricas (proyectando la columna nueva nullable), variantes (proyectando clasificación nueva) y envíos permanecieron iguales entre las lecturas comparadas. No se hicieron compras, cotizaciones, reportes o confirmaciones de pago reales para probar.

La huella de productos varió durante la revisión: el cron horario refrescó popularidad a13:17UTC y la auditoría registra publicación/actualización de NEEWER RGB61 por un usuario del panel a13:25UTC. No se presenta esa tabla como inmutable ni se revierte actividad concurrente legítima. La migración no realiza DML sobre filas de productos existentes; añade condición nullable y preserva la clasificación desconocida de imágenes históricas.

Los nuevos locks también protegen vías legacy de carrito/checkout. Por eso este release no se describe como exclusivamente opt-in: mantiene firmas y cálculos, pero una colisión de edición puede devolver `product_busy`. La propuesta de pagos excluida y las decisiones sobre Preventa/cupones siguen separadas; no se inventan políticas para cerrar el despliegue.

## Evidencia de verificación

- Tipos y lint móvil aprobados;85 unitarias móviles y32 adaptadores persistentes aprobados.
-12 ejecuciones UI funcionales y20 visuales, claro/oscuro, aprobadas; texto1.6 por CSS sólo aproxima fuente ampliada, no equivale a fontScale Android.
- Migración final sin pagos ensayada desde una base limpia:221/221 pruebas DB,23 suites. Ocho pruebas pertenecientes al bloque de pagos excluido permanecen documentadas fuera de ese harness; no se alteraron sus originales para hacerlas pasar. Los pagos legacy sí se verificaron.
- Revisión independiente confirmó igualdad de18 funciones relacionadas con pagos y10 tablas financieras en definición/estructura/ACL/políticas entre baseline y release locales.
- Export web y JavaScript/Hermes Android aprobados. No se generó nueva APK.

Expo confirmó Free y cuota disponible en [42375479457](https://github.com/somosoudy-design/marketplace/actions/runs/42375479457):8/1000 dispositivos,30602506/107374182400 bytes de Update. El fingerprint con el Firebase exacto de preview coincidió con el APK instalado en [42375479399](https://github.com/somosoudy-design/marketplace/actions/runs/42375479399):`b691ec2b61ee413fb1d6e7671a1a84446b4cd4f6`.

El workflow de publicación exige Free/cuota, runtime obligatorio válido y fuente limpia. Publica sólo Android en el canal técnico existente `preview`; después recupera el APK existente `df55b9b8-1ed5-42e6-b42f-8a09b9bce50f`, comprueba firma/runtime, recibe el UUID recién publicado en emulador y conserva recibo/capturas de claro y oscuro. El canal no agrega un acceso exclusivo del propietario al producto.

## Estado de cierre

Backend compatible activado. Publicación OTA y recepción nativa en curso; agregar el UUID, grupo, run y resultado al finalizar. No afirmar recepción en el teléfono de Oliver sin comprobarla. Una falla posterior de recibo no implica que la OTA no se haya publicado: conservar su UUID y repetir sólo la comprobación, no publicar otra copia idéntica.

Recuperación: conservar journals e historial. Las definiciones anteriores están respaldadas y se contrastaron con las migraciones ya versionadas. Ante una reversión, devolver primero el cliente compatible y restaurar selectivamente funciones; no borrar órdenes/pagos ni retirar columnas o journals con datos. Para Android se conserva el grupo previo `2a0d076f-4aa9-421e-b762-791041c83609` y su runtime; no ejecutar una reversión sin evaluar la incidencia.

Evidencia local detallada y hashes: `.local/publicacion-final-20261107/`, `.local/ajuste-visual-referencias-20261107/` y el checkpoint funcional previo. Esos directorios no contienen secretos de sesión exportados. La sesión del navegador se usó en el propio navegador; las claves privilegiadas no se copiaron al repositorio ni a la app.
