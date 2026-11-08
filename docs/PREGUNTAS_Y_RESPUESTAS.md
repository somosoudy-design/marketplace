# Preguntas y respuestas en la ficha

> Evaluación del hito 4 de la mejora de UI/UX (pedido de Oliver del 2026-10-10). Estado: **no implementado en la
> app, a propósito**. El diseño queda listo para la siguiente etapa.

## Por qué no está en la app todavía

Oliver pidió no poner botones que no funcionen y no desarrollar funciones nuevas del panel en esta etapa. Hoy no hay
ningún lugar donde una tienda vea una pregunta y la responda:

- No existe una tabla de preguntas. Lo más cercano son los reclamos (`claims`, `claim_messages`), que van ligados a
  un pedido entregado, y las respuestas de la tienda a las opiniones (`reply_review`, en el panel:
  `apps/admin/src/components/Reviews.tsx`).
- Si la app dejara preguntar sin esa pantalla de la tienda, la pregunta quedaría sin respuesta: sería un botón
  decorativo.

Por eso responder exige una **pantalla nueva de vendedor** (en el panel o en la app), y esa es la decisión que falta.

## Decisión que necesita Oliver

Autorizar la pantalla «Preguntas» del panel de vendedor (bandeja con las preguntas sin responder primero y un campo
para responder). Con eso, todo lo de abajo se hace en una etapa y se publica en la app por EAS Update (no necesita
APK nuevo).

## Diseño listo

### Base de datos (una migración)

- Tabla `product_questions`: producto, tienda, quién pregunta, texto (10 a 500 caracteres), estado (`published` u
  `hidden`), respuesta, quién respondió y cuándo, `is_demo` y fechas.
- Lectura (RLS): cualquiera ve las preguntas publicadas **ya respondidas**; quien pregunta ve también las suyas
  pendientes; la tienda y los administradores ven todas las de sus productos.
- Funciones, con el mismo estilo que `submit_review` y `reply_review`:
  - `ask_question(producto, texto)`: exige sesión (no exige compra).
  - `answer_question(pregunta, texto)`: solo miembros de la tienda.
  - `moderate_question(pregunta, ocultar, motivo)`: solo administradores.
  - `product_questions(producto, límite, desde)`: lista para la ficha.
- Avisos con `notify()`:
  - a la tienda cuando llega una pregunta;
  - a quien preguntó cuando le responden.

### Contra el spam y los duplicados

- Límite por persona con `check_rate_limit('question', 5, 3600)`.
- Texto mínimo de 10 caracteres.
- La misma persona no repite la misma pregunta (texto normalizado) en el mismo producto.
- Se rechazan teléfonos, correos y enlaces, para que el trato no salga de Kora.
- Un administrador puede ocultar una pregunta con motivo, y queda en la auditoría.
- Las preguntas de cuentas demo quedan marcadas como demo.

### App (ficha del producto)

- Sección «Preguntas» debajo de las opiniones:
  - las respuestas más recientes, con «Respuesta de {tienda}»;
  - «Ver todas» cuando hay más;
  - un vacío natural: «Nadie ha preguntado todavía».
- Botón «Preguntar»:
  - sin sesión, lleva a iniciar sesión;
  - con sesión, abre una hoja con el campo, el límite de caracteres y la nota «No compartas teléfonos ni correos».
- La pregunta propia pendiente se ve con «Esperando respuesta de la tienda».

### Panel

- «Preguntas» en el menú de la tienda: las sin responder primero, con la respuesta en línea.
- Moderación para administradores, junto a la de opiniones.

### Pruebas

- Base de datos:
  - solo con sesión;
  - límite de envíos;
  - no duplicar;
  - rechazo de contactos;
  - solo la tienda responde;
  - lectura según el estado.
- Interfaz:
  - un visitante va a iniciar sesión;
  - un comprador pregunta y ve su pregunta pendiente;
  - la tienda responde y la respuesta aparece en la ficha.
