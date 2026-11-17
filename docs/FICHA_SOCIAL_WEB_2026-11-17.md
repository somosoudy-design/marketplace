# Ficha web: preguntas, calificaciones y acciones alineadas

## Alcance autorizado

Oliver pidió publicar la ficha y, durante su revisión, indicó que faltaban preguntas y calificaciones y que Compartir/Favoritos estaban descuadrados. La publicación web está autorizada. Se conservan Workers Free, servicios existentes y reglas comerciales. No hay actualización APK ni publicación en tiendas en esta tanda.

## Implementación

- Compartir heredaba `margin: -6px 0 12px`; la ficha lo reinicia y alinea ambos botones de 44 × 44 px.
- La cabecera ofrece enlaces a Calificaciones y Preguntas. Las opiniones usan los contratos existentes de compra entregada, una opinión por ítem, edición de 60 días y moderación. Invitados vuelven a la ficha y variante al ingresar.
- Preguntas incorpora texto público de 10–500 caracteres, respuesta de la tienda, moderación administrativa con motivo, avisos y paginación. Una pregunta sin respuesta sólo la ven su autor y los responsables de la tienda. La respuesta vuelve pública la conversación. Los avisos abren la sección correspondiente y la tienda responde directamente allí, sin depender de otra publicación del panel.
- Se conservan borradores ante fallos, se impide doble envío y se vinculan operaciones/consultas a la cuenta capturada. Cerrar sesión limpia la interfaz privada; una petición emitida antes del cierre puede terminar para su actor original.
- La base decide los permisos. La tabla y los auxiliares privados no se exponen directamente. Texto con contactos/enlaces se rechaza y los reintentos de una misma pregunta no crean duplicados ni avisos adicionales. Límite de cinco preguntas nuevas por hora por cuenta.
- El cierre de cuenta incorpora autores de preguntas y respuestas a la misma clasificación de contenido que ya protegía reseñas; no borra contenido ni cambia retención financiera.

## Activación de datos

Única migración `20261117185142_product_questions.sql`, SHA256 `93a8c6ad90e2464cf5a2261b37a25e45c847210d1957117f0ec1757e60cee47f`. Aplicada mediante la sesión de Supabase del propietario en Marketplace `mimnotafmfasvwrclxan`, dentro de una transacción. El hash del inventario de cierre coincidió antes de modificarlo. Resultado observado: questions_ready, cero preguntas, 64 productos (igual al conteo anterior). La lectura pública devolvió 200 con lista vacía; tabla directa y envío anónimo devolvieron denegación 42501. No se insertaron fixtures remotos.

## Verificación

190 pruebas core, 119 API, 180 web existentes y 14 nuevas de handlers/notificaciones aprobadas; tipos y lint web aprobados. Cuarenta comprobaciones SQL reales aprobaron permisos, privacidad, duplicados, moderación, spam y cierre dentro de una transacción local revertida. Nueve recorridos de navegador locales aprobaron compra elegible/no elegible, estrellas por teclado, errores y reintento, respuesta de tienda, moderación y cambio de cuenta. Botones de estrellas medidos a 44 × 44 px en 320 px; vistas 390/1440 claro/oscuro revisadas independientemente.

Evidencia local: `Downloads/MAYAMI-social-2026-11-17`, `Downloads/MAYAMI-publicacion-UX-2026-11-17` y `.local/oferta-ux/`. Las pruebas comerciales se ejecutan sólo con fixtures locales example.com. Publicación final: Worker `94d92e43-2031-46fb-988c-24d930622362`, mayami.app y www.mayami.app, fuente `cedeaea`, inicio de Worker 19 ms. Se conservaron únicamente ASSETS y WORKER_SELF_REFERENCE. Cuatro vistas públicas 390/1440 claro/oscuro aprobaron HTTP 200, preguntas/opiniones vacías honestas, enlaces de sección y retorno de acceso, ausencia de desbordamiento y cero errores de aplicación. Ambos botones miden 44 × 44 px y sus centros coinciden. Recibo `publicado/VERIFICACION_PUBLICA.json`.

La repetición de los nueve recorridos sobre la fuente final pasó; también las siete pruebas durables de preguntas en el clon `kora_test`. La suite SQL completa no queda certificada: su ejecución pasó 140 casos, pero detectó divergencias anteriores del clon (falta la función de recuperación Google y el contrato de cuotas, y la guarda histórica de favoritos no admite el puerto 55322). Se incorporaron explícitamente las cinco nuevas funciones a la lista estricta de permisos; la comprobación de invitado y los controles de preguntas pasan. No se eliminaron ni desactivaron pruebas. Estas divergencias se mantienen documentadas para alinear el entorno en un encargo separado.
