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

El propietario autoriza avances validados en Android `preview`. El resultado de EAS, el runtime y el ID se registrarán después de que el workflow termine; la publicación no demuestra que el Samsung haya recibido la actualización.
