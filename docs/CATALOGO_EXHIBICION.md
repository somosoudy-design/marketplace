# Catálogo de exhibición — lote 01

**Estado: preparación técnica; entrega fotográfica BLOQUEADA.** Seleccionados 15 productos; **0 fotografías auténticas obtenidas, 0 correspondencias modelo/variante verificadas y 0 permisos de redistribución confirmados**. No publicar ni presentar las ilustraciones actuales como fotografías.

## Alcance y procedencia

Lectura pública del catálogo remoto de pruebas el 2026-10-13 mediante RPC `search_products` y la clave anon ya existente: 43 productos, sin acceso administrativo, cambios remotos, SQL o migraciones. Primeros 15 por popularidad, incluidos el protagonista editorial y las primeras recomendaciones de C. Los UUID remotos y las rutas originales quedan en [lote-01.json](catalogo-exhibicion/lote-01.json). Los UUID locales son distintos: no sustituirlos por los de este manifiesto. También se leyeron las 15 fichas mediante RPC público `product_detail`: variantes, rutas de galería y estados demo/publicado coinciden con sus IDs. Los nombres comerciales todavía no identifican modelos/tonos oficiales. No cambia ningún dato comercial.

| Producto | Qué falta identificar antes de elegir fotografía |
|---|---|
| SHEGLAM labial líquido mate | Línea comercial y nombres oficiales de los tonos. |
| UGREEN Nexode cargador GaN 65 W | Número de modelo/SKU del fabricante y correspondencia de color y conector. |
| UGREEN Nexode power bank 20.000 mAh | Número de modelo/SKU del fabricante y correspondencia de color y conector. |
| UGREEN cable USB-C a USB-C | Número de modelo/SKU del fabricante y correspondencia de color y conector. |
| SHEGLAM brillo labial | Línea comercial y nombres oficiales de los tonos. |
| UGREEN Revodok hub USB-C 6 en 1 | Número de modelo/SKU del fabricante y correspondencia de color y conector. |
| SHEGLAM rubor líquido | Línea comercial y nombres oficiales de los tonos. |
| Audífonos inalámbricos con cancelación de ruido | Fabricante, modelo y variante: la ficha actual es genérica. |
| Audífonos in-ear con estuche de carga | Fabricante, modelo y variante: la ficha actual es genérica. |
| Vela aromática en vaso de vidrio | Fabricante, modelo y variante: la ficha actual es genérica. |
| UGREEN Nexode cargador GaN 30 W | Número de modelo/SKU del fabricante y correspondencia de color y conector. |
| Guantes de nitrilo sin polvo · caja x100 | Fabricante, modelo y variante: la ficha actual es genérica. |
| Cama ovalada para mascotas | Fabricante, modelo y variante: la ficha actual es genérica. |
| SHEGLAM base de maquillaje fluida | Línea comercial y nombres oficiales de los tonos. |
| Parlante portátil resistente al agua | Fabricante, modelo y variante: la ficha actual es genérica. |

## Investigación real y límites

Catálogo/dirección de arte y auditor independiente trabajaron mediante lectura; solo el agente principal modifica y hace commits. Intentos documentados a UGREEN (`www.ugreen.com`, `us.ugreen.com` y sitemap), SHEGLAM (`www.sheglam.com` y sitemap), CDN Shopify y Wikimedia: **CONNECT Tunnel 403** de la política de red. No se accedió a páginas de producto, licencias ni originales: los enlaces raíz son sitios a consultar, no fuentes verificadas de una foto. Registro local ignorado: `.local/catalogo-referencias-agent/fuentes-iniciales.json`. No se deducen derechos ni prohibiciones del 403.

Se guardó un borrador de configuración del entorno conservando sus dominios existentes y añadiendo `ugreen.com`, `*.ugreen.com`, `sheglam.com`, `*.sheglam.com`, `cdn.shopify.com`, `commons.wikimedia.org`, `upload.wikimedia.org`. El resultado exige aplicar/publicar esa configuración del entorno: **no es una OTA** ni habilita todavía los accesos. No se solicitaron credenciales de Supabase.

## Capa de presentación

- `catalog-exhibition-policy.ts`: opt-in `EXPO_PUBLIC_CATALOG_PRESENTATION=private-preview`, Android con canal nativo `preview` y backend de pruebas exacto. Web únicamente en loopback para evaluación local. Otras plataformas, backends, canales o valores ausentes quedan desactivados. La bandera es pública y solo cambia presentación; no concede permisos ni protege recursos confidenciales.
- `catalog-exhibition-assets.ts`: registro **vacío** de recursos locales Metro. Un reemplazo requiere UUID y ruta original exactos; no se infiere identidad por título ni slug. Fotos no registradas conservan Supabase y su encuadre actual.
- `ProductImage`: soporte `productId`, recurso local con `contain`, clave de reciclaje por identidad/hash/ruta y fallback a la imagen original ante error. Tarjetas, minis, editorial, galería de ficha, confirmación de agregado y carrito comparten el resolver. Favoritos/resultados/recomendaciones reutilizan esas tarjetas.
- Privado: oculta badges Demo y repetición editorial, con una leyenda `Entorno de pruebas` por pantalla, explicación accesible y texto visible breve de precios de ejemplo/no ofertas reales en ficha y carrito. Conserva `is_demo`, guardas contra promociones/escasez ficticias, estados comerciales y avisos de pago. Configuración habitual conserva todas las etiquetas anteriores.
- Galería: cada ruta se vincula separadamente; una foto de portada no se replica en todas las páginas. Antes de aceptar el lote hay que revisar también las fotos secundarias, evitando mezclar una fotografía real con ilustraciones inconsistentes. Categorías usan imágenes representativas sin UUID de producto; se conservan, pendiente una asignación explícita validada, sin inferir que el ID de categoría es un producto.

## Preparación y derechos

`node tools/catalog-exhibition/prepare.mjs` verifica el manifiesto sin escribir, descargar ni publicar. Hoy devuelve **0/15 y salida 2 esperada**: faltan modelo, original y derechos para todos. `--write` solo permite preparar 12–15 referencias documentadas, con originales ignorados en `.local/`, hash idéntico al revisado, metadatos reales ≥768×768 y ≤512 KiB. Copia los originales sin generar contenido, alterar colores, recortar marcas o ampliar artificialmente. La documentación de un permiso requiere revisión humana: el script no verifica por sí mismo su validez legal ni el modelo fotografiado.

Antes de incorporar una fotografía: confirmar referencia exacta, tonos/enchufe/puertos y derechos que cubran Expo/OTA y el repositorio público. Registrar página original, autor, evidencia de permiso/licencia, responsable, dimensiones y SHA-256. **Una imagen pública de fabricante no implica licencia.** Referencias sin permiso quedan exclusivamente en `.local/`, fuera de imports de Metro, commits, exportaciones, capturas públicas y EAS.

Los recursos aprobados generan un manifiesto privado junto a los archivos. El guard de promoción consulta manifiesto, árbol de recursos y registro del commit inmutable antes de llamar APIs; rechaza llevar recursos a `production` incluso si falta el manifiesto. No se cambió ni activó ningún workflow de publicación. El emulador actual publica capturas a `ci/capturas`: no ejecutarlo con referencias sin permiso.

## Evidencia y validación

Product Design usado realmente: `index`, `user-context`/preflight (sin memoria guardada), `audit` y `audit/references/design-audit-framework.md`. Se aplicaron consistencia entre apariciones, jerarquía del producto, claridad sobre datos de ejemplo y revisión de capturas de la app real. No se usó ImageGen: no sirve para acreditar una fotografía auténtica. El recurso compartido `references/critical-overrides.md` no estuvo disponible.

Antes: 8 capturas de Inicio (claro/oscuro, 320/412, normal/estrés CSS1,6) y 8 de scroll, guardadas en `.local/catalog-exhibition/before/`; la captura normal412 clara fue inspeccionada y muestra ilustraciones y Demo. El estrés CSS no prueba fuente del sistema Android. **No existe todavía una comparación antes/después con fotografías auténticas**, ni prueba Android de este lote. No atribuir al lote las capturas nativas de C anteriores.

Pruebas: política4/4; selección/procedencia/promoción9/9; tipos/lint global aprobados. Configuración habitual: Inicio/ficha23/23 y presentación8/8. Primera pasada privada8/8, evidencia repetida porque la captura de búsqueda todavía no esperaba la respuesta de UGREEN y la ficha estaba en transición. Auditor exigió estabilizar ambas; nueva pasada de capturas en curso. Web habitual/privado y AndroidHermes5,9MB exportados, 41 recursos Android de dependencias y 0 fotografías de exhibición. No ejecución/OTA nueva en Android, ni runtimeexacto nuevo confirmado.

## Próxima acción exacta

1. Aplicar los dominios guardados en Configuración del entorno y volver a probar una página oficial; no pedir acceso administrativo a Supabase.
2. Consultar referencias exactas y archivos oficiales o fotografías autorizadas; completar modelo/variante y evidencia de derechos en `lote-01.json`. Si la ficha no identifica un modelo, solicitar la referencia al propietario; no sustituir por uno parecido.
3. Revisar originales con el agente de catálogo y auditor. Preparar 12–15 aprobados, cubrir galería/categorías y capturar los mismos recorridos claros/oscuros a 320/412.
4. Verificar tipos/lint, recorridos focalizados, inventario de assets, runtime exacto APK5 `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba` y auditoría independiente. **Publicar Android preview solamente después de derechos confirmados y una autorización específica nueva de Oliver.**
