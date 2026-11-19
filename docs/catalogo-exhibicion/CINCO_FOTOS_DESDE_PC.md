# CAT-EXH-01 — cinco originales que debe aportar el propietario

**14 de octubre de 2026. Resultado real: 0/5 fotografías integradas, 0/5 correspondencias catálogo–SKU aprobadas y 0/5 permisos de distribución confirmados.** Investigación detenida conforme a la condición de Oliver; no se reconstruyó infraestructura ni se volvió a diagnosticar Supabase. Registro Expo vacío, capa privada desactivada y última OTA C conservada.

## Referencias oficiales comprobadas

Las siete páginas y sus JSON públicos respondieron HTTP 200. Los SKU de esta tabla son **candidatos oficiales**, no asignaciones confirmadas para el catálogo. [Evidencia de referencias, variantes y alcance](referencias-ugreen-cinco.json). No se descargaron fotografías ni se incorporaron imágenes oficiales a Git/Metro.

| Producto existente y archivo que debes aportar | Referencia oficial candidata | Qué confirmar del objeto fotografiado |
|---|---|---|
| **Nexode 65 W** — `ugreen-nexode-65w.jpg` | [3 puertos, SKU 10334](https://us.ugreen.com/products/65w-3-ports-gan-fast-charger) | SKU/modelo, puertos, enchufe y color. La ficha demo tiene Blanco/Negro; el candidato no acredita ambos colores. El bundle 10334+10232 es distinto del cargador solo. |
| **Power bank 20.000 mAh** — `ugreen-power-bank-20000.jpg` | [100 W, SKU 25188](https://us.ugreen.com/products/ugreen-100w-20000mah-power-bank) o [130 W con pantalla, SKU 35524](https://us.ugreen.com/products/ugreen-nexode-power-bank-20000mah-130w) | SKU/modelo, potencia, puertos y color Gris. 20.000 mAh identifica varias referencias, no permite escoger una fotografía por parecido. |
| **Cable USB-C a USB-C** — `ugreen-cable-usb-c.jpg` | [100 W, 2 Pack](https://us.ugreen.com/products/ugreen-usb-c-to-usb-c-cable-3ft-6ft-10ft): SKU 70427P (3.3FT), 10232 (6.6FT) | SKU/serie, largo 1 m o 2 m, acabado y potencia. Confirmar unidad frente a paquete de dos; la foto no debe comunicar un bundle que el producto actual no ofrece. |
| **Revodok 6 en 1** — `ugreen-revodok-6-en-1.jpg` | [206, SKU 15852](https://us.ugreen.com/products/ugreen-revodok-pro-6-in-1-usb-c-hub) o [Pro 106, SKU 45363](https://us.ugreen.com/products/6-in-1-usb-c-hub-4k) | Modelo/SKU, configuración de seis puertos y color Gris espacial. Ambos títulos son 6 en 1, sus modelos difieren. |
| **Nexode 30 W Blanco** — `ugreen-nexode-30w.jpg` | [SKU 90878, tienda UK](https://uk.ugreen.com/products/ugreen-nexode-30w-gan-wall-charger) | SKU/modelo, puerto(s), enchufe y Blanco. El dato Default Title no confirma ese color ni el enchufe de la unidad del catálogo. |

Puedes aportar una referencia distinta de estos candidatos **si identifica exactamente la unidad fotografiada y corresponde a la ficha existente**. No se modificará el producto para hacer coincidir una imagen equivocada.

## Paquete mínimo desde tu PC

Envía cinco originales JPG/PNG/WebP, uno por producto, sin marcas de agua y con ambos lados de al menos 768 px, sin ampliación artificial. Añade un texto con **SKU/modelo y variante de cada archivo**, y el enlace de su ficha exacta o una etiqueta del objeto que permita identificarlo. No se piden cinco fotografías de cada producto ni rehacer las once imágenes secundarias del lote inicial.

La vía directa es usar **fotos propias** e indicar quién las tomó y que autoriza su inclusión en la exhibición privada de HAYAZGO, Android preview/Expo OTA, capturas y repositorio público. Si son fotos del fabricante/proveedor, adjunta el permiso o licencia del titular que cubra ese mismo alcance y la atribución que exija. No hace falta autorizar futuras ventas públicas para esta entrega.

Los [términos US §5.1–5.3](https://us.ugreen.com/policies/terms-of-service) atribuyen las imágenes a UGREEN/licenciantes y conceden una licencia personal, no transferible; §5.2 dice: “You may not reproduce, distribute, modify, create derivative works from [...] the Site or its content”. Los [términos globales](https://www.ugreen.com/pages/terms-and-conditions) reservan los derechos y requieren consentimiento escrito para uso comercial. **No se obtuvo permiso para incluir esos recursos en un bundle/OTA o Git público.** Acceso HTTP 200 y enlace CDN no acreditan derechos.

Si ya tienes autorización de distribuidor, debe incluir esos usos de fotografías; no basta el alta como revendedor. [Contacto oficial](https://www.ugreen.com/pages/contact-us): partner@ugreen.com (distribución), pr@ugreen.com (prensa), legal@ugreen.com. No se enviaron correos ni se contrataron servicios.

## Integración que se retoma al recibir material utilizable

| Producto | UUID conservado | Ruta de portada original |
|---|---|---|
| 65 W | e7a91cd8-d3a2-4436-986c-71d1d95da813 | demo/ugreen-nexode-65w-1.webp |
| 20.000 mAh | 01a43334-e485-41cc-a12a-c049e933665d | demo/ugreen-power-bank-20000-1.webp |
| Cable | 22516bf2-7283-45c1-a3a5-2449797a25db | demo/ugreen-cable-usb-c-100w-1.webp |
| Hub | 910cdfb7-9a3e-48e5-bd40-99269aea332a | demo/ugreen-revodok-hub-6-en-1-1.webp |
| 30 W | 6209f8ff-aeab-40e3-9168-9528a30ca55d | demo/ugreen-nexode-30w-1.webp |

Reutilizar `catalog-exhibition-assets.ts` y el manifiesto existente. Ajustar **solo el umbral anterior 12–15 a la entrega autorizada de cinco** al preparar material real; no reconstruir la capa. Revisar galerías/variantes no cubiertas como límite concreto, sin fingir que una portada acredita otros colores o largos.

Después: comparación real de Inicio C, Buscar y ficha en claro/oscuro; mantener “Entorno de pruebas”, is_demo y protecciones comerciales, ocultar Demo repetido únicamente en la presentación privada. Verificar recorridos, APK5/runtime y recepción en emulador. **Oliver ya autorizó condicionalmente Android preview** para estas cinco si derechos, pruebas y compatibilidad están confirmados; no pedir de nuevo autorización OTA por rutina. Nunca production ni APK nuevo.

## Revisión y límites de esta ejecución

Dos agentes reales de lectura: catálogo/dirección de arte investigó fuentes, modelos y términos; auditor independiente revisó identidad y alcance de permisos. Raíz cotejó todos los SKU mediante JSON oficial y los términos globales/US. Solo raíz escribió documentación. Product Design `index` y `audit` consultados para criterios de coherencia y evidencia; **no se realizó auditoría visual ni comparación antes/después al faltar fotografías utilizables**.

Sin cambios de código móvil, activos fotográficos, backend, datos comerciales, finanzas, migraciones o publicación. **0 EAS Updates nuevas; ninguna recepción Android de un lote nuevo que acreditar.** Las capturas y OTA de C anteriores no son evidencia de esta entrega.
