# Frente A V2 — experiencia visual del comprador

Pedido de Oliver del 2026-10-10. Parte del cierre de UX-04 (`9e4e1f5`) y autoriza mejorar también Inicio
y descubrimiento. El Frente B no forma parte de este trabajo. La marca/configuración nativa existente
se conserva; Electric Violet sigue siendo la identidad visual.

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
en [38079644334](https://github.com/somosoudy-design/marketplace/actions/runs/38079644334), pendiente de terminar.

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
- `.local/frente-a-v2/comparacion.html`: galería autónoma antes/después; `gallery.mjs` la regenera.
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
`tools/eas/promote-update.mjs` (guardas unitarias **3/3**). Exige runs preview/Android aprobados y código nativo,
app y dependencias idénticos a la fuente; consulta builds Android terminados con production y este runtime
para indicar qué build lo consume. No reconstruye el paquete ni cambia el enlace de preview. No cambiar el perfil nativo ni crear un APK para cambiar de canal.

No modificar panel, motor financiero, SQL, Supabase remoto, Firebase, identidad nativa ni dependencias.
No ejecutar registro, pedidos, pagos o push remotos. Registrar runs/resultados antes del relevo final;
no afirmar recepción de producción en APK 5 ni verificación física sin evidencia. Frente B fuera del alcance.
