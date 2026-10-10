# Dirección de producto de Kora

## Qué es Kora

Kora no es un e-commerce genérico. Es un marketplace nativo premium para Venezuela con:

- identidad visual propia (Electric Violet, abierta a refinamiento);
- navegación compacta y contextual, con la experiencia centrada en productos;
- tiendas independientes en un marketplace multivendedor;
- productos propios, disponibles, por encargo y reservables;
- carrito unificado aunque los productos salgan de tiendas distintas;
- pagos en varias monedas (bolívares, dólares, USDT; Pago Móvil, transferencia, Zelle, efectivo, y
  Binance Pay y PayPal preparados);
- anticipos y cuotas con saldo en USD;
- logística, seguimiento e historial;
- seguridad financiera y un panel de administración y de vendedores.

**La complejidad pertenece al sistema; la claridad, al usuario.** Simplifica la experiencia, no las
capacidades: ninguna función se elimina para que algo se vea más sencillo.

## Dirección visual: Electric Violet

Reemplazó a la dirección anterior («Arena y Jade», beige, verde y serif) por decisión de Oliver (Directriz
maestra 02). Tokens, componentes y reglas de fotografía: `docs/DISENO.md`.

- **Esto es una tienda.** Lo primero que se ve son productos: buscador grande, categorías compactas,
  colecciones con foto, recomendados, populares y tiendas destacadas. Nada de bloques institucionales, de
  pago o de tasa en el Inicio (la tasa vive en la cuenta, el carrito y el checkout, donde se decide).
- **El producto es protagonista.** Fotografía primero, luego nombre, precio y disponibilidad.
- **Color con función.** Violeta `#6D42E8` para la acción y la selección, no para rellenar superficies; tinta
  `#1C1928` para texto y precios; lavanda `#EDE6FF` para lo seleccionado; coral `#FF746B` solo para ofertas,
  urgencia y el punto de la marca. Superficie `#F8F7FC`, texto secundario `#777383`.
- **Una sola familia tipográfica:** Plus Jakarta Sans (400 a 800) en app y panel, con tracking negativo en
  tamaños grandes y cifras tabulares.
- Sin degradados gratuitos ni sombras decorativas; la sombra es para lo que flota (hojas, barras fijas).
- Modo claro y oscuro con los mismos roles; contraste AA del texto en ambos.

### Referencias

Oliver compartió cuatro capturas de apps de compras (una de zapatillas en violeta, «User App» en coral,
«Shopink» en amarillo, «Shopmore» en violeta). Son referencias de **personalidad y calidad de experiencia**,
no diseños para copiar: Kora tiene libertad para construir su identidad, igual o mejor. Las imágenes son de
terceros y no se suben al repositorio (están en los archivos del proyecto de Claude,
`/mnt/project-files/marketplace/diseno/referencias-oliver/`).

## Navegación contextual

- En pantallas de exploración: navegación principal discreta, cuatro pestañas con nombre (Inicio, Explorar,
  Carrito, Cuenta). Favoritos es una lista guardada, no un lugar para explorar: se abre con el corazón junto a
  las notificaciones en el Inicio y desde Cuenta (decisión de Oliver, 2026-10-10). No se rellena el hueco con otra
  pestaña.
- En la ficha de producto: sin navegación innecesaria; fotografía, información relevante y la acción de
  compra fija abajo.
- En el checkout: menos distracciones, pasos numerados y el total con su botón fijos abajo.
- En pagos: solo lo necesario para completar la operación (monto exacto, datos para pagar, confirmación).
- Hojas inferiores, acciones fijas, gestos naturales, transiciones y háptica cuando mejoran la experiencia;
  ninguna animación solo para decorar.
- Al volver a una pantalla se conserva el contexto: búsqueda, filtros y posición del scroll.

## Recorrido comercial

Inicio → Explorar → Producto → Variantes → Carrito → Checkout → Método de pago → Confirmación → Seguimiento.

Todo el recorrido usa el mismo lenguaje visual y conserva las capacidades: multivendedor, tiendas
independientes, disponibles, por encargo, reservables, carrito multivendedor, cuotas, anticipos, saldo en
USD, pago en bolívares, USDT, PayPal, Zelle, Pago Móvil, direcciones, envíos, seguimiento, historial y
administración.

Requisitos de experiencia que ya se cumplen y no deben perderse:

- Cada estado de disponibilidad (en stock, por encargo, reservable, en camino, agotado) tiene su llamado a la
  acción y su texto; la fecha estimada se muestra como rango.
- Checkout progresivo con direcciones venezolanas (estado, ciudad, municipio, referencia, cédula/RIF),
  totales del servidor y el plan de pago explicado; nada de sorpresas en el monto.
- La tasa nunca es un número suelto: dice fuente, hora y que el monto en bolívares se fija al generar el pago.
- Pago en verificación explicado («Estamos verificando tu pago»), sin marcar nada como pagado por un botón.
- Posventa como conversación: calificar, reportar un problema por motivo y seguir el reclamo como chat.
- Estados vacíos, de carga (esqueleto), error y sin conexión siempre con texto útil; nunca una pantalla en
  blanco ni un código interno.
- Mensajes en español de Venezuela, sin jerga técnica.
- Datos de demostración siempre rotulados.

## Criterios de calidad

- Un Design System real (tipografía, escalas, espaciado, radios, superficies, iconos, fotografía, movimiento,
  estados, jerarquía, accesibilidad, comportamiento responsive), no solo variables de color.
- Cada componente tiene una razón de existir y cada pantalla se siente parte del mismo producto.
- Minimalismo no es ausencia de contenido; sofisticación no es espacio vacío; premium no es botones gigantes
  y colores suaves. La calidad se percibe en los detalles.
- Compilar ≠ funcionar; pasar pruebas ≠ cumplir requisitos; tener componentes ≠ buen diseño; tener backend ≠
  integración completa. Se verifican recorridos reales: registro, productos remotos, navegación, variantes,
  carrito persistente, checkout, cuotas, conversión de moneda, pagos simulados, pedidos, separación de
  vendedores, permisos, errores, conexión deficiente y sesiones persistentes.
- El panel prioriza densidad y eficiencia sin perder la identidad.
