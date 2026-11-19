# Revisión independiente del artefacto visual · 8 de noviembre de 2026

Dictamen favorable al artefacto exacto para la publicación visual delimitada. Sin discrepancias en los controles locales descritos. No es una comprobación nueva del Worker hospedado ni una ejecución de despliegue.

- Fuente `b9a09a0e1cc22e5bb7877d1e6713c9a54e4359f6`, árbol `6f0b52c4ec80fc4a5c86bb72fdb4146c6a803594`, base `db41707f0c35e7e4e50373321225b03a2fd6ade0`.
- `source.patch` coincide byte a byte con visual-only.patch autorizado, SHA256 `d53f464d89713d2af960f46f35ed5c7e90d089dc938d4fc1a79442e409f7b1c0`. La diferencia de fuente contiene exactamente los seis paths previstos. Todo otro path permanece en db41707f; no se arrastran Google, cuotas ni Android de 8846117.
- Archivo `storefront-candidate.tar.gz`: 20.417.404 bytes; SHA256 `31644dea4f2ef937382d40760f9e5c4e33576e78e3afadf4218042ac18b5345c`, idéntico al manifiesto.
- 2.294 entradas exactas en tar/manifiesto: 2.273 archivos regulares y 21 enlaces. Todos los tamaños, SHA y destinos corresponden a los archivos locales actuales. El inventario completo de `.open-next` contiene 1.584 entradas y coincide; no hay entradas adicionales o ausentes dentro de ese árbol. Los enlaces son relativos, resuelven dentro de `.open-next` y no están rotos; sin nombres absolutos, duplicados o traversal en el tar.
- BUILD_ID `DI7YJ2OpleQHTuunKINa6` coincide con `.next` y los assets de OpenNext. La máscara compilada conserva los 19.027 bytes y SHA256 `046d5825ab82a348b98b6c47cc7ff077851f06cdb623c55888aaacd129fa44a2` del original aprobado.
- `pnpm-lock.yaml`, `wrangler.jsonc`, `open-next.config.ts`, `config/brand.json` y package.json de storefront coinciden entre base, fuente y archivos locales. El lock SHA declarado coincide. No hay inputs env/dev.vars, keystore, credenciales o Google Services en el inventario. La búsqueda acotada de formatos de claves privadas, tokens Supabase secretos y JWT service_role no produjo hallazgos; esto no constituye una auditoría universal de secretos.

El tar es el artefacto Worker/OpenNext y entradas de verificación existentes; no se afirma portabilidad de un servidor Next standalone genérico. Se leyeron también package.py y el manifiesto. Los gates/build/tipos/lint aportados por el integrador no se repitieron. No hubo HTTP remoto, navegador, build nuevo, suites ni modificaciones versionadas.

Detalle mecánico de la revisión: `INDEPENDENT_ARTIFACT_REVIEW.json`. El integrador sigue a cargo de revalidar el destino hospedado y publicar exclusivamente este candidato según la autorización vigente.

## Límite operativo comunicado antes del despliegue

El integrador detuvo la publicación: el catálogo público observado por él usa actualmente la imagen Tecnología `da3eea0c-d7cc-4afb-bb73-2ad29bfb3184.jpg`, mientras el helper exacto de este artefacto sólo admite `c6dba434-37f6-4758-91e5-a65a028c2fc2.jpg`. Su smoke SSR local indicó ausencia de máscara. Esta observación procede del integrador; no se repitió aquí.

La integridad del paquete queda confirmada, pero **no acredita elegibilidad del catálogo vivo ni una corrección visual efectiva sobre esa imagen actual**. El dictamen anterior se limita a identidad, alcance e integridad local del artefacto. Este candidato no debe publicarse como solución visual efectiva hasta reconciliar la imagen vigente. No se modificó helper, reconstruyó ni desplegó. No se realizaron comprobaciones nuevas después del aviso.
