# Frente A V2 — experiencia visual del comprador

Pedido de Oliver del 2026-10-10. Parte del cierre de UX-04 (`9e4e1f5`) y autoriza mejorar también Inicio
y descubrimiento. El Frente B no forma parte de este trabajo. La marca/configuración nativa existente
se conserva; Electric Violet sigue siendo la identidad visual.

**Estado:** terminado, probado y publicado. Oliver confirmó la recepción en su Android («ya se actualizó»). Revisión de la experiencia pendiente.

## Decisiones de implementación

- Reutilizar `ProductCard` en Inicio, Buscar, colecciones y Favoritos: foto, nombre de una línea, precio,
  indicadores que ya correspondan al producto y favorito en una superficie con borde y esquinas redondeadas.
  Mantener `Price`, disponibilidad y reglas comerciales. Adaptar skeletons y tarjeta compacta a esa estructura.
- Cabecera de Inicio: marca, notificaciones derivadas de `useUnreadCount`, carrito derivado de `useCartCount`
  y buscador. Favoritos pasa a Cuenta y productos; conservar el acceso desde Cuenta también para visitantes.
- Conservar Inicio · Buscar · Carrito · Cuenta. Buscar sigue siendo el catálogo `/explore` de UX-04.
  Carrito permanece en la barra porque la cabecera solo existe en Inicio: quitarlo aumentaría los pasos desde
  Buscar/Cuenta o al desplazarse. El acceso superior es contextual, usa el mismo carrito y contador.
- Barra común para web y nativo usando Expo Router/Reanimated ya presentes en APK 5: iconos en inactivos,
  píldora expandida con icono/nombre en el activo, transición breve y movimiento reducido respetado.
  Objetivos táctiles de al menos 44 px, etiquetas accesibles aun contraídas y navegación de pila conservada.
- Perfeccionar las secciones existentes: categorías, hero de colecciones, recomendados, tiendas y feed
  virtualizado. Sin promociones inventadas, porcentajes ficticios ni nuevas consultas/backend.

## Continuidad y validación

Base sincronizada y limpia: `9e4e1f5`. Sin trabajo pendiente de otro agente. Regresión de UX-04 y cambios
anteriores: **16/16**. Implementación visual validada hasta `622e227`; fuente OTA `b60b2cc`. Preview **Success** en
[38079470216](https://github.com/somosoudy-design/marketplace/actions/runs/38079470216). Android revisión 31
en [38079644334](https://github.com/somosoudy-design/marketplace/actions/runs/38079644334), **Success**: seis recorridos aprobados, visitante oscuro al segundo intento.

| Comprobación local | Resultado final |
|---|---|
| Tipos/lint de la rama; tipos/lint de app repetidos al terminar | Sin errores |
| Núcleo / admin unitario / API pública / panel entre roles | 50/50 · 28/28 · 12/12 · 9/9 |
| App, exportación web reconstruida | **52 aprobadas + 1 omitida** (registro sin correo; confirmación activa en local) |
| Casos V2 incluidos | 13: dos temas, 320 px, selección, tarjetas, demo frente a oferta real local, favoritos, scroll/buscador fijo, contadores, avisos y movimiento reducido |
| axe WCAG A/AA, Inicio/Buscar/Carrito/Cuenta a 320 px, ambos temas | **0 infracciones en 8 comprobaciones** |
| Contraste manual | Pestaña activa 4,83:1 claro / 5,03:1 oscuro; contador 5,84 / 7,01; título de tarjeta 17,23 / 15,59 |
| Capturas comparables | Antes: 40; después: 50, claro/oscuro incluyendo 320 px |

Favoritos está en Cuenta también para visitantes. El favorito de tarjeta es un botón independiente de su
acceso a la ficha. Los filtros usan `aria-pressed`; pestañas conservan nombres/selección accesibles; el buscador
fijo oculto no recibe foco ni figura como acceso invisible. No se muestran descuentos/escasez demo como reales.
Productos agotados, por encargo, en camino y ofertas reales se prueban con fixtures **locales**, sin datos remotos.

Los fallos durante iteración se corrigieron en código/selectores: alcance de pantallas retenidas, semántica
accesible, esperar datos antes de scroll y contador anunciado por su padre accesible. Stock agotado por repetir
compras se reinició únicamente en local. El pase final se ejecutó aislado para conservar los artefactos de
Playwright. No se borraron/desactivaron casos ni se modificó lógica comercial.

Evidencia local ignorada por Git:

- `.local/frente-a-v2/before/{light,dark}/` y `after/{light,dark}/`.
- `.local/frente-a-v2/comparacion.html`: galería autónoma antes/después + diez capturas Android; `gallery.mjs` la regenera. Controles/imágenes comprobados.
- `.local/frente-a-v2/accessibility.json`, `contrast.json`, `performance.json`.
- `.local/logs/frente-a-v2-ui-final.log`.

`node tools/design/screens.mjs <carpeta> light|dark` genera las 20 pantallas estándar; `visual.mjs` añade cinco
vistas a 320 px. Capturas y datos de ejemplo son del stack local. No presentar esa evidencia como teléfono.
Transiciones: 180 ms, desactivadas al pedir movimiento reducido; virtualización, memoización y tracking previos
conservados. Observación Chromium local: navegación 399 ms claro / 174 ms oscuro, mediana de frames 16,7 ms;
p95 83,3 / 16,8 ms con carga inicial. No equivale a medir FPS en Android físico; esa evaluación sigue pendiente.

## Publicación y límites

Oliver autorizó publicar al finalizar y especificó el canal **production**. El APK 5 (`d1d10c28`) documentado
consume **preview** y runtime `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`.
Primero publicar/verificar en preview y ejecutar Android 15 con ese APK existente, solo recorridos de visitante
en claro/oscuro. Después promover el mismo grupo inmutable a production con `eas-update-production.yml` /
`tools/eas/promote-update.mjs` (guardas unitarias **4/4**). Exige runs preview/Android aprobados y código nativo,
app y dependencias idénticos a la fuente; consulta builds Android terminados con production y este runtime
para indicar qué build lo consume. No reconstruye el paquete ni cambia el enlace de preview. No cambiar el perfil nativo ni crear un APK para cambiar de canal.

No modificar panel, motor financiero, SQL, Supabase remoto, Firebase, identidad nativa ni dependencias.
No ejecutar registro, pedidos, pagos o push remotos. Registrar runs/resultados antes del relevo final;
no afirmar recepción de producción en APK 5 ni verificación física sin evidencia. Frente B fuera del alcance.

### Android 15 — revisión 31

Run [38079644334](https://github.com/somosoudy-design/marketplace/actions/runs/38079644334) **Success**,
Maestro 2.11.0, APK 5 existente (único APK del request; el archivo se llama `apk1.apk`). Tres recorridos
en cada tema: nuevo visitante V2, volver de Favoritos con flecha, volver con Atrás de Android. **6/6**;
visitante oscuro pasó en el reintento automático. El resumen no conserva el paso fallido del primero;
no presentarlo como seis pases al primer intento. Capturas revisadas: Inicio/Buscar/Cuenta/Carrito/contador
en ambos temas. El nuevo `home-cart` confirma V2 y la ficha conserva la búsqueda al volver.

Diagnóstico al reabrir: actualización `01a12744-8ffc-7c8b-bfb0-b32cfae9a11e`, canal preview, runtime
`eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`, backend existente de pruebas, sesión cifrada sí.
Evidencia recuperada mediante `git fetch origin ci/capturas`, `ultima/LEEME.md` / `resumen.md`;
copia local `.local/frente-a-v2/android/`. Ninguna cuenta, pedido, pago, escritura de favoritos ni push remoto.
Production publicado tras esta comprobación, sin cambiar código ni reconstruir el bundle.
Cuenta Android conserva el aviso conocido «Tasa del día no disponible»; no se altera finanzas/tasas.

### Production — publicación confirmada

[Run 38080468671](https://github.com/somosoudy-design/marketplace/actions/runs/38080468671) **Success**, fuente
solicitud `d62b1fa`. Grupo [92b6bef2-56e7-4a3e-8012-40c030c48434](https://expo.dev/accounts/marketplacebrand/projects/marketplace/updates/92b6bef2-56e7-4a3e-8012-40c030c48434),
promovido del grupo preview `5abecd05-a0e4-4d5c-ae6f-79b30984b4a2` correspondiente a `b60b2cc`.
Se reutilizan exactamente sus assets/JavaScript; runtime APK 5 conservado. El aviso público «EAS production»
y artefacto `eas-production-release` confirman resultado y **0 builds Android terminados con canal production
y ese runtime**. No afirmar que un APK production lo recibió: no hay consumidor compatible registrado.
APK 5 `d1d10c28` usa **preview** y recibió allí esta misma versión en el emulador; su canal no se modificó.

### Archivos para retomar

- `src/components/catalog/{ProductCard,MiniProductCard,ProductFavorite,ProductGrid,ProductImage}.tsx`
  y `ui/Skeleton.tsx`, bajo `apps/mobile`: superficies/indicadores/favoritos compartidos.
- `apps/mobile/src/components/navigation/BuyerTabs.tsx`: destinos, expansión, accesibilidad/movimiento reducido;
  ambos `_layout` de `(tabs)` lo reutilizan. `ui/CountBadge.tsx`: contador real compartido.
- `apps/mobile/src/app/(tabs)/{index,account}.tsx`: cabecera/Inicio y acceso de visitante a Favoritos.
- `tests/app-e2e/tests/front-a-v2.spec.ts` (13 casos), navegación/favoritos adaptados; nunca desactivar casos.
- `tests/apk-flows/frente-a-v2/01-visitante.yaml`, `01b`, `01c`; selección/temas en `tools/eas/emulator-flows.sh`.
- `.github/eas-production-update-request`, workflow `eas-update-production.yml` y
  `tools/eas/promote-update.mjs`: promoción protegida del grupo probado, sin APK ni cambios de entornos.

No quedan cambios parciales activos. Próxima acción: revisión visual/funcional de Oliver en su APK 5;
solo ajustar este frente si lo pide. Física (lectores/FPS/push), tasa vencida y decisiones comerciales
heredadas conservan su estado. No iniciar Frente B ni construir un APK para obtener un canal production.

### Aclaración de entrega — 2026-10-10 15:44 Caracas

Oliver aclaró: «me refiero a que se me actualice en mi Android directamente». El objetivo es entregar al
APK 5 instalado, cuyo canal interno es **preview**. Esa entrega ya se publicó y se probó en el emulador
(run 38079470216 / 38079644334, OTA `01a12744-8ffc-7c8b-bfb0-b32cfae9a11e`).
No es necesario cambiar canales, generar APK ni republicar el mismo paquete. La publicación adicional
en production permanece como antecedente; no era un pedido de migrar la app instalada a ese canal.
La app descarga al abrir con internet y aplica en el siguiente inicio completo. La recepción física quedó
confirmada después por Oliver, como consta a continuación.

**Recepción física (2026-10-10 15:44 Caracas):** Oliver confirmó «ya se actualizó». Se registra entrega al Android
instalado; la revisión visual/funcional en su teléfono y las pruebas físicas específicas siguen pendientes.
No se republicó ni se generó un APK para esta confirmación.

### Cierre previo a iOS — 2026-10-10

Verificado el cierre desde `cf7a1b9`: no hay WIP de Frente A V2 ni cambios locales pendientes. Implementación,
pruebas, publicaciones y confirmación de Oliver ya documentadas. El pedido siguiente prepara instalación
iOS local con Personal Team; no reabre el diseño ni autoriza Frente B o una nueva publicación Android.
