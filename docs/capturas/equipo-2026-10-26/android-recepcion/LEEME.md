# Android: publicación confirmada, recepción en emulador bloqueada

EAS40413225725 publicó correctamente Android `preview`, fuente8233df7, runtime exacto APK5. Lectura real de EAS40416237747 observa:

- ID Android: `01a17a59-84da-79e1-a24e-ae78498e7c1c`.
- Grupo: `9c671692-ae0a-44c0-ad59-09071ba7d0b7`.
- Fecha:26oct2026,22:34:09UTC /18:34:09 Venezuela.
- Rama/canalpreview, actualización compatible más reciente, sin rollback.
- `isGitWorkingTreeDirty:true`; no declararlo limpio. El workflow creaba un JSON no ignorado en el repo antes de que EAS calculase ese indicador. Root reprodujo ese mecanismo y lo corrigió para publicaciones futuras, sin republicar este JS. La observación permanece roja por ese indicador, no se presenta como aprobación nativa.

Recepción50/40416237632: EAS confirma build histórico `d1d10c28-1d9e-4123-8487-602dc10b9710`, paquete/canal/runtime/commit/versionCode exactos. Su enlace venció24oct04:08:34UTC. Se solicitó `applicationArchiveUrl` de nuevo y se intentó descargar **una sola vez**: HTTP404. No se instaló APK, no abrió emulador y no se ejecutaron flujos19/20 ni hubo capturas Android.

No repetir URLs o investigaciones idénticas ni generar APK nuevo. Para completar esta verificación se necesita una copia autorizada del mismo binario APK5 conservada en otro almacén. La app ya instalada puede recibir la OTA sin reinstalar; comprobar **Cuenta → Diagnóstico → Código** con el ID Android arriba. Eso requiere evidencia del teléfono para acreditar recepción física; esta carpeta no la contiene.

`recepcion-bloqueada.json` conserva las annotations públicas, fuentes y límites. Sin URLs firmadas, tokens o cuerpos privados. Las capturas web están en la carpeta móvil y no se presentan como Android.
