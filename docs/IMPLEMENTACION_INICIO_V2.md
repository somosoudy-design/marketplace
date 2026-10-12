# Inicio V2 — primera implementación 1A + 2A

2026-10-12. Arquitectura aprobada por Oliver; publicación Android preview autorizada tras validación. [Documento rector](ARQUITECTURA_EXPERIENCIA_V2.md). Este incremento cambia la apertura y primera comparación; 2B y las alternativas A/B/C siguen siendo trabajos separados.

## Qué cambió

- Cabecera compacta: marca, avisos y carrito reales, saludo cuando existe perfil. Buscador rectangular con promesa de productos/marcas y acceso persistente al desplazarse.
- Categorías como enlaces compactos de al menos 44 px, miniaturas íntegras y nombres, sin círculos protagonistas ni selector «Todo».
- Una apertura editorial Electric Violet, de ancho útil completo: primera colección feature válida y un producto suyo, título completo, fotografía sin recorte, precio del producto, Demo y disponibilidad excepcional. Un único destino «Ver colección»; sin carrusel/puntos ni compra anidada.
- Primera comparación de cuatro productos en orden del backend, excluyendo solo el SKU editorial. Dos columnas móviles con texto normal; el ajuste de fuente nativo grande puede usar una columna. Con pocos datos se muestran los disponibles.
- Retoma aparece después. Recomendaciones restantes y otras colecciones feature no se pierden: siguen más abajo. Tiendas abren su tienda; se retiró «Ver todas» hacia productos porque prometía un directorio inexistente.
- Personalización exige sesión, preferencia real y flag del feed. El tracking espera el perfil, mide cada fila aparte del título y conserva claves por espacio; no atribuye abrir colección como abrir SKU.
- Aviso existente de datos guardados si falla la actualización. Un catálogo con colecciones no se declara vacío solo porque no haya recomendaciones.

No se reconstruyeron tarjetas, Buscar, checkout, vendedor o backend. Feed inferior/colecciones/tiendas conservan la organización operativa previa; la portada completamente finita corresponde a 2B, no se presenta como ya terminada.

## Comparación visual real

| Ancho, ambos temas | Primer producto antes | Después | Ganancia | Completas antes / después |
|---|---:|---:|---:|---:|
| 320 × 892 | 500 px | 432 px | 68 px antes | 2 / 2 |
| 412 × 892 | 505 px | 429 px | 76 px antes | 2 / 2 |

La mejora principal es una jerarquía distinta y comparación integrada, no fingir más tarjetas visibles. Hero final 218/215 px: presupuesto flexible para identificar producto y colección. Se conserva el precio del servidor; no hay precios promocionales, escasez o estadísticas inventadas.

| Estado | Antes | Después |
|---|---|---|
| Claro 412 | [Original](capturas/inicio-v2/before/light-412-inicio.png) | [Original](capturas/inicio-v2/after/light-412-inicio.png) |
| Oscuro 320 | [Original](capturas/inicio-v2/before/dark-320-inicio.png) | [Original](capturas/inicio-v2/after/dark-320-inicio.png) |
| Claro 320 | [Original](capturas/inicio-v2/before/light-320-inicio.png) | [Original](capturas/inicio-v2/after/light-320-inicio.png) |
| Oscuro 412 | [Original](capturas/inicio-v2/before/dark-412-inicio.png) | [Original](capturas/inicio-v2/after/dark-412-inicio.png) |
| Texto ampliado web | Simulación específica nueva; no comparación física | [Claro](capturas/inicio-v2/after/light-320-texto-ampliado.png) / [Oscuro](capturas/inicio-v2/after/dark-320-texto-ampliado.png) |
| Scroll | Continuidad de módulos conservada | [Claro 412](capturas/inicio-v2/after/light-412-scroll.png) / [Oscuro 320](capturas/inicio-v2/after/dark-320-scroll.png) |

Originales PNG, sin retoques. El primer conteo DOM «7» incluía tarjetas del rail fuera de pantalla; se descartó y se documentó en las mediciones. Antes: dos completas verificadas en originales. Después: intersección X/Y del viewport. No usar la cifra descartada como evidencia.

Texto web ampliado por CSS 1,6 prueba crecimiento/legibilidad, **no cambia `useWindowDimensions.fontScale` ni acredita fuente Android**. Esa comprobación tiene flujo 09 con fuente OS 1,6 en emulador aislado. La etiqueta de pestaña truncada en la simulación CSS no acredita cómo se comporta Android.

## Revisión real y correcciones

Raíz escribe/commitea; subagentes solo leen. Product Design: `index`, `audit` y framework realmente consultados; preflight de contexto ejecutado, sin contexto guardado. La arquitectura y sus imágenes aprobadas fueron la base, sin copiar cada píxel. `ideate` se consultó para las tres alternativas posteriores; todavía no se confunde ideación con implementación.

| Especialista | Ronda 1 | Corrección y ronda 2 |
|---|---|---|
| UX/UI `/root/ux_director_v2` | Texto ampliado partía «Esenciales»; densidad del hero y conteo anterior | Título de ancho completo, SKU/precio y foto debajo, altura menor y conteo corregido. **APROBADO visual web**, no fuente nativa |
| Ecommerce `/root/commerce_v2` | Región medida incluía encabezado; clasificación cambiaba mientras llegaba perfil | Filas directas separadas de título/espacios; espera del perfil/preferencia y claves por clasificación. **APROBADO comercial**, sin objeciones |
| Auditor `/root/reviewer_v2` | **CAMBIOS OBLIGATORIOS:** reflow y transición del tracking | Inspeccionó código y diez capturas finales. **APROBADO** tras dos rondas, sin objeciones importantes |

La aprobación interna cubre diseño/alcance. No sustituye runtime exacto, publicación, recepción Android o revisión física de Oliver. No hubo una tercera ronda indefinida.

## Pruebas ejecutadas

- **27/27 UI visitante/regresión**, claro/oscuro: colección y categoría → regreso, ficha/favorito independiente, búsqueda con foco/filtros/contexto, contador/carrito, estados de disponibilidad, pocos productos, ausencia de colección, catálogo vacío y simulación de texto ampliado.
- **2/2 seguimiento con sesión local real**, perfil real demorado y flag de personalización controlado: no solicitudes mientras falta perfil/solo encabezado; dos IDs cuando aparece primera fila; clic e impresión en `home_for_you`, sin `home_featured`. El test inicial fallaba porque intentaba desplazar un wrapper; se corrigió con rueda real, conservando todas las aserciones.
- Total **29 verificaciones aprobadas en dos pases**; no se afirma un pase combinado 29/29 inexistente. UI existente y nuevo bloque se ejecutaron en Chromium contra el backend local actual.
- Tipos y lint del monorepo aprobados; exportación web y Android/Hermes 5,9 MB aprobadas. `bash -n tools/eas/emulator-flows.sh` aprobado.
- Backend API de prueba en lectura/rollback; Auth sirvió la cuenta demo existente sin bootstrap/migración/reset. La comprobación de seguimiento verifica solicitudes del cliente/contexto, **no persistencia de telemetría**. Sin cuentas, pedidos o pagos remotos.

Comando focal: `pnpm --filter @kora/app-e2e exec playwright test --config <config local sin panel> home-v2.spec.ts navigation.spec.ts browse.spec.ts`; luego `home-v2.spec.ts -g 'real local session'` tras corregir el scroller del test. Config/servicios auxiliares ignorados en `.local/home-v2`; entorno instalado reutilizado, sin nuevas dependencias.

## Publicación y recepción

**Fuente validada:** `6df3c7d`, commit/push confirmados. **Publicación solicitada:** `.github/eas-update-request` con runtime exacto `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`, guard de CI con Firebase original antes de EAS Update Androidpreview, resultado real EAS y emulador flows 08/09 en claro/oscuro. Sin APK nuevo, production o cambios nativos.

La recepción se comprobará por identificador/fecha/canal/runtime y capturas nativas de apertura, destinos, regreso y fuente OS 1,6. No se afirmará recepción Samsung sin comprobación de Oliver. Después se informará inmediatamente y se seguirá con tres alternativas A/B/C de diseño, sin otra publicación.
