# Kora — marketplace nativo para Venezuela (nombre provisional)

E-commerce y marketplace multivendedor: app nativa (iOS/Android) para compradores, panel web para
administración y vendedores, y un backend Supabase donde viven las reglas de precios, pagos, cuotas,
tasas y permisos. El nombre "Kora" es provisional y se cambia en [`config/brand.json`](config/brand.json).

**¿Vas a trabajar en el proyecto (persona o agente de IA)?** Empieza por [`AGENTS.md`](AGENTS.md) y luego
[`docs/ESTADO_ACTUAL.md`](docs/ESTADO_ACTUAL.md). Rama compartida: `claude/marketplace-v1`.

## Estructura

```
apps/mobile        App Expo / React Native (expo-router)
apps/admin         Panel Next.js: /admin y /vendedor
packages/core      Reglas compartidas: dinero exacto, planes, tasas, pagos, errores en español
packages/api       Cliente tipado de Supabase para app y panel
packages/design-tokens  Sistema de diseño "Electric Violet"
supabase/          Migraciones, seed de demostración, Edge Functions, config.toml
tools/local-stack  Supabase local sin Docker (Postgres + Auth + PostgREST + gateway + funciones)
tools/demo-assets  Generador del catálogo, imágenes demo y seed
tests/             Pruebas de base de datos, e2e de API y Playwright (app y panel)
docs/              Documentación
```

## Empezar

```bash
pnpm install
pnpm stack:start && pnpm db:reset          # backend local con datos demo
pnpm --filter @kora/admin dev              # panel en http://127.0.0.1:3100
pnpm --filter @kora/mobile start           # app (Expo)
```

Cuentas demo locales (clave `Demo-1234`): `admin@example.com`, `vendedor@example.com`,
`comprador@example.com`. Detalles en [docs/ENTORNO.md](docs/ENTORNO.md).

## Pruebas

```bash
pnpm test:db && pnpm test:e2e && pnpm test:functions && pnpm test:ui && pnpm test:panel
pnpm typecheck && pnpm lint
```

Últimos resultados: [docs/PRUEBAS.md](docs/PRUEBAS.md).

## Documentación

- [Manual para agentes y personas que continúan el trabajo](AGENTS.md)
- [Estado actual y próxima acción](docs/ESTADO_ACTUAL.md) y [pendientes](docs/PENDIENTES.md)
- [Arquitectura, funcionalidades y convenciones](docs/ARQUITECTURA.md)
- [Dirección de producto](docs/DIRECCION_PRODUCTO.md)
- [Entorno: instalación, pruebas, compilación, despliegue y variables](docs/ENTORNO.md)
- [Historial de agentes](docs/HISTORIAL_AGENTES.md)
- [Informe final de la v1 inicial](docs/INFORME_FINAL.md)
- [Servicios externos](docs/SERVICIOS_EXTERNOS.md) y [estado de integraciones](docs/INTEGRACIONES.md)
- [Sistema de diseño](docs/DISENO.md)
- [Publicación en tiendas](docs/PUBLICACION.md)
- Variables de entorno: [`.env.example`](.env.example)

## Seguridad

La app y el panel solo usan la clave pública; ningún secreto vive en el cliente ni en el repositorio. Los
pagos se confirman por verificación de un administrador o por un webhook firmado del proveedor, nunca por
el cliente. Todos los datos de `supabase/seed.sql` son ficticios y no deben cargarse en producción.
