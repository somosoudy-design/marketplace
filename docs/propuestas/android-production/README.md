# Android producción: propuesta aislada

8 de noviembre de 2026. Fuente limpia: `59e88a07a53338678c29aaf16a824daa7b31d58c`, última fuente Android publicada conocida. Este directorio **no está importado ni activado**. No se modifican `apps/mobile/app.config.ts`, `apps/mobile/eas.json`, `config/brand.json`, paquetes, canales o requests de publicación.

## Resultado y decisión pendiente

`app.config.ts.template` corrige en una copia exclusiva de Android producción el nombre Expo a mayami, los hosts Android/router a mayami.app y el correo extra a soporte@mayami.app. Conserva los iconos/label Android Mayami existentes, permisos, configuración iOS original, proyecto Expo y política fingerprint. Conserva el scheme **kora**, que usa el retorno de pagos; no renombrarlo de forma aislada.

`eas.production.json` prepara únicamente base/production: distribución store, Android app-bundle, entorno/canal production, configuración pública anon de Marketplace y panel oficial. No habilita la presentación privada de catálogo ni incluye submit. Esto no demuestra que el futuro bundle excluya todos los recursos privados: el artefacto final necesita el scanner comercial correspondiente.

Propuesta de applicationId: **`app.mayami.marketplace`**, todavía **sin confirmar ni reservar**. No se halló una decisión/reserva de producción en el repositorio o historial consultados; no se consultó una reserva remota ni Play Console en esta tanda. El dominio no acredita por sí solo disponibilidad de un paquete. La plantilla rechaza el valor pendiente y `com.example`; la identidad propuesta se usa sólo como entrada sintética en las pruebas.

Antes de activarla, Oliver debe confirmar el applicationId o aportar el ya reservado. Al cambiarlo después de publicar, Play considera la entrega otra app. [Identidad Android oficial](https://developer.android.com/build/configure-app-module#application-id). Cambiar el valor `MAYAMI_ANDROID_APPLICATION_ID` del perfil por el confirmado forma parte de esa activación posterior; no se creó ninguna variable remota.

## Por qué no se integra en la configuración activa

La versión instalada de `@expo/fingerprint` incluye el archivo **entero** `eas.json` como fuente `easBuild`; configuración resuelta y módulos cargados también participan. Editar sólo el bloque production no conserva necesariamente el runtime preview. La comprobación local encuentra expresamente `eas.json` entre las fuentes. Ver `docs/ENTORNO.md`, sección10.

Por ello, las plantillas se mantienen fuera de `apps/mobile`, `config` y `packages`. Su copia de producción rechaza preview/iOS para evitar utilizarla accidentalmente como fuente de OTA. La fuente activa de preview conserva paquete, scheme, assets, runtime policy y canales byte por byte. No se fuerza una huella ni se excluyen fuentes. La igualdad local de fingerprint antes/después se registra en el recibo; se calcula sin `GOOGLE_SERVICES_JSON`, por lo que **no acredita el hash literal del APK instalado**.

## Validación focal

```bash
node --test docs/propuestas/android-production/verify.test.cjs
```

Cuatro pruebas con resolución **real de Expo config** en fixtures ignoradas: propuesta sintética válida; identidad ausente/provisional rechazada; preview/iOS rechazados en la copia; perfil AAB y configuración pública exactos. También se comprobaron tipos TypeScript estrictos de la configuración y esquema real de EAS CLI24.12.1, sin llamar a servicios remotos. Hash local preview idéntico antes/después: `ccbac2f55b3a72ea6cf04871d415813c4ff6690e`. [Recibo acotado](validation.json). No hay nuevo cliente de autenticación ni servidor local.

El 8nov, GET públicos devolvieron HTML200 en `/contacto`, `/privacidad` y `/terminos`, con soporte@mayami.app publicado. Esto verifica publicación del contacto, **no entrega de correo o buzón**. `/.well-known/assetlinks.json` devuelve404: los App Links Android verificados siguen pendientes del applicationId y certificado reales. No se publica un certificado ni una asociación propuesta.

## Próximo build, todavía no autorizado ni ejecutado

1. Confirmar applicationId y comprobar si existe una identidad previa. Autorizar por separado el uso o creación de firma/credenciales necesarias; no generar una keystore automáticamente.
2. En una copia limpia dedicada exclusivamente a producción Android, copiar `app.config.ts.template` a `apps/mobile/app.config.ts` y `eas.production.json` a `apps/mobile/eas.json`; sustituir el identificador pendiente por el confirmado. Registrar un commit exclusivo de activación y resolver otra vez su configuración. **No usar el HEAD compartido ni enviar OTA/preview desde esa copia.**
3. Desde `apps/mobile` de esa fuente de producción, cuando se autorice el build:

```bash
APP_VARIANT=production EAS_BUILD_PLATFORM=android npx --yes eas-cli@24.12.1 build --platform android --profile production
```

Esta tanda no autoriza ese comando, firmas, nuevas credenciales, cargos, envío a Play ni publicación. El perfil preparado declara AAB; no existe un AAB firmado producido o inspeccionado aquí. El estado actual de verificaciones de Play Console no se revalidó y no se da por completado.

## Requisitos del artefacto final

Al8nov2026, apps nuevas de teléfonos deben apuntar a **Android16/API36 o superior**; el plazo general fue31ago y la prórroga terminaba1nov2026. [Requisito oficial de Play](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en).

La guía actual exige soporte16KB en dispositivos64bit para apps que apunten a API35+. Su versión del4nov sitúa el bloqueo de actualizaciones incompatibles en1feb2027; no autoriza inferir una exención para una app nueva. Deben verificarse alineación ZIP y segmentos ELF de todas las bibliotecas64bit, incluidas dependencias. SDK/AGP/NDK declarados no prueban el binario. [Guía Android vigente](https://developer.android.com/guide/practices/page-sizes).

Sobre el AAB final, sólo lectura:

```bash
bundletool dump manifest --bundle=Mayami.aab --module=base
bundletool dump config --bundle=Mayami.aab
```

Comprobar applicationId, versionCode y targetSdkVersion>=36, además de PAGE_ALIGNMENT_16K. Sobre APKs derivados existentes, usar `zipalign -c -P 16 -v 4 Mayami.apk`; revisar también LOAD>=2**14 y GNU_RELRO según la guía y ejecutar el artefacto final en un entorno16KB posteriormente autorizado. No generar APKs con una nueva firma debug como atajo. En este Mac hay zipalign/apkanalyzer; no se halló NDK en el directorio estándar revisado. Ninguna de estas verificaciones del binario se declara aprobada.

Este bloque Android no modifica la cuenta de prueba ni el panel publicado. El estado de la prueba de cierre se sigue por separado en `docs/ESTADO_ACTUAL.md`.
