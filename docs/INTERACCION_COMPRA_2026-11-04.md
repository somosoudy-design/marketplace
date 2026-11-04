# HAYAZGO · interacción y compra compacta · 4 de noviembre de 2026

## Resultado

Se aplicaron cuatro de los cinco objetivos de Oliver: favoritos con respuesta inmediata y recuperación fiable, carrito integrado, productos reunidos en la revisión y transiciones/carga que conservan la composición. La app y el storefront comparten la jerarquía comercial. **Cupones queda pendiente de una operación real del backend**, no se presenta como funcional.

La URL de referencia `https://x.com/desdivj/status/2117922523082076329` devolvió CONNECT 403 por política de red. No se vio el video. Las decisiones se basan en los cinco criterios escritos por Oliver y en capturas de la aplicación real; no se atribuyen a esa referencia tiempos, imágenes o comportamientos no observados.

Fuentes: antes `6139009`; implementación app `55e6aaa`; corrección del diálogo web y pruebas `3f05e84`. Root fue el único escritor e integrador. No se modificaron reglas financieras, precios, pagos, SQL, servicios remotos, iOS, configuración nativa ni fotografías.

## Decisiones implementadas

### 1. Favoritos: la respuesta visual representa una operación real

Tarjetas y ficha usan el mismo control: corazón discreto de 19 px en un objetivo táctil de 44 × 44 px. La selección responde inmediatamente, con pulso breve y halo sólo al guardar; el contorno del objetivo táctil no se encoge. En nativo conserva respuesta háptica; con movimiento reducido se omite la animación.

El auditor reprodujo dos escrituras opuestas al tocar rápidamente el favorito anterior. Ahora hay guard síncrono por cuenta/producto, estado ocupado compartido entre sus apariciones y consultas acotadas al comprador. Un fallo revierte sólo ese producto, sin deshacer otro favorito guardado en paralelo. Las respuestas tardías de una cuenta cerrada no rellenan la caché de otra cuenta.

El error se muestra en una hoja en la app y un diálogo accesible en la web. Reintentar conserva la intención original y ejecuta la operación, incluso si también falló la lectura de favoritos. Al quitar desde Favoritos, la tarjeta permanece durante el guardado y el error, para no perder la acción de recuperación. Al completarse, desaparece y el vacío se actualiza.

### 2. Carrito: producto, importe y cantidad pertenecen al mismo conjunto

Una superficie continua contiene los productos, separados internamente por tienda/entrega. Cada fila agrupa fotografía, nombre y variante; el importe de línea y los controles de cantidad/quitar comparten un pie a ancho completo. El precio unitario sólo aparece cuando hay varias unidades. Los estados de disponibilidad y la confirmación de quitar se conservan.

La web deja de confundir número de grupos logísticos con productos. Distingue referencias, unidades y entregas; el contador del carrito refleja unidades. Continuar queda bloqueado durante una modificación o recálculo pendiente. El resumen desktop ya no se estira a toda la altura de la lista.

### 3. Revisión: un cuadro de productos, sin fingir una sola entrega

El cuadro reúne las referencias y unidades. Dentro permanecen tienda, agrupación logística, método, coste, fecha estimada, retiro y Cambiar por entrega. Después aparecen dirección, plan/calendario y desglose. La web elimina el segundo inventario duplicado en la revisión.

La barra fija conserva total, anticipo cuando corresponde y Confirmar pedido. El desglose y la explicación de que confirmar crea el pedido y reserva productos permanecen en el cuerpo desplazable. La secuencia sigue **Dirección → Entregas → Plan → Revisión → Pago**: dirección determina opciones/coste/plazo; el pago sigue siendo una operación posterior, sin verificación automática.

### 4. Progresión: continuidad sin demoras artificiales

Las fases de checkout entran con una transición de opacidad de 160 ms; el encabezado conserva el foco y las decisiones/Atrás siguen funcionando. Movimiento reducido omite la transición. La actualización de importes respeta la misma preferencia. No se añadió una animación escalonada de todos los productos ni una dependencia nativa.

El skeleton de producto adopta la geometría de la tarjeta real. En 412 px la diferencia medida de altura pasó de 45,5 px a 0; a 320 también es 0. Una consulta pendiente conserva los datos existentes y bloquea la acción correspondiente. El indicador de refrescar el carrito sólo responde al gesto de refrescar, no aparece por cada cambio de cantidad.

## Evidencia comparable

[Registro completo y hashes SHA-256](capturas/interaccion-compra-2026-11-04/manifest.json). Son PNG originales, sin retoques ni generación de imágenes. Mismos tres productos, cuatro unidades, dos entregas y comprador local; subtotal 101 USD, envío 5,30 USD y total 106,30 USD iguales. Las capturas no crean pedidos.

| Pantalla | Antes | Después |
|---|---|---|
| Carrito, 320 oscuro | [Original](capturas/interaccion-compra-2026-11-04/before/01-cart-320-dark.png) | [Original](capturas/interaccion-compra-2026-11-04/after/01-cart-320-dark.png) |
| Revisión, 412 claro | [Original](capturas/interaccion-compra-2026-11-04/before/02-review-412-light.png) | [Original](capturas/interaccion-compra-2026-11-04/after/02-review-412-light.png) |
| Revisión, 320 texto 1,6× | [Original](capturas/interaccion-compra-2026-11-04/before/06-app-review-text160-320-dark.png) | [Original](capturas/interaccion-compra-2026-11-04/after/06-app-review-text160-320-dark.png) |
| Carrito web, 1440 claro | [Original](capturas/interaccion-compra-2026-11-04/before/03-web-cart-1440-light.png) | [Original](capturas/interaccion-compra-2026-11-04/after/03-web-cart-1440-light.png) |
| Revisión web, 320 oscuro | [Original](capturas/interaccion-compra-2026-11-04/before/04-web-review-320-dark.png) | [Original](capturas/interaccion-compra-2026-11-04/after/04-web-review-320-dark.png) |

La serie principal contiene 18 PNG por fase: app a 320/412, web a 320/1440, claro/oscuro y presión tipográfica. Las capturas web fullPage sitúan la barra fija a la altura del viewport dentro del PNG largo; consultar también el [viewport real](capturas/interaccion-compra-2026-11-04/complementary/after-09-web-review-viewport-320-dark.png). No es una barra colocada en medio del documento.

| Medida | Antes | Después |
|---|---:|---:|
| Contenido del carrito app a 320 | 910 px | 823 px |
| Filas de los tres productos, app 320 | 178/160/160 px | 152/142/142 px |
| Primer producto en revisión app | Y290 | Y248 |
| Barra fija de revisión, 320 × 892 | 210 px | 113 px |
| Barra fija, 320 × 740 y texto 1,6× | 342,375 px | 179 px |
| Altura del contenido principal del carrito web 320 | 1122 px | 989 px |
| Diferencia skeleton/tarjeta a 412 | 45,5 px | 0 px |

La mejora no se atribuye a todos los números: en app 412 dos filas crecen 8 px al uniformar su estructura; en revisión web el primer producto queda 51 px más abajo por el conteo/agrupación, aunque se elimina la lista duplicada y el contenido total baja 81 px. La dirección, plan y desglose siguen alcanzables por scroll; el último aviso termina 24 px por encima de la barra en texto normal y ampliado.

Las imágenes documentan React Native Web y Next.js en Chromium, **no Android físico**. Texto 1,6× se simuló en el DOM; no equivale al fontScale nativo ni a una sesión de TalkBack.

## Revisión independiente y Product Design

Recursos consultados realmente:

- Product Design `index/SKILL.md`: seleccionar el procedimiento de auditoría.
- Product Design `audit/SKILL.md` y `audit/references/design-audit-framework.md`: capturar primero, separar evidencia de hipótesis, gravedad por tarea y revisar después de implementar.
- `oliver-design-direction/SKILL.md`: continuidad visual, protagonismo del producto, densidad útil y controles con función.
- `user-context/SKILL.md` de Product Design no estuvo disponible; no se atribuye su lectura.

El especialista UX/UI capturó e inspeccionó las 36 imágenes comparables y tres adicionales. El especialista ecommerce verificó conteos, grupos y permisos; rechazó deducir soporte de cupón de la mera columna `discount_usd`. El auditor independiente reprodujo la carrera de favoritos y el salto del skeleton antes, y verificó la corrección después. Root contrastó las capturas y consolidó los cambios.

**Veredicto: APROBADO para los puntos implementados 1, 2, 3 y 5.** Diez verificaciones independientes: ocho app y dos web. No se aprueba el cupón como funcional ni se certifica todo el marketplace o la recepción física de una OTA.

Correcciones exigidas durante la revisión: guard de doble toque, rollback por producto, aislamiento de respuestas de cuentas, reintento que realmente guarda tras fallo de lectura y conservación de la hoja al quitar desde Favoritos. Se descartaron el cupón ficticio, la fusión de todas las entregas y reducir áreas táctiles para aparentar mayor densidad. No quedan objeciones bloqueantes para este incremento.

[Informe UX y límites](capturas/interaccion-compra-2026-11-04/REVISION_UX.md) · [dictamen independiente](capturas/interaccion-compra-2026-11-04/REVISION_INDEPENDIENTE.md).

## Pruebas y publicación

Resultados: **44 casos distintos de app exportada y 42 de storefront aprobados**, incluyendo los diez del auditor; no se suman dos veces. La regresión app obtuvo 35/36 al principio; el selector histórico de texto se corrigió al nombre accesible del producto y sus dos casos pasaron junto a los ocho nuevos. Web: 40/40 de la suite más dos casos independientes. Pasaron 52 unitarias core, 3 de favoritos y 11 de confirmación; tipos, lint, build web de producción y export Android Hermes. [Registro de validación](capturas/interaccion-compra-2026-11-04/validacion.json).

Se solicita una única OTA Android preview usando la autorización vigente. El guard de CI debe confirmar el runtime APK5 exacto `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`. Publicación y observación del canal se completan a continuación; no hay emulador ni teléfono conectado. El storefront está implementado y probado localmente, sin URL pública nueva.

Se encontraron dos dependencias de las pruebas históricas, no se alteró el producto para ocultarlas: stock local agotado y tasas demo vencidas. Los tests ahora reutilizan copias de productos exclusivamente locales; no reponen stock compartido. Se ejecutó una vez `dev_refresh_demo_rates()` del seed en loopback para insertar lecturas demo con los mismos valores, sin cambiar políticas ni crear snapshots. El bloqueo de pagos ante tasas vencidas se mantuvo. El helper de navegación espera cambio real de progreso, y la prueba de favoritos consulta su nombre accesible, que conserva marca y nombre aunque visualmente estén separados.

## CUP-01 y siguiente incremento

La interacción recomendada es una fila «Agregar cupón» de al menos 44 px que despliega campo y Aplicar dentro del resumen; foco al campo, resultado/error junto a él y posibilidad de quitar. El descuento y el total deben proceder del backend. No se ha añadido esta fila a la aplicación porque no existe RPC/API de canje ni reglas de elegibilidad.

Antes de implementarla hay que definir financiador del descuento, tiendas/productos elegibles, importe o porcentaje, tope/mínimo, vigencia, límite por comprador, acumulación y efecto sobre cuotas/reembolsos. Después se prepara el contrato y pruebas locales de permiso, concurrencia y persistencia; no se activa remotamente por esta entrega.

Otros seguimientos acotados: verificar esta OTA en el Samsung de Oliver; revisar la etiqueta de pestaña activa con fuente nativa grande (truncamiento preexistente); adaptar la fila desktop del carrito para aprovechar mejor el ancho. Mantener separado el fallo previo de EAS Hosting del panel y el storefront aún sin publicación pública.
