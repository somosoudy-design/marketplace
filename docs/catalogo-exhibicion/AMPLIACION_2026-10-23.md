# Catálogo restante: referencias oficiales y decisiones pendientes

Oliver encargó continuar los demás productos. Se cerró un bloque acotado sobre **39 UUID restantes de 44 productos públicos**, sin reconstruir la infraestructura de exhibición ni cambiar datos. El paquete contiene siete originales UGREEN para seis referencias y documentación de los otros productos. **Cero fotografías nuevas integradas en la app, cero correspondencias aprobadas y cero permisos de redistribución confirmados.** No se publicó otra OTA fotográfica.

Registro por producto, fuentes, variantes, hashes y bloqueos: [catalogo-restante-2026-10-23.json](catalogo-restante-2026-10-23.json). Solo metadatos sanitizados en Git; los píxeles y fuentes completas están en `.local/arte-20261023/catalogo-restante`, ignorado.

## UGREEN: originales obtenidos y revisados

| Producto del catálogo | Referencia oficial candidata | Decisión de revisión |
|---|---|---|
| Nexode 100 W | [40737, 3C+1A](https://us.ugreen.com/products/100w-3c1a-gan-fast-charger) | Acabado profesional; confirmar modelo y clavija estadounidense |
| Magnético 10.000 mAh, Azul | [MagFlow 65958, Qi2 25 W](https://us.ugreen.com/products/ugreen-25w-magnetic-power-bank-10000mah) | Otro modelo, con cable/pantalla; no equivale a una variante del 25208. Sello del fabricante sin verificación independiente |
| USB-C a Lightning, 1 m | [60759, 3,3 pies](https://us.ugreen.com/products/ugreen-20w-usb-c-to-lightning-cable) | Conectores/longitud coherentes; confirmar SKU del producto representado |
| Hub 10 en 1, Plata | [45366](https://us.ugreen.com/products/ugreen-10-in-1-usb-c-docking-station) | Confirmar acabado. Cables, tarjetas y pendrive ilustran conexiones; no afirmar incluidos |
| Cargador de auto, Negro | [90314, paquete con cable](https://uk.ugreen.com/products/ugreen-30w-pd-car-charger-2-ports-with-60w-usb-c-cable) | Rechazado para integración por variante/paquete sin acreditar. Candidato del UUID `648be…`; nunca asignarlo al 25845 |
| Soporte de laptop, Plata | [40289](https://us.ugreen.com/products/laptop-stand) | Aspecto coherente; el catálogo no acredita ese modelo |

El séptimo original, magnético **25208 crema**, quedó rechazado frente a Azul y archivado separadamente. No se recoloreó ni se presentó el 65958 como su variante. Se revisaron seis imágenes primarias y una archivada. Cuatro originales son de 600 px: útiles para tarjetas, limitados para ampliar detalle; no ampliarlos artificialmente. El método fotografía/render de fabricante no está documentado.

## Resto del paquete

- **7 SHEGLAM:** siete referencias oficiales con SKU y tono, seis páginas de producto HTTP200 y una referencia de categoría HTTP200 cuyo producto respondió503. Las imágenes no se descargaron: CDN `img.ltwebstatic.com` bloqueado. Líneas/tonos del catálogo siguen sin acreditar. Baked Glow suelto se rechazó frente al producto compacto descrito en catálogo.
- **25 genéricos:** cada UUID tiene campos concretos faltantes de fabricante, modelo, material, dimensiones o variante. No asignar marcas/productos por parecido con una ilustración.
- **DJI Mic 3:** cuatro fotografías que ya existían en Storage descargadas e inspeccionadas; acabado profesional y kit reconocible. No contarlas como cuatro originales oficiales nuevos: origen, part number y permiso siguen sin confirmar. No se reemplazaron sus recursos.

La comprobación administrativa del coordinador se limitó a los39UUID, con `read_only:true` y transacción `BEGIN READ ONLY/ROLLBACK`: **56 variantes, 55 códigos internos DEMO, uno vacío y cero códigos de fabricante identificados**. Sin extraer valores privados de SKU ni cambiar filas. No se repitieron diagnósticos de BCV, permisos, cron o vendedor.

## Revisión y límites

`catalog_art` investigó y preparó archivos ignorados; `catalog_review` examinó originales y metadatos en dos rondas. Dictamen: aptos como referencias profesionales locales y para versionar metadatos; ninguna aprobación de asignación comercial o distribución. Correcciones: separar modelos magnéticos, rechazar crema, advertir paquete/color/props y aclarar conteos. Raíz integra y realiza commits. Se comprobaron hashes, dimensiones y tamaños de los11archivos descargados:7UGREEN y4copias de la galería DJI existente. No hubo exportación de app ni cambio de su registro de imágenes.

SHEGLAM §2.1–2.2 requiere consentimiento para usos comerciales/reproducción; no se obtuvo licencia específica. UGREEN tampoco tiene permiso de distribución acreditado. La disponibilidad de un original en la web no resuelve ese estado. Los textos comerciales extensos y todos los píxeles quedan fuera de este documento/JSON público. No Canvas/Canva disponible; no se generaron ni retocaron estos originales con IA.

## Siguiente bloque exacto

1. Revisar/guardar/publicar el borrador de **Configuración del entorno** que conserva los dominios oficiales anteriores y añade `img.ltwebstatic.com`. Guardado confirmado; todavía no aplicado. Es configuración de red, no publicación de HAYAZGO. No repetir peticiones CONNECT403 antes de aplicarlo.
2. Confirmar con referencias de proveedor qué modelos/tonos representan los UUID demo y la base de uso de sus fotografías. El JSON conserva enlaces y discrepancias por producto; no modificar datos para hacer coincidir imágenes.
3. Con material autorizado y correspondencia resuelta, integrar el lote usando el registro/preparador existentes, comparar Inicio/Buscar/ficha y demás apariciones, comprobar APK5 y preparar la entrega. Este paquete de referencias todavía no cumple esas condiciones.

La compra ya publicada sí fue recibida en el Samsung de Oliver: OTA `01a1693d-60d9-7183-a309-92769e4ea219`. Ese diagnóstico no acredita que estas fotografías nuevas estén dentro de la OTA. Si Oliver sigue percibiendo la app igual, precisar fotografías/carrito/checkout/diseño general; no enviar el mismo APK como si contuviera otro rediseño ni republicar idéntico código para cambiar solo el ID.


## Checkpoint posterior — CDN SHEGLAM operativo

En el turno de Inicio real, el agente de arte comprobó GET200 y descargó/inspeccionó siete originales SHEGLAM1340×1785 con hashes verificados. Recursos sólo ignorados: `.local/arte-20261023/catalogo-restante/sheglam-descargas-20261023.json`, lote02 y manifest39.0correspondencias aprobadas/0permisos de redistribución; polvo rechazado por formato, seis referencias con línea/tono/colaboración sin confirmar. La espera anterior por aplicación del dominioCDN queda superada. SamsungEP-T4510 respondió403, AnkerA1263 404 y StarTechST7300U3M403 en una sola prueba; no repetir reintentos ni incorporar fotos por parecido. Ningún original nuevo fue incluido en la app/OTA.
