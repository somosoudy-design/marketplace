# AGENTS.md: manual para cualquier agente que trabaje en Kora

Sirve para Claude, ChatGPT o cualquier otra IA, y también para una persona. No hace falta conocer las
conversaciones anteriores: todo lo necesario está en este repositorio.

## Qué es Kora

Marketplace nativo premium para Venezuela (nombre provisional en `config/brand.json`). Tiene una app para
compradores (Expo / React Native), un panel web para administración y vendedores (Next.js) y un backend en
Supabase donde viven las reglas de precios, pagos, cuotas, tasas y permisos. Es multivendedor, vende productos
propios y por encargo, tiene carrito unificado, pagos en varias monedas (bolívares, dólares, USDT), anticipos,
cuotas, logística y seguimiento. La identidad visual es **Electric Violet**.

Filosofía: **la complejidad pertenece al sistema; la claridad, al usuario.** Simplifica la experiencia, no las
capacidades. Detalle en `docs/DIRECCION_PRODUCTO.md`.

## Personas

- **Oliver**: dueño del producto. Decide producto, gastos, cuentas externas y publicación.
- **Kevin y Heisber**: socios; prueban la app y pueden continuar el desarrollo con sus propios agentes.
- Se coordinan por WhatsApp. **Un solo agente trabaja a la vez** sobre el repositorio.
- Toda comunicación con ellos, en español.

## Al empezar un turno (en este orden)

1. `git fetch origin && git checkout claude/marketplace-v1 && git pull --ff-only`
2. `git log --oneline -15`: mira qué hizo el último agente y si dejó commits `WIP`.
3. Lee `docs/ESTADO_ACTUAL.md` (estado real, trabajo en curso, próxima acción).
4. Lee `docs/PENDIENTES.md` (prioridades y bloqueos).
5. Si hay trabajo incompleto, decide si conviene terminarlo, corregirlo o revertirlo. No supongas que el agente
   anterior terminó bien: corre las pruebas de lo que tocó.
6. Continúa desde el estado real, sin rehacer lo que ya existe. Antes de crear algo, busca si ya está
   (`docs/ARQUITECTURA.md` dice dónde vive cada cosa).

Para montar el entorno, ejecutar pruebas y usar Supabase o Expo: `docs/ENTORNO.md`.

## Rama y Git

- Rama compartida: **`claude/marketplace-v1`**. Todos trabajan en ella. No crees ramas por persona ni
  cambies la estructura de Git sin una necesidad técnica real (por ejemplo, un experimento grande que no
  pueda quedar desactivado en la rama).
- `main` solo tiene el README inicial; el PR #1 (borrador) lleva la rama a `main` cuando Oliver lo decida.
- Nunca `git push --force` ni reescribir historia publicada. Si el remoto avanzó, `git pull --rebase` sobre
  tus commits locales y resuelve los conflictos con cuidado.
- Los workflows de GitHub se disparan cambiando archivos en `.github/` de esta rama (ver `docs/ENTORNO.md`).

## Checkpoints (obligatorios)

Haz un checkpoint cada 20–30 minutos de trabajo activo, al cerrar un módulo, antes de una refactorización,
migración, compilación o despliegue, y siempre que veas riesgo de interrupción:

1. Guarda los archivos.
2. Commit identificable. Si no está terminado, el título empieza con `WIP:` y el cuerpo dice qué falta.
3. `git push origin claude/marketplace-v1`.
4. Actualiza `docs/ESTADO_ACTUAL.md` (sección «Trabajo en curso» y «Próxima acción») en el mismo commit o el
   siguiente.

Un checkpoint no puede romper la rama: lo incompleto queda desactivado (sin enlazar en la navegación, detrás
de una constante, o en archivos que nada importa todavía) y las pruebas existentes siguen pasando. Nunca
presentes trabajo incompleto como terminado.

## Reglas que no se negocian

Seguridad y dinero:

- Ningún secreto en el repositorio (es público), en la app ni en la documentación: ni `EXPO_TOKEN`, ni la
  service role key de Supabase, ni claves de proveedores, ni contraseñas. Se documenta el **nombre** de la
  variable y dónde se configura (`docs/ENTORNO.md`).
- La app y el panel solo llevan la clave pública `anon`. La autorización la decide la base de datos (RLS y
  funciones `security definer`).
- El cliente nunca fija precio, tasa ni saldo: totales, cotizaciones y saldos los calcula el servidor.
- Un pago no se confirma porque el usuario pulsó un botón o subió una captura: queda en verificación hasta que
  un administrador lo revisa o llega un evento firmado del proveedor.
- No afirmar que Zelle tiene integración pública universal, ni que Binance Pay o PayPal aprobarán
  automáticamente un marketplace. Una integración no habilitada queda preparada y documentada, nunca simula
  éxito.
- Tasas: nada fijo en el código como solución permanente; si las fuentes fallan, no usar en silencio una tasa
  vieja; nada de scraping indiscriminado ni evadir protecciones de proveedores.
- No custodiar ni transferir automáticamente fondos de terceros: las liquidaciones a vendedores se registran y
  se pagan a mano.
- No ejecutar transacciones reales ni gastos sin autorización de Oliver.

Datos y servicios:

- Supabase `bfuggvbgttvcygbexqyn` es de otros productos de Oliver: **no se toca nunca**. El de Kora es
  `mimnotafmfasvwrclxan` («Marketplace»), que hoy es el entorno de pruebas.
- Nunca cargar `supabase/seed.sql` en un proyecto remoto (crea cuentas con clave conocida).
- Nada destructivo sobre datos importantes (borrados, `DROP`, reinicios) sin autorización explícita.
- Datos ficticios siempre rotulados (`is_demo`, `is_test`) y correos de prueba bajo `example.com`. No
  presentar precios o especificaciones ficticias como reales.
- No publicar en Google Play ni en App Store hasta que Oliver lo diga.
- No pedir contraseñas por chat. Cada socio usa sus propias cuentas.

Calidad:

- Compilar no es funcionar y pasar pruebas no es cumplir requisitos. No declares verificado algo que no
  ejecutaste; di qué probaste y dónde (local, web, emulador, teléfono).
- Cada cambio de comportamiento lleva su prueba. No borres ni desactives pruebas para ponerlas en verde.
- Sin regresiones en el motor financiero, las políticas RLS, los pagos ni la lógica comercial.
- El diseño es parte del trabajo: revisa las pantallas que tocas en claro y oscuro
  (`node tools/design/screens.mjs <carpeta> light|dark`).

## Autonomía

Trabaja con criterio profesional. No pidas permiso para decisiones técnicas ordinarias (diseño, código,
librerías, datos demo, correcciones). Detente y pregunta a Oliver solo por: credenciales privadas, decisiones
legales, gastos, operaciones financieras reales, publicación pública o cambios destructivos sobre datos
importantes. Si una tarea se bifurca en un detalle menor, elige lo razonable, anótalo y sigue.

## Verificar cambios

```bash
pnpm typecheck && pnpm lint
pnpm --filter @kora/core test     # reglas compartidas (dinero, tasas, sesión)
pnpm test:db                      # base de datos (si tocaste migraciones o funciones SQL)
pnpm test:e2e                     # compra completa por la API pública
pnpm test:functions               # funciones del servidor (si tocaste supabase/functions)
pnpm test:ui                      # app en Playwright (reconstruye la versión web)
pnpm test:panel && pnpm test:admin
```

Todo corre contra el stack local (`pnpm stack:start && pnpm db:reset`). El detalle de cada suite y sus casos
críticos está en `docs/PRUEBAS.md`.

## Ceder el turno

Al terminar (o si se te acaba el contexto o el crédito):

1. Commit y push de todo lo que tengas (con `WIP:` si no está terminado).
2. Actualiza `docs/ESTADO_ACTUAL.md`: qué quedó hecho, qué falta, qué pruebas corriste, la próxima acción
   concreta (archivos y comandos) y la fecha.
3. Actualiza `docs/PENDIENTES.md` si cambió alguna prioridad o bloqueo.
4. Agrega una entrada en `docs/HISTORIAL_AGENTES.md`.
5. Comprueba que el push llegó: `git fetch origin && git status -sb` no debe decir «ahead».

## Mapa de la documentación

| Archivo | Para qué |
|---|---|
| `docs/ESTADO_ACTUAL.md` | Estado real, trabajo en curso, próxima acción, cómo retomar |
| `docs/PENDIENTES.md` | Tareas por prioridad, con dependencias y bloqueos |
| `docs/ARQUITECTURA.md` | Monorepo, backend, decisiones técnicas y convenciones de código |
| `docs/DIRECCION_PRODUCTO.md` | Identidad de Kora, filosofía UX, navegación y criterios de calidad |
| `docs/DISENO.md` | Sistema de diseño Electric Violet: tokens, componentes, fotografía |
| `docs/ENTORNO.md` | Instalar, ejecutar, probar, Supabase, Expo/EAS, variables de entorno |
| `docs/PRUEBAS.md` | Suites, casos críticos y lo que no se pudo ejecutar |
| `docs/INTEGRACIONES.md`, `docs/SERVICIOS_EXTERNOS.md` | Estado y activación de servicios externos |
| `docs/PUBLICACION.md` | Lista para publicar en tiendas (más adelante) |
| `docs/HISTORIAL_AGENTES.md` | Relevos y bitácora de lo hecho |
| `docs/INFORME_FINAL.md` | Informe de la v1 inicial (histórico) |
| `CLAUDE.md` | Notas extra para Claude; las reglas son estas |
