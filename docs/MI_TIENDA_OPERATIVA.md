# Mi tienda operativa — ampliación de VEN-01A

Oliver probó VEN-01A en Android y solicitó administración móvil real. Base `887197b`;
orden autorizado: perfil, catálogo, acciones de pedidos. Conservar la lectura/navegación ya publicada.
**Publicación pausada:** no EAS Update ni APK nuevo, no servicios/datos remotos, iOS o checkout.
La corrección de tasas BCV conserva su prioridad crítica separada.

## Bloque 1 — perfil

Pantalla existente `/my-store/settings`: nombre comercial, frase corta, descripción, correo de contacto,
información de envío, devoluciones, garantía y acento de la paleta existente. Selección de logotipo y portada
por `expo-image-picker`, ya incluido en APK 5. Vista previa, 5 MB, JPG/PNG/WebP, guardar explícitamente.
Los demás datos de `policies` se conservan. Estado, slug, kind, demo y valoraciones no son editables aquí.
No se añadieron campos de teléfono/dirección que no existan en el contrato del panel.

`api.seller.updateStore` utiliza UPDATE con sesión/anon y exige devolver una fila: un cambio denegado
nunca se presenta como guardado. `uploadImage` usa el bucket `stores` y rutas únicas por tienda, sin
sobrescritura; las políticas existentes solo permiten INSERT. No borra imágenes previas, certificados o datos.
Rutas subidas se conservan durante un reintento de guardado; archivos subidos pero no asociados pueden
quedar huérfanos, pues el backend no permite borrarlos al vendedor. No se amplían esos permisos.

Guardado bloquea duplicados y edición durante la solicitud; conserva el formulario al fallar o perder
conexión. Confirmación antes de abandonar cambios, incluidas acciones de stack/Atrás; advertencia al
recargar web. Caché por usuario/tienda y sin drafts privados persistidos en disco. Se actualiza la pertenencia
real en caché y se invalidan tienda pública, Inicio, catálogo y fichas; los cambios persisten en `stores`.

El panel continúa ofreciendo las operaciones avanzadas y su vista previa. No se cambia RLS, el panel ni
la configuración nativa. Compatibilidad técnica prevista con APK 5 por usar módulos ya presentes;
la nube Linux no puede ejecutar la galería nativa nueva sin publicar, lo que está expresamente pausado.

### Validación y reproducción

- Tipos y lint locales aprobados durante implementación; repetir si cambia código.
- `seller-store-edit.spec.ts`: persistencia real + galería/upload/archivo público/página de tienda,
  validación, fallos, reintento, dirty/back, desconexión y recuperación, ambos temas, ancho 320 px.
- `seller-store-write.test.ts`: UPDATE propio, protección de identidad/estado/ratings, denegación ajena
  y anónima, permisos SQL de Storage. Se ejecuta junto con `seller-access.test.ts`.
- No usar `db:reset` ni el script de tests que elimina `kora_test`. Crear copia local nueva con pg_dump/
  pg_restore y definir `TEST_DATABASE_URL`; datos demo aditivos, ningún servicio remoto.
- Stack y runner UI en el mismo proceso de ejecución cloud: `pnpm stack:stop; pnpm stack:start`, después
  `pnpm --filter @kora/app-e2e exec playwright test -c playwright-app.config.ts seller-store-edit.spec.ts seller-app.spec.ts`.
- Logs ignorados `.local/logs/seller-store-*`, capturas `.local/seller-ops/screens/`.

Cierre bloque 1: UI **26/26** (1,8 min), permisos **6/6**, tipos/lint/export web aprobados. Ocho capturas de perfil antes/después, página pública y error en ambos temas; revisión directa de campos, botones y confirmación/error. No prueba nativa nueva. Commit de cierre: consultar historial/`git log`; publicación pausada.

## Bloque 2 — catálogo operativo

Pantalla de catálogo ampliada, nuevo `/my-store/product` para crear/editar. Ficha (nombre/subtítulo/
descripción/seis características/categoría), variantes, precio principal manual, SKU, inventario, disponibilidad,
peso/máximo por pedido/precio anterior y fotografías de galería. Puede pausar la venta con No disponible,
pausar/activar variantes sin borrarlas, agregar variantes manuales y cambiar la portada entre las fotos.
Estados reales y motivos/historial de moderación; corrige y reenvía un rechazo, suspensión requiere administración.

Para productos ya automáticos, precio de solo lectura y edición de costo por variante, flete, gastos y margen
mediante `set_product_costs` existente. No se cambió fórmula, tasa, cobro o checkout. Cambiar el modo de precio/
origen/enlace de costos y ampliar variantes automáticas quedan en el panel. No se eliminan productos,
variantes vendidas ni fotos guardadas. El servidor no admite drafts: no hay botón falso de borradores.

### Guardado y migración preparada

`20261011172600_seller_product_editor.sql` aplicada **solo localmente**, incluida copia de pruebas.
`seller_save_product` SECURITY INVOKER agrupa operaciones del editor existente: RLS/triggers siguen activos,
campos permitidos explícitos, sin aprobar/reasignar tienda. Variantes y referencias de fotos se guardan en
la misma transacción; costo opcional delega al RPC existente. UUID estables por intención y rutas subidas
conservadas: una respuesta perdida se reintenta sin duplicar producto, variante o imagen. Error de una variante
revierte ficha/otras variantes. No borra datos. Storage no participa en la transacción: archivos subidos sin
asociar pueden quedar huérfanos (no ampliar permisos ni limpiarlos automáticamente).

Fallo real reproducido antes de arreglarlo: tras rechazo, editar ficha y precio publicaba un producto de bajo
riesgo. La migración conserva revisión manual/pending usando el último evento administrativo existente;
actualizar variantes/costos ya no aprueba un rechazo. Suspensión y categorías sensibles mantienen revisión.
La aprobación continúa en `moderate_product` con permiso administrativo real. Regresión roja/verde conservada
en `.local/logs/seller-moderation-{before,after}.log`.

`seller_editor_ready` comprueba soporte del servidor. Sin la migración, el catálogo de lectura/panel funciona,
pero no aparecen acciones móviles de edición. No hay variable cliente que conceda permisos.
**No está listo para publicar completo en APK 5 hasta autorizar/aplicar/verificar la migración remota** y
comprobar el guard nativo existente. Nada remoto se desplegó; no EAS Update.

### Pruebas bloque 2

- Backend **20/20**: seis nuevas operaciones/RLS/rollback/idempotencia/moderación/reprecio con snapshot local,
  siete reglas existentes de precios, dos autoría y cinco privilegios (allowlist actualizada para dos RPC nuevos).
- Núcleo **50/50**, tipos/lint/export web aprobados.
- UI **30/30**: 22 regresiones VEN-01A + ocho operaciones de catálogo, claro/oscuro, 320 px. Crear/galería/
  dos variantes/SKU, precio/stock/pausa/reanudación, ficha pública, respuesta perdida sin duplicar foto/producto,
  dirty/Atrás, costo automático, rechazo pendiente, aislamiento y servidor sin migración. Esperan `aria-busy=false`
  y confirmación final, no dan por guardado el estado de carga. Perfil también pasó **4/4** en corrida conjunta
  anterior (12/12 con catálogo). Capturas de formulario/error/historial revisadas en ambos temas.
- La galería se valida por picker web + gateway local; permisos de Storage además por SQL contra RLS.
  No equivale a selección física Android, TalkBack o rendimiento nativo.

## Bloque 3 — siguiente

Implementar detalle/acciones sobre pantallas de pedidos existentes. Reutilizar `advance_fulfillment`: servidor
controla `seller_can_set`, pago requerido, avance solo hacia delante y guía obligatoria para despacho a domicilio.
La app no verificará pagos o cancelará entregas administrativamente. Consulta/historial deben seguir limitados
a la entrega de la tienda, sin depender del límite de 200 registros para abrir un detalle.
