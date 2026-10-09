# Informe final — Marketplace "Kora" v1

Fecha: 2026-10-09. Marca provisional "Kora" (se cambia en `config/brand.json`).

## Resumen

Se construyó una primera versión funcional e integrada de un e-commerce + marketplace multivendedor para
Venezuela: app nativa (Expo/React Native), backend Supabase con la lógica financiera en la base de datos,
funciones de servidor para pagos en línea, tasas y push, panel web de administración y de vendedores, sistema
de diseño propio, catálogo de demostración reproducible y 179 pruebas automatizadas en verde ejecutadas
sobre una base reconstruida desde cero. Después de la primera entrega se hicieron dos rondas de profundidad
(opiniones verificadas, posventa como conversación, inicio editorial, tasa explicada, recomendaciones
medidas con su panel, parámetros validados; luego pago en verificación, direcciones, app sin conexión,
recibos de entrega de push con su salud en el panel e importador protegido contra DNS rebinding), cada pieza
con pruebas y revisión de pantalla. El código está en GitHub con un PR en borrador.

## Qué se entrega (entregables A–J)

| | Entregable | Dónde |
|---|---|---|
| A | App móvil (Expo + expo-router, iOS/Android, también web para pruebas) | `apps/mobile` |
| B | Backend: 23 migraciones, RLS, 140 definiciones de funciones SQL, 5 Edge Functions, `config.toml` | `supabase/` |
| C | Panel de administración (20 secciones) y panel de vendedor (9 secciones) | `apps/admin` |
| D | Sistema de diseño: tokens, componentes, reglas | `packages/design-tokens`, [DISENO.md](DISENO.md) |
| E | Datos iniciales: 5 tiendas (1 propia, 4 externas, incluida una odontológica), 16 categorías, 43 productos, 66 variantes, pedidos en varios estados, cuotas, pagos, envíos y notificaciones de prueba, todo marcado como demo | `tools/demo-assets`, `supabase/seed.sql` |
| F | Resultados de pruebas | [PRUEBAS.md](PRUEBAS.md) |
| G | Instalación y compilación | [INSTALACION.md](INSTALACION.md) |
| H | Variables de entorno y servicios externos | `.env.example`, [SERVICIOS_EXTERNOS.md](SERVICIOS_EXTERNOS.md) |
| I | Estado de integraciones | [INTEGRACIONES.md](INTEGRACIONES.md) |
| J | Este informe; continuidad para otra sesión | [CONTINUIDAD.md](CONTINUIDAD.md) |

## Lo que funciona hoy

- **Compra completa:** catálogo editorial, búsqueda, filtros y orden que se conservan al volver, ficha con
  variantes y estados comerciales (Comprar, Encargar, Reservar, Avisarme), favoritos, carrito persistente
  de invitado y de usuario, checkout progresivo con direcciones venezolanas, división en entregas por
  vendedor y modalidad con su envío, planes de pago y total calculado por el servidor.
- **Motor financiero:** USD como referencia con decimales exactos; cobro en USD, USDT o VES; pago completo,
  anticipo, 50% y cuotas; pagos parciales; el saldo queda en USD y se re-cotiza a la tasa vigente;
  cotizaciones con vencimiento; idempotencia y bloqueos contra dobles toques, carreras y duplicados;
  libro contable balanceado con obligaciones del comprador, ingresos de la plataforma y deuda con
  vendedores separados; auditoría.
- **Pagos:** manuales con instrucciones, referencia, comprobante y verificación del administrador (total,
  parcial o rechazo); en línea (Binance Pay, PayPal) preparados de punta a punta y bloqueados mientras no
  haya credenciales.
- **Tasas:** proveedores desacoplados (BCV, DolarApi, Binance P2P como referencia, Kraken, manual), políticas
  por par con respaldo, margen, redondeo, antigüedad máxima y detección de saltos; nunca se usa una tasa
  vencida en silencio.
- **Marketplace:** tiendas con perfil propio y personalización controlada, aislamiento estricto entre
  vendedores, moderación con publicación automática de bajo riesgo y revisión de categorías reguladas,
  comisiones, balance y liquidaciones manuales registradas.
- **Logística:** flujo de importación en 10 pasos con cargas agrupadas que respetan el pago, flujo de 6
  pasos del vendedor con guía obligatoria al despachar, transportistas, zonas, tarifas, puntos de retiro,
  tiempos de preparación, fechas estimadas como rango.
- **Cuenta:** registro, acceso, recuperación, perfil, direcciones, historial, seguimiento, reclamos con
  escalamiento, centro de notificaciones, preferencias de privacidad y recomendaciones, solicitud de
  eliminación de cuenta con confirmación. Pedidos, direcciones, favoritos, avisos e inicio se abren sin
  conexión (nunca tasas, cotizaciones ni carrito), con avisos honestos cuando lo mostrado puede estar viejo.
- **Avisos al teléfono:** envío por Expo en lotes sin duplicados, recibos de entrega que limpian
  dispositivos inexistentes y marcan lo no entregado, y una tarjeta en el panel que advierte si los avisos
  se atascan o las credenciales son rechazadas.
- **Recomendaciones:** ranking configurable por afinidad, popularidad, novedad, disponibilidad y curación,
  con diversidad por categoría y tienda y exclusión de lo ya comprado. Se mide cada espacio (impresiones,
  clics, carrito y compra tras el clic) y el panel muestra el rendimiento, avisa si los datos son de
  demostración y edita los pesos con validación.
- **Opiniones verificadas:** solo tras una entrega completada, editables 60 días, respuesta pública de la
  tienda, moderación con motivo visible al autor; las notas de productos y tiendas las calcula la base y nadie
  puede escribirlas.
- **Posventa:** reportar un problema desde el pedido, conversación con la tienda, plazo visible, escalado a la
  plataforma y decisión final; avisos que abren el pedido o el reclamo.
- **Panel:** dashboard, pedidos, pagos, productos y moderación, inventario, categorías, tiendas, usuarios y
  roles, importación por URL con derechos de imagen, contenido editorial, envíos y tarifas, tasas, cuotas,
  liquidaciones, reclamos, configuración comercial sin tocar código y auditoría.

## Decisiones de arquitectura

- **La base de datos decide.** Precios, totales, tasas, saldos y permisos se validan en funciones
  `security definer` con RLS; la app y el panel solo tienen la clave pública. Una prueba mantiene la lista
  de funciones expuestas igual a una lista aprobada.
- **Un solo núcleo de reglas en TypeScript** (`packages/core`) para la app, el panel, las pruebas y las
  funciones del servidor (copia generada y verificada para Deno).
- **Funciones sin dependencias npm**, hablando con PostgREST por HTTP: arranque rápido y nada que auditar.
- **Integraciones honestas:** un método automático no puede habilitarse desde el panel sin que el servidor
  lo marque listo; sin credenciales, la función responde "no configurado" y no crea nada.
- **Stack local sin Docker** (Postgres + GoTrue + PostgREST + gateway) para que las pruebas corran en
  cualquier entorno; con Docker se usa `supabase start` con la misma configuración.

## Limitaciones verificadas

- No se compiló ni instaló la app en Android o iOS: sin Android SDK, sin acceso a Google Maven y sin macOS en
  este entorno. La interfaz se probó en su versión web con viewport de teléfono.
- Ninguna fuente de tasas ni proveedor de pagos se consultó en vivo (sin salida de red a esos dominios y sin
  credenciales).
- Binance Pay y PayPal necesitan cuentas comerciales aprobadas; no hay garantía de que aprueben el modelo
  de marketplace. Zelle seguirá siendo manual.
- Las liquidaciones a vendedores son manuales: no se custodian ni transfieren fondos de terceros de forma
  automática hasta verificar requisitos legales y proveedores.
- Imágenes y precios del catálogo son de demostración (ilustraciones originales rotuladas, precios no
  actuales). Las marcas UGREEN y SHEGLAM solo indican el tipo de producto previsto.
- Push y recibos se probaron con un Expo simulado: falta una build nativa con credenciales FCM/APNs.
- La franja "Sin conexión" se verificó en la versión web; en iOS y Android falta comprobarla en dispositivo.
- El repositorio no tiene CI: las suites se ejecutan en el stack local. El código está en GitHub
  (`claude/marketplace-v1`, PR #1 en borrador) y respaldado en los archivos del proyecto
  (`marketplace/kora-repo.bundle`).

## Siguientes pasos recomendados

1. Revisar el PR #1 y autorizar un proyecto Supabase dedicado; desplegar siguiendo
   [INSTALACION.md](INSTALACION.md).
2. Crear la cuenta de Expo/EAS y generar un APK de preview para probar en teléfonos reales.
3. Validar las fuentes de tasas en vivo desde el proyecto real y fijar la política definitiva.
4. Cargar datos reales: métodos de cobro, tarifas de envío, comisiones, catálogo con fotos autorizadas.
5. Solicitar las cuentas de Binance Pay y PayPal (sandbox primero).
6. Asesoría legal para categorías reguladas, términos, privacidad y modelo de liquidaciones.
7. Mejoras: verificación automática de USDT en cadena, CI en GitHub Actions, pruebas en dispositivos reales
   con Maestro o Detox.
