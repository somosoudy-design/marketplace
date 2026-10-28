# Integración visual del catálogo · 28 de octubre de 2026

## Primer incremento: imágenes ausentes o fallidas

En una prueba local de Buscar → ficha → regreso, el auditor interceptó la fotografía de un producto con una respuesta 404: la tarjeta y la galería quedaban vacías sin indicar qué había ocurrido. El fixture residual que apareció en Inicio era una imagen válida de 1×1 px; no demuestra un error remoto y no se modificó.

El componente compartido `ProductImage` ahora muestra una señal discreta cuando no hay ruta o falla la imagen remota. La ficha añade «Imagen no disponible», mientras que las miniaturas conservan sólo el icono. La carga en curso sigue diferenciada del fallo. Si el teléfono pierde y recupera conexión se intenta cargar de nuevo, sin solicitar una imagen inexistente en bucle. Cambiar producto, ruta o variante inicia un nuevo intento; si falla una imagen de exhibición se prueba la de Storage y no se atribuyen créditos de una imagen que no llegó a verse. No se inventó una fotografía ni se alteraron datos, precios, reglas o rutas.

La auditora detectó que el color inicial no contrastaba sobre algunos tonos y fondos editoriales; se sustituyó por una superficie semántica propia del estado de error, sin cambiar fotos cargadas. Contraste medido del icono/texto frente al fondo: **6,59:1 en claro y 11,10:1 en oscuro**. El nombre accesible de la galería incluye «Imagen no disponible».

## Evidencia y pruebas

Las capturas son originales de Chromium con datos locales; el 404 fue interceptado intencionalmente y no acredita un fallo de Supabase remoto ni la recepción Android. Se inspeccionaron claro/oscuro y 320/412. [Antes: ficha oscura](capturas/pulido-2026-10-28/ficha-antes-dark-320.png) · [después](capturas/pulido-2026-10-28/ficha-despues-dark-320.png); [antes: Buscar claro](capturas/pulido-2026-10-28/buscar-antes-light-320.png) · [después](capturas/pulido-2026-10-28/buscar-despues-light-320.png). [Manifiesto y hashes](capturas/pulido-2026-10-28/manifiesto.json).

- 21 casos UI de galería, catálogo y carrito, incluyendo 404 → reconexión → imagen recuperada, una ruta ausente, carga pendiente y fallo de imagen local más fallo de Storage; cambio de variante recupera sus propios créditos.
- Revisión independiente: **aprobada en el alcance web**; cuatro combinaciones de 320/412 y claro/oscuro, regreso con consulta conservada, favoritos, contraste, y casos de fondo `night` y cabecera editorial. Sin peticiones de escritura ni compras remotas.
- Tipos/lint del monorepo y export Android Hermes. No se ha comprobado TalkBack ni la recepción física; el APK5 histórico no está disponible para reinstalar en este entorno y no se generó otro.

## Fotografías

Oliver autorizó expresamente usar las imágenes necesarias. Dos especialistas revisaron fuentes oficiales sin alterar el backend: cuatro imágenes UGREEN son candidatos con atributos compatibles, pero no se ha confirmado el SKU exacto; el cargador 40737 muestra enchufe y puertos que la ficha no determina, y la batería 65958 muestra un cable no confirmado. En las siete fichas SHEGLAM consultadas los SKU son nulos y faltan líneas y tonos; un polvo suelto no corresponde a la ficha de polvo compacto. Las licencias de redistribución de esos originales tampoco fueron acreditadas por sus titulares. La autorización de Oliver se registra como tal y no se presenta como licencia de terceros. **No se integraron fotografías nuevas ni se asignaron modelos por parecido.** Referencias y pasos exactos en `catalogo-exhibicion/RECURSOS_PENDIENTES_2026-10-24.md` y `catalogo-exhibicion/CANDIDATAS_2026-10-28.json`.

## Publicación

El propietario autoriza avances validados en Android `preview`. [EAS40631857067](https://github.com/somosoudy-design/marketplace/actions/runs/40631857067) terminó **Success**: fuente `e3e118e`, request `65d828d`, runtime de APK5 `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`, ID Android `01a180bf-931c-7024-913b-156815835dd4`, grupo `fdae521f-b34e-44c5-bda8-f944bd9d1572`. La publicación no demuestra que el Samsung haya recibido la actualización.


## Segundo incremento: productos recientes y navegación accesible

La tarjeta de «Retoma donde quedaste» amplía la fotografía de 52 a 64 px, separa la marca sólo cuando coincide con el título y reserva una fila de ancho completo al precio. El favorito sigue siendo una acción independiente de 44 × 44 px. En el mismo fixture a 320 px, el nombre pasa de «SHEGLAM la…» a «labial líquido mate»; la tarjeta también crece aproximadamente 35 px en altura. La primera propuesta fue rechazada porque un importe muy largo se solapaba con Favoritos; la solución final evita esa colisión sin basarse en la longitud del precio.

El conteo inicial de impresiones de este anaquel incluye únicamente tarjetas que alcanzan el 60 % visible; no se cambió el seguimiento global. El carrusel todavía no registra las impresiones de tarjetas que se revelan después de desplazarse horizontalmente; es una limitación previa. En web, Enter ahora activa los enlaces del componente compartido y las tarjetas y favoritos muestran un foco completo sin alterar los botones nativos. La auditora rechazó un primer anillo oscuro de 2,18:1 sobre fotografías claras; se agregó una base temática que eleva el contraste medido a 5,84:1 en claro y 6,55:1 en oscuro.

[Antes, claro](capturas/pulido-2026-10-28/recientes-antes-light-320.png) · [después, claro](capturas/pulido-2026-10-28/recientes-despues-light-320.png) · [antes, oscuro](capturas/pulido-2026-10-28/recientes-antes-dark-320.png) · [después, oscuro](capturas/pulido-2026-10-28/recientes-despues-dark-320.png). PNG originales de Chromium con el mismo fixture local; para alinear la tarjeta se ajustó el scroll real 18 px, sin editar capturas. El fixture muestra recomendaciones archivadas como vistas recientemente y no representa la sesión de Oliver. [Foco de tarjeta](capturas/pulido-2026-10-28/foco-card-light-320.png), [foco de favorito](capturas/pulido-2026-10-28/foco-favorite-dark-320.png) y [hashes](capturas/pulido-2026-10-28/manifiesto-tarjetas.json).

La auditoría independiente aprobó el export integrado en web: geometría y dos acciones independientes, claro/oscuro, anillos completos y 44 px. **27 pruebas UI**: 16 de galería/navegación, siete de carrito/reputación, dos de tarjetas recientes y dos de impresiones; más una prueba unitaria del cálculo de visibilidad. La prueba de impresiones tuvo que fijar el orden del fixture local porque el feed se refresca con otra clasificación; se ejecutó nuevamente con los dos casos aprobados. Comprobados 280/320/412, importes extensos, CSS1,6 simulado, regreso, enlaces y personalización desactivada. Tipos/lint del monorepo y export Hermes Android aprobados. Estas pruebas no acreditan TalkBack, fuente ampliada nativa ni recepción Android.

**Estado de publicación del segundo incremento:** pendiente de solicitud EAS tras commit y push.
