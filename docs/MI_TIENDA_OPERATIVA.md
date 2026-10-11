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

## Bloques 2 y 3

Todavía pendientes. El editor web actual guarda producto/variantes/fotos en llamadas separadas; revisar
confiabilidad y reintentos antes de trasladarlo. El backend no tiene estado draft en su enum de moderación:
no presentar «pendiente» como borrador privado. La moderación corresponde a triggers/RPC administrativos.
Precios automáticos dependen de `product_pricing`/`set_product_costs`; no duplicar fórmulas.

Los pedidos usan `seller_fulfillments` y `advance_fulfillment`: el servidor decide pasos `seller_can_set`,
pago requerido, avance solo hacia delante y guía requerida para despacho a domicilio. La app nunca
verifica pagos, liquida saldos ni permite cancelación administrativa. Reutilizar el historial de eventos y
el destino/datos ya incluidos en la consulta del panel, limitados a las entregas de la tienda.
