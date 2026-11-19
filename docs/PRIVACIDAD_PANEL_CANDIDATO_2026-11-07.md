# Privacidad y panel: preparación local cerrada

7 de noviembre de 2026. Dos preparaciones acotadas; sin activación ni publicación. Backend conservado exactamente en `881765ffc6f2dac1f3e98c3171b2284840671f28`, incluidas sus dos migraciones. No desplegar el HEAD compartido, que conserva trabajo paralelo de Google, correos y cuotas.

## Textos candidatos

Sólo se cambian los cuerpos de privacidad y eliminación existentes en `apps/storefront/src/data/policies.json`, y una frase del acuse en Preferencias móvil. Se conservan estructura, enlaces, fecha de las páginas, resto de documentos y diseño.

- Datos diarios y archivos personales: retirada al completar el cierre verificado; una solicitud recibida todavía necesita revisión y no equivale a eliminación inmediata.
- Eventos de acceso de la cuenta comprendidos en el cierre y gestionados en SQL por Mayami: mínimos necesarios, 90 días desde cada evento. No se atribuye ese plazo a toda la auditoría Auth.
- Recibo operativo: 90 días desde la finalización verificada. Una conservación excepcional debe tener motivo concreto, alcance necesario y plazo finito; no retiene toda la cuenta.
- Marcador mínimo seudónimo: evita reactivar sesiones o repetir el cierre; revisión cuando cambie el mecanismo. No se presenta como anónimo ni como conservación del contenido del perfil.
- Historial comercial: revisión específica de finalidad/plazo, sin borrar pedidos ni inventar una obligación legal.
- Logs y backups del proveedor: ciclos separados; no conocemos un plazo físico individual comprobado para todos ellos. Los 90 días anteriores no se les extrapolan. Tampoco se aplica al usuario el plazo contractual de la DPA al terminar el servicio.

**No publicar este texto antes de activar y verificar backend, guardas/worker y ejecutor de retención.** Es copy candidato que describe el comportamiento local probado; no acredita ejecución en producción ni aceptación por Play.

## Panel con fuente precisa

Se añade `tools/panel/prepare-candidate.mjs` como preparación local sin llamadas de despliegue. Mantiene el canal de export compatible con EAS, sin modificar CI ni su control request-only. El request real de la rama tampoco cambia.

El helper comprueba repositorio exacto, SHA completo, padre del request, diff exclusivo del request, base ancestral, checkout limpio, ausencia de merges y rutas permitidas. Construye desde `git archive` del SHA, con dependencias offline/frozen y scripts de instalación deshabilitados. Verifica los blobs antes/después y excluye archivos locales ignorados o sin seguimiento; rechaza `.env` de build en el proyecto. El entorno del subproceso contiene sólo lo necesario y configuración pública de Marketplace.

Fuente compilada: `da9085c00f884f487a2ae4d35aed71a220d553a0`.
Árbol: `f3882527e424faee4ac0cc6a1a57e444456839e7`.
Request Git exclusivamente local: `b353eee4f31da780db80571bb57fa7c1a6d60b94` (un padre, la fuente anterior; no se publica ni se modifica el disparador).
Marcador: `candidate.da9085c00f88`.

Artefactos reales, bajo este checkout aislado:

| Archivo | Ruta relativa | SHA-256 |
|---|---|---|
| Panel, 245 archivos | `.local/panel-candidate-da9085c00f88/panel.tar.gz` | `7535b9b079c6cdc9e69155ae61501852634b09b569f40a742091011c6c505dcb` |
| Manifiesto e inventario | `.local/panel-candidate-da9085c00f88/manifest.json` | `c4155e02c64ee3ad41686debfb029e7bdae574dbd9dea7d912f303f82a09f184` |

En la misma carpeta: `export/`, `build.log`, `request-proof.txt`, `verification.json`, snapshot y tar de fuente. El manifiesto fija también hashes de lockfile, configuración pública, log, prueba del request y cada archivo. No contiene claves privadas. Los artefactos ignorados permanecen locales, no se suben a Git.

Rutas comprobadas por presencia de HTML: `/`, `/login`, `/admin`, `/vendedor`, `/admin/pedidos`, `/admin/pedidos/ver`, `/vendedor/productos/nuevo`, `/vendedor/productos/editar` y `/admin/tasas`. Rutas/cabeceras del export y marcador verificados; las dos páginas de detalle reciben su `id` por query, según el contrato existente. Esto no es recepción HTTP en hosting.

Verificación del paquete, sin reconstruir ni desplegar:

```bash
node tools/panel/prepare-candidate.mjs --verify .local/panel-candidate-da9085c00f88 c4155e02c64ee3ad41686debfb029e7bdae574dbd9dea7d912f303f82a09f184
```

Un segundo tar del mismo export produjo exactamente el mismo SHA. La normalización del empaquetado es determinista; no se afirma que dos compilaciones independientes de Next produzcan bytes idénticos. La futura publicación puede consumir este export aprobado mediante el canal EAS existente, sin reconstruir el HEAD compartido ni cambiar los controles de CI. Antes debe revalidarse el hash y completarse la activación y verificación del backend; cualquier publicación queda fuera de esta tanda.

## Verificación ejecutada

- 28/28 Node: request estricto existente, Git/ref reales, repositorios/SHA/diffs inválidos, snapshot contaminado, manifiesto/archivo/export alterados y render real en servidor de ambos textos.
- 5/5 Vitest de enlaces legales móviles; tipos y lint del panel aprobados.
- Un build real Next en snapshot limpio, instalación offline (431 paquetes reutilizados, cero descargados), export de 245 archivos y scanner sin claves privadas/backend local.
- Verificación por manifiesto congelado y segundo empaquetado del mismo export: aprobados.
- Revisión independiente de texto y procedencia: precisiones corregidas sobre alcance de auditoría y aislamiento de inputs. Sin otra matriz visual ni suites financieras/backend repetidas.

Log focal: `/Users/brandeastudio/marketplace/.local/play-local-prep-20261107/focused-tests.log`. Revisiones y propuestas en esa misma carpeta; build/log/manifiesto bajo el checkout aislado descrito arriba.

No hubo cambios remotos en Supabase, Cloudflare, EAS o Play; tampoco APK/OTA/AAB, firmas, fixtures, grants, cuentas, credenciales nuevas, soporte externo o cargos. El checkpoint de código/documentación no publica la app.

## Próxima acción concreta

Coordinar una tanda posterior de activación desde fuentes aisladas: preservar hook y permisos comprobados en el preflight; aplicar/verificar las dos migraciones de backend881 y guardas/worker; observar el ejecutor y su vencimiento real; después coordinar textos y frontends. Revisar límites externos sin inventar un TTL individual. La ruta exacta y sus guardas siguen en `PREFLIGHT_REMOTO_RETENCION_2026-11-07.md`. No repetir estos builds/tests sin una incidencia nueva ni activar el request del panel desde el HEAD combinado.
