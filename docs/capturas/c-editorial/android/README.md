# C publicada — recepción Android y fuente nativa

Veintidós JPEG originales del workflow, copiados sin recorte ni retoque. Android 15/API35, emulador Pixel6 con APK5 existente. Run [38342591484](https://github.com/somosoudy-design/marketplace/actions/runs/38342591484), revisión40, fuente `637d60e46c99e6797814d2f2581a0178a937c002`; resultado **4/4, sin reintentos**.

Fuente inmutable: `ci/capturas` **`9e99b968620a7ece34131e4f6a9bc978e63c0c39`**, carpeta `ultima`, 2026-10-13 03:44 UTC. Solo se simplificaron nombres para distinguir tema. Los JPEG tienen el contenido exacto del artefacto.

Diagnóstico en ambos temas: actualización **`01a13354-e5fd-70f0-90bc-feec7f425a03`**, publicada **2026-10-13 03:36 UTC**, canal `preview`, runtime **`eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`**. Backend Marketplace responde, sesión cifrada y cuenta sin sesión. Este es el ID individual Android recibido; no se inventa un UUID de grupo EAS.

| Estado | Claro | Oscuro |
|---|---|---|
| Portada normal | [JPEG](light-inicio-v2-01-portada.jpg) | [JPEG](dark-inicio-v2-01-portada.jpg) |
| Colección / salir de Inicio | [JPEG](light-inicio-v2-02-coleccion.jpg) | [JPEG](dark-inicio-v2-02-coleccion.jpg) |
| Regreso de ficha | [JPEG](light-inicio-v2-05-regreso.jpg) | [JPEG](dark-inicio-v2-05-regreso.jpg) |
| Buscador persistente | [JPEG](light-inicio-v2-08-buscador-persistente.jpg) | [JPEG](dark-inicio-v2-08-buscador-persistente.jpg) |
| Fuente OS1,6, apertura | [JPEG](light-inicio-v2-texto-01-portada.jpg) | [JPEG](dark-inicio-v2-texto-01-portada.jpg) |
| Fuente OS1,6, comparación | [JPEG](light-inicio-v2-texto-02-comparacion.jpg) | [JPEG](dark-inicio-v2-texto-02-comparacion.jpg) |
| Diagnóstico | [JPEG](light-inicio-v2-07-diagnostico.jpg) | [JPEG](dark-inicio-v2-07-diagnostico.jpg) |

El flujo08 comprueba colección/categoría/ficha/regreso/favorito visitante/carrito/Buscar y buscador persistente. El09 aplica `font_scale=1.6` al OS del emulador: leyenda/SKU de ancho completo, comparación de una columna e Inicio legible; restaura1,0 al terminar. Inicio tiene reloj/iconos claros sobre violeta; al salir a colección clara, el reloj vuelve oscuro; al regresar mantiene el fondo correcto.

Estas comprobaciones son **nativas en emulador**. No acreditan recepción física en el Samsung, TalkBack, FPS o toda la aplicación. No compras, pagos ni escrituras de vendedor remotas. No nuevo APK.
