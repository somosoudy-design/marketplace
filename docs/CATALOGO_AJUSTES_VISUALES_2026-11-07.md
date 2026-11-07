# Tres casos visuales del catálogo · 7 de noviembre de 2026

Tanda autorizada después del cierre invitado85f0110. Son correcciones de superficies existentes: fotos con fondo blanco en oscuro, nombre completo Odontología y encuadre Tecnología. Sin rediseño de catálogo, nuevos assets, filtros/tintes, cambios de grilla, cuentas, precios, stock, pagos ni microajustes aplazados de círculos/textos/botón. Sólo root integra y publica; especialistas trabajan en carpetas ignoradas y contextos locales aislados, sin controlar Chrome compartido.

## Evidencia anterior y decisiones

1. **Foto oscura reproducida:** en móvil una foto800×1000 dentro de161×161 deja16.1px de banda lateral por lado, pintada con tono oscuro de categoría frente al fondo claro del original. Web ya tenía contain y superficie#f4f3f6; no se vuelve a presentar contain como novedad. Ajuste sólo en la superficie de foto de ProductCard oscuro: fondo blanco continuo y filete discreto, misma geometría, radio y foto. No se cambia ProductImage global, ficha, carrito ni banners. El color del producto y los fondos que pertenezcan al bitmap permanecen intactos.
2. **Odontología reproducida:** móvil360 tiene tile76, área útil66 y texto74.23; a390 normal cabe. Estrés equivalente a1.6 deja118.77px de texto en90px útiles. Web320/160% tiene140px de texto en columna104 y CTA122px. Ajuste local de ancho/wrap del label móvil y sólo el tile Odontología web; conserva nombre y controles, sin reducir fuente ni fijar altura/grilla. El estrés CSS de ExpoWeb es aproximación, no prueba de font_scale Android.
3. **Tecnología sin recorte adicional de UI:** app usa tecnologia.webp448×448 en marco cuadrado; se muestran81×81@390 y74×74@360 sin corte adicional. El portátil ya sale de los bordes superior/derecho en el original SHAa387649040c6acbca4a6eebe8c12ab8e1dbe69be100102af82c6a0d0a2184a97. Web usa otra foto de categoría800×1000 en contain. No se cambia el arte ni se simula recuperar contenido inexistente. Reencuadrar la composición original exigiría otro asset, fuera de esta autorización; se identifica el límite antes de actuar y se conserva tal cual.

El ajuste anterior45743f9 de alturas/pies de categorías sigue conservado. No se rehace ni se sustituye un caso ya resuelto por otro pendiente.

## Implementación local en curso

Cuatro archivos de UI: ProductCard.tsx, CategoryShowcase.tsx, globals.css y marketplace-home.css. Sólo superficie de foto oscura y wrap Odontología. CSS candidato revisado en8contextos sin cambiar geometría, src, fit, tarjeta ni color de fotos; controlesDJI original blanco y foto pastel iguales porSHA. Originales registrados en before/source-assets.json (147archivos). Tipos y lint completos pasan. Falta cerrar export móvil/QA final, revisión independiente y publicación compatible autorizada.

No hace falta migración, SQL mutador ni nuevo servicio. Stack local de lectura reutiliza el clon mayami_guest_mode_20261107 y puertos55442/55444; no se reinicia el PostgreSQL compartido, no se siembran productos/cuentas y no se usa producción para pruebas mutadoras.

## Evidencia local

`.local/catalog-visual-20261107/`: before/, before-mobile/, candidate/, proposals/WEB_AUDITORIA_Y_PROPUESTA.md, proposals/REVISION_Y_QA_INDEPENDIENTE.md y logs/. Los fallos de selector del capturador se conservan aparte; no se corrige la app para satisfacer un oráculo equivocado.

Próximo paso: export móvil después en8091, QA focal de los dos ajustes y constancia del tercer límite; después un único despliegue web y una única OTA compatible, sin APK nuevo/servicios de pago. No abrir otra tanda.
