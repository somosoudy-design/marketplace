# Ensayo de fuente ampliada · no integrar

La OTA publicada para esta entrega es la `01a17b21-55f2-7ebe-83b4-ff980e1d06fb`; este ensayo no forma parte de ella. El director UX desarrolló una propuesta aislada sobre la fuente móvil `e6dd4c4`, con tarjeta horizontal cuando `fontScale > 1,3`, estados visibles, controles de búsqueda apilados y precio existente sin reducir. El auditor independiente dictaminó **CAMBIOS OBLIGATORIOS**. El archivo `propuesta-no-aplicar.patch.gz` es un registro inerte (se puede leer con `gzip -dc`), no un parche aprobado ni una solución que deba integrarse directamente.

## Hallazgos comprobados

- La escala 1,6 fue simulada en React Native Web. Se visualizaron Nexode 30/65/100 W y los cables USB-C/Lightning en muestras elegidas del backend local, sin modificar precios. Una primera iteración unía palabras al separar el sufijo; se detectó durante revisión. [Ejemplo de modelos](modelos-dark-320.png). No se ha probado el tamaño del sistema Android.
- La heurística de sufijo falla con nombres de vendedores arbitrarios: «UGREEN Revodok hub USB-C 6 en 1» quedó visualmente como «Revodok hub … 1»; se perdió el dato 6. Una etiqueta accesible completa no sustituye la comparación visual. La propuesta no garantiza nombres que terminan con tres o más palabras.
- Al forzar cambio de escala 1 → 1,6 y ancho 320 → 321, consulta UGREEN y filtro Disponible se conservaron, pero `FlatList` volvió de `scrollTop=168` a `0` por el cambio de columnas y su `key`. [Antes](escala-antes-320.png), [después](escala-despues-321.png) y [medidas](medidas-retencion.json). Son dos pasos de una transición, no una comparación del mismo viewport.
- La propuesta no debe aceptarse por pruebas técnicas ni por los ejemplos que sí distinguen: también debe conservar precio, estados, favorito, nombre completo accesible y navegación en Inicio, Buscar, tienda, colección y favoritos. La instrucción vigente del propietario mantiene el nombre de la tarjeta en una línea. No inventar un atributo de modelo ni imponer un tamaño de precio ilegible.

## Próxima acción exacta

Diseñar una representación que funcione con nombres arbitrarios de productos reales y preserve sus datos diferenciadores sin heurísticas frágiles ni alterar el precio. Diseñar además una restauración verificable del contexto cuando cambian las columnas, sin romper el `onScroll` animado de la tienda, el seguimiento de impresiones o el retorno desde la ficha. Probar ambos temas, 320/412 y texto normal/ampliado, incluyendo «6 en 1», «30 W negro», varias tiendas y los estados de oferta/agotado/encargo; luego solicitar revisión independiente. Si alguna restricción impide una solución, documentarla y dejar el código sin publicar. Para validar Android real hace falta una copia del APK5 existente; no volver a descargar el enlace histórico que ya devolvió 404 ni generar otro APK.

[Manifiesto y hashes](manifiesto.json). Las capturas son originales, de navegador y datos de fixture locales; no acreditan recepción física, TalkBack, licencias de fotografías ni datos comerciales reales.
