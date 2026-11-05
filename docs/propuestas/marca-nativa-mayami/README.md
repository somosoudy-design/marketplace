# Propuesta nativa Android mayami — pendiente de autorización

Esta carpeta contiene una preparación revisable. **No se ha aplicado el parche, ejecutado prebuild, construido APK ni publicado.** La preparación de PNG en la carpeta de propuesta está autorizada; no activa los recursos en la app. El código actual sigue siendo compatible con APK 5.

## Causa comprobada de la K al abrir

- `apps/mobile/app.config.ts:75–80` referencia `assets/images/violet/splash-icon.png` y su variante oscura. La inspección visual confirma el símbolo K. Icono adaptativo, monocromo y notificaciones también conservan K.
- `apps/mobile/src/app/_layout.tsx:31–54` mantiene el splash nativo mientras carga fuentes y recupera sesión. No dibuja otra introducción JS ni un logo K. Las dos cabeceras de Inicio ya usan BrandMark original mayami.
- El plugin instalado `expo-splash-screen/plugin/src/withAndroidSplashStyles.ts:50` fija `windowSplashScreenAnimatedIcon` a `@drawable/splashscreen_logo`. La imagen es un recurso compilado. Su API JS permite ocultar/retener el splash y configurar duración, pero no sustituir el bitmap instalado.
- El fallback de iniciales sin nombre de `ProfilePhoto.tsx` conservaba K; corregido por root a icono de persona en este incremento OTA, separado del arranque nativo.

**Solución real:** un APK Android nuevo con los originales de Work. Una OTA no cambia el icono del sistema ni el splash ya compilado. No se propone overlay, segunda introducción ni retraso artificial para ocultar la K.

## Originales verificados

Fuente: `MAYAMI_Kit_Vectorial_v3.zip` proporcionado por Oliver. SHA256 del ZIP: `22574beeae113122dfb669149b86e4729dcf87122674a3d54523bc09aae307d1`.

Ocho archivos originales se copiaron byte a byte a `originales/`. Origen exacto, tamaño y SHA256 de cada uno: `originales-manifest.json`. Root ejecutó la receta de preparación: cinco PNG y hashes disponibles en `prepared-assets/`, sin activar configuración ni compilar APK.

| Recurso Android previsto | Original | Tratamiento previsto |
| --- | --- | --- |
| Icono estático | App/MAYAMI_App_1024.png | Copia exacta, 1024 × 1024 |
| Foreground adaptativo y monocromo | SVG/MAYAMI_Simbolo_Blanco.svg | M original blanca sobre transparencia; escala uniforme y centrada, sin alterar trazados |
| Splash claro | PNG/MAYAMI_Simbolo_Violeta_1200.png | Copia exacta, 1200 × 1120; imageWidth 96, fondo actual #F8F7FC |
| Splash oscuro | PNG/MAYAMI_Simbolo_Blanco_1200.png | Copia exacta; imageWidth 96, fondo actual #110F18 |
| Notificaciones | SVG/MAYAMI_Simbolo_Optico_Blanco.svg | Máster óptico original para tamaño pequeño, blanco/transparente, raster 96 × 96 |

Se usa la M del kit para estas superficies compactas, no una palabra MAYAMI sobredimensionada. Adaptive: figura 450 × 420 dentro de lienzo 1024²; semidiagonal 307,77 px, menor al radio seguro Android 312,89 px (66 dp dentro de 108 dp). Preserva trazados, proporción y margen para máscaras. El fondo adaptativo usa el violeta existente; no conserva una segunda imagen de fondo K. La variante óptica de notificación corresponde al uso pequeño recomendado en LEEME del kit. El tamaño definitivo todavía debe comprobarse en launcher, máscaras y arranque de Android real/emulado antes de entregar el APK.

## Parche concreto, sin aplicar

`android-native-identity.patch` modifica únicamente:

1. `android.icon` y capas adaptativas en app.config.ts; conserva el icono global usado por iOS.
2. Etiqueta Android mediante un config-plugin de manifiesto: **mayami**, sin sufijo Preview. No cambia `config/brand.json`, nombre global Expo ni identificadores.
3. Override `android` de expo-splash-screen; la implementación instalada mezcla el override con los colores actuales y mantiene intacta la configuración iOS.
4. Icono de expo-notifications. El plugin tipa icon/color como Android; su implementación iOS sólo consume mode, sounds y enableBackgroundRemoteNotifications. Cambiar este icono no cambia su configuración iOS.

Paquete `com.example.kora.preview`, scheme `kora`, proyecto Expo, Firebase, canal `preview`, backend y enlaces permanecen iguales. La etiqueta visible será mayami; el nombre heredado de metadata Expo seguirá en el archivo compartido para no cambiar iOS. No se debe interpretar este nombre técnico heredado como cambio de marca pendiente.

## Receta portable y comprobaciones

Desde la raíz del repositorio, tras activar sus herramientas existentes:

```sh
node RUTA_DE_ESTA_CARPETA/verify-proposal.cjs
```

La prueba verifica los ocho hashes originales, sintaxis de la receta, aplicación limpia del parche **sin aplicarlo** y callback del plugin Android aislado: cambia la etiqueta, preserva paquete/scheme e iOS. No es prebuild ni compilación nativa.

Preparación permitida de recursos para revisar, sin tocar la app activa:

```sh
node RUTA_DE_ESTA_CARPETA/prepare-assets.mjs --output .local/logo-refine-20261105/native-proposal/prepared-assets
```

La receta produce cinco archivos y un manifiesto de hashes en el directorio indicado por `--output`; si se omite, usa `prepared-assets/` junto a la receta. Rechaza destinos dentro de `apps/`, no instala dependencias, no modifica fuente ni compila APK. Usa sharp ya disponible, copias de PNG originales y posicionamiento uniforme de SVG originales. Después de la autorización explícita para sustituir la identidad nativa, el integrador debe revisar esos resultados, copiar los cinco PNG a `apps/mobile/assets/images/mayami/` y aplicar el parche. **No se ha copiado ningún recurso a la app activa ni aplicado el parche.**

## Runtime y publicación

La fuente actual `5e096ce` conserva el fingerprint relativo `da033dbf2e656078bbc76aa353ad3ed3088134d1`, las mismas 63 fuentes y hashes de configuración nativa sin cambios. Evidencia: `fingerprint-comparison.json`. Este cálculo no tiene Firebase local; CI sigue verificando el runtime APK 5 exacto.

Aplicar la propuesta cambiará legítimamente el fingerprint: se necesita un APK nuevo. No forzar el runtime viejo ni añadir exclusiones. El workflow OTA actual exige APK 5, por lo que la nueva identidad requiere actualizar el control de publicación para el nuevo runtime una vez construido y comprobado. Conservar `preview` es posible: EAS selecciona por runtime; una OTA nueva no actualizará recursos del APK 5. No renombrar el paquete, no cambiar firma y no desinstalar para migrar; el nuevo APK debe instalarse encima con versionCode mayor y la firma actual para conservar datos.

Antes de entregar: verificar fingerprint real, firma, paquete y versionCode; launcher y splash claros/oscuros; máscaras circular y cuadrada, monocromo y notificación; arranque en frío, sesión y enlaces existentes; recepción OTA del nuevo runtime. No se afirma ninguna de estas pruebas nativas futura como ejecutada.
