# Estado actual de Kora

> Documento vivo. Lo actualiza el agente que trabaja, en cada checkpoint (cada 20–30 minutos de trabajo, al
> cerrar un módulo y antes de ceder el turno). Si algo de aquí no coincide con el repositorio o con los
> servicios, gana lo que compruebes y corriges este archivo.

**Última actualización:** 2026-10-24: catálogo original validado, publicación preview en preparación. Antecedente —  Inicio real publicado y recibido en emulador Android15/APK5. OTA `01a16a08-5900-7324-83c5-8f833e369d19`,23oct18:31UTC/14:31Caracas. EAS40003745928 Success/e6fccbd/guard exacto;4/4nativos claro/oscuro/OS1,6 sin reintentos. Recepción de esta nueva OTA en Samsung aún no observada.

## Siguiente incremento comprador — ficha con selección vinculada a compra

El catálogo 25/32 ya fue publicado: EAS `40043643824` Success, fuente `04b384c`, guard exacto APK 5 y publicación Android preview aprobados. Se inició recepción nativa con solicitud revisión 44, fuente `b4d70b9`, flujos `12-catalogo-original` y `09-inicio-v2-texto`, claro/oscuro. Falta leer el ID de OTA en evidencia original; no afirmar recepción Samsung.

Root continúa un bloque específico de ficha, recomendado por director UX con framework Product Design y revisado estructuralmente por auditor: sección «Tu selección», resumen fijo de variante/cantidad y precio por unidad del DTO, Editar devuelve al selector medido, vendedor antes de condiciones. No otro modal ni cálculos. Se bloquea edición mientras agrega y se evita un segundo envío simultáneo; cambiar selección retira la confirmación anterior. Android reserva el inset superior una sola vez para que los iconos del sistema conserven contraste sobre las fotos claras; skeleton coherente y apariencia restaurada al salir. No cambios iOS/nativos/backend/financieros.

**Checkpoint:** código de ficha y Chip opcionalmente deshabilitado, tipos/lint aprobados; validación UI/capturas/Android pendiente. No incluido en la primera OTA del catálogo y no publicar la segunda hasta cerrar su revisión y comprobar la recepción de la primera. Próxima acción: exportación web bajo `.local/ficha-seleccion-20261024`, pruebas focalizadas Editar→color/cantidad→Agregar→carrito, bloqueo/envío único/error/sin stock, capturas 320/412 claro/oscuro y revisión independiente. No repetir suites generales ni regenerar imágenes.

## Trabajo en curso — renovación real de imágenes Android

Oliver aclara Android/APK5, descarta iPhone y ordena continuar sin preguntas rutinarias con imágenes y después mejoras sustanciales de la app. Autoriza las publicaciones progresivas Android preview ya revisadas. La instrucción más reciente de continuar sustituye la espera anterior de confirmación entre imágenes y UX; no concede derechos sobre fotografías de terceros.

Inventario público ya comprobado:44productos/43demo/0UUID nuevos. No repetir diagnóstico. Material de marca:19productos con sustitución profesional todavía bloqueada por identidad exacta o permiso de redistribución; no publicar sus originales locales ni afirmar44/44.

**Checkpoint de código:**25productos genéricos/32recursos originales generados ya vinculados porUUID/ruta y variantes,2,84MB optimizados. No son fotografías auténticas de fabricante: su ficha identifica imagen generada de exhibición y composiciones referenciales. Modo preview exclusivamente, backend original y `is_demo` conservados; AndroidAPK5, web sólo loopback, iOS y production desactivados. Si elDTO no traeis_demo (carrito/checkout/detalle de pedido/categoría), se corrobora mediante la consulta pública de producto reutilizada; carga/error/false/ruta cambiada conservan Storage. Aviso único por pantalla aclara que incluye imágenes generadas. Misma selección en tarjetas/ficha/carrito/checkout/detalle de pedido; resumen de pedidos no traeUUID/variante y conserva imagen del servidor. La comparación inicial de Inicio prioriza sólo nuevas muestras visuales cuando no hay personalización; no cambia el ranking remoto ni inventa popularidad.

**Revisión real:**agente de arte cerró25productos/32recursos; auditor de catálogo exigió mostrar explorador y pinza en el kit, sin inventar composición exacta: recurso corregido. Revisión final de32originales APROBADA como imágenes referenciales, no fotografías auténticas. Dos P2 de código corregidas y capturas comparadas revisadas por auditor. Root integra; ningún subagente modifica archivos versionados. Canvas/Canva no disponible; ImageGen sí utilizado. Mantener avisos de pruebas, moderación, pagos y restricciones sanitarias/comerciales.

**Pruebas:** 26 unitarias, tipos/lint y exportaciones web/Android Hermes aprobados. 20 casos UI únicos finales aprobados, incluidos los 25 productos en ambos temas y color→carrito, error/no-demo; dos selectores se ajustaron a la vista activa de la pila. 24 capturas antes/después en 320/412 claro/oscuro. Dos capturas prematuras fueron rechazadas y recapturadas con carga/opacidad completa. Resumen de pedidos conserva Storage: no devuelve UUID/variante. Checkout autenticado y Samsung no probados en este bloque. **Todavía no hay OTA nueva de este lote.** Última publicada sigue `01a16a08-5900-7324-83c5-8f833e369d19`.

**Próxima acción exacta:** commit/push de pruebas y evidencia final; publicar EAS Android preview con guard exacto APK 5 y comprobar OTA nueva en emulador mediante `12-catalogo-original`, ambos temas. Recursos completos, no volver a generar ni investigar fuentes. Informe: `catalogo-exhibicion/GENERADOS_2026-10-23.md`. Informar cobertura real25/44como máximo, sin atribuir derechos sobre19marcas pendientes. No backend/finanzas/iOS/nativo/APK nuevo.

## Incremento Inicio real — publicado y recibido en Android

Oliver confirma que no percibe avances recientes. Se verificó que después de `aa9510a` sólo se habían añadido documentación/pruebas; la recepción física de aquella OTA está comprobada y no explica la falta de cambio en Inicio. No republicar código idéntico ni pedir otro diagnóstico.

**Incremento implementado y publicado:** apertura de producto real dentro de C, elegida entre mercancía publicada/no demo/tienda activa/foto normal del backend/comprable. Consulta pública `newest`, primera página, sin UUID fijo ni pertenencia ficticia a colecciones. El backend actual ofrece DJI Mic 3; «Ver producto» abre su ficha. Todas las colecciones permanecen accesibles; se excluye el producto de la primera comparación y del feed repetido. Aviso de pruebas y restricciones comerciales conservados. Se retira de Inicio la prioridad artificial de las seis fotos documentales que Oliver rechazó; no se incluyen originales oficiales sin permiso.

**Validación final:** tipos/lint sin advertencias,22unitarias,12UI finales y exportaciones web/AndroidHermes aprobadas.12capturas nuevas412/320claro/oscuro: antes/despuésInicio y ficha. Banda320/306 y primeras fotos425/411 (412/320); dos tarjetas completas. Auditor exigió excluir precio cero/no finito y respuesta reciente tras fallo: corregidos/probados. Director UX y auditor APROBADO visual web, con límite explícito de catálogo fotográfico incompleto. Informe/evidencia [INICIO_REAL_2026-10-23.md](INICIO_REAL_2026-10-23.md). Director UX consultó Product Design index/audit/user-context/preflight/framework; no Canvas disponible.

**Catálogo paralelo:** siete originales SHEGLAM descargados e inspeccionados1340×1785, sólo bajo `.local/arte-20261023/catalogo-restante`;0correspondencias aprobadas/0permisos de redistribución. GET CDN200 comprobado, ya no esperar aplicación de aquel borrador. Samsung403/Anker404/StarTech403 en prueba única; sin reintentos.

**Recepción Android:** run40004177228/fuentef9fe1a1,08+09,4/4sinreintentos; normal y fuenteOS1,6 en claro/oscuro. Diagnósticos originales muestran nueva OTA/canal/runtime correctos y Marketplace responde257/285ms en normales; portada DJI visible y destino/regreso comprobados.24PNG/hash24/24 recuperados del artefacto12524101560 mediante run40007057660 Success, rama inmutable `ci/evidencia-40007057660@589fc143ec7fd0436e1c92eb37c098a8fb01a7e5`;12PNG representativos copiados sin editar a `capturas/inicio-real-2026-10-23/native/`. El workflow original se canceló sólo después de recuperar su evidencia: su paso de pruebas sí terminó Success, el publicador posterior llevaba más de10min atascado. No repetir pruebas/OTA por esa cancelación. Auditor independiente nativo APROBADO tras24PNG/24hashes, sin P1/P2 nuevos deHome. Persiste P2 preexistente de ficha oscura: reloj/iconos blancos sobre fotos claras; no se corrigió en este bloque.

**Trabajo en curso:** ninguno pendiente de este incremento. Código publicado y recepción en emulador comprobada; revisión física de esta nueva versión por Oliver aún no observada.

**Próxima acción exacta:** siguiente bloque pequeño del comprador: corregir contraste de barra de estado sobre galería clara en ficha oscura (`apps/mobile/src/app/product/[id].tsx` y gestión compartida deStatusBar), conservando retornoHome y configuración nativa. Reproducir primero con DJI/SHEGLAM claro/oscuro/OS1,6; capturar antes/después, tipos/lint/pruebas focalizadas, auditor y publicación preview/APK5 con guard. No afirmar que este fallo ya se resolvió. Catálogo paralelo continúa con SKU/tono/composición/permisos de originales ya obtenidos (seis SHEGLAM pendientes, polvo rechazado,0mappings/0permisos), sin repetir investigación/descargas. No hay código móvil pendiente de publicar; no republicar idéntico código ni pedir otra confirmación rutinaria. Sin APK/config nativa/backend/finanzas/iOS.


## Autorización vigente — publicar cada avance validado

Oliver instruye: **«No esperes confirmación, actualiza todos los avances para ir viendo en la aplicación directamente»**. Publicación progresiva autorizada en Android **preview**, compatible con APK 5, después de pruebas/revisión/guard de runtime y con comprobación de recepción. No volver a solicitar aprobación rutinaria de diseño o publicación para cada bloque del alcance comprador/catálogo. Mantener commits, push y continuidad; no generar APK ni modificar configuración nativa, finanzas o servicios remotos por este permiso.

Comprobación anterior a este incremento: EAS39972699874 continuaba Success y `git diff aa9510a HEAD -- apps/mobile packages` entonces estaba vacío. En aquel momento todo el código estaba en la OTA física confirmada; los commits posteriores hasta el incremento Inicio sólo incorporaban pruebas/evidencia/documentación. No se publica idéntico código como un avance nuevo. Los originales oficiales locales aún no cumplen correspondencia/permiso para incorporarlos al lote distribuible: la autorización de publicación de Oliver ya está resuelta, esas condiciones del material siguen pendientes.

## Compra publicada — recepción confirmada en emulador y Samsung

Oliver indica que no ve los cambios en el teléfono y valora positivamente el acabado profesional de productos. Se continúa la autorización de entrega progresiva en su APK 5: publicar únicamente las mejoras funcionales ya revisadas y probadas (36 casos locales, tipos/lint/web/Android Hermes), conservando las imágenes distribuibles existentes. No interpretar su valoración visual como permiso de redistribución del nuevo packshot oficial.

EAS `39972699874` terminó Success, fuente `aa9510a`: proyecto, perfil preview, Firebase, guard exacto `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`, publicación y resultado aprobados. Recepción real en emulador Android 15/revisión 42/run `39973330513`, fuente `b945400`: **2/2 claro/oscuro sin reintentos**, flujo `11-compra-revisada`. Ficha/compartir/copiar, conservar/Atrás/quitar producto, acceso desde carrito/pago y regreso. Ambos diagnósticos muestran OTA **`01a1693d-60d9-7183-a309-92769e4ea219`**, publicada 23oct14:49UTC (10:49Caracas), preview/runtime exactos, Marketplace responde y sesión cifrada. Auditor independiente examinó14capturas de flujos: APROBADO, sin P1/P2 del recorrido. Checkout autenticado/métodos siguen probados localmente, no en este emulador visitante.

Evidencia [COMPRA_ANDROID_2026-10-23.json](COMPRA_ANDROID_2026-10-23.json),14JPG nativos sin edición en `capturas/calidad-2026-10-23/android/`, hashes idénticos al origen inmutable `ci/capturas@9c64c933f3d3dae70d84a3c07136ff6769844e0f`. Captura inicial de instalación con ANR del Pixel Launcher excluida de evidencia aceptada; no fue cierre de la app y los flujos posteriores no tienen ese diálogo. Los logs Actions no son descargables por la política cloud; ID leído de diagnósticos originales, sin inventar grupo EAS ni fecha exacta con segundos.

**Recepción física confirmada por evidencia del propietario:** Oliver envió fotografía de su diagnóstico. Samsung/API36, canal preview, runtime exacto APK5 y OTA `01a1693d-60d9-7183-a309-92769e4ea219`, publicada23oct14:49UTC, Marketplace responde1266ms, sesión cifrada y cuenta con sesión. No se almacena esa foto personal en Git público. Esto acredita la versión ejecutada en su teléfono; no equivale a prueba física completa del checkout o aprobación visual del recorrido. Se informó a Oliver: la OTA cambia carrito/checkout/ficha pero conserva las fotografías anteriores; los packshots nuevos siguen locales. No otra publicación, reinstalación, borrado ni diagnóstico repetido de recepción.

**Catálogo: primer bloque de39restantes cerrado.** `catalog_art` preparó siete originales UGREEN para seis referencias, siete originales SHEGLAM descargados e inspeccionados (CDN200 confirmado),25genéricos con identidad faltante y cuatro imágenes DJI existentes inspeccionadas. `catalog_review` revisó originales UGREEN/datos en dos rondas: referencias locales/metadatos únicamente;0mappings/0permisos/0nuevas imágenes enapp.55SKUdemo+1vacío en56variantes de39UUID, comprobación administrativa acotadaREADONLY sin valores privados ni cambios. No repetir investigación/descargas hechas. Fuentes/metadatos sanitizados y siguiente bloque en [catalogo-exhibicion/AMPLIACION_2026-10-23.md](catalogo-exhibicion/AMPLIACION_2026-10-23.md); originales solo ignorados `.local/arte-20261023/catalogo-restante`.

**Continuidad del catálogo:** el CDN SHEGLAM ya funciona; no repetir aplicación del borrador ni las descargas. Obtener/confirmar modelo/tono y base de redistribución de las referencias del paquete. No asignar65958como variante25208 ni90314al25845; no repetir retoques de fotos amateur. Luego integrar lote autorizado mediante infraestructura existente, comparar en app, probar y publicar preview/APK5 sin otra confirmación rutinaria. La pregunta anterior fotos/carrito-checkout/diseño general queda como orientación opcional: no frenar trabajo autorizado esperando respuesta. No diagnosticar otra vez recepción ni republicar código idéntico.

## Base del incremento — calidad de la app real antes de publicar

El siguiente registro describe las pruebas y el cierre de código previos a la OTA. Su publicación y recepción posteriores constan arriba; no volver a tratar este incremento como pendiente de publicar.

Base `b1e79a1`, sincronizada. Auditoría Product Design sobre capturas nuevas claro/oscuro y revisión independiente. Primer bloque: pago distingue sesión/carga/pedido sin acceso, recupera métodos fallidos; confirmaciones sensibles bloquean cierre durante solicitud; compartir producto usa enlace real y copia recuperable.10/10 pruebas nuevas finales,2/2 compartir tienda, tipos/lint móvil aprobados. Cuatro pruebas rojas previas reproducen fallos de la versión anterior. Se liberaron reservas de fixtures locales propias y se añadió limpieza automática; sin cambiar stock manualmente ni datos remotos.

**Bloque2 implementado:** carrito compacto/grupos reales/retirada confirmada con rollback; checkout envíos resumidos con hoja de opciones, producto/variante/cantidad, bloqueo de ediciones durante creación y error de refresco que impide confirmar; ficha galería cuadrada/skeleton coherente y encargo sin promesa universal. Altura real de barras adapta scroll; Escape web durante apertura corregido.22/22 finales, tipos/lint/web.26capturas antes/después y medidas en `docs/capturas/calidad-2026-10-23/`.

**Imágenes — corrección del propietario:** descarta fuentes amateur/documentales y sus retoques, aunque sean licenciadas. No integrar recorteUGREEN/AnkerAI. Agentes obtuvieron dos packshots oficialesSKU50706, solo referencia local mientras se aclara redistribución; no alterar modelo de otros productos para encajar fotos. Antecedente: esos dominios estaban en borrador; comprobación posterior acotada Samsung403/Anker404/StarTech403 y CDN SHEGLAM200. No inferir que toda la red esté lista ni repetir reintentos. No Canvas/Canva disponible, ImageGen sí utilizado y derivados rechazados.

**Cierre:** auditor ronda2 APROBADO para incremento local, P1/P2 resueltos. Android/Hermes final exportado (HBC5,9MB, fuente funcional130d041, incluye singular), sin emulador/teléfono o guard exactoAPK5 nuevos. Buscar singular probado2/2; enlace de tienda3er caso adicional; cobertura consolidada36casos únicos, sin inflar repeticiones. Comparación fotográfica4grupos/18PNG web reales aceptados tras rechazar capturas durante transición. Un packshot oficial en referencia local, cero oficiales nuevos en paquete distribuible verificado por hash. Evidencia `calidad-marketplace-2026-10-23.json`.

**Continuidad fotográfica actual:** consultar el paquete y la revisión independiente en `catalogo-exhibicion/AMPLIACION_2026-10-23.md`. Siete originales SHEGLAM ya descargados/revisados; falta identidad exacta/tono/composición y permiso de uso. No repetir descargas, retoques amateur ni infraestructura. El incremento de Inicio publicado y su recepción están registrados al comienzo de este documento; no volver a tratar la compra anterior como pendiente de publicar. BCV y Mi tienda quedan separados.

## Antecedente — V4 comprador, revisión de Oliver

Esta propuesta es un antecedente de diseño. La autorización posterior de mejora general ya produjo el incremento sobre la app real descrito arriba, publicado el 23 de octubre. No volver a tratar todo el trabajo de compra como un prototipo sin integrar ni repetir su implementación.

Oliver rechazó ambas propuestas V3 por acabado y composición; aportó referencia de catálogo/ficha/carrito. No implementarlas ni tratarlas como aprobadas. Se conserva su fuente histórica. Nuevo incremento `docs/experiencia-v4/`: una dirección Electric Violet, comprador únicamente, prototipo aislado sin API.

**Resultado:** Inicio/Buscar/ficha/carrito/favoritos/checkout/pago/seguimiento conectados. Buscar reúne categoría/contador/filtro/orden en una barra; primer producto a131px. Carrito integra fotografía/variante/precio/cantidad por tienda; primera fotografía a163,39px frente302,50 deV3A y277,16 deV3B. Fotografías88×104 en412px frente64×72; dos completas y resumen a la vista. Entrega y revisión fusionadas; ambos envíos4+4 y productos51=total59 antesdecrear. Compromiso junto al botón, pago después. Referencia/comprobante y en verificación separados de confirmado. Datos y aritmética del prototipo son ficticios; no reutilizarlos como regla financiera.

**Evidencia:**36capturas originales412/320 claro/oscuro y6V3 recién capturadas; comparison.html/README.md/evidence.json/design-qa.md. FuenteV3 del repo, no sitioWork: acceso al enlace devolvióCONNECT403. Ocho grupos de verificaciones aprobados conPlaywright/Chromium local; ceroerroresJS/redexterna/desbordamiento documentomain en casos ejecutados. HTML único `.local/diseno-v4/HAYAZGO-comprar.html` (~1,77MB), imágenes/fuentes/iconos/licencias integrados, recorrido probado con red offline después de cargaHTTP local. file:// denegado por política del navegador gestionado, no probado en Samsung ni publicado enSites.

**Revisión independiente:** release_auditor examinó capturas y comparaciones; exigió títulos13px en320, encuadre completo lectorUGREEN y eliminar snackbar redundante de resultado. Corregidos y revisados de nuevo; dictamen LISTA PARA REVISIÓN DE OLIVER, sin nuevas objeciones de este incremento. No equivale a aprobación comercial final. Product Design index/audit/get-context/user-context/image-to-code consultados; preflight sin contexto guardado; límites del recurso compartido no resuelto documentados. No ImageGen/Figma o investigación fingida.

**Límites:** fotos autorizadas documentales, no estudio; cuotas/anticipos elegibles, variantes múltiples/encargo/agotado, sesión/errores remotos y fuenteOS/TalkBack requieren variantes y validación antes de implementación nativa. No vendedor, appExpo, backend/SQL/precios/tasas o pagos modificados. Sin OTA/APK/iOS/production. C del APK permanece. No republicar por aprobación del auditor.

**Próxima acción exacta:** Oliver revisa V4 (HTML descargable y comparación). Si acepta la dirección, completar variantes comerciales de checkout con contratos actuales y proponer el primer incremento nativo; si rechaza, corregir la pantalla/composición señalada. No empezar integración en la app ni publicar automáticamente. Reproducir: activar `/workspace/.onboarding/env.sh`, servir raíz del repo en8098 con `tests/app-e2e/serve.mjs`, ejecutar `node docs/experiencia-v4/verify.cjs` y `python3 docs/experiencia-v4/build-download.py`. No rehacer diagnósticos BCV/vendedor/fotografías cerrados.

## Entrega visual — cinco modelos, seis fotografías autorizadas

Se reemplazaron las referencias UGREEN sin permiso por fotografías reales de Wikimedia Commons con licencias CC BY, CC BY-SA o CC0: Samsung EP-T4510 (dos fotografías), Anker PowerCore 10.000, UGREEN lector SD USB-A/USB-C, StarTech ST7300U3M y UGREEN cargador de carro 25845. Archivos integrados en `apps/mobile/assets/catalog-exhibition`, registro Metro y créditos visibles en las fichas. Procedencia, licencia y hashes en `catalogo-exhibicion/lote-02-autorizado.json`. Ningún packshot oficial sin permiso fue distribuido.

Cinco UUID demo actualizados en títulos, marca, descripción y variantes para corresponder a las fotografías. Transacción remota guardada; precios, existencias y actividad idénticos antes/después, `is_demo=true`. Sin cambios en tienda, funciones financieras, esquema o dependencias. La presentación privada prioriza fotos en Inicio C, muestra únicamente fotos autorizadas en sus galerías y oculta badges Demo repetidos, conservando el aviso de pruebas. Otros productos fuera de estos cinco mantienen sus recursos anteriores.

Validación: preparador 3/3, recursos 4/4, typecheck/lint móvil y exportaciones web/Android Hermes aprobadas, seis WebP incluidos. Playwright 2/2 claro/oscuro para Inicio C, resultados reales de Buscar, cinco fichas y créditos. Publicación **Android preview** aprobada por EAS run38642215601, fuente `69f1c45`, grupo `72ffe95f-d27a-481a-889c-9de9a4c1305c`, 2026-10-14 21:43 UTC. Guard runtime APK5 exacto: `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`. Sin APK nuevo, production o iOS.

**Recepción real confirmada:** revisión41/run38642731907 Success, 2/2 claro/oscuro sin reintentos. Diagnóstico al reabrir y capturas finales coinciden: OTA `01a13c5e-f303-7822-acda-7ce771cf4db2`, preview, runtime APK5 exacto, backend Marketplace responde. Revisión visual de 24 capturas nativas: Inicio C, Buscar para cada modelo, cinco fichas y recepción en ambos temas. Fotos, colores, créditos y aviso de pruebas visibles; sin badges Demo repetitivos. Evidencia `catalogo-exhibicion/entrega-android-2026-10-14.json`, origen inmutable ci/capturas `8497754a36dc72b85bef86adeb915ba564f91a63`; cuatro capturas representativas versionadas.

**Trabajo en curso:** ninguno en esta entrega. **Próxima acción:** Oliver abre APK5 conectado, espera la descarga y vuelve a cerrar/abrir para recibir las fotografías en Samsung. Recepción física aún no observada; no repetir publicación/auditoría general ni modificar BCV o Mi tienda.

## BCV/VES — DESPLEGADO Y VERIFICADO (2026-10-14,16:48 Venezuela)

**Criterio de éxito cumplido en servidor:** `create_payment_quote` por PostgREST conJWT comprador devuelveHTTP200 para Pago Móvil y transferencia. Base25USD →21.947,50Bs; tasa877,90, fuente`dolarapi_oficial`, Fecha Valor14oct00:00Caracas, respaldo explícito/no manual. Evidencia `BCV_VES_DESPLIEGUE_2026-10-14.json`; informe `BCV_VES_CORRECCION.md`.

Oliver autorizó explícitamente desplegar BCV/VES en Marketplace sin cobros. Fuente`2a7265e`; migración20261014202228 aplicadaHTTP201, `rates-sync`/`panel-api` ACTIVE/v2 conJWT false/true conservados. No otra migración, tienda, precios/redondeo/fórmulas/stock, APK u OTA. Mi tienda sigue activada; no volver a tocarla.

Causa corregida: `current_rate` vencía por horas corridas la Fecha Valor del viernes en fines de semana/feriados. Ahora usa calendario bancario2026 verificado y fecha efectiva Caracas; guarda próxima Fecha Valor sin usarla antes de vigencia, excluye snapshots futuros y rechaza fechas inventadas. TLS seguro conservado; BCV directo sigueUnknownIssuer, respaldo vigente funciona. Cloud necesita www.bcv.org.ve/bcv.org.ve yve.dolarapi.com para pruebas directas; no se reintentaron conexiones bloqueadas.

Validación:20/20 BCV,46/46 pagos/precios/permisos/BCV sobre paquete exacto,52/52 core,18/18 funciones,12/12 E2E,6/6 guardas/reintento, typecheck/lint. Reversión SQL ejecutada en clon con21/21 pagos/precios aprobados; mantiene exclusión de futuro y no borra datos. Suite amplia113/114: único fallo de búsqueda también ocurre con funciones originales; investigación detenida, fuera de este bloque.

Prueba remota real: comprador/pedido demo temporales y obligación25USD, sin productos ni fulfillment. Ambas cotizaciones200, estadoopen, importe correcto; saldo pagado0,0pagos/ledger. Todas las fixtures limpiadas y confirmado0usuarios/pedidos/cotizaciones/pagos. No se invocaron cobros ni revisión. No atribuir esta prueba a Android físico.

**Próxima acción:** Oliver abre un pedido pendiente, vuelve a seleccionar Pago Móvil/transferencia y solicita monto nuevo. No requiere actualización móvil. No repetir despliegue/auditoría general ni investigación de búsqueda. Antes de terminar2026 cargar calendario bancario2027 verificado; fecha desconocida falla de forma segura. Otros pendientes solo dentro de sus autorizaciones/condiciones existentes; cinco fotografías siguen evaluación local sin permiso de distribución.

## Dónde está el trabajo

| Dato | Valor |
|---|---|
| Repositorio | https://github.com/somosoudy-design/marketplace (público: nunca subir secretos) |
| Rama compartida | `claude/marketplace-v1` (todos los agentes trabajan aquí; ver `AGENTS.md`) |
| PR | #1 en borrador hacia `main` (`main` solo tiene el README inicial; no fusionar sin Oliver) |
| Última publicación | Compra funcional `130d041`, solicitud `aa9510a`; EAS `39972699874` Success. OTA `01a1693d-60d9-7183-a309-92769e4ea219` recibida en Android15/run39973330513,2/2 |
| Plan vigente | Inicio C conservado; mejoras de compra implementadas en la app real y publicadas; fotografías oficiales nuevas solo locales |
| Objetivo actual | Ampliar catálogo fotográfico profesional por lotes; Oliver revisa visualmente compra ya recibida en Samsung |
| Panel publicado | **https://kora-panel.expo.app** (EAS Hosting; cuentas reales del proyecto de pruebas, no las demo locales) |
| Respaldo extra | `/mnt/project-files/marketplace` (copia del repo y bundle; solo existe en el proyecto de Claude) |

## Última entrega funcional cerrada — Mi tienda ACTIVADA

Oliver autorizó explícitamente **«SIII»** a las dos migraciones y pruebas controladas. Paquete exacto SHA2567bebd4d2a99bda38a2b71f700a6f6cb0022f7f074ea4781de7d45aebc7c23ebd ejecutado UNA vez vía Management API en Marketplace; HTTP201, catalog_supported/orders_supported=true. Ambas versiones registradas:20261011172600/20261011174200; total esperado28. No reejecutar migración ni pedir aprobación otra vez.

**Operación comprobada:** 12/12 casos SQL remotos con fixtures UUID nuevas: creación y reintento sin duplicados; edición/stock/pausa; fallo atómico sin edición parcial; perfil de tienda propio/ajeno; aislamiento vendedor y catálogo privado; admin real/revisión preservada; detalle por tienda/id; bloqueo sin pago; preparación/despacho/guía/historial/duplicados/estados admin/saldo; comprador y visitante denegados. Las escrituras/lecturas se verificaron dentro de una transacción revertida. No se comprometieron cambios de productos/pedidos reales ni se realizaron/revisaron pagos; secuencias pueden dejar huecos, sin filas de fixture persistentes.

Cuatro RPC existentes en servidor, editor INVOKER/detalle DEFINER, anon sin EXECUTE y authenticated/service_role habilitados. REST readiness pasó de404 a401/42501 para anon, según grants. Otra conexión confirmó mismos conteos originales (44productos,63variantes,104imágenes,5tiendas,31pedidos,35entregas,6pagos) y hashes de advance_fulfillment/set_product_costs intactos. Evidencia sanitizada `docs/mi-tienda-activacion-2026-10-14.json`. Auditor independiente APROBADO tras exigir asserts NULL-safe y12 resultados explícitos; corregidos antes de ejecutar.

**Android:** no OTA necesaria. Pantallas publicadas consultan readiness con staleTime0/refetchOnMount always; Oliver debe volver a entrar Cuenta→Mi tienda. Backend verificado; sesión/formularios/guardado confirmado en Samsung físico aún por comprobar. No atribuir estas pruebas SQL a Android nativo.

**Próxima acción exacta:** aplicar el borrador guardado de configuración del entorno Codex que añade `bcv.org.ve`, `www.bcv.org.ve`, `crt.sh` conservando lo existente. Requiere revisión/publicación en la configuración del entorno; no es una publicación de la app ni cambio Supabase. El acceso cloud recibió CONNECT403 antes de TLS: distinto del UnknownIssuer observado en Edge. Tras disponer del sitio, verificar cadena/CA real sin desactivar validación, preparar corrección TLS y separación publicación/observación/Fecha Valor, probar vigencia/futuro/fines de semana/Caracas. Presentar diff exacto antes del despliegue financiero y pedir autorización específica; no heredar permiso de Mi tienda. PostgreSQL local existente arrancado sin reset/seed/migraciones para pruebas posteriores. No se ha modificado código financiero ni afirmado solución TLS.

**Catálogo: resultado local adicional cerrado.** Cinco PNG oficiales candidatos obtenidos por Codex, integrados temporalmente mediante registro existente; dos exports WEB solo loopback y44 capturas comparables InicioC/Buscar/resultados/cinco fichas claro/oscuro412/320, regreso conservaUGREEN. Auditor independiente APROBADO para evaluación local tras recapturar320 esperando resultados reales. Recursos principales coherentes entre tarjetas/ficha; resto de galerías originales. Datos/variantes/modelos no se retocaron para aparentar correspondencia (65W/30W gris vs Blanco, cable pack2, power100W/hub206 candidatos). Directorio ignorado `.local/catalog-exhibition/evaluacion-cinco-20261014/`, comparación autocontenida `comparacion.html`; procedencia y límites en `CATALOGO_EXHIBICION.md` y JSON sin imágenes. Registro compartido restaurado vacío; cero imágenes en Git/OTA. Permiso de redistribución y correspondencia comercial aún pendientes; no prueba Android ni cinco fotografías de cámara verificadas. No devolver búsqueda al propietario. iOS pospuesto, sin APK o cambios de InicioC.

## Histórico CAT-EXH-01 — parada bajo instrucción anterior

Oliver autorizó una primera entrega **de cinco** fotografías, empezando UGREEN, y publicación Android preview condicional a derechos/pruebas/runtime APK5. Investigación acotada realizada con dos agentes reales de lectura, raíz único escritor. Supabase no se volvió a diagnosticar. Siete fichas oficiales/JSON comprobados HTTP200 para cinco productos, pero **0/5 correspondencias catálogo–SKU y 0/5 licencias OTA/repo aprobadas**. Los términos US §5.2 permiten uso personal/no transferible y prohíben redistribución; no se descargó/integró material sin autorización. Auditor independiente verificó fuente y emitió **RECHAZADO/BLOQUEADO para el lote**, sin objeciones a parar.

**Entrega concreta:** `docs/catalogo-exhibicion/CINCO_FOTOS_DESDE_PC.md`, tabla de cinco productos, candidatos/SKU, variantes por confirmar y UUID/ruta conservados; evidencia `referencias-ugreen-cinco.json`. Originales propios o autorizados + SKU/modelo/color/enchufe/largo/puertos permiten desbloquearlo. No asumir que 65W es10334, powerbank100W/130W, cablepack2, hub206/Pro106 o30WUKBlanco por título/parecido. Los candidatos no se escribieron como mappings del catálogo.

**Resultado real:** 0 fotos integradas; registro vacío y capa desactivada, misma OTA C. Sin cambios de app/infraestructura, backend/datos/migraciones, finanzas o dependencias. Sin comparaciones nuevas Inicio/Buscar/ficha, exportación o recepción Android del lote; no reutilizar capturas anteriores como prueba. Product Design index/audit consultados, no auditoría visual ejecutada sin material utilizable.

**Próxima acción exacta:** recibir cinco originales del paquete documentado y su permiso/SKU, revisar material y completar únicamente sus entradas en lote-01.json. Ajustar mínimo del preparador de12–15 a5 como adaptación puntual al alcance, sin reconstruirlo; generar assets/registro con la infraestructura existente. Comparar InicioC/Buscar/ficha claros/oscuros, mantener aviso Entorno de pruebas e is_demo/guardas. Verificar runtime APK5 y publicar **solo Android preview**, ya autorizado si cumple las condiciones; comprobar recepción real en emulador. No pedir nueva autorización OTA rutinaria para estas cinco ni publicar antes de material aprobado. Si continúan sin originales utilizables, esperar al propietario en vez de otra investigación general.

## Último bloque cerrado — Supabase conectado y diagnosticado, sin activación

**Conexión recuperada:** token personal ya vinculado al gestor seguro, disponible en el entorno y usado solo en memoria hacia Management API. GET confirma **Marketplace / mimnotafmfasvwrclxan / ACTIVE_HEALTHY**. Las referencias anteriores a 401/token ausente están resueltas; no volver a pedir credenciales. Ejecutamos en Linux cloud, sin acceso a la PC física; CLI instalada, sin necesidad de link, service_role o contraseña DB. No se consultó el otro proyecto.

**Diagnóstico remoto desde las 14:44, Venezuela:** 26 migraciones aplicadas de 28 locales; **20261011172600_seller_product_editor y 20261011174200_seller_fulfillment_detail ausentes**, igual que seller_save_product/seller_editor_ready/seller_fulfillment_detail/seller_orders_ready en pg_proc. Ya no es una hipótesis de caché; no repetir la implementación móvil. Paquete exacto de activación existente todavía NO ejecutado.

**BCV crítica:** cron rates activo, otras tres fuentes ok, BCV directo falla **invalid peer certificate: UnknownIssuer** en las tres respuestas más recientes; 12 respuestas muestran fallo por certificado. 0 filas de BCV directo y 0 tasas futuras. A las 14:48, USD/VES 877,90 desde DolarAPI de respaldo, USDT/VES 1.012,00 y USD/USDT 1,0011. Snapshot 3 válido hasta 15oct 07:40 Venezuela; políticas y hashes financieros comprobados. No cambiar cifras, cálculos o vigencia en este diagnóstico.

**Servicios/permisos:** 7 cron activos, todos con succeeded en 24 horas; HTTP 200 no equivale a todas las fuentes sanas. Cuatro Edge ACTIVE/v1, incluida assets-mirror. 5 buckets, RLS activo y 21 políticas con hashes iguales al stack local. La política con nombre catalog **sí cubre stores** y controla tienda/carpeta; sospecha de ausencia de permiso descartada. Upload autenticado y aislamiento/persistencia remotos no se probaron. 44 productos/43 demo/1 no demo; 104 filas de imágenes, 100 rutas demo/4 otras, sin certificar derechos. PayPal/Binance Pay desactivados; métodos manuales habilitados.

**Evidencia/validación:** informe `docs/DIAGNOSTICO_SUPABASE_2026-10-14.md` y JSON sanitizado. READ ONLY real confirmado (`supabase_read_only_user`, transaction_read_only:on); SQL inicial base validado localmente; scripts finales completos ejecutados contra remoto con READ ONLY, incluidos cron/net. PostgreSQL local no estaba disponible al intentar repetir la versión final; no se reinició/resetó el stack. Un RPC SQL fue denegado al rol readonly; anon REST funciona, no se ampliaron grants. Scripts de diagnóstico ajustados para esa limitación y extracción segura de errores BCV. Sin escrituras de negocio, migraciones, compras, pagos, uploads, APK ni EAS. No repetir suites generales.

**Publicación solicitada después:** este bloque no produjo cambios móviles visibles; no se hizo una OTA de documentación ni se activó backend como efecto implícito. APK5 recibe Android preview, no production. Última OTA C permanece 01a13354-e5fd-70f0-90bc-feec7f425a03.

**Próxima tarea exacta:** revisar el informe con Oliver; comenzar por investigar cadena TLS/confianza del runtime y preparar localmente corrección mínima BCV con casos de Fecha Valor/hoy/mañana/Caracas/stale. Presentar el cambio antes de desplegar. Después autorizar y aplicar exclusivamente las dos migraciones de vendedor ya ensayadas, con sus guards y revisión de moderación; no db push general/seed. Este diagnóstico no autoriza cambios remotos, pagos o publicación fotográfica sin derechos.

## Último bloque cerrado — preparación de catálogo; fotografías pendientes

**Preparación cerrada (checkpoints `9ccc6e3`, `4225185`; cierre `40d37ea`):** 15 productos y fichas identificados por lecturas públicas sin admin. UUID/ruta originales, variantes y galerías verificadas; modelos oficiales no identificados todavía. Capa privada por ID/ruta y fallback normal, desactivada por defecto; registro vacío. `is_demo`, precios, disponibilidad, moderación y guardas comerciales intactos. Guard de promoción cruza árbol/registro/manifiesto del commit inmutable antes de APIs.

**Validación:** política4/4, selección/promoción9/9, tipos/lint global aprobados. UI existente Inicio/ficha23/23 + presentación final habitual8/8/privada8/8 =39 focalizadas, sin reintentos. Capturas prematuras rechazadas por auditor y recapturadas con query/fuentes/imágenes estabilizadas; 14 privadas finales revisadas, 12 comparables PNG originales versionadas. Auditor **APROBADO infraestructura**, no lote. Web habitual restaurada; Hermes Android5,9MB con perfil preview/backend Marketplace, 41 recursos de dependencias y0fotosexhibición. Native/runtimeexacto no verificado; no OTA ni APK.

**Bloqueo actualizado el 14 de octubre:** UGREEN responde HTTP 200, a diferencia del CONNECT403 de la sesión anterior. No se volvieron a comprobar todos los otros fabricantes/CDN/Wikimedia; no asumir que siguen bloqueados ni que ya están accesibles. Siguen faltando modelos exactos, fotografías originales y permisos de distribución. **0 fotografías obtenidas/0 licencias/0 modelos confirmados: la entrega fotográfica NO está terminada.** Informe `docs/CATALOGO_EXHIBICION.md`, selección `docs/catalogo-exhibicion/lote-01.json`, evidencia/inventario en el mismo directorio. Solo raíz escribió; catálogo/artdirección y auditor trabajaron de lectura. WIP anteriores cierran únicamente preparación; no revertir ni repetir C.

**Próxima acción fotográfica vigente:** la instrucción posterior de Oliver reduce el primer incremento a cinco. Seguir `docs/catalogo-exhibicion/CINCO_FOTOS_DESDE_PC.md` y el bloque superior; red UGREEN ya comprobada, no repetir diagnóstico o infraestructura. Autorización Android preview condicional recibida; originales/modelos/permisos todavía pendientes.

## Última entrega cerrada — C publicada; revisión física del propietario

**C cerrada:** Oliver eligió continuidad marca→búsqueda→editorial y después autorizó sustituir/publicar su portada. Una banda fullwidth sin tarjeta exterior integra la apertura; categorías puente y cuatro recomendaciones contiguas después. B queda histórica. Leyenda/Demo/SKU/precio/CTA y assets del catálogo reales conservados; no ImageGen en producción. Tipos/lint, UI31/31 finales y web/AndroidHermes5,9MB aprobados; código `ef44048`, cierre `1a37860`. WIP ef44048 supersedido por cierre; no código incompleto activo.

**Medidas y calidad:** banda normal web316/319px a412/320, primeras fotos421/424, dos completas. C original raster395,58px a412, diferencia79,58 (~20%); frente a app publicada anterior el catálogo adelanta solo8px, mejora principal estructural. CSS1,6 crece sin recortes pero no es OS. Cinco contrastes sólidos ≥6,88:1. Informe `docs/C_EDITORIAL_REFINADA.md`, comparación `docs/diseno-v2/c-refinada/comparacion.html`. Product Design audit/ideate/framework real; fuente seleccionada C y referencias existentes. Auditor/UX/ecommerce APROBADO ronda1 web/código y ronda2 nativa; sin objeciones C. Único escritor raíz.

**Publicación y recepción exactas:** EAS `ad41160` / run `38342356897` **Success**, guardAPK5 exacto aprobado03:35:15UTC; Android preview publicado2026-10-13 **03:36 UTC**. Android40 source `637d60e` / run `38342591484` **Success,4/4 sin reintentos**. Diagnóstico: **`01a13354-e5fd-70f0-90bc-feec7f425a03`**, preview, runtime `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`, backend Marketplace responde/sesión cifrada. Veintidós JPEG originales/hashes en `docs/capturas/c-editorial/android`; fuente inmutable `ci/capturas` SHA `9e99b968620a7ece34131e4f6a9bc978e63c0c39`.

**OS1,6 real:** leyenda y SKU fullwidth, precio/CTA completos, una columna e Inicio sin abreviar. Buscador persistente funcional; colección/categoría/ficha/regreso/favorito visitante/carrito/Buscar comprobados. Reloj claro sobre violeta y restaurado oscuro al salir a colección clara; no afirmar contraste perfecto de todas las fichas. Samsung físico/TalkBack/fluidez pendientes del propietario; no compras/pagos remotos ni telemetría persistida verificados.

**Próxima acción exacta:** Oliver revisa su Samsung y da nuevas instrucciones. No repetir implementación, pruebas generales o publicación. Si autoriza continuar, siguiente incremento de Inicio2B (descubrimiento finito/colecciones/Retoma/tiendas) conserva C; extensión a Buscar/ficha/carrito es posterior y no impone header violeta gigante. Observación ficha oscura/reloj blanco sobre foto clara documentada para su etapa, no modificar ahora. Sin iOS/APK/production/backend/finanzas/vendedor; BCV/SQL vendedor separados. No otra EAS automática.

## Hitos de la Directriz maestra 02

| Hito | Qué es | Estado |
|---|---|---|
| A | Instalar en el Android físico de Oliver | Hecho: APK 4 instalado en su Samsung (2026-10-09 ~20:40Z) |
| B | Catálogo remoto visible y acceso (registro con código) | Hecho: catálogo demo cargado; registro con código probado; registro sin confirmación para testers observado activo el 2026-10-09 22:40Z |
| C | Inicio nuevo e identidad Electric Violet | Hecho y publicado por EAS Update: Inicio de tienda, 20 pantallas revisadas en claro y oscuro, logos de tiendas, panel con la misma tipografía y marca. Identidad nativa violeta en APK 5; Frente A V2 publicado |
| D | Rediseño del recorrido comercial completo | En curso: selector de pago rediseñado y publicado. Ficha, carrito, checkout, cuotas y seguimiento revisados en web; carrito visitante validado V2 en Android. Checkout con cuenta/cuotas/seguimiento esperan revisión actual Android (`PENDIENTES.md` 1.3) |
| E | Validación integral | En curso: V2 visitante en APK 5, claro/oscuro, 6/6 (un reintento). Recorrido con cuenta anterior en revisión 20; no repetido en V2. Teléfono físico pendiente |

## Qué funciona hoy (verificado)

- **Mi tienda operativa (local + OTA APK 5, 2026-10-11):** perfil/fotos, catálogo y acciones de entrega con persistencia/
  permisos/errores/aislamiento reales; UI 42/42 + último pase operativo 20/20, DB 31/31, core 50/50, tipos/lint,
  web/Hermes y visual claro/oscuro. OTA `01a12c4b` publicada 18:48 UTC, Android visitante 2/2;
  dos migraciones remotas sin verificar. Paquete exclusivo probado 8/8 y permisos/persistencia 24/24 local.
  Fuente 5a3b884; informe: `docs/MI_TIENDA_OPERATIVA.md`. VEN-01A debajo es el antecedente publicado de lectura.

- **VEN-01A (local, 2026-10-11):** Mi tienda nativa desde Cuenta, roles/pertenencias reales, selector de
  tiendas, resumen, catálogo paginado, entregas recibidas y configuración solo consulta; panel avanzado
  conservado. Comprador/admin multirrol con pedidos compradores propios. UI 22/22, permisos 6/6,
  núcleo 50/50, tipos/lint, web/Android JS y revisión visual claro/oscuro aprobados. Publicado en preview,
  run 38156171005/fuente `2d00f96`; guard APK 5 aprobado. Android 15, revisión 35/run 38156560856:
  visitante **2/2**, ambos temas, sin reintentos; OTA `01a12bd4-1483-7096-b0c2-de39d35f4c15` de
  16:38 UTC comprobada. **Teléfono físico no conectado.** Detalle: `docs/VEN-01A.md`.
- Backend del proyecto de pruebas en Supabase, comprobado con el conector el 2026-10-09 22:00Z: 23 migraciones
  aplicadas (las mismas 23 de `supabase/migrations`), funciones `rates-sync` y `push-dispatch` activas (versión 1,
  con la validación del token de tareas), 6 trabajos de `pg_cron`, última tasa leída 21:30Z, 43 productos
  demo, 1 usuario (Oliver) y 2 pedidos de prueba.
- Histórico APK 4 en el teléfono de Oliver: canal `preview`, runtime `a4682c83…` (no recibe los updates de APK 5). La
  sesión cifrada en Android quedó corregida en la actualización del 2026-10-09 21:14Z: el emulador Android 15
  con el APK 4 dice «Sesión cifrada: sí» después de reabrir. En un teléfono real todavía no se ha comprobado.
- Últimas actualizaciones publicadas al APK 4 (todas con el runtime `a4682c83…`): sesión corregida, registro
  sin código cuando el proyecto lo permite, etiquetas legibles sobre fotos en oscuro, selector de pago nuevo.
- Tarjetas de producto simplificadas (pedido de Oliver del 2026-10-10 12:57Z, commit `1e3ca57`): solo imagen,
  nombre en una línea con puntos suspensivos y precio; descuento y «Quedan N» discretos arriba a la izquierda de la
  foto. Tienda, disponibilidad y entrega siguen en la ficha. Publicado al APK 5 por EAS Update (runtime sin cambios).
- Selección del método de pago más simple (pedido de Oliver del 2026-10-10 13:17Z): lista compacta con icono, nombre
  y selector (`RadioRow`, el mismo de las opciones de envío); al elegir un método se abre «Pagarás ≈ monto» con la
  conversión o el descuento, la comisión y la nota del método. Los límites siguen en la fila. Mismos cálculos de
  estimación que antes; el monto exacto sigue saliendo de la cotización del servidor. Publicado al APK 5.
- Ficha de producto más clara (pedido de Oliver del 2026-10-10 14:17Z, commit `e18f794`): un solo precio principal
  (con el anterior tachado si hay oferta); sin la píldora de Zelle/USDT ni la línea en bolívares, que se ven al
  elegir el método al pagar; sin «Disponible» fijo: solo se muestra el estado cuando no es el normal («Agotado» en
  una etiqueta sólida con el precio en gris; «Por encargo» o «En camino» con el plazo corto) o «Quedan N». El plazo
  y la fecha estimada pasaron a la fila «Entrega»; «Opiniones» vacía es una línea. Sin cambios de cálculos, carrito
  ni base de datos. Publicado al APK 5 por EAS Update.
- Tiendas: compartir e insignias (pedido de Oliver del 2026-10-10 14:36Z, commit `096828d`, detalle en
  `docs/INSIGNIAS_TIENDAS.md`). La página de cada tienda tiene «Compartir» con el enlace, el menú nativo y «Copiar
  enlace»; el enlace es `/tienda/<slug>` y, sin dominio propio todavía, en la app es `kora://tienda/<slug>` (abre esa
  tienda en la app instalada; sin la app no abre). Insignia reutilizable (`StoreBadge`): dorada para la tienda de la
  plataforma (`kind = 'platform'`, hoy solo «Kora»); la verificada (morada) y la asociada (gris) están diseñadas pero
  ninguna tienda las muestra porque no existe el dato. Se quitó «Vendedor verificado», que salía en todas las tiendas.
  Sin migraciones. Publicado al APK 5 por EAS Update.
- Foto de perfil (pedido de Oliver del 2026-10-10 15:09Z): en Cuenta, tocar la foto (o las iniciales) abre la
  galería con recorte cuadrado y compresión; se previsualiza y se guarda con «Usar esta foto» o se descarta con
  «Cancelar»; con foto, la hoja permite cambiarla o quitarla (vuelven las iniciales). Se guarda en un bucket privado
  nuevo `avatars` (3 MB, JPG/PNG/WebP), una carpeta por usuario; solo el dueño la lee, sube o borra, y el perfil solo
  puede apuntar a su carpeta (migración `20261010151906_avatars`, aplicada en el proyecto de pruebas y comprobada con
  roles simulados). `profiles.avatar_path` ya existía. `expo-image-picker` ya está en el APK 5: basta EAS Update.
  En el emulador Android 15 (revisión 30, run 38064708597), el APK 5 con la actualización `01a1266c` abre el
  selector de fotos de Android desde Cuenta y vuelve sin cambios al cerrarlo. Elegir y guardar una foto real en un
  teléfono queda para la prueba de Oliver.
- **Frente A V2 terminado** (2026-10-10): tarjetas integradas, cabecera con avisos/carrito reales,
  Favoritos en Cuenta/productos, barra Inicio · Buscar · Carrito · Cuenta expandible e Inicio refinado.
  App local 52 + 1 omisión, Android 15 APK 5 claro/oscuro 6/6 (un reintento), capturas comparativas y axe AA.
  EAS preview run 38079470216 y production run 38080468671 **Success**; mismo paquete validado/runtime APK 5.
  Production grupo `92b6bef2-56e7-4a3e-8012-40c030c48434`; inventario EAS: **0 builds production compatibles**.
  APK 5 recibe por preview. Detalle/pruebas/límites: `docs/FRENTE_A_V2.md`. Sin APK nuevo ni servicios alterados.
- UX-04 (HAYAZGO, Frente A, 2026-10-10): barra **Inicio · Buscar · Carrito · Cuenta**; catálogo existente
  `/explore` con encabezado Buscar; retirado el botón contiguo de filtros de Inicio que abría el mismo destino.
  Se conservan filtros, categorías, Favoritos y contexto. Pruebas locales y revisión visual claras/oscuras
  cerradas. Publicado al APK 5 por EAS Update desde `0a34aae`,
  [run 38072209661](https://github.com/somosoudy-design/marketplace/actions/runs/38072209661) en verde;
  guard de runtime `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba` superado antes de publicar. Falta revisión de Oliver.
- APK 5 (build `d1d10c28`, runtime `eb5ed117…`), en el emulador Android 15 de GitHub Actions el 2026-10-10 (revisión
  20, run 38027029394): se instala encima del APK 4, recibe EAS Update, «atrás» de Android vuelve a la pantalla
  anterior, y un aviso push real («Pedido P-… recibido») llega por `push-dispatch`, Expo y Firebase, y al tocarlo
  abre el pedido. Recibo de Expo «ok» (entregado a Firebase). Capturas en
  `/mnt/project-files/marketplace/telefono/capturas-apk5/`.
- Preparación iOS anterior (`264112b`): core 50/50 y comprador web 40/40; tipos/lint aprobados. Corrección actual: guardas/verificador 11/11, verificación nativa de archivos y tipos/lint aprobados. No equivale a probar el arranque en iPhone.

## Mejora de UI/UX (hecha el 2026-10-10)

Pedido de Oliver del 2026-10-10 01:30Z: perfeccionar la app sin rediseñarla ni cambiar la identidad, por hitos, con
commit y push al cerrar cada uno y publicación solo por EAS Update compatible con el APK 4 (un APK nuevo, solo con
su autorización). Restricciones: no tocar el motor de precios, ni iOS, ni Firebase, ni agregar funciones al panel,
ni borrar datos demo, ni hacer la interfaz más compacta.

| Hito | Qué | Estado |
|---|---|---|
| 1 | Navegación, Favoritos y accesos al panel | Hecho: cuatro pestañas con nombre (Inicio, Explorar, Carrito, Cuenta); Favoritos es una pantalla aparte que se abre con el corazón junto a la campana del Inicio y desde Cuenta; los accesos «Panel de vendedor» y «Administración» abren https://kora-panel.expo.app (la variable `EXPO_PUBLIC_PANEL_URL` no estaba en el perfil `preview`; va en `UPDATE_ONLY_ENV` del workflow de actualizaciones porque `eas.json` cambia la huella). Runtime sin cambios (`a4682c83…`). En el emulador (APK 4 con la actualización): Favoritos abre bien y el recorrido con cuenta pasó, pero «atrás» de Android cierra la app en vez de volver (desde Favoritos, la ficha o iniciar sesión). Causa nativa comprobada, no de esta mejora: ver «Errores conocidos». La flecha de Favoritos sí vuelve a Inicio |
| 2 | Fichas de producto y presentación comercial | Hecho en código y pruebas web (la píldora de divisas y la línea de bolívares salieron de la ficha el 2026-10-10 14:29Z, ver arriba): marca sobre el título; precio principal con descuento si hay precio anterior; precio especial con Zelle/USDT como píldora verde; bolívares en una línea discreta que abre «Precios y tasa de cambio» (ahora explica el precio en divisas); nota de demostración compacta; cada opción con su precio cuando difieren; tarjeta «Vendido por» con reputación; «Características» y descripción larga plegada; barra con «Agregar» y «Comprar» (agrega y abre el carrito, sin duplicar si ya se agregó). Fórmulas sin tocar |
| 3 | Opiniones y calificaciones más visibles (sin reconstruir el sistema) | Hecho y publicado al APK 4 (actualización de `45f62a0`): la sección «Opiniones» siempre está en la ficha (con «Aún no hay opiniones de este producto» cuando no hay) y dice quién puede opinar; «Calificar tu compra» en la ficha para quien recibió ese producto y no lo calificó; arriba del pedido entregado, «¿Qué tal te llegó?» con «Calificar»; «Compra verificada» con ícono y la respuesta de la tienda en un bloque con su nombre. Sin cambios en la base de datos (consulta nueva `reviews.deliveredItems` con las reglas de acceso existentes) |
| 4 | Preguntas y respuestas | Evaluado, sin implementar en la app: responder exige una pantalla nueva de vendedor, y Oliver pidió no agregar funciones al panel ni botones que no funcionen. Diseño listo y la decisión que falta en `docs/PREGUNTAS_Y_RESPUESTAS.md` |
| 5 | Pulido visual y validación en Android; informe de 7 puntos a Oliver | Hecho en parte: el cambio de bolívares a divisas pesa menos (píldora «con Zelle/USDT», línea de bolívares discreta, «Cómo calculamos los montos» y «Ver cálculo» al pagar, tiempo del monto con unidades), publicado con el hito 3. Emulador (revisión 15): recorrido con cuenta, ficha, Favoritos y flecha de Favoritos bien. Informe enviado a Oliver |

## Antecedentes de implementación (cerrados)

**Entrega 01 — terminada, publicada y verificada en emulador, 2026-10-12.** Buscar compacto: buscador/herramientas fijos, categoría en conteo mantiene contexto al desplazar; categorías subrayadas sin cápsulas, Filtrar/Ordenar agrupados; hoja precio/disponibilidad con borrador, aplicar/cancelar/reset y contratos existentes. Tarjetas compartidas radio10/foto4:5/precio16/nombre1línea; corazón19/superficie28/táctil44 sin sombra/círculo oscuro; estados no normales visibles y demo honesto. Mini/skeleton/fade reducido coherentes.

**29/29 pruebas focalizadas sobre fuente actual**, claro/oscuro/320, teclado/reduced motion, borradores/RPC/contextos/regreso/scroll/favoritos reales locales, estados controlados y skeleton sin salto. Tipos/lint mobile aprobados. Capturas antes16 +4scroll recapturadas desde snapshot baeb39d tras rechazo de4 tomas; 20 capturas después/10 extras, Hermes final y axe0 infracciones/0 incompletas en8 vistas aprobados. Pruebas anteriores fallaron por teclado, selector amplio, race de debounce y reinicios paralelos del stack local; corregidos/concentrados en un único proceso, no reset ni datos remotos. EASpreview38297286778 Success, fuentece9b960/móvil d945797; guard APK5 aprobado, publicado2026-10-12 19:24:48UTC. Android38/run38297634332 Success, fuente8fe9731;07 ambos temas **2/2 sin reintentos**,14 capturas nativas revisadas y OTA `01a13193-1f3f-7f61-8fc6-90f2fa12e20d` de19:24UTC recibida, preview/runtime APK5/backend responde/sesión cifrada. No recepción en S24 afirmada; Oliver debe revisar diseño y TalkBack/fuentes/fluidez. No Entrega02.

**Cierre técnico del antecedente global:** EAS 38291282048 Success, APK 5 preview. Android revisión37/run38292016113: 4/6 recorridos pasaron; 06-global-ux falla en ambos temas porque el enlace `kora://explore` deja Inicio (captura real), antes de probar los filtros. No afirmar 6/6. La nueva prueba entrará por la pestaña real Buscar. Recepción física confirmada por Oliver; evaluación visual negativa origina esta entrega.


**Antecedente 2026-10-12 · UX global publicada; Oliver solicita rediseño visual significativo.**
Base edae062; fuente c17f22f. Recuperación de catálogo/contextos, targets 44 px, CTA adaptable/con texto
al cargar, foco/campos/errores, hojas/galería accesibles, grupos Cuenta/filas y reflujo de precio-cantidad.
Regresión consolidada 115 aprobadas + 1 omisión conocida; últimos pases 40/40 y 34/34 sobre afectados,
núcleo 50/50, tipos/lint/web/Android Hermes aprobados. axe 0 infracciones en 16 vistas, contraste 22/22
mínimo 4.78; 58 capturas antes + 58 después revisadas, imágenes/8 pasos en REVISION_GLOBAL_UX.md.
Solo datos demo locales, stock agotado de fixture repuesto 20 unidades sin reset; sin cambio de cálculos.
EAS preview 38291282048/fuente68a0881 Success, guard APK 5 aprobado, publicado 2026-10-12 18:31 UTC. Android37 4/6, entrada de 06-global-ux falló; recepción física confirmada por Oliver, evaluación visual negativa. No APK/iOS/panel/backend remoto/finanzas.
No repetir este pulido global; continuar Entrega 01, descrita arriba.

**Publicación autorizada y validación visitante Android terminadas.** Oliver pidió «Publícala primero para revisar en mi teléfono y mientras reviso continúa si tienes pendientes».
EAS preview [38165223060](https://github.com/somosoudy-design/marketplace/actions/runs/38165223060), fuente `2a38dfb`, **Success**, guard exacto APK 5 aprobado; publicación 18:48:30Z.
Android revisión 36 [38165564922](https://github.com/somosoudy-design/marketplace/actions/runs/38165564922), fuente `3ea956e`, **Success**: visitante **2/2** claro/oscuro sin reintentos, seis rutas protegidas, Cuenta/login/flecha/Atrás, inicio/reapertura.
Diagnóstico en ambos temas: actualización `01a12c4b-86a2-7565-9f95-ae8e8a6f7711`, 2026-10-11 18:48 UTC, preview/runtime `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`, backend Marketplace responde, sesión cifrada. No se afirma recepción en el teléfono de Oliver.
18 capturas del recorrido revisadas; [evidencia inmutable](https://github.com/somosoudy-design/marketplace/tree/ac77702b7701fa4bc212a86446ac5c635ab626cf/ultima). Sin APK nuevo ni cambio de canal.

**Activación del servidor: paquete preparado y probado, aplicación pendiente de autorización.** Actualización 14oct: acceso administrativo recuperado. Historia y pg_proc confirman que faltan las dos migraciones/RPC nuevos; el bloqueo de red y falta de credencial anteriores están resueltos. No se aplicó SQL en el diagnóstico.
`tools/supabase-remote/aplicar-mi-tienda-operativa.sql` contiene solo `20261011172600`/`20261011174200`, transacción/advisory lock, identidad Marketplace desde Vault, prerequisitos, historia sin reescrituras y grants finales. Builder específico independiente del build.py antiguo; no usar db push general.
Pruebas del paquete **8/8**: aplicación real/ejecución repetida, proyecto incorrecto, historia conflictiva por nombre/versión, prerequisito/RPC ausente y grants inconsistentes abortan sin cambios. Copia nueva conservada `kora_seller_release_20261011185732`, sin reset/borrados. Permisos/persistencia tras aplicarlo **24/24** (7 suites existentes); funciones protegidas financieras/logísticas no cambiaron. SQL remoto no ejecutado.
Configuración segura activa para Supabase: token personal vinculado y limitado a api.supabase.com. Un operador también puede revisar el paquete en SQL Editor de Marketplace siguiendo MI_TIENDA_OPERATIVA.md; ejecutarlo requiere autorización. No pedir secretos por chat.
Perfil usa contrato actual. Catálogo/acciones consultan RPC de soporte y conservan lectura/panel si faltan; publicar OTA no habilita esas migraciones. Galería/teclado/Atrás con formularios/TalkBack/fluidez/roles nativos siguen para revisión física de Oliver. No iniciar otras funciones mientras revisa.

**Mi tienda operativa — tres bloques terminados localmente, sin WIP funcional pendiente.** Base `887197b`.

1. Perfil (`928494d`): campos permitidos, logo/portada por galería, guardado real/public storefront, errores/
   reintento/dirty/Atrás y desconexión, RLS sin ampliar permisos.
2. Catálogo (`9648e35`): creación/edición, variantes manuales/fotos/precio/stock/disponibilidad/moderación;
   costos automáticos por regla/RPC existente. Guardado transaccional INVOKER + ids estables, rechazo/revisión
   no se autopublica al cambiar variantes/costos. Sin drafts falsos o borrados.
3. Pedidos (fuente `5a3b884`, checkpoint resuelto): detalle aislado por tienda, tarea real/pago, confirmación,
   preparación/despacho/guía/transportista/avance/entrega/historial. advance_fulfillment intacto, sin verificar
   pagos o alterar saldos directamente. Reintento de respuesta perdida no duplica avance y confirmación
   obsoleta se bloquea. Si otra sesión completa el mismo paso con datos distintos, se conserva el borrador
   y se informa el conflicto sin éxito falso. Consulta/panel conservados donde faltan migraciones o permisos.

**Validación final:** UI conjunta 42/42 (3,6 min), luego 20/20 operativos tras textos/disponibilidad compartida/
captura estable (2,5 min), y pedidos 8/8 finales tras guarda de nota/guía concurrente (1 min); ambos temas/320 px. Backend combinado 31/31 en copia local `kora_seller_ops_171524`
conservada, sin reset; core 50/50 durante catálogo sin cambios posteriores. Tipos/lint/web finales y Android
JS/Hermes sobre 5a3b884 aprobados. Revisión visual formularios/errores/confirmación/página pública/historial en
ambos temas; 22 capturas operativas. Detalle, comandos, datos persistidos y límites: `docs/MI_TIENDA_OPERATIVA.md`.

SQL `20261011172600_seller_product_editor.sql` y `20261011174200_seller_fulfillment_detail.sql` aplicados
**solo local/copia**, sin afirmar estado remoto. Servidor sin migración conserva consulta/panel; los RPC de
capacidad nunca conceden un rol. OTA autorizada/publicada y guard APK 5 ya aprobados (arriba). Activación
remota requiere acceso al proyecto Marketplace, revisión/autorización específica del SQL y comprobación.
Sin nuevas dependencias/configuración nativa/Firebase/panel/checkout/iOS/BCV o reglas financieras.
[skip ci] en API evita despliegue automático del panel. Prueba física de formularios/galería pendiente.

### Antecedente VEN-01A cerrado

**VEN-01A terminado, sin WIP funcional activo.** Base `da4dd54`, alcance `c2a9910`, implementación `cc6db73`,
separación de pedidos compradores por cuenta `5f90e27`. Informe de consultas, pruebas y límites: `docs/VEN-01A.md`.
Cuenta usa `api.account.roles/stores` (filas reales), conserva compra/administración y abre `/my-store`.
Selector multitienda; resumen `seller_dashboard`, productos RLS paginados de 30 en 30, pedidos con
`seller_fulfillments`/etiquetas de pasos del backend y configuración solo consulta. Panel avanzado existente.
Lecturas con sesión/anon; ninguna escritura nueva, permiso simulado, RPC o migración. Datos privados de tienda no
persistidos en disco; claves por usuario/tienda y limpieza al salir/cambiar cuenta.
Pruebas finales aprobadas: UI **22/22**, claro/oscuro (1,4 min, sin omisiones/reintentos; 320 px en recorrido
principal), servidor **6/6** en copia local nueva sin borrar datos, núcleo **50/50**, tipos/lint y web.
**18 capturas revisadas** en `.local/ven01a/screens/`. Contraste de 22 pares AA, mínimo 4,78:1.
Exportación Android JS/Hermes aprobada para `5f90e27`; no es compilación de APK ni ejecución nativa.
La revisión visual detectó que «Mis pedidos» de administradores incluía pedidos ajenos: su RLS permite
consultarlos y la consulta compradora no filtraba `buyer_id`. Cuatro regresiones reproducidas antes del arreglo.
Corregido únicamente el alcance de lectura de `useOrders`: filtro por comprador y clave de caché por usuario,
sin alterar RLS, herramientas administrativas, checkout o finanzas. API conserva la lectura amplia cuando no
se solicita filtro. Los casos finales verifican una compra propia del administrador y ninguna compra ajena
en la cuenta con varios roles sin compras. La caché antigua sin usuario no se reutiliza en esta vista.
Prueba de abrir panel intercepta solo el destino externo: verifica URL/ventana/sesión, no reconstruye el panel.
Primeros fallos de prueba documentados en historial; corregidos sin desactivar casos.
Commits de API llevan `[skip ci]`: `panel-deploy.yml` despliega automáticamente por `packages/api/**`;
evita publicar el panel contra la restricción vigente. No cambiar workflows ni solicitudes EAS.
Android visitante comprobado por CI; TalkBack, fluidez, navegador externo y sesión vendedor/admin en
teléfono físico pendientes. No se afirma recepción en el Samsung de Oliver.
**Publicación autorizada posteriormente:** Oliver confirmó y pidió «Sí, publica» el 2026-10-11.
Solicitud `.github/eas-update-request` actualizada únicamente con el mensaje de VEN-01A; runtime APK 5
conservado. El workflow verifica el proyecto, carga Firebase preview y compara la huella antes de publicar.
[EAS preview 38156171005](https://github.com/somosoudy-design/marketplace/actions/runs/38156171005)
**Success**, fuente `2d00f96`; guard runtime y publicación Android terminados en verde, 16:38 UTC.
[Android 38156560856](https://github.com/somosoudy-design/marketplace/actions/runs/38156560856)
**Success**, revisión 35/fuente `098f430`: `05-mi-tienda-acceso.yaml`, **2/2**, ambos temas, sin reintentos.
Cuatro rutas nuevas protegidas, Cuenta/flecha/Atrás físico, login y regreso aprobados. Diagnóstico:
OTA `01a12bd4-1483-7096-b0c2-de39d35f4c15`, preview/runtime APK 5, publicada 2026-10-11 16:38 UTC.
Las **14 capturas nativas del recorrido se revisaron**; código móvil/API idéntico al publicado.
[Evidencia inmutable](https://github.com/somosoudy-design/marketplace/tree/61ebb1d0e2e03d9b18beb991b59351eadbaf9985/ultima).
Sin cuentas o escrituras remotas; no sustituye los 22 casos locales con vendedor/admin. Sin iOS/Xcode, checkout, pagos,
dependencias, servicios backend/panel o APK nuevo. No repetir comprador/franja; la ampliación operativa está autorizada en el nuevo bloque superior.

### Antecedentes cerrados — 4.3 y sesión comprador

**Sesión cerrada: 4.3 corregida, publicada y validada en emulador Android; sin WIP activo.**
Oliver autorizó explícitamente «Autorizar actualización para APK 5» por EAS Update `preview`, con entrega
a su Android. Paquete fuente `41d415f`: franja `adf3c78` y errores de carrito/checkout `e9b56a0`.
[Publicación 38148288379](https://github.com/somosoudy-design/marketplace/actions/runs/38148288379) **Success**;
guard del runtime APK 5 `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba` aprobado antes de publicar.
No nuevo APK, canal production, dependencias, configuración nativa, iOS, panel ni cambios financieros.

[Emulador 38148610558](https://github.com/somosoudy-design/marketplace/actions/runs/38148610558) **Success**,
revisión 34/fuente `19067d6`, Android 15/Pixel 6/APK 5 existente `d1d10c28`: **2/2**, claro/oscuro,
sin reintentos. `04-franja-sin-conexion.yaml` ampliado en `ca0923d`: 39 pasos, siete capturas por tema.
Favoritos, modo avión, Atrás/reentrada, Inicio y reconexión aprobados; sin cuentas/pedidos/pagos remotos.
Diagnóstico tras reabrir: OTA `01a12b6c-3da0-7ce9-a45b-b2dd018a9c13`, publicada 2026-10-11 14:44 UTC,
canal preview y runtime APK 5. Confirma recepción/ejecución en emulador; **teléfono físico aún sin comprobar**.

Las **14 capturas se revisaron visualmente**. Desaparece el espacio duplicado bajo la franja: título,
flecha y contenido bajan solo por la altura del aviso. Favoritos conserva la posición al reentrar;
Inicio mantiene buscador y pestañas accesibles, y reconectar restaura el espacio en ambos temas.

- [Antes: revisión 33, capturas del fallo](https://github.com/somosoudy-design/marketplace/tree/17a77d7f7a123b4383974702d16b6d8222910560/ultima).
- [Después: revisión 34, capturas y diagnóstico](https://github.com/somosoudy-design/marketplace/tree/2919b0c503e3bf1264ef381eebb761fc2a0d7011/ultima).

Causa/corrección: Android native-stack conserva su inset (`setTopInsetEnabled` es no-op en screens 4.26.2).
`OfflineNotice.tsx`/`offline-layout.ts` mantienen el inset real y compensan la reserva duplicada solo en
Android, sin desmontar el navegador o cambiar el diseño. Geometría **9/9**, comprador web **6/6**
(22,4 s, claro/oscuro), tipos/lint y exportaciones web/Hermes Android aprobados sobre el mismo código.
No repetidas suites generales. La lectura directa de manifiesto EAS dio proxy 403; diagnóstico/capturas
del emulador y Success del workflow son la evidencia. Checkpoints `41d415f`/`19067d6` cerrados.

En ese bloque VEN-01 era solo backlog. El nuevo pedido de Oliver autorizó VEN-01A, terminado arriba;
las fases B/C e iOS siguen pospuestos. No publicar otro paquete por defecto.

**Sesión corta comprador terminada, sin WIP activo.** Sincronizada `9d22155`, cierre iOS revisado;
checkpoint de continuidad/VEN-01 `70443c0`. iOS pospuesto; helpers/proyecto nativo intactos. VEN-01 registrada
con prioridad alta tras estabilizar comprador, fases A/B/C, solo backlog en ese momento. Alcance vigente arriba.

Dos problemas reproducidos antes de corregirlos (2 fallos esperados en web local):

- `checkout.tsx`: si falla la consulta de direcciones, la consulta de resumen no arranca y quedaba un skeleton
  indefinido. Ahora muestra `ErrorState` y «Reintentar» sobre direcciones; recupera resumen/botón tras el éxito.
- `(tabs)/cart.tsx`: un cambio de cantidad fallido se revertía sin explicación. Ahora muestra aviso accesible
  con el componente existente; steppers y «Continuar» se bloquean durante guardado y este último también
  durante actualización del carrito. El rollback/operaciones existentes y cálculos no cambian.

`buyer-errors.spec.ts`: **6/6**, 20,2 s, claro/oscuro; fallo/reintento de direcciones sin crear pedido,
cantidad/rollback/reintento y controles bloqueados, franja web/reconexión sin tapar encabezado. Tipos/lint
aprobados. Capturas revisadas `.local/buyer-errors/{light,dark}-*.png`; antes en `before/`.
Pruebas contra backend local conservando sus datos; sin suites generales, transacciones remotas o pagos.

En el primer bloque, 4.3 solo se comprobó en web; la reproducción Android y corrección posterior constan arriba.
Cambios comprador publicados junto a 4.3 con autorización posterior, fuente `41d415f`. No nuevo APK, canal production, configuración
nativa, dependencias/lockfile, SQL/motor financiero ni panel. No compilación/pruebas iOS.

**Cierre iOS local — arranque resuelto y probado; continuación pospuesta por Oliver.**
2026-10-11 00:00 Caracas. Causas demostradas en registros Xcode/iPhone: falta de ciclo UIScene (crash UIKit)
y restricciones separadas del sandbox de scripts RN/CocoaPods. Reparación aislada en el proyecto existente:
escena Expo y compatibilidad **solo KoraDev/Debug**, con firma/Team/Bundle ID/datos preservados.
Detalle definitivo y evidencia: `docs/IOS_DIAGNOSTICO.md`. Checkpoints `cff0d52`, `12686cb`, `0d30497`,
`db33ab9` cerrados por la verificación física; no WIP funcional activo.

Pruebas ejecutadas: 19/19, verificador `--native`, tipos/lint, core 50/50; workspace Debug **BUILD SUCCEEDED**,
Xcode Run/LLDB físico, firma validada, Metro entrega bundle Hermes, Inicio/Cuenta observados y reapertura
normal fuera del depurador aprobada. Sesión existente y contador de carrito conservados al reabrir.
Sin nuevos crash reports del binario corregido. Logs/capturas/respaldos privados en `.local/ios-diagnosis/`.

**Alcance final de Oliver:** solo quería abrir la app para probar. No continuar iOS todavía; sin pruebas
ampliadas de checkout/pagos/fotos/Keychain/temas/VoiceOver ni Release/simulador. Metro existente queda activo
para sus pruebas. No Android/APK 5/producción, prebuild, cambios de Pods, dependencias o servicios remotos.

**Antecedente: preparación iOS terminada en `264112b`.** Base `cf7a1b9` sincronizada;
checkpoint de alcance `498c051`. Frente A V2 cerrado antes de comenzar; sin WIP ajeno ni nuevas modificaciones
visuales. Solo helpers `tools/ios-personal/` y documentación. Guía exacta: `docs/IOS_PERSONAL_TEAM.md`.

`node tools/ios-personal/prepare-personal-team.mjs` genera `.local/ios-personal`, copia aislada ignorada por Git,
con backend Marketplace de pruebas del perfil preview y bundle ID `com.somosoudy.hayazgo.oliver.local` usado
en la validación. No cambia ningún archivo de `apps/mobile`, configuración compartida, dependencia/lockfile,
workflows o servicios. Conserva Electric Violet/nombre provisional. Solo allí se retiran Associated Domains/APNs,
se desactiva OTA y se sustituyen registro/listeners push; campana/listado interno se conservan.
El permiso local de fotos incluye perfil; cámara para comprobantes/reclamos, sin micrófono.

Pruebas de esa preparación: guardas **5/5**; verificador Expo real y archivos nativos con `--native` aprobados, incluido
rechazo de APNs insertado en el plist (restaurado). Generador repetido sin alterar fuente, prebuild iOS
**sin Pods** terminado, 39 módulos Expo Apple/10 entradas RN iOS resueltos; 34 versiones SDK compatibles localmente.
Plantilla: **iOS 16.4 mínimo**. Exportación Hermes iOS 5,5 MB, tipos de copia local y tipos/lint monorepo aprobados,
núcleo **50/50**, web comprador **40/40**, sin omisiones: login/códigos, catálogo/ficha/Favoritos/carrito/checkout
con datos locales, perfil/sesión, 13 V2 y 6 navegación claro/oscuro. Primera pasada web interrumpida por gateway
apagado al salir del proceso de arranque: 4 fallos, 1 interrumpido, 35 sin ejecutar; segunda con backend vivo aprobada.
Sin cambios/desactivación de tests. Logs `.local/logs/ios-personal-*.log`; guía conserva límites.

Huella Android local sin Firebase idéntica antes/después `da033dbf2e656078bbc76aa353ad3ed3088134d1`;
no confundir con runtime completo de APK 5, que requiere su archivo Firebase de EAS. Inputs originales sin cambios;
no nuevo APK, EAS Update/build/publicación, panel, motor financiero, SQL ni Supabase/Firebase remoto.
Online Expo/Apple y lecturas remotas Supabase bloqueadas por proxy HTTP 403; cotejo SDK offline realizado.

**Límite de esa preparación:** Linux sin Xcode/simulador/Mac/iPhone. Este agente no compiló Pods/Swift,
verificó firma/Keychain/gestos ni instaló en iPhone. Posteriormente Oliver reportó instalación con cierre al abrir;
no volver a generar el proyecto como primer paso del diagnóstico. Firma gratuita caduca en **7 días**.
No TestFlight/ad hoc/EAS IPA/Expo Go, gastos/cuentas de pago/certificados privados ni Frente B.

**Recepción en Android confirmada por Oliver:** «ya se actualizó» (2026-10-10). La entrega al APK instalado
queda confirmada por el propietario; no equivale a haber probado todos los recorridos en su teléfono.

**Aclaración vigente de Oliver:** «producción» significaba que la app de su Android se actualice
directamente. Para su APK 5, las publicaciones autorizadas deben llegar al canal **preview**, ya integrado
en ese APK. No interpretar esa palabra como cambiar al canal EAS production. V2 ya está publicado en
preview y comprobado en el APK 5 del emulador; no hace falta republicar, cambiar configuración ni instalar
otro APK. La publicación adicional en production queda como antecedente, sin consumidor APK 5 por ese canal.

**Frente A V2 cerrado; no hay WIP activo de este agente.** Continuidad desde `9e4e1f5`, últimos cambios
UX-04 revisados y regresión inicial 16/16. El pedido V2 autoriza Inicio/descubrimiento; no autoriza Frente B.
Fuente de la interfaz validada `b60b2cc`; publicación production solicitada en `d62b1fa`.

Tarjetas compartidas integradas y favoritas independientes; cabecera con contadores reales; barra común
expandible de cuatro destinos (44 px mínimo, 180 ms/movimiento reducido); secciones existentes refinadas,
virtualización/tracking conservados y contenido demo rotulado. Electric Violet y marca/configuración nativa
existente conservados. Decisiones/archivos: `docs/FRENTE_A_V2.md`.

Pruebas: tipos/lint sin errores; core **50/50**, API **12/12**, admin **28/28**, app **52 aprobadas + 1 omitida**
(confirmación de correo activa en local), panel **9/9**, guardas production **4/4**. App incluye 13 casos V2 y
6 de navegación UX-04. axe **0 infracciones en 8 pantallas/temas**, 320 px; contraste texto seleccionado AA.
Android 15 con APK 5 existente: **6/6**, visitante oscuro al segundo intento; informe conserva ese fallo inicial
sin identificar su paso. No afirmar seis pases al primer intento. Favoritos/Atrás y carrito visitante comprobados.
Checkout completo/cuenta y distintos estados comerciales probados en local; no compra/pago/push remoto.

Evidencia: `.local/frente-a-v2/comparacion.html`, galería autónoma web antes (40)/después (50) + 10 capturas
Android de ambos temas; `.local/frente-a-v2/android/` copiado de `ci/capturas` run 38079644334.
Diagnóstico al reabrir: OTA `01a12744-8ffc-7c8b-bfb0-b32cfae9a11e`, canal preview, runtime APK 5,
sesión cifrada sí. Capturas muestran el aviso conocido de tasa del día no disponible; no se modifica su lógica.
Recepción Android confirmada por Oliver («ya se actualizó»). Sin prueba física de lector, rendimiento o push en este turno.

Publicación autorizada por Oliver en **production**: [run 38080468671](https://github.com/somosoudy-design/marketplace/actions/runs/38080468671) **Success**.
Grupo production `92b6bef2-56e7-4a3e-8012-40c030c48434`, promovido del grupo preview
`5abecd05-a0e4-4d5c-ae6f-79b30984b4a2` sin reconstruir. El promotor comprobó los runs preview
38079470216 / Android 38079644334 aprobados, commits exactos, APK/recorridos/temas y código/dependencias
idénticos. Runtime `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`.
Inventario EAS: **0 builds Android terminados con canal production y este runtime**. APK 5 (`d1d10c28`)
consume preview, donde también conserva esta versión validada. No cambiar su canal/perfil ni crear un APK.

Sin cambios en motor financiero, SQL, Supabase remoto, Firebase, panel, nombre definitivo, dependencias,
configuración nativa ni Frente B. Registro de cierre en `docs/HISTORIAL_AGENTES.md`.

Pendiente heredado, independiente de UX-04:

Pedido de Oliver del 2026-10-10 03:50Z: «Compilar APK 5 con notificaciones push». Hitos 1 a 5 hechos; solo falta la
prueba de push en el teléfono de Oliver.

| Hito | Qué | Estado |
|---|---|---|
| 1 | Push | Hecho: Firebase `hayazgo` con el paquete `com.example.kora.preview` y clave FCM V1 del mismo proyecto (comprobado por `firebase-check.yml`); canal de Android «Pedidos y pagos»; registro al activar «Avisos en este dispositivo» y al entrar si ya hay permiso; el token se borra al cerrar sesión; tocar un aviso abre el pedido. `push-dispatch` solo envía a los dispositivos del destinatario y nunca avisos demo o de prueba |
| 2 | «Atrás» de Android | Hecho: `predictiveBackGestureEnabled: false` (manifiesto del APK 5 con `enableOnBackInvokedCallback=false`) |
| 3 | Identidad nativa violeta | Hecho: icono, splash y color de avisos (`NATIVE_IDENTITY = 'violet'`). Mismo nombre, paquete y configuración de producción |
| 4 | Compilación | Hecho: build `d1d10c28`, versionCode 4, misma firma que el APK 4, Supabase de pruebas, canal `preview` |
| 5 | Pruebas en el emulador | Hecho (revisión 20): los cinco recorridos pasan al primer intento. Ver «Pruebas» |

Preguntas y respuestas sigue pospuesto por Oliver (`PENDIENTES.md` 2.5). Del relevo anterior siguen abiertos: la
regla comercial del motor de precios (`pricing.import.configured = false`, la define Oliver) y el cambio del
repositorio a privado (lo hace Oliver).

## Próxima acción

Oliver revisa **C publicada** en su Samsung. Ver informe/galería `C_EDITORIAL_REFINADA.md` y `diseno-v2/c-refinada/comparacion.html`. Actualización `01a13354-e5fd-70f0-90bc-feec7f425a03`, 2026-10-13 03:36 UTC, Android40 **4/4**, auditor final APROBADO. No repetir o republicar.

Tras nuevas instrucciones, concretar siguiente incremento:2B de Inicio o lenguaje compartido para Buscar/ficha, manteniendo continuidad C y reglas comerciales. No forzar la banda editorial en todos los recorridos ni iniciar otro frente. BCV y SQL vendedor independientes; iOS pospuesto.

## Pendiente de Oliver (solo él puede hacerlo)

1. ~~Desactivar «Confirm email»~~: el workflow del emulador lo encontró desactivado el 2026-10-09 22:40Z
   (`/auth/v1/settings` → `mailer_autoconfirm: true`). Hecho.
2. Supabase › Authentication › URL Configuration › Redirect URLs: agregar `kora://**`.
3. Dar acceso al repositorio de GitHub a Kevin y Heisber si van a trabajar con sus propios agentes.
4. Instalar el APK 5 en su Samsung y probar los avisos push (`que-probar.md`).
5. Más adelante: dominio y SMTP propio (vuelve el código por correo), credenciales de Binance Pay y PayPal. Detalle en `docs/SERVICIOS_EXTERNOS.md`.

## Errores conocidos

- iOS Personal Team: cierre UIKit y fallo de scripts **resueltos en Debug local**; build/firma/Metro y
  reapertura física aprobados. Release y checklist ampliado no probados, pospuestos por Oliver. Sin nuevos
  informes de cierre del binario corregido; evidencia en `docs/IOS_DIAGNOSTICO.md`.
- Tasa BCV vencida desde el 2026-10-10 13:20Z: la última de DolarApi («oficial») es del 2026-10-09 04:00Z y la regla
  de `rate_policies` (USD/VES, 2000 minutos) la da por vencida. Mientras tanto no se cotiza en bolívares (Pago Móvil,
  transferencia) y la app lo dice al elegir el método; Zelle y USDT siguen. Es el comportamiento previsto (nunca usar
  una tasa vencida); se arregla solo cuando la fuente publique, o con una tasa manual en el panel. Decisión de Oliver.
- APK 4 (y anteriores): «atrás» de Android cierra la app en Android 13 a 15. Corregido en el APK 5.
- Push comprobado solo en el emulador Android 15; en un teléfono real falta la prueba de Oliver. Los pedidos de
  prueba (también los del emulador automático) avisan a Oliver como dueño de la tienda demo «Kora» cuando tenga
  los avisos activados.
- Maestro a veces pierde el emulador unos segundos y un recorrido falla al empezar (revisión 18): el script
  repite una vez el recorrido que falla y deja el primer fallo en el resumen.
- Sin SMTP propio, «Olvidé mi contraseña» y el código de registro solo llegan a correos del equipo de
  Supabase de Oliver (límite de unas 2 por hora).
- El panel publicado abre las fichas desde las listas con una carga completa la primera vez que se visitan (sitio
  estático); funciona igual.
- Los artefactos de GitHub Actions no se pueden bajar desde el contenedor de Claude: usar la rama `ci/capturas`.
- `pnpm stack:start` sobre un stack ya encendido deja PostgREST y funciones sin arrancar («Address in use»):
  usar `pnpm stack:stop` antes.
- `gh run view --log` a veces da 403 al bajar registros; leerlos con la herramienta `get_job_logs` del
  conector de GitHub o por la API de jobs.

## Pruebas

**Mi tienda operativa — cierre 2026-10-11:** 42/42 UI conjunta y 20/20 operativos finales tras refinamientos,
31/31 backend en copia conservada, core 50/50 durante catálogo (sin cambios posteriores), tipos/lint/web/
Android JS/Hermes aprobados. Claro/oscuro/320 px; galería y persistencia real mediante web/gateway local,
permisos SQL, atomicidad/moderación/costos/logística/reintentos probados. No prueba nativa nueva ni publicación.
Reproducción/evidencias/alcance en MI_TIENDA_OPERATIVA.md y PRUEBAS.md; no usar wrapper destructivo test:db.

VEN-01A, cierre local (2026-10-11 12:22 Caracas): `seller-app.spec.ts` **22/22** en 1,4 min, ambos temas,
sin reintentos/omisiones; 320 px en recorrido principal. Permisos existentes + herramientas vendedor **6/6**
en copia local conservada, núcleo **50/50**, tipos/lint aprobados. Web y Android JS/Hermes exportados desde
`5f90e27`. Dieciocho capturas revisadas; contraste de 22 pares ≥4,5:1. Logs, casos, reproducción y límites
en `docs/VEN-01A.md`. Ese cierre local fue anterior a la publicación/comprobación nativa siguiente;
no se probó TalkBack ni el teléfono físico de Oliver.

VEN-01A publicado (2026-10-11 12:38 Caracas): EAS preview 38156171005 **Success**, fuente `2d00f96`,
guard runtime exacto APK 5 aprobado. Revisión 35/run 38156560856 **Success**, Android 15/Pixel 6/APK 5:
visitante **2/2 sin reintentos**, cuatro rutas protegidas, flecha/Atrás/Cuenta/login; 14 capturas revisadas.
Diagnóstico de ambos temas confirma OTA `01a12bd4-1483-7096-b0c2-de39d35f4c15` de 16:38 UTC,
preview/runtime APK 5. Sin cuentas/pedidos/pagos/escrituras remotas. No prueba física ni roles con sesión nativa.

4.3, cierre (2026-10-11 10:55 Caracas): EAS preview 38148288379 **Success**, runtime APK 5 aprobado.
Android 15/Pixel 6, revisión 34/run 38148610558 **2/2 sin reintentos**; diagnóstico confirma OTA
`01a12b6c-3da0-7ce9-a45b-b2dd018a9c13` de 14:44 UTC. Las 14 capturas claro/oscuro confirman corrección
visual y navegación/reconexión en Favoritos e Inicio. Sin prueba física del Samsung ni nueva compra/pago.
Geometría repetida 9/9; los 6/6 web, tipos/lint y bundles anteriores corresponden al mismo código publicado.

4.3 (2026-10-11 08:39 Caracas): Android 15/Pixel 6, APK 5 con OTA anterior, run 38113135559 **2/2**;
ocho capturas muestran el fallo visual pese al éxito de navegación. Código corregido: geometría **9/9**,
tipos/lint, exportaciones web/Hermes Android y comprador web **6/6**, 22,4 s, ambos temas.
En ese checkpoint todavía no había prueba nativa «después» ni publicación; ver cierre posterior arriba.
Primer CLI web consumió el spec como otro proyecto (cero pruebas); corregido con `--project=app`. Arranque
local siguiente falló por puerto PostgREST aún ocupado; reintentado tras liberarse, sin reset de datos ni cambios
de herramientas. No contados como pases. Sin suites generales ni pagos.

Sesión corta comprador (2026-10-11 00:38 Caracas, Linux): `buyer-errors.spec.ts` **6/6**, claro/oscuro,
Pixel 7 web, 20,2 s; tipos/lint aprobados y seis capturas revisadas. Antes del fix, 2 fallos confirman carga
indefinida de direcciones y error de cantidad invisible. Franja web aprobada; **no valida native-stack Android**.
Runner temporal ignorado `.local/buyer-errors/playwright-app.config.ts` usa el mismo proyecto app sin levantar
el panel, cuyo arranque demoraba el runner general (interrumpido). Un intento inicial sin backend persistente
también se interrumpió; no se cuenta como verificación. Sin suites generales, pruebas nativas ni pagos.

Corrección del verificador iOS (2026-10-10 22:29 Caracas, Linux):

- `node --test tools/ios-personal/*.test.mjs`: **11/11**, sin omisiones (6 regresiones pbxproj + 5 guardas).
- `node tools/ios-personal/verify-personal-team.mjs --native`: aprobado contra los archivos existentes.
- Proyecto existente copiado a temporal con IDs sin comillas: Debug y Release aprobados; original sin cambios.
- `pnpm typecheck && pnpm lint`: aprobados. Sin cambios de UI/app/SQL; no repetidas suites web/DB/Android.
- No ejecutados: compilación/firma/simulador, consulta de logs del Mac/iPhone ni prueba de arranque físico.

Validación histórica **Frente A V2**, base `9e4e1f5`, mismo stack local: tipos/lint sin errores, núcleo 50/50,
admin 28/28, API 12/12, app **52 aprobadas + 1 omitida**, panel 9/9. App incluye 13 casos V2 y 6 de navegación
UX-04. axe: 0 infracciones en 8 pantallas/temas a 320 px; contraste de texto seleccionado AA. Galería web autónoma
`.local/frente-a-v2/comparacion.html`, 40 capturas antes / 50 después. Guardas del promotor production 4/4.
Preview fuente `b60b2cc`: run 38079470216 Success, runtime exacto APK 5 comprobado. Android revisión 31 **Success**, 6/6 (1 reintento); production run 38080468671 **Success**, grupo `92b6bef2…`, cero builds consumidores compatibles registrados. Sin validación en teléfono ni TalkBack/VoiceOver físicos. Detalle y límites en
`docs/PRUEBAS.md` / `docs/FRENTE_A_V2.md`.

Validación **anterior** UX-04 (2026-10-10, entorno Codex cloud, Node 24.19.0, pnpm 10.28.0, Postgres 17.11,
backend local sin Docker y Chromium; datos demo locales):

| Suite | Resultado |
|---|---|
| Tipos y lint | Sin errores |
| Núcleo / panel unitario | 50/50 y 28/28 |
| API de compra y avatar | 12/12 |
| App Playwright, exportación web Pixel 7 | 39 aprobadas, 1 omitida (`signup-without-email`, requiere `AUTH_AUTOCONFIRM=true`; local usa confirmación) |
| Navegación UX-04, incluidos en la app | 6/6, claro y oscuro |
| Panel Playwright entre roles | 9/9 |
| Revisión visual | Inicio, Buscar, Carrito y Cuenta en claro/oscuro, Pixel 7; Inicio/Buscar también a 340 px |

No ejecutadas para UX-04: suites SQL/funciones (sin cambios en ellas) ni emulador/teléfono.
La recepción de esta actualización en el Samsung queda para la revisión de Oliver.

Resultados históricos (2026-10-09, stack local):

| Suite | Comando | Resultado |
|---|---|---|
| App, Playwright (Pixel 7) | `pnpm test:ui` | 21 pasan, 1 omitida a propósito (`signup-without-email`, corre solo con `AUTH_AUTOCONFIRM=true`; pasó así) |
| Panel entre roles | `pnpm test:panel` | 8/8 |
| Panel unitario | `pnpm test:admin` | 28/28 |
| Núcleo | `pnpm --filter @kora/core test` | 43/43 |
| Catálogo remoto en base aparte | `pnpm test:remote-catalog` | todas pasan |
| Tipos y lint | `pnpm typecheck && pnpm lint` | sin errores |

No ejecutadas en aquella sesión: `pnpm test:db` (76), `pnpm test:e2e` (8) y `pnpm test:functions` (11); pasaron la
última vez que se tocó la base (ver `docs/PRUEBAS.md`) y desde entonces no cambió ninguna migración ni función.

En el APK real (GitHub Actions, Android 15, pantalla de Pixel 6), revisión 15 del 2026-10-10 con el APK 4 y la
actualización de los hitos 1 a 3: `02-cuenta` (registro, carrito, dirección, checkout, métodos, monto, cancelar) y
`01b` (flecha de Favoritos) pasan; `01a` y `01c` fallan por «atrás» de Android (error conocido); `01-visitante`
falló por el toque a la variante. Revisión 16 (`62e393f`): `01-visitante` pasa (variante de 2 m, «Agregar»,
«Comprar» abre el carrito con 12 USD sin duplicar, carrito conservado al reabrir), igual que `01b` y `02-cuenta`.

APK 5 (revisiones 17 a 20 del 2026-10-10, APK 4 instalado y luego el 5 encima): instalación encima «Success»,
actualización recibida al reabrir, `01-visitante`, `01a` y `01c` («atrás» desde la ficha, Favoritos e iniciar sesión
vuelve a Inicio), `01b` y `02-cuenta` pasan. `02-cuenta` ahora también: permiso de avisos rechazado y luego dado
(«Avisos activados en este dispositivo.»), aviso push real del pedido tocado desde otra pantalla que abre el pedido,
sesión conservada al reabrir, cerrar sesión y volver a entrar. En la base: el aviso solo fue al token de la cuenta de
prueba, recibo «ok», y al cerrar sesión el token se borró y se registró de nuevo al entrar.

App, Playwright, 2026-10-10 con el APK 5: 29 pasan, 1 omitida. Con los hitos 1 a 3: 28 pasan, 1 omitida; `pay-divisas.spec.ts` (nueva) pasa sola.

Faltan: pruebas en un teléfono físico
más allá de lo que Oliver prueba a mano.

## Servicios externos (estado vivo)

Resumen; procedimientos en `docs/ENTORNO.md`.

| Servicio | Estado |
|---|---|
| Supabase de pruebas `mimnotafmfasvwrclxan` («Marketplace») | 24/24 migraciones (última `20261009233831_pricing_engine`), 4 funciones (`rates-sync`, `push-dispatch`, `panel-api`, `assets-mirror` de uso único), 7 trabajos de cron (nuevo `kora-pricing-snapshot`, hora :40), brecha del día vigente, imágenes demo en Storage, registro sin confirmación por correo |
| EAS Hosting | Panel en https://kora-panel.expo.app (mismo proyecto Expo `marketplacebrand/marketplace`, plan sin costo) |
| Supabase `bfuggvbgttvcygbexqyn` | **Prohibido tocarlo**: es de otros productos de Oliver (BingoCriollo) |
| Expo `marketplacebrand/marketplace` | APK 5 (build `d1d10c28`, versionCode 4, runtime `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`); Frente A V2 publicado en preview y production; APK 5 consume preview, inventario production compatible 0. `GOOGLE_SERVICES_JSON` (archivo, entorno preview) y clave FCM V1 cargadas por Oliver. El APK 4 ya no recibe actualizaciones |
| GitHub Actions | `eas-android-preview.yml` (APK), `eas-update-preview.yml` (actualización), `eas-update-production.yml` (promoción del bundle validado), `apk-verify.yml`, `apk-emulator.yml` (capturas también en la rama `ci/capturas`), `firebase-check.yml` (Firebase y credenciales de EAS), `panel-deploy.yml` (panel); secreto `EXPO_TOKEN` configurado |
| Google Play / App Store | Nada publicado. Oliver dijo que todavía no |
| Binance Pay, PayPal | Preparados en código, deshabilitados (`pending_credentials`) |

## Cómo retomar

```bash
git fetch origin && git checkout claude/marketplace-v1 && git pull --ff-only
git log --oneline -10
# Leer AGENTS.md, estado/pendientes y ARQUITECTURA_EXPERIENCIA_V2.md.
# No ejecutar db:reset, compra/pago o publicación para revisar documentación.
```

La arquitectura y el incremento 1A+2A ya fueron aprobados, implementados y publicados. C ya fue elegida, corregida, implementada y publicada con recepción/emulador comprobados. No retomar WIP histórico ni volver a publicar. Esperar revisión física/nuevas instrucciones de Oliver; consultar C_EDITORIAL_REFINADA y documentos actuales. No implementar B. Preservar datos y permisos. Para futuros incrementos autorizados, usar `docs/ENTORNO.md` y pruebas focales, preservando datos existentes.
