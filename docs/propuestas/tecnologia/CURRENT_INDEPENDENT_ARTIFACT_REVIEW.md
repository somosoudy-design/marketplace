# Revisión independiente del artefacto reconciliado · Tecnología

Dictamen favorable de identidad, integridad y aislamiento local del artefacto nuevo. Sin discrepancias en los controles descritos; no se ejecutaron build, suites, HTTP o despliegue.

- Fuente `064f4729dc8c2680859bb38c1338f274906465c3`, árbol `cef8efa772bca94e28db4f49caa3591dda83fb0c`, base pública documentada `db41707f0c35e7e4e50373321225b03a2fd6ade0`.
- BUILD_ID `oRxefyBw9hH3OMgOr-mio` coincide en manifiesto, `.next` y assets OpenNext.
- Tar: **20.417.415 bytes**, SHA256 `25c98ea7b88dc52f285c7a6912c49f93028bffcf6f2e57da556b119dde035bea`. Manifiesto SHA256 `406086db3cd077b4009c6869aebcfe61541811f9133109f6513e9644903b07d6`. Ambos coinciden con la identidad entregada.
- Las **2.294 entradas** coinciden entre tar/manifiesto/disco: 2.273 archivos regulares con tamaño/SHA correctos y 21 enlaces relativos válidos que resuelven dentro de `.open-next`. Sin duplicados, traversal o entradas adicionales. El inventario actual completo de `.open-next` tiene 1.584 entradas, exactamente las previstas en el manifiesto.
- Máscara compilada idéntica: 19.027 bytes, SHA256 `046d5825ab82a348b98b6c47cc7ff077851f06cdb623c55888aaacd129fa44a2`. La procedencia compilada requiere el JPEG `da3eea0c-d7cc-4afb-bb73-2ad29bfb3184.jpg`, con SHA `0eb198ff2389e39568eff25de22c7ef0a4afe4898871c483584f53b713576ad8`, igual al cleanInput y JPEG descargado ya revisado. El nuevo path y referencia de máscara están presentes juntos en el chunk SSR de Home y en handler.mjs. No es el artefacto b9a09a0e descartado.
- Fuente frente a db41707f: exactamente seis paths visuales. `visual-only-current.patch` coincide con el diff binario de fuente y SHA256 `27d5d459bd7547d567e5218300fc3af48119cf8b0ec02b66352f2ab26c45817b`. Ningún otro path de Google, cuotas o Android se incorpora. `pnpm-lock.yaml`, wrangler.jsonc, open-next.config.ts, config/brand.json y package.json del storefront conservan bytes entre base, fuente y disco.
- Sin env/dev.vars, keystore, credenciales o Google Services en las entradas. La búsqueda acotada de formatos de clave privada, tokens Supabase secretos y JWT service_role no detectó coincidencias. No constituye una auditoría universal de secretos.

Se revisaron bytes y metadatos locales; no se repitieron pruebas visuales ni funcionales. La revalidación del Worker público, el recorrido real y las capturas pertenecen al integrador/revisor web. Esta revisión no declara que el candidato ya esté publicado. El tar conserva el alcance Worker/OpenNext y entradas de gates; no se afirma portabilidad de Next standalone genérico.

Detalle: `INDEPENDENT_ARTIFACT_REVIEW.json`.
