# Carrito y favoritos de invitado · 7 de noviembre de 2026

## Resultado publicado

App y web permiten agregar, quitar y consultar carrito y favoritos sin iniciar sesión. Conservan productos, variantes y cantidades al navegar, recargar o volver a abrir. La identificación se solicita al continuar con la compra; después combina la selección con el contenido existente de la cuenta. Fallar o cancelar el acceso conserva la selección. No cambian diseño, componentes, tarifas, catálogo ni reglas financieras.

Las reservas pertenecen a la cuenta que las capturó. Cerrar A y entrar con B no copia el carrito, favoritos ni estado privado de A. Un reintento conserva su clave y no duplica cantidades ni vuelve a incorporar un favorito quitado después de una primera respuesta perdida. Los precios, existencias, disponibilidad, cotización y pedido siguen sujetos al servidor; el invitado no puede confirmar una compra.

Los círculos, textos redundantes y ajuste del botón de la tanda anterior siguen aplazados. No se incluyen OAuth, cuotas, dominio del panel ni servicios nuevos con cargos.

## Implementación y seguridad

- Los stores puros compartidos viven en `packages/core/src/guest-cart.ts` y `guest-favorites.ts`. Carrito conserva su clave histórica, recupera el WAL anterior y reserva por actor en lotes de 50. Favoritos guarda entradas y reservas en un único documento durable. Web coordina pestañas con Web Locks; móvil reutiliza AsyncStorage y una instancia compartida.
- Carrito usa el `cart_merge_intent` existente, con recibo del servidor y cancelación terminal antes de reemplazar una reserva incierta. No se usa el merge legacy parcial. Favoritos usa su recibo propio; no altera los journals de carrito/checkout.
- Sincronización de ambos grupos independiente. Un error propio del carrito bloquea una compra nueva; un error de favoritos no la bloquea. Las ramas de recuperación de un checkout previamente transmitido se conservan antes del gate nuevo.
- Consultas, respuestas y ACK están ligados a actor/generación/token capturado. Listas, modal de quitar y estado transitorio de producto se remontan por cuenta; no se usan placeholders privados entre actores. No se copia contenido autenticado al store invitado al salir.
- El retorno por acceso, registro, OTP y callback acepta destinos internos seguros; rechaza orígenes externos, rutas de autenticación recursivas y parámetros/hash de credenciales. Recuperación de contraseña captura el token del actor original para su PUT, sin dejar que un SDK global escoja otra cuenta después. Los campos se reinician por actor y las respuestas tardías no presentan éxito tras cancelar.
- Sin conexión conserva la selección y permite operaciones locales independientes. No reconstruye un catálogo offline; si faltan tarjetas muestra el estado de conexión. Web no presenta precios como confirmados ni permite continuar sin actualizar. Un JSON corrupto muestra recuperación, conserva sus bytes y no borra el otro store.

Una reserva legacy ya enviada con más de 50 líneas se conserva entera: no se inventan claves nuevas ni se parte una operación cuyo resultado original podría existir. Las nuevas reservas sí se dividen antes de enviar.

## Backend activado una vez

Migration `20261107171748_guest_favorites_merge_intent.sql` aplicada en **Marketplace, mimnotafmfasvwrclxan**, mediante la sesión legítima del dashboard. DDL y registro de migración comparten transacción. Se añaden únicamente:

- schema privado `favorites_private`;
- tabla `favorites_private.merge_journal`, con RLS y sin permisos de API;
- RPC `public.favorites_merge_intent(uuid[],text)`, execute sólo para authenticated y comprador derivado por `require_user()`.

La función normaliza IDs, serializa por comprador, conserva recibos históricos y realiza la unión más el recibo atómicamente. Un replay sólo devuelve el resultado histórico. Mantiene los permisos existentes de favoritos, sin ampliar visibilidad de productos ni modificar funciones financieras.

SHA-256 de la migración: `25856e3ad30f32c374a03ad6867f8f0951a340cd9c2c86530db489a08665a470`. Definición remota idéntica a la probada local; ocho definiciones protegidas, grants/RLS de favoritos y contadores de siete tablas comerciales iguales antes/después. La API anónima real devuelve 401/42501. Journal vacío en esa comprobación. No se ejecutaron merges con usuarios de prueba remotos, compras, pagos ni fixtures remotos. No reaplicar la migración por un spinner o una respuesta demorada.

## Publicación

**Web:** Worker `8a9d859c-9278-4053-9a72-082e9949fc99` al 100%, fuente compilada `44df8d6cff685584b1bca81951078ac08f1acbda`, BUILD_ID `NqXBAA8hrtUae7IjMrgxw`. HTML público 200, trece JS/CSS por SHA coinciden con el artefacto; CSS `3168e33b4f1796591b8baa6e5970deb76107eda3ab53128836541f7c77d6ca5a`. WWW conserva ruta/consulta en su 301. Sólo ASSETS y WORKER_SELF_REFERENCE; Workers Free y dominio público sin Access del propietario.

**Android:** una solicitud, fuente `d9cc8c1622b387c64b97aa1cfb596a7e9dfc5d6c`, [ejecución 42398760657](https://github.com/somosoudy-design/marketplace/actions/runs/42398760657). Guardas Free/cuota, runtime, fuente limpia, publicación y APK existente aprobadas. Manifest servido HTTP200 con UUID `01a1b729-93e7-7854-8e9a-722261609de2`, grupo `10bb1190-1b86-4b07-870f-6677b7bfa641`, runtime `b691ec2b61ee413fb1d6e7671a1a84446b4cd4f6`. No hay APK nuevo, iOS ni publicación en tiendas. La observación nativa del mismo run sigue en curso; no se repite publicación ni infraestructura.

La app puede descargar la actualización al abrir o volver al primer plano. El aviso «Hay una versión nueva lista» permite aplicarla con «Reiniciar». No se ha observado el teléfono físico de Oliver.

## Validación y límites

Aprobados: 116 core, 139 unitarias móvil/web, 13 casos independientes adicionales de crash/ACK, 12 SQL de recibos, 5 API con Supabase Auth/OTP/RLS real local, tipos/lint del monorepo y 30 Node/marca. Se usó un clon aislado con Auth/REST/SMTP en loopback, sin resetear el cluster compartido. Contraseñas y sesiones locales quedan sólo en archivos privados ignorados.

Trece recorridos principales UI acreditados entre la corrida inicial y focos corregidos: persistencia/reapertura, cantidades/variantes, fallo y cancelación de acceso, unión con cuenta no vacía, registro OTP, respuestas perdidas, off posterior y A→logout→guest nuevo→B con respuestas tardías. Modal/estado añadido/Comprar móvil también cubiertos. Dos smoke offline/corrupción aprobados; temas opuestos app oscuro y web claro, dos recorridos y ocho PNG revisados independientemente. El historial inicial 11/14 y los fallos de oráculo/preparación se conservan; no se presentan como una primera corrida perfecta. El caso de Auth válido que responde después de cancelar no se presenta como timing ejecutado en UI; una sesión ya aceptada no se finge revocada.

Artefacto Worker: 4/4 focos guest aprobados. Producción: cuatro focos funcionales correctos con HiTune S3 real (variante Púrpura, dos unidades); resultado estricto 1/4 porque tres casos fallaron después de sus aserciones al bloquear el GET del beacon de Cloudflare. Se conservan los originales y no se modificó la guarda ni se repitió para ponerla verde. SSR Chrome registró HTTP200 y BUILD_ID nuevo; root confirmó por curl HTML/trece assets y tráfico 100%. Sin enviar Auth ni mutaciones comerciales. Un primer cliente Python recibió 403; curl y Chrome recibieron 200 sin otro despliegue.

La comprobación nativa en curso acredita el UUID y recorridos existentes de la APK; no sustituye una prueba nativa nueva de merge/OTP/A→B. Esas conductas están ejecutadas en el frontend móvil exportado y API local real.

## Evidencia conservada

En `.local/guest-mode-20261107/`: `remote/final-verification.json`, `activation-plan.json`, `public-integrity.json`, `ui/README.md`, `ui/manifest.public.json`, `proposals/ui-independent-final.md`, `public-guest/README.md` y `native/served-manifest-result.json`. Históricos de errores y recibos originales permanecen intactos. Los servicios Auth/REST/SMTP/gateway y frontends locales de esta tanda están cerrados; el PostgreSQL compartido se conserva.

Próximo paso único: archivar resultado de la observación nativa ya iniciada y cerrar este bloque, sin nuevas publicaciones ni ciclos de infraestructura.
