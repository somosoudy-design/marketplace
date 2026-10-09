# Motor comercial de precios

Cómo Kora pone precio a un producto a partir de su costo real, y cuánto paga el comprador según el método. La base
de datos calcula y cobra (migración `20261009233831_pricing_engine.sql`); `packages/core/src/pricing.ts` repite las
mismas fórmulas para las vistas previas del panel y de la app, y las pruebas comprueban que dan lo mismo.

## Idea en una línea

El precio principal está en **dólares a tasa BCV**. Quien paga en bolívares paga ese precio a la tasa BCV. Quien
paga con **Zelle o USDT** paga lo que el producto realmente tiene que dejar en dólares: el precio principal sin la
brecha, que se descuenta **una sola vez** con las tasas del día, visibles en la cotización.

## Fórmulas

| Paso | Fórmula | Dónde se configura |
|---|---|---|
| Costo | precio de compra de una unidad (por ejemplo Amazon, con impuesto y envío al courier) | Ficha del producto › Costos y precio (por variante) |
| Flete | peso × USD por kg, o el monto que se escriba para ese producto | Regla general (`pricing.import.per_kg_usd`) o la ficha |
| Gastos logísticos | monto fijo por unidad, o el de ese producto | Regla general (`pricing.import.fixed_usd`) o la ficha |
| Costo puesto en Venezuela | costo + flete + gastos logísticos | — |
| Margen | % sobre el costo puesto en Venezuela | Regla general (`pricing.import.markup_pct`) o la ficha |
| **Precio en divisas (objetivo)** | costo puesto × (1 + margen) | — |
| Brecha del día | P2P (Bs por USDT) ÷ BCV (Bs por dólar) − 1; nunca negativa | Se toma sola cada 24 h (`pricing.gap`) o con «Actualizar brecha ahora» |
| **Precio principal (USD BCV)** | precio en divisas × (1 + brecha), con la terminación (por ejemplo ,99) | Se guarda en la variante cuando el producto «sigue su costo» |
| **Pago Móvil / transferencia** | precio principal × BCV | Igual que antes |
| **Zelle / USDT** | precio principal × BCV ÷ P2P (Zelle además ÷ USDT por dólar) × (1 + ajuste del método) | Ajuste por método (`payment_methods.basis_adjust_pct`, 0 por defecto) |

### Por qué la brecha no se aplica dos veces

Los bolívares de un Pago Móvil (precio × BCV) compran en P2P exactamente (precio × BCV ÷ P2P) USDT, que es lo que
paga quien usa USDT. Es decir, los dos caminos dejan el mismo valor real, y ese valor es el precio en divisas del
que se partió (más la diferencia de la terminación). La brecha entra una vez para formar el precio en bolívares y
sale una vez para el precio en divisas; nunca se calcula un descuento sobre un precio que ya lo tiene.

### Ejemplo (tasas del proyecto de pruebas del 2026-10-09)

BCV 875,65 Bs/$ · Binance P2P 1.014,93 Bs/USDT · brecha 15,91 %. Cable comprado en Amazon a $40, 0,5 kg, flete
$12/kg, gastos logísticos $2,50, margen 30 %:

| Concepto | Monto |
|---|---|
| Costo + flete + logística | 40,00 + 6,00 + 2,50 = **$48,50** |
| Margen 30 % | $14,55 → precio en divisas **$63,05** |
| Con la brecha | 63,05 × 1,1591 = $73,08 → terminación ,99 → **$73,99 BCV** |
| Pago Móvil | 73,99 × 875,65 = **Bs 64.789,34** |
| Zelle / USDT | 73,99 × 875,65 ÷ 1.014,93 = **$63,84** (13,72 % menos) |
| Ganancia real | 63,84 − 48,50 = $15,34 (24 % del precio en divisas) |

Este ejemplo es una prueba automática (`packages/core/test/pricing.test.ts` y `tests/db-tests/test/db/pricing.test.ts`).

## Cuándo cambian los precios

- La brecha se toma de las tasas vigentes (las mismas del checkout). La toma la tarea `kora-pricing-snapshot` cada
  hora si la última tiene más de `refresh_hours` (24 h); vale `valid_hours` (30 h). Un administrador puede tomarla
  cuando quiera desde el panel.
- No se toma si alguna tasa está vencida (`rate_unavailable`) o si la brecha supera `max_gap_pct` (150 %): una
  lectura dudosa de P2P nunca llega a los precios (`rate_anomaly`).
- Con cada brecha nueva, los productos que «siguen su costo» recalculan su precio principal. Los que tienen precio
  a mano no cambian (igual reciben el precio en divisas por la brecha del día al pagar).
- Una cotización de Zelle o USDT vence a más tardar con la brecha que usó.

## Si no hay brecha vigente

No se usa una vieja: Zelle y USDT se cotizan al precio principal (sin descuento) y la app deja de mostrar el
precio especial en ese mismo momento (`pricing_today()` dice `available: false`). Lo mismo si un administrador
apaga `pricing.gap.divisas_prices`.

## Qué queda registrado (verificable)

- Cada brecha: tasas, fuentes, hora de cada tasa, quién la tomó (`pricing_snapshots`).
- Cada cotización en divisas: `price_basis = 'divisas'`, la brecha usada (`pricing_snapshot_id`, `gap_pct`) y el
  factor aplicado (`rate_applied`). El pago acredita el pedido completo en dólares BCV (`usd_recognized`).
- Cambios de costos: auditoría (`product_costs`, `variant_costs`). Los costos solo los ven la tienda y los
  administradores.

## Contabilidad

Pedidos, cuotas, comisiones y liquidaciones siguen en dólares a tasa BCV. Un pago en divisas acredita el monto en
dólares BCV que cubre; el dinero real recibido es menor por la brecha y queda en el pago (`amount`, `rate_applied`).
Antes de operar con vendedores externos, Oliver debe decidir cómo se les liquida lo cobrado en divisas
(`docs/PENDIENTES.md`).
