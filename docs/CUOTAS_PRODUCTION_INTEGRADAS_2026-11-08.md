# Cuotas de preventa: integración production local · 8 de noviembre de 2026

La integración local está terminada en `da803460fcc3f819b0bbd896de58438207ace5d7`, árbol `8d6307c16c04a18bd3fa3bc4be25da1c4598d853`, padre `bb3de95871419ac35afb213067d02c9e6cd02835`. El preflight remoto queda pendiente: el controlador de Chrome agotó el tiempo antes de ejecutar SQL, incluso en el intento explícito posterior a la reconexión. No es una nueva denegación de Supabase ni requiere inferir credenciales nuevas. La coordinación cerró los intentos de navegador y este bloque continúa sólo por CLI local.

## Qué cambió

Se integraron exactamente los 17 archivos de cuotas validados en `1e8938ad1beedab31514bc52512d4f78fe7ddfa9`: presentación en producto, carrito y checkout móvil/web, preferencia de plan durante autenticación, tipos, core, migración y pruebas. Son tres pagos en total: primero hoy y siguientes a los 15 y 30 días. El servidor sigue determinando importes y elegibilidad; se conservan recargos, intervalos, otros anticipos, reglas de carritos mixtos e historial. La excepción de mínimo sólo corresponde al carrito íntegramente reservable/por encargo validado por el servidor.

Los 9 archivos de identidad/configuración Android y legales de bb3de958 permanecen idénticos. Se excluyeron Google, correo, administración, cosmética y documentación ajena. Se añadieron únicamente tres archivos de pruebas focales: navegación móvil, fixture de puertos Expo Router y configuración Vitest acotada. No se sustituyeron fuentes activas del checkout compartido por blobs antiguos. El AAB ya entregado no cambió.

## Validación y límites

- **30/30 pruebas focales**, cinco suites, en la fuente aislada: 8 de presentación, 14 de retorno/navegación web, 5 de enlaces legales y 3 nuevos casos móviles de preferencia sanitizada, destinos seguros y fallback. Comando: `pnpm exec vitest run --config tools/eas/installments-integration.vitest.config.mjs`.
- Tipos de móvil y storefront, lint de los archivos funcionales afectados y `git diff --check`: aprobados. Revisión independiente favorable, 17/17 blobs de cuotas y 9/9 protegidos exactos.
- Se reutiliza la evidencia previa de **299 pruebas**: 124 core y 175 adicionales, que incluyen 22 SQL. Sus 20 hashes se verificaron; no se repitió esa matriz. Los 30 focales se solapan con ella y no deben sumarse como 329 casos distintos.
- Los 3 casos móviles nuevos también pasan en la rama compartida. Allí se seleccionaron sólo esos casos: 27 no seleccionados, mientras que la fuente aislada ejecutó los 30.
- El primer intento Vitest falló por alias y resolución Flow. Se corrigió el arnés, usando core real y puertos Expo Router simulados, sin desactivar pruebas. Los tipos web fallaron inicialmente por una carpeta `.next/dev/types` generada desde otra fuente; se conservó en evidencia ignorada y se regeneró. No se modificaron rutas del producto para superar ese fallo.

No hubo nuevo render, captura claro/oscuro, dispositivo, compilación, export, prueba nativa u OTA. Las capturas y builds previos pertenecen a su fuente original. Estos checks no prueban recepción nativa ni comportamiento remoto. Esta fuente es para integrar Android production; su storefront completo tiene una base anterior a los últimos legales públicos y no debe publicarse como reemplazo web.

## Preflight remoto preparado, sin ejecutar

[Consulta exacta](propuestas/cuotas-production/PRECHECK_READONLY.sql), SHA256 `e1b4ef64f775d7be26a5192fc49c439dc22ab95fd56bf6794ddb3691cdcbd47e`. Contiene una consulta SELECT de metadatos, dentro de `BEGIN TRANSACTION READ ONLY` / `ROLLBACK`: versiones, cuerpos/atributos/permisos de funciones, esquemas, RLS, guardas de cierre y términos de `three_parts`. No consulta clientes ni ejecuta RPC comerciales. Sólo tuvo revisión manual; no se ejecutó ni parseó en PostgreSQL. [Expectativas locales](propuestas/cuotas-production/EXPECTATIONS.json) no son prueba del estado hospedado.

La migración exacta es `20261107203116`, SHA256 `5f929adbcc1ccc5063599ce88bd54ce101f2749d2df617d8dea5b559ceb0d653`. Sus guardas `md5(prosrc)` siguen siendo `2052c218ca383e8366fd8bf85b27a833` para `_build_checkout` y `62fee35a611d6593055bad973f016d6b` para `product_detail_commercial`. No se ajustaron hashes, grants o seguridad. No se reintentó el conector denegado, no se utilizó la cuenta incorrecta del CLI y no se extrajeron credenciales o cookies.

Próxima acción remota concreta: cuando funcione el controlador oficial, confirmar cuenta y proyecto **Marketplace / mimnotafmfasvwrclxan** en la UI, ejecutar una vez la consulta de lectura y comparar el recibo de forma independiente. Si la versión ya está instalada exactamente, no reaplicarla. Si está ausente y coinciden guardas previas, atributos y términos, preparar la activación exacta como acción posterior delimitada. Ante estado parcial, duplicados o diferencias, detenerse y reconciliar. Nunca restaurar `require_user`, las políticas restrictivas `account_open_only` o los triggers `account_00_open` desde la instantánea vieja de cuotas. El estado hospedado actual sigue siendo desconocido.

## Recuperación y entrega

[Manifiesto de fuentes](propuestas/cuotas-production/source-manifest.json), [validación](propuestas/cuotas-production/validation.json) y [revisión independiente](propuestas/cuotas-production/REVISION_INDEPENDIENTE.md). [Patch bb → da](propuestas/cuotas-production/source.patch), SHA256 `9456e985ef7aedfe5898821f13df0ac86910488def56c22e5fe1b8d2d27e2e3a`; [patch completo 59e88a07 → da](propuestas/cuotas-production/full-source.patch), SHA256 `67a23f00822cd8c9314129345a55bb0915d241a3d057049494bb1347a3fa4a94`. Aplicarlos sólo en una fuente aislada apropiada, nunca sobre HEAD compartido sin reconciliar. El árbol recuperado debe coincidir con `8d6307c16c04a18bd3fa3bc4be25da1c4598d853`.

El bundle local conserva ambos commits sobre `59e88a07a53338678c29aaf16a824daa7b31d58c`; `git bundle verify` aprobado. Ruta: `/Users/brandeastudio/.codex/worktrees/mayami-play-privacy/marketplace/.local/installments-production-20261108/source.bundle`, SHA256 `65a67eae7fa342ee1e36cf96f7e4bec456ad41347b13fb8d010e6b5ae591ac5a`. Logs y recibos: `.local/installments-production-20261108/` de la fuente aislada y del checkout principal. El checkpoint compartido conserva patches y pruebas sin mezclar los otros frentes activos.

Sin SQL aplicado, grants, compras/pagos reales, publicaciones, nuevos AAB, cambios de claves, activaciones de correo/Google o servicios con cargos. El bloque local se cierra con preflight pendiente; no se presenta como una app ya actualizada o backend activo.
