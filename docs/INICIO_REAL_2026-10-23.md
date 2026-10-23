# Inicio real — incremento visible del 23 de octubre

## Resultado y alcance

Los commits posteriores a la compra publicada eran documentación/pruebas; Inicio no había cambiado. La
foto de diagnóstico del Samsung acreditaba recepción, pero no una mejora nueva de la portada. Este bloque
sí modifica la app: C presenta mercancía publicada del catálogo en lugar de forzar las fotos documentales
de exhibición que el propietario rechazó.

Se reutilizan `home_feed`, `search_products` y `ProductImage`. La apertura elige un producto publicado,
tienda activa, no demo, foto normal del backend, precio finito positivo y disponibilidad comprable. No
certifica licencia o calidad por `is_demo=false`. No hay UUID/modelo fijo: actualmente corresponde al DJI
Mic 3, con la fotografía que ya estaba cargada en su ficha. No se agrega una imagen nueva al bundle.

«Ver producto» abre ese UUID; no inventa pertenencia a «Esenciales para cargar todo». Todas las colecciones
siguen accesibles más abajo. El producto no se repite en comparación/feed. Se conserva C continua, el aviso
de pruebas, categorías y controles de Cuenta/carrito. Sin datos recientes válidos se conserva la apertura
de colección existente; el fallo de esa consulta no bloquea Inicio.

## Evidencia comparable

Exportaciones nuevas del antes `8bd38ae` y después funcional `058cb7b`, mismo backend y viewport 892px.
Imágenes/fuentes cargadas y transición terminada; PNG originales sin edición. Medidas y hashes en
[INICIO_REAL_2026-10-23.json](INICIO_REAL_2026-10-23.json).

| Vista | Antes | Después |
|---|---|---|
| Claro412 | [Inicio](capturas/inicio-real-2026-10-23/before/light/412-inicio.png) | [Inicio](capturas/inicio-real-2026-10-23/after/light/412-inicio.png) |
| Oscuro412 | [Inicio](capturas/inicio-real-2026-10-23/before/dark/412-inicio.png) | [Inicio](capturas/inicio-real-2026-10-23/after/dark/412-inicio.png) |
| Claro320 | [Inicio](capturas/inicio-real-2026-10-23/before/light/320-inicio.png) | [Inicio](capturas/inicio-real-2026-10-23/after/light/320-inicio.png) |
| Oscuro320 | [Inicio](capturas/inicio-real-2026-10-23/before/dark/320-inicio.png) | [Inicio](capturas/inicio-real-2026-10-23/after/dark/320-inicio.png) |

| Medida CSS, idéntica entre temas | Antes | Después |
|---|---:|---:|
| Final de banda editorial412 | 319px | 320px |
| Primera comparación412 | 424px | 425px |
| Final de banda editorial320 | 319px | 306px |
| Primera comparación320 | 424px | 411px |
| Tarjetas completas antes de barra inferior | 2 | 2 |

El cambio está en producto/contexto/destino, no en fingir una mejora general de densidad. Título completo
una sola vez, precio y «Por encargo» reales, foto112/98px contenida y CTA legible. La ficha de destino también
se capturó en los cuatro casos (`after/{light,dark}/{320,412}-ficha.png`).

## Pruebas y revisión independiente

- Tipos/lint móvil sin advertencias; exportaciones web y Android Hermes aprobadas.
- 22unitarias:18selección/elegibilidad/precio/fallback/no mutación de datos y4aislamiento fotográfico.
- 12UI claro/oscuro: destino y regreso, todas las colecciones, deduplicación, categorías/búsqueda, consulta
  reciente fallida, refresco fallido conservando caché, catálogo de otras secciones vacío,320px/texto web1,6
  y continuidad de las cinco fichas fotográficas/créditos anteriores.
- Lecturas públicas contra Marketplace; analítica interceptada localmente y otras mutaciones bloqueadas.
  Los primeros fallos del arnés fueron `route.fetch` sin red Node, proxy explícito que afectaba localhost y
  una lista de RPC incompleta; se corrigió el arnés sin abrir permisos ni alterar la app para pasar pruebas.
  Resultado final12/12, sin omisiones/reintentos automáticos.
- Auditor: dos P2 iniciales (precio cero y caché reciente tras fallo), corregidas y probadas. Revisión visual
  web APROBADA tras examinar imágenes cargadas en320/412/ambos temas y fichas. Director UX también APROBADO.
  No se exige una tercera ronda visual web ni se afirma que los unitarios acrediten diseño.

Product Design realmente consultado en este turno: `index`, `audit`, `user-context`, script de preflight
(sin contexto guardado) y `audit/references/design-audit-framework`. Guiaron evidencia previa, continuidad,
jerarquía, destino honesto, accesibilidad/reflujo y declaración de límites. No nueva consulta `ideate`,
generación de imágenes ni investigación externa simulada. No Canvas/Canva disponible.

## Publicación y límites

Publicación progresiva autorizada por Oliver: sólo Android preview/APK5, guard exacto de runtime antes de
EAS. EAS40003745928 Success, fuente `e6fccbd`, guard/publicación/resultado aprobados. Revisión43 de emulador solicitada con08+09ambos temas/fuenteOS1,6. ID y recepción se registrarán después de comprobarlos;
no afirmar recepción del nuevo Home por el diagnóstico de la OTA anterior.

Este incremento no completa el catálogo profesional: las tarjetas mantienen fotos CC/ilustraciones
anteriores. El agente de arte descargó siete originales SHEGLAM en `.local`, todavía con0correspondencias
aprobadas y0permisos de distribución; no se incorporan. Sin backend, SQL, precios, pagos, iOS, configuración
nativa ni APK nuevo. La prueba de fuente Android1,6 y recepción nativa se ejecuta después de publicar.
