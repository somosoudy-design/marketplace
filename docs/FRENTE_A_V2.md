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

Base sincronizada y limpia: `9e4e1f5`. No hay trabajo pendiente de otro agente.
Comprobación inicial: `browse`, `favorites`, `navigation` (ambos temas), `profile-photo` y `store-share`,
**16/16**. Capturas antes: `.local/frente-a-v2/before/light/` y `before/dark/` con
`tools/design/screens.mjs`. Primera validación: tipos/lint de toda la rama, core **50/50**, API **12/12**,
admin **28/28**, app **48 pasan + 1 omisión** (registro sin correo, desactivado en local), panel **9/9**.
Pruebas específicas **17/17** en claro/oscuro. Sin cambios en los módulos de backend o panel.

Revisión adicional: semántica tablist y selección explícita en web; buscador fijo oculto fuera del árbol
accesible mientras no se ve y objetivo de 44 px; datos `is_demo` rotulados también en tarjeta/colección,
sin mostrar descuento o escasez demo como oferta real. Se amplía la prueba para esos comportamientos.
Auditoría axe adicional: imágenes decorativas con alternativa vacía explícita, filtros como botones
activados (`aria-pressed`, selección nativa conservada) y buscador oculto fuera del foco de teclado.
La repetición de suite usa seed local limpio para no agotar stock entre compras de prueba. Prueba de scroll
espera la carga del catálogo antes del gesto. Capturas después, pase final y compatibilidad/publicación pendientes.

Modificar las pruebas que dependan del antiguo corazón de Inicio conservando las comprobaciones de
Favoritos y Atrás desde Cuenta/productos. Verificar barras a 320/340 px, movimiento reducido, enfoque,
búsqueda/filtros/scroll, indicadores reales, distintos estados comerciales, carrito y checkout.
Ejecutar tipos, lint y suites locales del protocolo. No ejecutar los recorridos remotos con cuenta/push:
este frente no autoriza escribir datos de Supabase ni cambiar Firebase.

## Publicación y límites

Sin cambios en panel, motor financiero, SQL, Supabase remoto, Firebase, identidad nativa ni dependencias.
No generar APK. Publicación Android `preview` únicamente tras pruebas mediante el workflow existente,
que exige el runtime de APK 5 `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba` antes de EAS Update.
Registrar el run y resultado antes del relevo final; no presentar pruebas web como validación nativa.
