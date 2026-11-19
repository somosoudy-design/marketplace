# Comparativa real de voz comercial · 26 de octubre de 2026

**16 PNG / 8 pares; datos comerciales iguales en 8/8 y hashes correctos en 16/16.** [Índice visual](index.html) · [Manifiesto completo](manifest.json).

Baseline privado `743bb7c` en `http://127.0.0.1:8101`; final en `http://127.0.0.1:8103`. Mismo backend local, mismo artículo editorial UGREEN Nexode cargador GaN 65 W, UUID `f59d84f9-30b3-47a1-8681-6504374d195a`, mismo precio de DTO: $42,00. Buscar usa la consulta real `UGREEN`; la ficha corresponde al mismo UUID. No se cambió el nombre para hacerlo coincidir con la presentación Samsung del registro remoto.

Inicio, Buscar y ficha a 412 px en claro y oscuro; Inicio a 320 px en ambos temas. Todos los PNG tienen altura 892 y escala de dispositivo 1. Se esperaron fuentes, fin de lecturas, decodificación de imágenes visibles y estabilidad de posiciones. Sin retoque ni composición de píxeles.

Cada par conserva respuestas completas, URL, cuerpo de consulta, SHA del payload y horarios reales. Los DTO comerciales y todos los DTO de lectura comunes coinciden. Las capturas se realizaron entre las **22:17:42 y las 22:23:36 UTC**; dentro de cada par transcurrieron entre 1,7 y 3,7 segundos.

| Par | Antes UTC | Después UTC | Datos |
|---|---|---|---|
| 412-light-home | 2026-10-26T22:17:42.924Z | 2026-10-26T22:17:46.321Z | Iguales |
| 412-light-search | 2026-10-26T22:23:18.810Z | 2026-10-26T22:23:20.541Z | Iguales |
| 412-light-detail | 2026-10-26T22:23:23.719Z | 2026-10-26T22:23:26.960Z | Iguales |
| 320-light-home | 2026-10-26T22:20:07.965Z | 2026-10-26T22:20:11.284Z | Iguales |
| 412-dark-home | 2026-10-26T22:20:14.546Z | 2026-10-26T22:20:17.845Z | Iguales |
| 412-dark-search | 2026-10-26T22:23:28.678Z | 2026-10-26T22:23:30.369Z | Iguales |
| 412-dark-detail | 2026-10-26T22:23:33.600Z | 2026-10-26T22:23:36.924Z | Iguales |
| 320-dark-home | 2026-10-26T22:20:31.267Z | 2026-10-26T22:20:34.889Z | Iguales |

Los avisos de entorno y precios de ejemplo pasan de una aparición visible a cero en las 16 vistas correspondientes. Las ilustraciones antiguas del Storage mantienen «IMAGEN DEMO» incrustado en los píxeles. **No se afirma que estas fotos estén renovadas, que el texto incrustado haya desaparecido o que los 38 overrides de Marketplace se hayan ejercitado aquí.**

Los UUID locales del seed difieren de los UUID remotos del registro. Esta comparativa sólo acredita composición y avisos de UI sobre los mismos DTO locales. Los seis tests anteriores acreditan por separado mapping, galería, Sheet y fallback atribuido mediante IDs públicos reales y bytes versionados, interceptados localmente. Android deberá comprobar la apariencia del backend Marketplace con sus overrides.

Sin autenticación, mutaciones, reset, cambios de assets o llamadas remotas. Los eventos analíticos se atendieron localmente con 204. Las respuestas de lectura reales no se reemplazaron ni reprodujeron desde fixtures. No se repitieron los seis tests tras el ajuste de alcance StoreHeader en8103.
