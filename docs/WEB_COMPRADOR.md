# Web comprador de HAYAZGO · primera entrega

**30 de octubre de 2026.** Implementación real dentro del mismo monorepo, no maqueta. Nueva aplicación `apps/storefront`, Next.js16.4.1; comparte API, reglas y tokens con Android y panel. Marca provisional tomada de `config/brand.json` (actualmente Kora); no se ha iniciado un cambio de nombre.

## Qué funciona

- **Inicio:** editorial Electric Violet, producto con foto/precio/destino real, categorías, comparación inicial, colecciones y tiendas de `home_feed`. Portada finita; muestra acotada de tiendas. No inventa promociones o testimonios.
- **Buscar:** búsqueda, categoría, colección, tienda, disponibilidad, rango de precios, orden y paginación. Parámetros en URL, enlaces compartibles y regreso con contexto. Escritorio con filtros laterales; móvil los pliega y muestra cuántos están activos. El backend usa **slugs** para categoría/tienda/colección.
- **Ficha `/p/[slug]`:** fotografías, variantes activas, precio por variante, cantidad, disponibilidad, descripción, vendedor, relacionados y agregar al carrito. Selecciona inicialmente una variante con existencias; diferencia opción agotada. El servidor valida existencias/importe al agregar.
- **Cuenta:** login real de Supabase con la cuenta existente, cierre de sesión y regreso seguro al destino interno. La misma cuenta sirve en app y web, pero la sesión de cada dispositivo/origen es independiente.
- **Favoritos:** guardar/quitar y consultar lo persistido en backend; reintento ante error. Se ven desde otro navegador o la app con la misma cuenta.
- **Carrito:** carga por RPC, cantidades, eliminación confirmada, errores recuperables e importe de líneas/subtotal calculados por servidor. Persiste al recargar y en otro navegador. No calcula precios o tasas en el cliente.
- Carga de consultas privadas, vacío, error/reintento,404 real para ficha inexistente, teclado/foco, movimiento reducido y adaptación320/412/escritorio. Catálogo y ficha públicos llegan en HTML aun sin JS.

**No es todavía la web comercial completa.** Checkout/pago/pedidos web, direcciones, registro/recuperación y herramientas de vendedor siguen siendo incrementos posteriores. El carrito explica que se puede continuar la compra en la app con la misma cuenta; no hay botón que finja finalizar la compra web. Esta entrega no modifica ni publica Android.

## Arquitectura y aislamiento

| Pieza | Responsabilidad |
|---|---|
| `apps/storefront` ·3200 | Web de compradores |
| `apps/admin` ·3100 | Panel existente, separado |
| `apps/mobile` | Android/Expo existente |
| `packages/api`, `core`, `design-tokens` | Contratos RPC, reglas compartidas y lenguaje visual |
| Supabase Marketplace | Catálogo, cuentas, favoritos, carrito y autorización real por RLS |

SSR crea un cliente **anónimo nuevo por lectura**, sin cookies/tokens del navegador y sin caché de respuestas privadas. Reutiliza `createKoraClient`, incluido el rechazo de service role. Sesión sólo en navegador; cachés privadas con identidad y limpieza al cambiar cuenta, ficha/controles aislados por producto+comprador. Login rechaza destinos externos, `//` y barras inversas. El frontend nunca concede permisos. No se ha cambiado RLS, SQL, datos remotos, pagos ni reglas comerciales.

## Imágenes

Se reutiliza el registro y los archivos de exhibición de la app mediante `tools/storefront/prepare-assets.mjs`, sin importar React Native ni duplicar asociaciones manuales. Verifica SHA256 y conserva producto+originalPath+variante+`is_demo`, procedencia y avisos bajo demanda. Son **las imágenes de exhibición ya usadas en la app**, incluidas generaciones y referencias de fabricante; no se ha acreditado un catálogo fotográfico comercial definitivo ni licencias nuevas.

Opt-in `STOREFRONT_PRIVATE_PREVIEW=1`, sólo desarrollo loopback y backend aprobado (local54321 o Marketplace `mimnotafmfasvwrclxan`). No alias por parecido entre IDs locales y remotos. Algunas fixtures locales antiguas tienen identidad distinta y conservan sus imágenes; por ello las capturas fotográficas finales se hicieron con el Marketplace correcto, **anónimo y sólo lectura**. Todas las operaciones de cuenta/favoritos/carrito se probaron exclusivamente contra backend local.

`build` ejecuta preparador **`--release`**, que retira archivos y metadata de exhibición independientemente de `.env.local`. `verify:release` exige registro vacío, ausencia de carpeta pública y ausencia de referencias en bundles servidor/cliente. `start` exige primero esta verificación: se comprobó que rechaza iniciar con recursos privados sobrantes de desarrollo. `typecheck` sólo asegura tipos de un registro inicial vacío si falta; no regenera recursos ni contamina builds. No publicar el servidor de desarrollo: `noindex` evita indexación, **no es control de acceso**.

## Ejecutar y probar

Desde la raíz, con las dependencias del workspace:

```bash
pnpm install --frozen-lockfile
cp apps/storefront/.env.example apps/storefront/.env.local
# Configurar URL y anon pública del backend elegido en ese archivo ignorado.
# Nunca usar service_role, token de gestión, contraseñas o credenciales de proveedores.
pnpm --filter @kora/storefront dev
# http://127.0.0.1:3200
```

Para conectar al Marketplace de la app: usar las **dos variables públicas** de `apps/mobile/eas.json` → `build.preview.env`, como `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`; no hace falta acceso administrativo. El proyecto prohibido nunca se utiliza. El opt-in de imágenes es únicamente para evaluación local. En esta nube Node24 requiere `NODE_USE_ENV_PROXY=1` para SSR remoto; conservar proxy y CA, sin desactivar TLS. No es una exigencia del hosting normal.

Pruebas mutadoras **sólo local**:

```bash
pnpm stack:start             # no resetear si ya hay una base local en uso
# .env.local del storefront debe usar el gateway local y su anon de .local/keys.env.
pnpm --filter @kora/storefront build
pnpm --filter @kora/storefront verify:release
pnpm --filter @kora/storefront start
# En otra terminal:
PW_CHROMIUM_PATH=/usr/bin/chromium pnpm test:storefront
```

`PW_CHROMIUM_PATH` sólo si hace falta seleccionar un Chromium instalado. La suite aborta peticiones del contexto principal hacia el Marketplace compartido; los fixtures rechazan DB no local. No ejecutar pruebas de compra sobre el backend remoto.

## Evidencia y control de calidad

[Capturas originales y manifiesto](capturas/web-comprador-2026-10-30/manifest.json):14PNG del catálogo real anónimo, Inicio1440/412/320 y Buscar/ficha1440/320, ambos temas. No son pruebas Android ni fotos físicas. Al ser una web nueva no existe un «antes» equivalente: no se fabricó comparación. Primera fila de comparación en Inicio: y739,7 en1440;813,3 en412;832,3 en320; viewport960 de alto. La apertura ya contiene un producto/precio navegable antes del catálogo. Es una primera base, no una promesa de conversión.

- Especialista de arquitectura de sólo lectura: recomendó web Next separada, SSR público, API/RLS compartidos y no trasladar la SPA de pruebas como web definitiva.
- Auditor independiente: ronda1 **CAMBIOS OBLIGATORIOS** por exclusión release insuficiente, fotos comprobadas contra fixtures equivocadas y altura/categorías. Corregido con release explícito, evaluación con Marketplace correcto y tira móvil64px/desktop integrada.
- Ronda2 **APROBADO para incremento local**:12capturas y12navegaciones de categorías/tiendas/colecciones, sin desbordamientos ni erroresJS. Revisó aislamiento, variantes, `Object.hasOwn`, reintento de favoritos y fuentes. Cierre focalizado verificó compactación y Next16.4.1 sin overlay de desarrollo. No sustituye revisión de Oliver ni autoriza un lanzamiento público.
- Se consultaron el enrutador Product Design y la skill `oliver-design-direction`; implementación basada en la direcciónC existente, no una nueva ideación ni una auditoría Product Design ficticia. Reglas aplicadas: densidad contextual, jerarquía comercial, complejidad progresiva, fotos protagonistas y teclado/reflow reales.

## Pruebas finales ejecutadas

| Verificación | Resultado y entorno |
|---|---|
| UI específicas | **12/12** dev y **12/12** buildproducción final; misma suite, no24casos distintos |
| Persistencia | SQL local + segundo contexto de navegador, favoritos/carrito; cierre/cambio de cuenta |
| Errores | Transporte abortado al agregar no muestra éxito; reintento persiste; vacío y404 tienen salida |
| Adaptación |320/412/1440 claro/oscuro, sin overflow/JSerror; teclado y movimiento reducido |
| SSR | Inicio/ficha visibles sinJS y404 de recurso inexistente |
| Monorepo | `pnpm typecheck`, `pnpm lint`,52core aprobados |
| Build/aislamiento | Next16.4.1 compila; `verify:release` aprueba vacío y también después de tipos; `start` rechaza92registros privados |
| Revisión visual |14PNG originales finales archivados; revisión independiente12capturas/12recorridos y cierre móvil |

Logs ignorados en `.local/storefront-20261030/`: `tests-release-final.log`(12/12), `build-final-photo-action.log`, `typecheck-final-all.log`, `lint-final-all.log`, `core.log`, `release-final.log` y `guard-negative.log`. Las capturas de datos remotos no son prueba de mutaciones remotas. No se verificó este sitio en navegador físico del Samsung ni se instaló otra app.

## Seguridad y lanzamiento

Se detectaron tres avisos Next16.4.0 (GHSA-2464-fhr4-w9xw, GHSA-p3m5-59mp-jv5r, GHSA-673q-mjm6-r5xr). Parche aplicado **sólo a storefront**, Next/eslint-config-next16.4.1. `pnpm audit --prod` posterior ya atribuye esos avisos exclusivamente al panel previo `apps__admin>next`, no a esta web. No afirmar que todo el workspace carece de advisories; el panel requiere su parche separado y pruebas propias antes de otro despliegue suyo.

Esta entrega no tiene hosting público ni dominio oficial. El entorno cloud sirve para desarrollar; el lanzamiento requiere alojamiento Next permanente y HTTPS, dominio, redirects de Auth, revisión de sesiones/políticas/CSP, contenido comercial/fotos con derechos y protección de cualquier URL privada de evaluación. No utilizar por accidente el workflow de despliegue del panel. `noindex` permanece activo; habilitar indexación/metadata canónica/sitemap sólo al preparar lanzamiento aprobado.

**Próxima intervención exacta:** checkout web progresivo, reutilizando RPC `checkout_preview`/`place_order`, direcciones y opciones reales, idempotencia y recuperación de la confirmación ya corregida en móvil. Luego Pago con cotización y estado de verificación reales y Mis pedidos; antes de la web pública cerrar registro/recuperación, SEO y despliegue protegido. Sin cálculos de cliente ni gastos/compras remotos de prueba.
