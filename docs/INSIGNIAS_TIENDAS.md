# Insignias y enlaces de tiendas

Pedido de Oliver del 2026-10-10 14:36Z: enlaces para compartir tiendas e insignias de tienda (oficial, verificada,
asociada). Este documento dice qué funciona con los datos de hoy y qué falta para completar el sistema.

## Insignias

| Insignia | Color | Significado | Con qué dato | Estado |
|---|---|---|---|---|
| Tienda oficial | Dorada (`amber 400`) | La opera directamente la plataforma | `stores.kind = 'platform'` | Funciona. Hoy solo la tiene la tienda «Kora» (comprobado en el proyecto de pruebas el 2026-10-10) |
| Tienda verificada | Morada (`brand`) | Identidad y documentos verificados por la plataforma | No existe | Solo el diseño: ninguna tienda la muestra |
| Tienda asociada | Gris (`textMuted`) | Relación comercial reconocida; no implica verificación | No existe | Solo el diseño: ninguna tienda la muestra |

- Componente: `apps/mobile/src/components/catalog/StoreBadge.tsx` (`StoreBadge`, `storeTier`, `STORE_TIERS`). Un
  sello con un check, dibujado con el `badge-check` del set de iconos.
- Dónde se ve: junto al nombre en la página de la tienda (al tocarlo explica qué significa), en «Vendido por» de la
  ficha y en las tarjetas de «Tiendas destacadas» del Inicio. No se puso en carrito ni checkout, donde el nombre de la tienda
  es solo un rótulo pequeño.
- Los vendedores no pueden ponerse la dorada: `guard_store_fields` impide que cambien `kind` (solo admin o servicio).
- Se quitó la etiqueta «Vendedor verificado» que la página de tienda mostraba a todo vendedor, y «Vendedores
  verificados» del Inicio: ninguna verificación existe todavía.

### Qué falta para la verificada y la asociada

1. Un dato que solo pueda poner un administrador, por ejemplo una columna `stores.badge` (`verified`, `partner` o
   vacío) con la fecha y quién la otorgó, agregada a `guard_store_fields` para que el vendedor no la cambie. Es una
   migración; no se hizo porque el pedido dice no migrar sin necesidad.
2. Incluirla en lo que la app ya lee de cada tienda (`store_profile`, la tienda de la ficha y los resúmenes de
   tienda) y leerla en `storeTier`.
3. En el panel de administración, otorgar o quitar la insignia con un motivo (la tabla ya tiene auditoría).
4. El proceso real de verificación (qué documentos, quién revisa): decisión de Oliver.
5. Opcional: un índice único para que solo pueda existir una tienda `platform`.

## Enlaces de tienda

- Ruta: `/tienda/<slug>`, la que la app ya tenía para enlaces universales; abre la tienda con su catálogo.
- Botón «Compartir» en la página de la tienda: muestra el enlace, «Compartir» (menú nativo, o el del navegador si
  existe) y «Copiar enlace».
- El enlace sale de `storeLink` en `apps/mobile/src/lib/links.ts`:
  - con un dominio real en `config/brand.json`: `https://<dominio>/tienda/<slug>`;
  - hoy (el dominio es `kora.example.com`, que no existe): en la app, `kora://tienda/<slug>`, que abre la tienda
    en la app instalada; en la versión web, la dirección desde donde se sirve.
- Qué falta para que funcione sin la app: un dominio, publicar ahí la versión web de la app y `assetlinks.json` para
  que Android abra la app desde ese enlace. Con el dominio en `config/brand.json`, el enlace cambia solo a https.
  Publicar la web es una decisión de Oliver (es público). WhatsApp y otras apps no vuelven tocable un enlace
  `kora://`: hasta tener dominio, se puede copiar pero no siempre se puede tocar.
- La ficha de producto ya compartía `https://kora.example.com/p/...`, que tampoco funciona todavía; no se cambió
  aquí porque el pedido era solo de tiendas.
