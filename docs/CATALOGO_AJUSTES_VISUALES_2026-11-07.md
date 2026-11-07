# Correcciones visuales del catálogo · 7 de noviembre de 2026

## Resultado de los tres casos

Se publican **dos correcciones puntuales** sobre el diseño existente. El tercer caso es un límite del archivo original y se conserva, sin simular una reparación. No cambian la grilla, las fotografías, los colores del producto, el catálogo ni sus operaciones.

| Caso | Evidencia anterior | Resultado |
|---|---|---|
| Fotos con fondo blanco en oscuro | ProductCard móvil colocaba bandas oscuras junto al bitmap claro: foto800×1000 en marco161×161,16.1px laterales. Web ya tenía contain y fondo#f4f3f6. | Sólo la superficie de foto de la tarjeta oscura pasa a blanco continuo con filete discreto. Foto, SRC, proporción, opacidad y colores intactos; claro y placeholder conservados. No se presenta contain como una novedad. |
| Odontología | A360 la tile76 daba66px útiles frente a74.23px del nombre. Web320/160% tenía140px de texto en104px útiles y CTA122px. | Nombre completo dentro del pie, sin reducir fuente ni fijar altura.390normal sigue en una línea; al necesitar reflujo ofrece división silábica legible. Nombre accesible, datos y navegación siguen usando categoría.name original. |
| Tecnología | App muestra el arte448×448 en marco cuadrado sin recorte extra:81×81@390/74×74@360. El portátil ya sale por arriba/derecha dentro del original. Web usa fotos de catálogo distintas, en contain; hoy una tablet. | Sin modificación: no existe contenido fuera del bitmap que un ajuste de encuadre pueda recuperar. Cambiar esa composición requeriría otro asset fuera de esta tanda. No se genera, sustituye ni tiñe el arte ni se cambian las demás categorías. |

El arte móvil Tecnología conserva SHA-256 `a387649040c6acbca4a6eebe8c12ab8e1dbe69be100102af82c6a0d0a2184a97`. Su límite se identificó antes de actuar. El ajuste anterior de alturas/pies45743f9 tampoco se rehace.

## Cambios concretos

Cuatro archivos de interfaz: ProductCard.tsx, CategoryShowcase.tsx, globals.css y marketplace-home.css. ProductImage global, ficha, carrito, galería por color y tres banners conservan su código. La superficie nueva se aplica sólo a tarjetas oscuras, con el mismo margen/radio/área. No hay filtros, multiply ni opacidad añadidos sobre el producto.

Odontología usa ancho acotado y reflujo local; en móvil el padding del pie pasa4→3 sólo para esa categoría y un guion discrecional permite la división Odonto-/logía cuando hace falta. No altera el nombre del registro, el enlace ni su nombre accesible. En web únicamente su tile permite envolver nombre/CTA. La primera aproximación aislaba una última letra a390; se retiró esa aprobación y se corrigió antes de publicar. Sus originales se conservan.

Se añade el flow27 de categorías y cuatro recibos en la misma comprobación Android (normal1/1.6×ambos temas), sin alterar los diez flows anteriores ni infraestructura. Shell y YAML validados; DSL contrastado con documentación primaria. El guard de publicación exige al menos40PNG. Un assert de nombre accesible no sustituye la revisión de los glifos en esos PNG.

No se incluyen círculos, textos redundantes, botón de ficha, OAuth, cuotas, estructura general de ficha, dominio del panel ni otros pendientes. No hay nuevas credenciales, permisos, servicios, migraciones o SQL mutador.

## Pruebas locales

- Tipos/lint del monorepo aprobados; tras el refinamiento final, tipos/lint móvil repetidos y aprobados.116core,139unitarias móvil/web y30Node/marca pasan.
- Web integrada5/5:390/1440 ambos temas y medición320oscuro; Odontología normal/160%, superficie, fotografía original, banner, Preventa, selección de color/UUID/portada y persistencia guest. Cero Auth, writers o destinos prohibidos.
- ExpoWeb antes85f0110 y después9916d3e: blanco DJI/pastel mantienen foto, contain161², tarjeta173×271, filtroNone/opacidad1. Placeholder conserva tamaño/tono y no incorpora filete.147originales sin cambios porSHA y nueve gates de código de guest/ficha/banners/availability idénticos.
- Caption final export8092: dos PNG de fuente real abiertos por integrador y revisor.390normal conserva una línea;160% usa Odonto-/logía dentro92px, sin letra aislada. Lectura360 completa. Aria/canonical/destino originales. El estrésCSS es una aproximación sobre ExpoWeb; no se atribuye a Android nativo.

Las vistas locales usan un clon y fixtures visuales previos, no el inventario comercial oficial. No se siembra ni se modifica el clon, no se ejecuta Auth ni se reinicia el PostgreSQL compartido. Contextos de navegador nuevos y aislados; Chrome compartido del Mac no se controló. Todos los servidores locales de esta tanda están cerrados; el cluster compartido permanece intacto.

## Publicación web verificada

Fuente compilada `9916d3ef7792584f1ad9ceb52f4080664d370c80`, igual en código de aplicación a la solicitud `73fc75ef124121693d8fc42efa77dd11dcf370f6`. BUILD_ID `ZFY1G0Dw-qyRFOIV0IH7N`; Worker `d8756e3b-42c9-47ee-b041-44456fa341f6` al100%. Sólo ASSETS y WORKER_SELF_REFERENCE, Workers Free. Despliegue único; anterior8a9d859c conservado como referencia.

Build/guards release, comercial yCloudflare aprobados. Preview4/4 y público4/4 en390/1440 ambos temas con el catálogo real actual. CadaHTML confirma BUILD_ID; cinco fotos por contexto mantienen path/dimensiones/contain/opacidad/radio respecto a Preview y sólo oscuro recibe la superficie. Odontología normal/160% cabe en104px móviles/149px desktop. Tecnología muestra su bitmap completo en contain, sin atribuir un cambio. PNG representativos revisados tras carga.

Cero errores de app/HTTP/red inesperados y cero Auth/writers prohibidos. Cuatro GET del beacon deCloudflare se abortan intencionalmente y se registran con sus requestfailed/consoleerror como diagnóstico opcional; no se declara consola global limpia ni se oculta otro error. Root confirma HTML200, treceJS/CSS porSHA idénticos al artefacto yWWW301 conservando ruta/consulta.

## Android publicado, recibo en curso

Una solicitud, [ejecución42403068492](https://github.com/somosoudy-design/marketplace/actions/runs/42403068492), intento1, fuente `73fc75ef124121693d8fc42efa77dd11dcf370f6`. Guard Free/cuota, runtime y fuente limpia aprobados; publicación completada. ManifestHTTP200: UUID `01a1b758-773b-7a0f-82c5-a96d2bc2fb81`, grupo `db1d3f57-b2b3-4c6e-9507-b9e4f859f0bf`, runtime `b691ec2b61ee413fb1d6e7671a1a84446b4cd4f6`, creado18:49:50.651UTC. Mismo APKdf55b9b8, sin APK nuevo, iOS ni tiendas. Falta archivar recepción exacta y las cuatro capturas de categorías con font_scale real; no se presenta como ya aprobado.

No servicios con cargos ni pruebas mutadoras de catálogo, cuentas, compras o pagos en producción. La recepción en el teléfono físico no ha sido observada.

## Evidencia antes/después

Bajo `.local/catalog-visual-20261107/`:

- `before/`, `before-mobile/`: código y capturas anteriores; `before/source-assets.json` registra147SHA.
- `candidate/` y `after-source/`: propuesta web y fuente integrada; `after-source/README.md` separa sus fixtures de producción.
- `after-mobile/`: fotografías/controles y huellas conservadas; su aprobación intermedia de caption remite al cierre definitivo.
- `final-source-caption/README.md`: dos PNG del export final y mediciones; no son un experimento con texto/padding inyectados.
- `proposals/DICTAMEN_CAPTION_9916d3e.md` y `caption-final-independent.json`: revisión final independiente.
- `publication/worker/README.md` y `publication/public/README.md`: cuatro contextos reales,20fotos, errores/diagnósticos separados, originales y hashes.
- `publication/public-integrity.json`: identidad/treceassets/www; `publication/native/`: manifest y seguimiento de la única ejecución.

Próximo paso único: archivar resultado de esa observación Android y cerrar esta tanda con el límite de Tecnología explícito. No abrir otra ni iniciar un ciclo de infraestructura.
