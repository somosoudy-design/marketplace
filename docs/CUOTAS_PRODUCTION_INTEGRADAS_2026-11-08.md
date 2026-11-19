# Cuotas de preventa: integración production local · 8 de noviembre de 2026

La integración local está terminada en `da803460fcc3f819b0bbd896de58438207ace5d7`, árbol `8d6307c16c04a18bd3fa3bc4be25da1c4598d853`, padre `bb3de95871419ac35afb213067d02c9e6cd02835`. El preflight hospedado quedó resuelto a las 12:03 de Venezuela del 8 de noviembre: la coordinación ejecutó la consulta exacta una vez y este hilo revisó el recibo. Coinciden los metadatos esperados; la migración sigue ausente y no se aplicó. Los timeouts anteriores quedan superados como bloqueo. [Resultado y acción delimitada](PREFLIGHT_CUOTAS_HOSPEDADO_2026-11-08.md).

## Qué cambió

Se integraron exactamente los 17 archivos de cuotas validados en `1e8938ad1beedab31514bc52512d4f78fe7ddfa9`: presentación en producto, carrito y checkout móvil/web, preferencia de plan durante autenticación, tipos, core, migración y pruebas. Son tres pagos en total: primero hoy y siguientes a los 15 y 30 días. El servidor sigue determinando importes y elegibilidad; se conservan recargos, intervalos, otros anticipos, reglas de carritos mixtos e historial. La excepción de elegibilidad omite mínimo y restricción de flujo sólo para carritos íntegramente válidos reservables/por encargo, con suelo aritmético USD 0,03; puede incluir seller_shipping. No modifica los flujos guardados del plan.

Los 9 archivos de identidad/configuración Android y legales de bb3de958 permanecen idénticos. Se excluyeron Google, correo, administración, cosmética y documentación ajena. Se añadieron únicamente tres archivos de pruebas focales: navegación móvil, fixture de puertos Expo Router y configuración Vitest acotada. No se sustituyeron fuentes activas del checkout compartido por blobs antiguos. El AAB ya entregado no cambió.

## Validación y límites

- **30/30 pruebas focales**, cinco suites, en la fuente aislada: 8 de presentación, 14 de retorno/navegación web, 5 de enlaces legales y 3 nuevos casos móviles de preferencia sanitizada, destinos seguros y fallback. Comando: `pnpm exec vitest run --config tools/eas/installments-integration.vitest.config.mjs`.
- Tipos de móvil y storefront, lint de los archivos funcionales afectados y `git diff --check`: aprobados. Revisión independiente favorable, 17/17 blobs de cuotas y 9/9 protegidos exactos.
- Se reutiliza la evidencia previa de **299 pruebas**: 124 core y 175 adicionales, que incluyen 22 SQL. Sus 20 hashes se verificaron; no se repitió esa matriz. Los 30 focales se solapan con ella y no deben sumarse como 329 casos distintos.
- Los 3 casos móviles nuevos también pasan en la rama compartida. Allí se seleccionaron sólo esos casos: 27 no seleccionados, mientras que la fuente aislada ejecutó los 30.
- El primer intento Vitest falló por alias y resolución Flow. Se corrigió el arnés, usando core real y puertos Expo Router simulados, sin desactivar pruebas. Los tipos web fallaron inicialmente por una carpeta `.next/dev/types` generada desde otra fuente; se conservó en evidencia ignorada y se regeneró. No se modificaron rutas del producto para superar ese fallo.

No hubo nuevo render, captura claro/oscuro, dispositivo, compilación, export, prueba nativa u OTA. Las capturas y builds previos pertenecen a su fuente original. Estos checks no prueban recepción nativa ni comportamiento remoto. Esta fuente es para integrar Android production; su storefront completo tiene una base anterior a los últimos legales públicos y no debe publicarse como reemplazo web.

## Preflight hospedado resuelto; activación pendiente

La consulta exacta de lectura se ejecutó una sola vez por la coordinación, sin filas personales ni mutaciones. Recibo SHA256 `a9d7f8386e252c1f9c99f5a3b6ad0271c69984016a7dde9883a7fe5c90849739`: versión y helper ausentes, cuerpos previos/atributos/ACL y plan exactos, cierre conservado en los 17 ámbitos inspeccionados. Root contrastó 171 metadatos, con revisión independiente y sin repetir consultas o pruebas de producto.

Las dos cadenas definition capturadas no son respaldo byte a byte de los cuerpos cuyo MD5 calculó el servidor; no deben usarse para DDL o rollback. La propuesta sólo utiliza la migración original SHA256 `5f929adbcc1ccc5063599ce88bd54ce101f2749d2df617d8dea5b559ceb0d653`, con sus guardas intactas. No se infiere deriva por esta limitación de captura ni se oculta el límite. [Resultado completo](PREFLIGHT_CUOTAS_HOSPEDADO_2026-11-08.md) y [acción exacta posterior](propuestas/cuotas-production/ACTIVACION_PROPUESTA.md).

La migración todavía no se aplica. Preparar/revisar un batch único por el mecanismo existente del SQL Editor, con guardas atómicas, fuente literal, aserciones, registro estándar y COMMIT; después reconciliar por lectura focal independiente. No publicar HEAD compartido ni restaurar require_user, políticas o triggers de cierre desde la base antigua. No ampliar permisos como atajo.

## Recuperación y entrega

[Manifiesto de fuentes](propuestas/cuotas-production/source-manifest.json), [validación](propuestas/cuotas-production/validation.json) y [revisión independiente](propuestas/cuotas-production/REVISION_INDEPENDIENTE.md). [Patch bb → da](propuestas/cuotas-production/source.patch), SHA256 `9456e985ef7aedfe5898821f13df0ac86910488def56c22e5fe1b8d2d27e2e3a`; [patch completo 59e88a07 → da](propuestas/cuotas-production/full-source.patch), SHA256 `67a23f00822cd8c9314129345a55bb0915d241a3d057049494bb1347a3fa4a94`. Aplicarlos sólo en una fuente aislada apropiada, nunca sobre HEAD compartido sin reconciliar. El árbol recuperado debe coincidir con `8d6307c16c04a18bd3fa3bc4be25da1c4598d853`.

El bundle local conserva ambos commits sobre `59e88a07a53338678c29aaf16a824daa7b31d58c`; `git bundle verify` aprobado. Ruta: `/Users/brandeastudio/.codex/worktrees/mayami-play-privacy/marketplace/.local/installments-production-20261108/source.bundle`, SHA256 `65a67eae7fa342ee1e36cf96f7e4bec456ad41347b13fb8d010e6b5ae591ac5a`. Logs y recibos: `.local/installments-production-20261108/` de la fuente aislada y del checkout principal. El checkpoint compartido conserva patches y pruebas sin mezclar los otros frentes activos.

Sin SQL aplicado, grants, compras/pagos reales, publicaciones, nuevos AAB, cambios de claves, activaciones de correo/Google o servicios con cargos. El bloque local y el preflight se cierran con revisión terminada; la migración y la publicación siguen pendientes. No se presenta como app ya actualizada o cuotas nuevas activas en el backend.
