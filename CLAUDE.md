# CLAUDE.md

Lee primero **`AGENTS.md`**: ahí están las reglas, el inicio de turno, los checkpoints y el relevo. Este
archivo solo agrega lo que es propio de trabajar con Claude; si algo choca, gana `AGENTS.md`.

## Antes de empezar

- La memoria de Claude y el historial de una conversación no son la fuente de verdad: el repositorio sí.
  Empieza por `docs/ESTADO_ACTUAL.md` aunque recuerdes el proyecto.
- Responde a Oliver, Kevin y Heisber en español, corto y con lo que necesitan decidir primero.

## Claude Code en la nube (contenedor del proyecto)

- El contenedor no llega a `expo.dev` ni a `*.supabase.co` (el proxy los bloquea). Por eso:
  - Las compilaciones, las actualizaciones de EAS y el emulador corren en GitHub Actions; se disparan
    cambiando los archivos `.github/apk-preview-request`, `.github/eas-update-request`,
    `.github/apk-emulator-request` o `.github/apk-verify-request` (detalle en `docs/ENTORNO.md`).
  - El proyecto de Supabase se consulta y modifica con el conector de Supabase (`execute_sql`,
    `apply_migration`, `list_migrations`, `get_edge_function`, `deploy_edge_function`).
- El conector pide una confirmación para sentencias destructivas (`DELETE`, `DROP`) que Oliver no ve en su
  app, así que la tarea se queda colgada. No reintentes ni disfraces la sentencia: genera un archivo `.sql`
  para que Oliver lo ejecute en el SQL Editor de Supabase y explícale qué hace.
- `gh` funciona para consultar y disparar workflows. Si `gh run view --log` da 403, lee el registro con
  `get_job_logs` del conector de GitHub.
- `/mnt/project-files/marketplace` es una copia de seguridad que solo existe dentro del proyecto de Claude:
  `bash tools/backup-to-project.sh` la refresca. GitHub sigue siendo la fuente principal.
- No uses `pkill -f` con un patrón que aparezca en tu propia línea de comandos: usa los archivos `.pid`.

## Revisión visual

Claude puede ver capturas: después de tocar pantallas, genera las capturas
(`node tools/design/screens.mjs <carpeta> light|dark` con la versión web servida en `:8089`) y míralas antes
de dar el trabajo por bueno.
