# HAYAZGO — recorrido comprador V4

**Propuesta corregida para revisión de Oliver, no implementación de la app.** Ambas direccionesV3 fueron rechazadas por el propietario. Se conserva su fuente histórica; ninguna debe considerarse aprobada. V4 adapta la referencia aportada (catálogo/ficha/carrito) a ElectricViolet y al pedido multivendedor. No reproduce literalmente sus dispositivos, gradientes, insignias o productos.

## Decisiones que cambian el recorrido

1. **Producto como unidad comercial:** misma fotografía/nombre/precio entre catálogo, ficha, carrito y pedido. Tarjetas integradas con nombre de dos líneas y precio prioritario; foto4:3 para las fuentes existentes, corazón visual18px con objetivo44px. No reseñas, promociones o existencias inventadas.
2. **Buscar prioriza resultados:** campo visible y una sola barra reúne categoría/cantidad, filtros y orden. Sin repetir marca, encabezado grande y dos hileras persistentes de controles. Tipos de producto en hoja; selección y cantidad conservan contexto. Cuatro modos reales del prototipo: búsqueda, tipo, rango y orden.
3. **Carrito compacto por tienda:** fotografía88×104 a412px (72×96 a320), variante, precio y cantidad forman la misma fila. Dos grupos se reconocen por tienda y costo. Se elimina introducción editorial, cinta explicativa y fila repetidaDisponible. Resumen legible y acción fija; los controles conservan44px.
4. **Un checkout, sin revisión duplicada:** dirección, productos por tienda, modalidad/costo de cada entrega y resumen conviven en una pantalla. Hojas acotadas editan dirección/modalidad. El efecto de Crear pedido permanece al lado del botón: reserva, vacía carrito, pago después.
5. **Pagar conserva contexto:** pedido creado, método, instrucciones, referencia/comprobante y verificación son estados diferentes. No se presenta reporte como pago confirmado. El importe no se usa como etiqueta de una acción ambigua. Accesos directos sin pedido y reenvíos del reporte quedan protegidos en la simulación.
6. **Un sistema, densidades distintas:** PlusJakartaSans existente, ElectricViolet para selección y acción, superficies contiguas, separadores finos, cifras alineadas, fotografías originales. Catálogo comparativo; carrito en filas; checkout en grupos; pago centrado en importe e instrucciones. Sin nuevo sistema de tarjetas flotantes para cada explicación.

La aperturaInicio interpreta la continuidad de C dentro del prototipo. No sustituye la portada del APK ni aprueba otro rediseño de Inicio. Favoritos siguen en productos y Cuenta; navegaciónInicio/Buscar ahora llega a catálogo real, no a carrito. La ficha no muestra un selector ficticio cuando el ejemplo tiene una sola presentación.

## Evidencia y medidas

[Comparación antes/después](comparison.html), [36 capturas](screens/), [evidencia](evidence.json). Capturas originales, mismos anchos y alto892; sin retoques ni dispositivo dibujado. Valores medidos de DOM tras fuentes/imágenes decodificadas:

| Medida | V3A | V3B | V4 |
|---|---:|---:|---:|
| Y primera fotografía del carrito,412px |302,50px|277,16px|163,39px|
| Tamaño de esa fotografía,412px |64×72|64×72|88×104|
| Y primera fotografíaBuscar |No existía vista|No existía vista|131px|

Se adelanta el producto139px frenteA y114px frenteB; no se atribuye todo ese espacio a la cabecera. V4 conserva dos fotografías completas, controles y resumen en la primera vista. Los131px deBuscar también se verificaron a320px y en oscuro. No comparar esta cifra con capturas históricas de la app sin repetir el mismo estado.

V3cart mostraba subtotal51USD y envío por definir; V4 aprovecha un destino de ejemplo preseleccionado y muestra estimación8USD, total59USD. Los productos siguen42+9; checkoutV3 ya usaba4+4. Para implementar en la app, **solo mostrar envío/total estimados si los devuelve el servidor para destino/modalidad válidos**. Sin esa información se muestraPor calcular; no trasladar la aritmética ficticia del prototipo al motor real.

## Recorrido y revisión

| Paso | Vista | Estado de la propuesta |
|---|---|---|
|1|Inicio/Buscar|Destinos de productos reales en el prototipo; búsqueda, filtro, orden y vacío revisados|
|2|Ficha|Imagen/precio compartidos, galería y favorito, regreso conservado|
|3|Carrito|Cantidad, eliminación confirmada, vacío, resumen y dos entregas revisados|
|4|Finalizar pedido|Entrega y revisión fusionadas; dos costos/total y compromiso visibles|
|5|Método|Pedido creado, aún pendiente de pago|
|6|Instrucciones/reporte|Referencia obligatoria paraVES, efectivo opcional; comprobante local sin envío|
|7|Seguimiento|Pago en verificación; no confirmado ni reenviable|

Chromium local, claro/oscuro,412/320:8 grupos de verificaciones aprobados,36PNG,0erroresJS y0peticiones externas. Otro smoke del HTML autocontenido cargó el documento por loopback, apagó red y completó carrito→checkout→pago→verificación sin peticiones/errores. `file://` fue denegado por política del navegador gestionado; no se afirma probado ese transporte ni la apertura en Samsung. Nada de backend, cobros, APK o Android físico.

Auditor independiente `release_auditor`: revisó18capturas y3comparaciones; exigió títulos13px en320, encuadre completo del lectorUGREEN y eliminación del aviso flotante redundante en resultado. Corregidos; segunda revisión focalizada de3PNG confirma **LISTA PARA REVISIÓN DE OLIVER**, sin nuevas objeciones en este incremento. La aprobación interna no aprueba la dirección para producción.

## Product Design utilizado

Recursos realmente leídos durante esta ejecución: `index/SKILL.md`, `audit/SKILL.md`, `get-context/SKILL.md`, `user-context/SKILL.md` y su script depreflight, `image-to-code/SKILL.md` del complementoProductDesign. Prefijo: `skill://Plugin_fa77aec24fc08191bc6e57f377126d76/`. Preflight: sin contexto guardado. El recurso compartido `critical-overrides.md` no pudo resolverse; no afirmar ejecución íntegra/certificación del complemento. No hubo ImageGen, Figma o investigación externa fingida.

Aplicación concreta: audit→capturar fuente antes de juzgar, separar evidencia de producto real; get-context→fijar comprador/móvil y decisiones de compra, sin abrir vendedor; image-to-code→imagen de referencia como dirección de composición, activos reales existentes, navegación/control/estados y QA renderizada. Es una adaptación solicitada, no una reproducción1:1 del montaje. Fotos existentes con sus licencias; ningún producto dibujado mediante CSS/SVG. Los SVG de iconos proceden del registroLucide ya utilizado por la app.

El enlaceWork proporcionado recibióCONNECT403. Se inspeccionó la copiaV3 del repositorio, no su publicación viva. Navegador usado: Chromium local conPlaywright, no integraciónBrowser/Sites. No se republicó ese sitio.

## Reproducir y entregar

Desde la raíz con dependencias existentes:

```bash
source /workspace/.onboarding/env.sh
node tests/app-e2e/serve.mjs /workspace/marketplace 8098
# Otra terminal, con el mismo helper activado:
node docs/experiencia-v4/verify.cjs
python3 docs/experiencia-v4/build-download.py
```

El empaquetador genera `.local/diseno-v4/HAYAZGO-comprar.html`: documento único con fuentes/fotos/iconos/licencias, sinAPI (`connect-src none`). InicialmenteCarrito; desde la barra se exploran Inicio,Buscar,Cuenta/favoritos y tema. El source es solo documentación/prototipo, nada lo importa enExpo.

## Límites y siguiente incremento

Las fotos autorizadas son documentales: ilustran mercancía real pero **no alcanzan dirección de arte de catálogo de estudio**. El acabado comercial final necesita un lote consistente de fotografías limpias autorizado para su uso; no se oculta este límite con un test aprobado o fotos falsas.

Este incremento muestra un pedido mixto de pago completo y5referencias. Cuotas/anticipos elegibles, variantes múltiples, encargo/agotado, direcciones nuevas, sesión y errores remotos necesitan sus variantes antes de implementación nativa; no se propone eliminar esas funciones actuales. No se rediseña vendedor, finanzas o backend. No hay prueba de fuenteOS ampliada, TalkBack, FPS o dispositivo físico.

**Próxima tarea exacta:** Oliver revisa composición y flujo de V4. Si acepta, completar variantes comerciales de checkout/errores/sesión con los contratos actuales y pasar el sistema comprador a componentes existentes por incrementos. Si rechaza, precisar la pantalla/composición fallida sobre estas capturas. No modificarAPK, backend, tasas o publicarOTA por aprobación interna.
