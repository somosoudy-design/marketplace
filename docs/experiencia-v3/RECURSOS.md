# Recursos y procedencia

- `assets/samsung.webp`: fotografía real de Dinkun Chen, [SAMSUNG EP-T4510 45W POWER ADAPER BLACK & USB C TO C CABLE](https://commons.wikimedia.org/wiki/File:SAMSUNG_EP-T4510_45W_POWER_ADAPER_BLACK_%26_USB_C_TO_C_CABLE.jpg), [CC BY-SA4.0](https://creativecommons.org/licenses/by-sa/4.0/). Tamaño/formato adaptados, conserva licencia.
- `assets/lector.webp`: fotografía real de Bejnamin, [UGREEN SD Card Reader](https://commons.wikimedia.org/wiki/File:UGREEN_SD_Card_Reader.jpg), [CC0](https://creativecommons.org/publicdomain/zero/1.0/). Tamaño/formato adaptados.
- Origen de ambos recursos: lote autorizado de la app en `apps/mobile/assets/catalog-exhibition/manifest.json`; no son packshots UGREEN sin permiso.
- Plus Jakarta Sans: recursos ya instalados en el proyecto, SIL Open Font License, `assets/FONT-LICENSE.txt`.
- Iconos: geometría del registro actual de HAYAZGO, derivada de Lucide; ISC, `assets/ICONS-LICENSE.txt`. No iconografía generada para simular funciones nuevas.
- `conceptos/*.png`: dos exploraciones independientes con Product Design / Image Gen. Referencias adjuntas reales de la app. Son imágenes conceptuales, no capturas ni fotografías aprobadas de catálogo. No se forzó su proporción; la precisión412/320 corresponde a las maquetas capturadas en `screens/`.
- `audit/*.png`: capturas actuales del código exportado con datos representativos interceptados; ninguna escritura externa. No equivalen a validar servidor o Android.
- `screens/*.png`: maquetas renderizadas del prototipo aislado. Imágenes y textos de ejemplo; ningún importe utilizable para pagar.

Product Design: index,audit,get-context,user-context (preflight sin contexto guardado),ideate. Dos llamadas Image Gen reales y consulta de patrones Apple/Baymard. Controlador de navegador in-app no expuesto en este entorno; captura/QA mediante Chromium local y Playwright existentes. No se afirma uso de Figma ni usuarios reales.
