# Preventa, galería por color y selector ·7nov2026

Alcance autorizado: tres correcciones conservando la estructura actual. Reservable se presenta como Preventa; action reserve/Reservar y reglas existentes permanecen. Nexode sigue No disponible. No cambios de inventario, precios, anticipos, cuotas ni compra.

## Evidencia y causa

Baseline real16 contextos: web pública y Expo Web congelado0df5410,390px,claro/oscuro,texto normal/160%;64PNG. Cambia variante pero permanece portada del color anterior. Los dos UGREEN heredados tienen options vacíos, sin enlaces de imágenes. No se pierden al leer API: la creación antigua no guardaba opciones, y los editores actuales no las recogen; esta tanda no rediseña editores ni inventa opciones.

Doce originales1600px revisados: HiTune Púrpura H0/H2/H3, Negro H1/H4/H5; Nexode Gris N0/N2/N3, Blanco N1/N4/N5. Cada foto muestra carcasa de un color: ninguna es común. Manifest verificable ignorado `.local/preventa-color-20261107/assets-review/color-evidence-manifest.json`, SHA256 `87fe040d04080953427c8a84af017dd1da30ba167f140e552b3b62022661e557`.

## Implementación en curso

Reutilizar `catalog_set_variant_media` con la sesión real del panel, autorización servidor y control optimista; asociar3imágenes ordenadas por cada variante. No SQL directo, suplantación, credenciales nuevas ni cambios comerciales. Conservar snapshot anterior y respuestas auditables, verificar después antes de repetir una operación.

Círculo decorativo con nombre accesible, selección explícita, mismas variantes/precios. Para legacy sólo títulos exactos Negro/Blanco/Gris/Púrpura; no se persiste Color ni se analizan títulos compuestos. Colores desconocidos no reciben tono inventado. Imágenes comunes sólo si están asociadas explícitamente a cada variante: la ausencia de asociación no acredita neutralidad. Reinicio ya existente app/galería; remount de foto web evita portada decodificada anterior.

## Validación pendiente

104pruebas compartidas y tipos/lint móvil/storefront aprobados. Pendientes: contraste comercial después de RPC, regresión de galerías/compra, capturas después y revisión independiente, publicación única web/OTA compatible y recibos. No afirmar entrega física en Samsung.
