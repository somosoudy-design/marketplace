# Ensayo acotado: Buscar con texto ampliado — NO INTEGRAR

Estado: investigación aislada sobre `c00cb60`. Sin cambios de aplicación ni publicación. El experimento y su evidencia se archivan aquí. No sustituye el ensayo rechazado del 27 de octubre ni se considera solución de accesibilidad terminada.

## Problema y propuesta

Con 320 px y escala CSS simulada 1,6, el contador «60+ productos» tenía 43 px disponibles para un texto de 138 px y se veía cortado. «Por encargo» también se cortaba. El candidato agrupa Filtrar/Ordenar en un bloque adaptable, permite al contador ocupar varias líneas y deja que el estado comercial de las tarjetas de Buscar se parta hasta en dos líneas. No altera valores, nombres, precios, cálculos, las columnas ni la navegación normal. Es un cambio independiente de la función experimental de restauración.

Conservar una sola línea y dos columnas no permite garantizar que cualquier nombre comercial se lea íntegro: el texto sintético «Revodok hub USB-C 6 en 1» ocupa 260 px y dispone de 116 px con la escala simulada. El candidato sigue truncándolo; la etiqueta accesible completa no sustituye la lectura visual. Tampoco se verificó que importes extensos sean íntegros a escala ampliada. No adoptar esta propuesta como corrección completa de nombres/modelos ni de precios.

## Conservar contexto al cambiar columnas

El código vigente cambia la `key` de FlatList cuando cambia el número de columnas y la lista se desmonta; se conservan la búsqueda y los filtros, pero se pierde el scroll. El primer intento de restauración con el primer producto visible falló porque `scrollToIndex` se llamó antes de que se midieran filas (`averageItemLength=0`): el scroll cambió de 1946 a 0 y el contenido visible de productos sintéticos 14–19 a 0–5. El fallo quedó registrado en este resumen.

La segunda prueba espera un máximo de seis reintentos cuando no hay medidas y estima el desplazamiento cuando sí las hay. En Chromium claro, en un cambio 320 → 720 con filtro activo y 60 respuestas sintéticas, retuvo el producto 14 en pantalla: antes se veían 14–19 y después 12–17; la búsqueda UGREEN y «Filtrar, 1 activos» persistieron. Resultado observado en `resultado-ancla.json`. La posición es aproximada por producto anclado, no exacta en píxeles. El prototipo limita su listener a Buscar cuando no hay `onScroll` externo; la tienda conserva su handler animado, pero esto todavía no demuestra que no existan regresiones nativas.

## Evidencia y limitaciones

- Capturas originales `antes-{light,dark}-{320,412}-f{1,1.6}.png` y `candidata-{light,dark}-{320,412}-f{1,1.6}.png`; para comparar usar igual tema, ancho y escala. Sólo se archivan aquí las capturas a 320 px con fuente CSS1,6; las demás fueron temporales y no acreditan validación nativa.
- La segunda prueba de ancla con reintento fue realizada solo en modo claro; no es una validación de oscuro ni de ciclos sucesivos.
- Son renders de Chromium, fuentes ampliadas mediante CSS y respuestas interceptadas sintéticas. No representan datos comerciales actuales, tamaño de fuente del sistema Android, TalkBack, recepción de OTA ni uso físico. Las 60 filas y sus precios se generaron solo para probar disposición; no se escribieron en la base de datos.
- `tsc --noEmit` pasó en la copia aislada. `git apply --check` confirmó únicamente que el parche puede aplicarse contra la fuente actual; no avala su corrección.

## Pendiente antes de integrar

1. Resolver con diseño revisado la lectura visual de nombres arbitrarios y la presentación íntegra de importes, respetando la regla del propietario de una sola línea. No usar heurísticas de sufijos o reducción de fuente que oculten diferencias o perjudiquen legibilidad.
2. Probar cambios reales de escala con y sin cambio de columnas, 320/412 y orientación en ambas direcciones, temas claro/oscuro, encabezado visible y scroll profundo con varias páginas, filtros/categorías, retorno desde ficha y favorito.
3. Ensayar listas vacías, cambios de consulta y datos mientras haya una restauración pendiente, interacción durante los reintentos y listas cortas. Verificar que no se fuerce la posición si el usuario desplaza o cambia filtros.
4. Comprobar en Android real compatible, TalkBack y rendimiento; comprobar explícitamente el encabezado animado de tienda, colección, favoritos y seguimiento. Pedir revisión independiente de diseño, navegación y pruebas antes de integrar.

## Reproducción

- Parche experimental **no aprobado** y comprimido: `propuesta-no-aplicar.patch.gz` (leer con `gzip -dc`), SHA-256 del contenido descomprimido `108745fd4504aacefc5aeac84d4c46f703d92b399edaec7255498d62f4a7ddd3`; contiene únicamente cambios a `Badge`, `ProductCard` y `Catalog`.
- Las comparaciones se hicieron con exportaciones locales 8187 (antes) y 8192 (candidato), datos sintéticos y bloqueo de red no local; los servidores temporales y las copias editables no se conservan. La prueba de columnas usó instrumentación de diagnóstico que no se incluye en el parche.
- Las capturas corresponden a la variante visual inicial; la iteración de reintento cambió solamente la restauración de scroll. El parche final incorpora el reintento y carece de los logs de diagnóstico, por lo que debe reexportarse y probarse íntegramente antes de cualquier aprobación.
