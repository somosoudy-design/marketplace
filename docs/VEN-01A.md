# VEN-01A — Mi tienda en HAYAZGO

Implementación terminada y validada localmente el 2026-10-11. Fuente: `cc6db73`, con separación de
pedidos compradores para cuentas con varios roles en `5f90e27`. Oliver confirmó y autorizó **«Sí, publica»**
posteriormente. **Publicado en preview y ejecutado en APK 5 en emulador Android**, sin APK nuevo ni
despliegue del panel/backend. El teléfono físico de Oliver no está conectado a esta sesión.

## Publicación y recepción comprobada

| Dato | Resultado |
|---|---|
| EAS preview | [Run 38156171005](https://github.com/somosoudy-design/marketplace/actions/runs/38156171005) **Success**, fuente `2d00f96` |
| Destino | Android, canal `preview`, APK 5 existente `d1d10c28` |
| Runtime | `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`; guard aprobado antes de publicar |
| OTA ejecutada | `01a12bd4-1483-7096-b0c2-de39d35f4c15` |
| Publicada | 2026-10-11 16:38 UTC (12:38 Caracas) |
| Comprobación Android | [Run 38156560856](https://github.com/somosoudy-design/marketplace/actions/runs/38156560856) **Success**, revisión 35/fuente `098f430`, Android 15/Pixel 6 |
| Prueba nativa | `05-mi-tienda-acceso.yaml`: **2/2**, claro/oscuro, sin reintentos, flujo de 41 pasos por tema |
| Evidencia inmutable | [Capturas y resumen](https://github.com/somosoudy-design/marketplace/tree/61ebb1d0e2e03d9b18beb991b59351eadbaf9985/ultima) |

El diagnóstico en ambos temas confirma esa OTA, canal preview/runtime APK 5, backend de pruebas correcto
y sesión cifrada. Las cuatro rutas nuevas exigen sesión; Cuenta de visitante conserva sus funciones,
la flecha y Atrás físico vuelven a Cuenta, e «Iniciar sesión» abre el formulario y permite regresar.
Se revisaron **14 capturas nativas del recorrido**. Sin creación de cuentas/pedidos/pagos o escrituras
remotas. El código móvil/API del checkpoint de la prueba es idéntico al publicado.

En el Android de Oliver: abrir con conexión, cerrar/abrir o pulsar «Reiniciar» cuando aparezca «Hay una
versión nueva lista». Al pie de Cuenta debe indicar **actualización `01a12bd4`**; diagnóstico completo
en `kora://diagnostico`. «Mi tienda» aparece únicamente si su cuenta tiene una tienda asignada en el backend.
Un administrador sin pertenencias conserva Administración; no se inventa una tienda para mostrar el acceso.

## Experiencia implementada

- Cuenta conserva compras, Favoritos, direcciones y preferencias. «Mi tienda» aparece solo cuando la
  cuenta tiene pertenencia real a una tienda. Administración conserva su acceso al panel existente.
  Ambas funciones pueden coexistir con las de comprador, sin cerrar sesión y sin quinta pestaña.
- Mi tienda muestra nombre, logotipo (o icono si falta), estado y aviso de demostración cuando corresponde.
  Permite elegir entre las tiendas asignadas. Resumen real de productos, entregas por preparar/en camino
  y estados de moderación; nunca presenta ceros durante una carga fallida.
- Mis productos consulta el catálogo de esa tienda, incluidos pendientes/rechazados, con precio base
  devuelto por el servidor, disponibilidad, fotografías existentes y nota de moderación. Paginación de 30.
- Pedidos consulta entregas propias en curso/cerradas, artículos, paso del flujo, nivel de pago confirmado
  por el backend y guía si existe. El RPC vigente limita cada vista a 200 entregas; cerradas, últimos 180 días.
- Configuración consulta nombre, estado, contacto, descripción, envíos y políticas. La edición sigue en
  el panel; no hay botones de edición o avance de pedidos que simulen funcionalidades futuras.
- El panel avanzado abre sus rutas existentes. Puede requerir iniciar sesión en el navegador con la
  cuenta habitual; no se transfieren tokens ni se introduce un mecanismo de acceso nuevo.
- Claro/oscuro con Electric Violet, controles de al menos 44 px, etiquetas accesibles, selección anunciada,
  carga, reintento, estados vacíos y reconexión. La flecha de Mi tienda vuelve a Cuenta; «Volver a comprar»
  conserva la misma sesión. Los datos privados de vendedor no se persisten para uso sin conexión.

## Autorización y consultas

La navegación consulta `api.account.stores(user.id)` y `api.account.roles(user.id)`:
`store_members` determina pertenencia (propietario/gestor), `user_roles` determina admin/superadmin.
No existe un nuevo rol vendedor decidido por el cliente. El selector acepta únicamente tiendas de esas
pertenencias; un administrador sin tienda conserva sus herramientas administrativas, sin tienda inventada.

Cada lectura usa la sesión Supabase y clave pública habituales. `seller_dashboard` y `seller_fulfillments`
exigen `require_store_member`; productos usan las mismas selecciones/RLS del panel. Esas restricciones
existentes se aplican en el servidor, aunque se altere el cliente. No se cambiaron políticas, RPC, migraciones,
reglas comerciales o servicios remotos. VEN-01A agrega consultas; no agrega escrituras.

El contexto y las claves de consulta incluyen usuario/tienda; cambiar tienda remonta el contenido y sus
filtros. Salir elimina la caché de cuenta. Los errores de pertenencia bloquean el contenido hasta recuperar
la autorización; cerrar sesión o entrar sin cuenta no solicita productos/pedidos de vendedor.

La revisión visual descubrió un fallo previo de cuentas con varios roles: RLS permite al administrador
leer todos los pedidos y «Mis pedidos» no acotaba la consulta compradora. Cuatro casos reprodujeron el fallo
antes de corregirlo. `useOrders` ahora filtra por `buyer_id` y utiliza una clave por usuario; no reutiliza
la antigua caché sin usuario. `api.orders.list()` sin filtro conserva las lecturas administrativas existentes.
Un administrador ve su compra propia; una cuenta con varios roles sin compras no ve compras ajenas.

## Archivos para continuar

| Pieza | Ubicación |
|---|---|
| Acceso desde Cuenta | `apps/mobile/src/app/(tabs)/account.tsx` |
| Contexto/pertenencias | `apps/mobile/src/lib/seller.tsx` |
| Guardas, scroll y panel avanzado | `apps/mobile/src/components/seller/SellerScreen.tsx` |
| Navegación y cuatro pantallas | `apps/mobile/src/app/my-store/` |
| Lecturas y contratos existentes | `packages/api/src/api.ts`, `packages/api/src/types.ts` |
| Pedidos compradores por cuenta | `apps/mobile/src/lib/hooks.ts` (`useOrders`) |
| Recorridos y fixtures locales | `tests/app-e2e/tests/seller-app.spec.ts`, `support/seller.ts` |
| Permisos del servidor | `tests/db-tests/test/db/seller-access.test.ts` |

## Pruebas ejecutadas

Cloud Linux, stack local existente y Chromium. Fixtures aditivos marcados demo/`example.com`, pedidos
locales sin pagar; no se borraron datos ni se utilizaron cuentas/operaciones remotas.

| Verificación | Resultado |
|---|---|
| Playwright, 11 casos por tema | **22/22**, 1,4 min, sin omisiones ni reintentos |
| Permisos + herramientas vendedor | **6/6**, en copia local nueva de la base, conservando la original |
| Núcleo compartido | **50/50**, sin cambios a sus reglas |
| `pnpm typecheck && pnpm lint` | Aprobados |
| Exportación web final | Aprobada sobre `5f90e27` |
| Exportación Android JS/Hermes final | Aprobada sobre `5f90e27`; un bundle `.hbc`, sin generar APK |
| Revisión visual | **18 capturas**, nueve por tema; recorrido principal a 320 × 780 px |
| Contraste de tokens usados | **22 pares** de texto, todos ≥4,5:1; mínimo 4,78:1 |
| APK 5 en Android 15, revisión 35 | **2/2** visitante en claro/oscuro, sin reintentos; OTA nueva y rutas protegidas comprobadas |

Los casos cubren visitante en las cuatro rutas, comprador sin tienda, vendedor, admin sin tienda con una
compra propia, cuenta con varios roles sin compras, dos tiendas, producto privado propio, paginación,
pedido real recibido, tienda vacía, carga, fallos de pertenencia/resumen/productos/pedidos, reintento,
desconexión/reconexión, regreso y cambio de cuenta sin mostrar datos anteriores.

La prueba del panel intercepta únicamente el documento de destino externo para verificar URL, apertura
y conservación de la sesión móvil. Los datos de Mi tienda vienen del backend local real; no se probaron
operaciones del panel ni se cambió su código. Los fallos de red de los casos de error son inducidos.

Evidencia ignorada en esta máquina: galería autónoma `.local/ven01a/galeria.html`, `.local/ven01a/screens/`
y `.local/logs/ven01a-{ui-final,permissions,core,
web-build-final,android-export-final,buyer-scope-before}.log`. Las capturas se regeneran con el spec.
El test de permisos conserva la copia `kora_ven01a_154805`; su nombre está en `.local/ven01a/test-db-name`.
Evidencia Android local: `.local/ven01a/release/native/ultima/`; copia inmutable enlazada arriba.

Para repetir los recorridos, con el entorno de `ENTORNO.md` instalado:

```bash
pnpm --filter @kora/app-e2e build:web
# Arrancar stack y suite en la misma invocación si el cloud no conserva procesos entre comandos.
pnpm stack:start && pnpm --filter @kora/app-e2e exec playwright test --config=playwright-app.config.ts --project=app tests/seller-app.spec.ts
```

Se usa el runner app existente sin iniciar el panel. Para permisos, definir `TEST_DATABASE_URL` con una
**copia nueva de la base local** y ejecutar los dos archivos con Vitest directamente; no reiniciar la base
de desarrollo para reproducir este bloque. No cargar fixtures o seed en proyectos remotos.

## Límites y siguiente etapa

El cloud no tiene un Android local conectado; la comprobación nativa se ejecutó por GitHub Actions.
Visitante/rutas protegidas/Atrás/recepción OTA aprobados en Android 15. Vendedor/admin/multirrol con sesión,
tienda real, navegador externo, TalkBack y fluidez del teléfono quedan para la revisión física de Oliver.
Los 22 casos con roles/datos reales se ejecutaron en web contra el backend local, no en su teléfono.
El contraste medido no es una auditoría completa de accesibilidad.

No se añadió un módulo nativo, dependencia o cambio de configuración Android. Publicación autorizada
cerrada, guard runtime APK 5 y comprobación nativa aprobados; no repetir esta publicación o generar APK.
Los commits de API usan `[skip ci]` porque el workflow del panel despliega por cambios en `packages/api/**`;
las comprobaciones locales sí se ejecutaron.

VEN-01B, tras autorización: crear/editar productos, fotografías y existencias reutilizando las operaciones
del panel/backend. VEN-01C: acciones de pedidos y configuración. No iniciar estas fases, iOS ni Frente B
como parte del cierre de VEN-01A.
