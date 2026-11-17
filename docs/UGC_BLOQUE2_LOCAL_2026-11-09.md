# UGC bloque2: implementación local y transición · 9 de noviembre de 2026

Implementado sobre la fuente aislada207c489, descendiente de39ffbee. No se tomó HEAD principal. La app y el panel tienen controles utilizables contra el backend preparado; no se publicó ni activó nada hospedado. El AABvc3 anterior se conserva y no contiene esta implementación. No se usó navegador/emulador ni se lanzó build, OTA, web/panel o Play.

## Qué cambió

**Móvil:** acciones contextuales separadas para denunciar opinión/respuesta y autor/tienda, confirmar bloqueo y gestionar/revertir bloqueos desde Cuenta. Invitados reciben identificación con retorno interno seguro, sin autorreplay. Gate apagado muestra indisponibilidad y no envía acciones. Normas completas y consentimiento explícito antes de publicar/editar. Borradores conservados ante error; doble toque usa latch inmediato antes de MutationObserver. Intentos de denuncia quedan sellados por actor/contexto/UUID/payload en memoria acotada32; cancelar/reabrir no envía ni crea otro intento incierto. No persiste texto privado en disco ni garantiza recuperación de ese borrador tras reiniciar proceso.

**Panel:** staffRPC paginada, conserva Publicadas/Ocultas, estrellas máximas, Sólo sin responder, total y orden estable. Metadata conserva producto/tienda/variante; la lectura sigue limitada a tienda propia o admin, sin roles nuevos. Editor con normas/aceptación, estado honesto y cancelación protegida durante envío. Cola administrativa con snapshot y contenido actual, cierre o moderación del objetivo pertinente y restauración separada de respuesta. Una opinión negativa honesta no se retira por recibir denuncia. Se conserva el resumen de reputación global y la moderación administrativa existente.

Si el texto cambió desde la denuncia, la UI impide retirarlo desde ese reporte y el servidor lo comprueba de nuevo bajo FOR UPDATE. Una edición concurrente ya confirmada no provoca ocultar contenido nuevo por una captura vieja. Admin aún dispone de la moderación manual existente sobre el contexto que revise; no se ha reescrito ese proceso general. Una respuesta moderada continúa oculta al editarla hasta restauración administrativa.

**Actores y caché:** API capturada por actor, comprobación entre operaciones dependientes y rechazo de resultados obsoletos. El propietario UGC se publica desde todos los eventos Auth (incluye recuperación), con revisión A→B→A aunque React agrupe renders. Se descarta una lectura inicial que contradice la identidad posterior, conservando la restauración del mismo actor y la sincronización invitada; las reglas de admisión URL/login/OTP/cart/favoritos no se sustituyen; no se integra el arreglo web login-CSRF pendiente. Mientras owner y contexto Auth no coinciden, no se muestran filas, borradores ni estado UGC previo y las queries quedan deshabilitadas.

Reseñas/tiendas se consultan con clave por actor; invitado usa Authorization anon explícita, sin heredar la sesión compartida. Restauración/persistencia elimina vistas UGC antiguas y sanea sólo avisos system+review_id; pedidos, pagos, direcciones, reclamos y avisos transaccionales conservan sus datos. Se limpia el dato UGC antes de hidratar; si falla escribir almacenamiento se usa la copia saneada y se vuelve a sanear al persistir, sin borrar la caché financiera ajena. La prueba usa puertos de almacenamiento: no acredita borrado físico en un teléfono ni recuperación de un disco averiado.

Los avisos UGC antiguos en primer plano con extractos se suprimen; los genéricos nuevos y los transaccionales se mantienen. No se puede retirar un push que el sistema/proveedor ya entregó ni una caché vieja de un cliente desconectado que aún no ejecutó esta versión.

## Delta servidor y permisos

La migraciónB1 `20261109172643_mayami_ugc_private_controls.sql` conserva SHA256 `c94d0794e6b2a1954bbcc710900cb8af61c17031f537935697bd5dc34c9d8c97`. Su plantilla original de activaciónd011 sigue intacta.

Nueva migración: `supabase/migrations/20261109175525_mayami_ugc_panel_compatibility.sql`.

SHA256: `754894b55a22d2cf93b1a093740f4ebfe6b8a576748eba3200a68f3a08ffb2e2`.

Añade una RPC autenticada `ugc_staff_reviews_page`, con la misma autorización operacional, filtros/total/página y búsqueda de contexto exacto. No se amplían roles; las diez RPC deB1 conservan permisos. Añade sólo mine booleano a reseñas públicas de tienda, sin publicar UUID humanos. Reemplaza la resolución de reportes manteniendo firma/ACL para rechazar texto cambiado; no modifica process_account_deletion, precios, pagos, cuotas, Google o Firebase.

Los archivos exactos para revisión están en `tools/ugc/deployment/`:

- `PRECHECK_PREPARE.sql` y `PREPARE.review.sql`: lectura previa y preparación transaccional B1+B2, historia y gatefalse. Incluye un UPDATE real de avisos UGC existentes.
- `PRECHECK_ACTIVATE.sql` y `ACTIVATION.review.sql`: segunda lectura y activación separada después de clientes compatibles. Cierra rawREST antes de habilitar acciones.
- `MANIFEST.json`: hashes/bytes. Preparación SHA `97ce052a5df8f6a96d3352ce380bf74c2595c377d60acf82301c5f84e1623be5`; activación SHA `6f8e6f1c8081f40adec1c5d611ad2cadbc7201daf4350113f9f4c03edb7c46ec`.

Ambos batches exigen un snapshot revisado de esa misma fase en mayami.ugc.approved_snapshot. Comparan dentro de la transacción definiciones/ACL/policies y el conteo afectado en preparación; sin parámetro, con deriva, fase incorrecta o estado ya aplicado, se detienen. Los límites de espera se fijan antes del primer lock (5s lock/60s statement). El parámetro es una guarda operacional, no prueba por sí mismo la aprobación humana o identidad del proyecto.

**No hay snapshot hospedado aprobado en la entrega.** Primero verificar externamente Marketplace/mimnotafmfasvwrclxan; PostgreSQL no demuestra esa identidad. Las huellas locales sólo acreditan fixtures y nunca se reutilizan contra otro proyecto. Después del preflight hospedado hay que contrastar el delta y aprobar específicamente batch+snapshot. No ejecutar db push de toda la rama ni sobrescribir funciones con deriva.

## Pruebas finales y evidencia

Cluster nuevo PostgreSQL17.11 loopback56539, datos vacíos y34migraciones exactas antes de fixtures, sin clone/seed/remoto. PostgREST16.5 y authSQL mínimo; JWT sintético anterior reutilizado, ninguna credencial externa creada. Otra base nueva del mismo cluster permitió probar desde las32migraciones previas el batch completo de preparación/activación.

| Grupo | Resultado y alcance |
|---|---|
| PG/REST |29grupos PASS:19regresión B1,7paginación/filtros/aislamiento y3contexto/mine/concurrencia de moderación |
| Móvil |7grupos PASS sobre handlers TSX y helpers reales con QueryClient/MutationObserver reales y puertos React/UI/API: gateoff, cancelar, cuatro objetivos, retry, bloqueo/undo, errores, doble toque, actor/versión |
| Panel |14grupos PASS: filtros/páginas, consentimiento, cancelación, errores, cola/contexto, moderación separada, owner mismatch, ABA y tres dobleclics con MutationObserver real |
| Cliente/caché/bridge |16tests Node PASS: contratos, epoch, autorización de operaciones, cache/persistencia quirúrgica, fallos de disco simulados, foreground y callbacks reales de ambos AuthProviders con puertos controlados |
| Auth nativo anterior |9regresiones PASS con SDK instalado/puertos sintéticos; no se reabrió admisión de sesión desde URL |
| Delta SQL |6grupos PASS: snapshot ausente/fase incorrecta/repetición rechazados, saneo sólo del aviso UGC histórico con pago intacto, preparación gatefalse, activación separada y locktimeout5s con solapamiento real |
| Estáticos |Tipos API/móvil/panel/db-tests, lint móvil y lint focal panel PASS; diffcheck correcto |
| Advisors |Security/warn local results[]; no es una auditoría completa |
| Privilegios generales |4/5: misma diferencia preexistente favorites_merge_intent ausente de EXPOSED; no se relajó ni maquilló. Permisos exactos UGC verificados aparte |

Los resultados anteriores a correcciones no se suman: quedan conservados. Se corrigieron por evidencia: doble toque asíncrono, ventana owner/auth, publicación de owner en recuperación y primer lock sin timeout. Un fallo de arnés omitía un import simulado; se conservó y corrigió sin cambiar producto para verde.

Revisión independiente focal identificó esos puntos; implementados y probados. No hay validación DOM/nativa, capturas claro/oscuro, teléfono, SDK/Auth hospedado, caché física o Play. No se compitió con el trabajador de emulador delvc3. Los puertos de test no certifican apariencia ni aceptación Google.

## Orden de transición y bloqueos externos exactos

1. Verificar proyecto/cuenta MIM y ejecutar sólo el preflight de lectura autorizado en una tanda posterior. Comparar hashes, ACL y conteo real; cualquier deriva requiere reconciliación, nunca sobrescribir a ciegas.
2. Aprobar exactamente preparación+snapshot; aplicar una vez, verificar historia/avisos/funciones y gatefalse. El panel y la app anteriores conservan su comportamiento durante preparación.
3. Distribuir panel y app compatibles por vías autorizadas y comprobar recepción, normas, lectura paginada, denuncia/bloqueo/reversión y purga de caché. El cliente nuevo depende de ese backend preparado: no publicarlo antes. La UI falla de forma explícita si faltan contratos/normas, sin fallback raw ciego.
4. Acreditar estrategia para versiones antiguas: actualización compatible recibida o nueva versión obligatoria para publicar UGC. El servidor activado exigirá aceptación quevc3 no ofrece; no activar suponiendo que todos se actualizaron. No afecta catálogo, compras, pedidos o reclamos, pero publicar opiniones desde un cliente viejo requiere actualización. No se promete compatibilidad OTA sin comprobar runtime/recepción.
5. Sólo tras verificación de clientes y nueva aprobación de activación+snapshot: cerrar ACL raw/habilitar gate y verificar por lectura/recorridos independientes. Mantener datos privados al recuperar; no reabrir rawREST o saltar términos como rollback.
6. Nuevo AAB, revisión visual/nativa e IARC/Play quedan para una tanda autorizada. Hoy elvc3 sigue siendo el candidato anterior sin estos controles. Esta preparación no autoriza marcar controles como publicados ni garantiza aceptación de Play.

Bloque2 local cerrado. No hay un bloqueo de implementación abierto en los casos probados; faltan el preflight/aprobaciones y verificaciones externas indicadas. El panel mantiene cola acotada100 por tanda con actualización al resolver, sin paginación ficticia. La identidad pública tienda no identifica empleados históricos ni bloquea canales legítimos de reclamos. Sin servicios con cargos ni resets de cuota.

Los procesos de esta prueba quedaron detenidos y los puertos56539/56540 cerrados. El AABvc3 conserva SHA256 `eb8243732509e141fb3e4211be539a702afd063bbb21dcde49872362a3570f23`.
## Entrega recuperable y fuente fijada

Fuente final: `737839c939d8fc5a69be5027c868ae6c2da88876`; árbol `ba0cc9ef2d85e65b01d6943e3189702cee21e5a1`; base `207c489e198f2c78035526c3c95be5cd8f8c4ea7`. El repositorio aislado quedó limpio. Este registro en la rama compartida sólo incorpora documentación y recibos: no integra código de ejecución ni publica la fuente.

Paquete: `/Users/brandeastudio/Downloads/Mayami-UGC-Bloque2-Local-2026-11-09/MAYAMI-UGC-Bloque2-Local-2026-11-09.tar.gz`, 420233 bytes; SHA256 `859bd8c80bd4eeeaf15754a3d2cad5c8ab75f0bf60c4ac35e2ab0b132651ccc0`. Incluye fuente modificada, patch, bundle incremental verificado y evidencia; 77 miembros contrastados byte a byte. El bundle requiere la base207c489. No incluye JWT, configuración privada, bases, AAB ni snapshot hospedado aprobado.

Recibos persistentes: [validación final](propuestas/ugc-block2-20261109/FINAL_VALIDATION.json), [entrega](propuestas/ugc-block2-20261109/DELIVERY_RECEIPT.json), [PG/REST](propuestas/ugc-block2-20261109/PG_REST_RESULTS.json), [móvil](propuestas/ugc-block2-20261109/MOBILE_RUNTIME_RESULTS.json), [panel](propuestas/ugc-block2-20261109/PANEL_RUNTIME_RESULTS.json), [delta](propuestas/ugc-block2-20261109/DEPLOYMENT_RESULTS.json), [estáticos](propuestas/ugc-block2-20261109/STATIC_RESULTS.json), [privilegios heredados](propuestas/ugc-block2-20261109/privileges.results.json) y [parada](propuestas/ugc-block2-20261109/STOP_RECEIPT.json). Los scripts/logs completos permanecen en el paquete y en `.local/ugc-block2-20261109` / `.local/ugc-block2` del worktree aislado.
