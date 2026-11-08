# Primer AAB de Mayami · 8 de noviembre de 2026

## Autorización y preflight

Oliver confirmó expresamente app.mayami.marketplace, una nueva clave de carga exclusiva de producción custodiada en Expo EAS y el primer AAB. Gasto máximo $0. La autorización no incluye Play App Signing, crear o publicar una app en Google, submit, OTA, Firebase/OAuth, cambios de preview, permisos adicionales o planes de pago.

Fuente aislada y limpia: bb3de95871419ac35afb213067d02c9e6cd02835, árbol 1f5498524cba222639cc39e2749a9ebbcda13744. No se usa HEAD compartido. Se reutilizan las ocho pruebas focales, tipos, lint y revisión independiente anteriores; bytes intactos, sin repetir suites.

Lectura oficial del CLI el 8 de noviembre a las 10:30 de Venezuela: proyecto @marketplacebrand/marketplace, ID 9f629f10-d679-4a99-9965-8a9e588afc85, sólo credencial com.example.kora.preview con huella pública 86bf…df7f. app.mayami.marketplace aún no aparece entre las credenciales de ese proyecto. No se infiere disponibilidad global o ausencia en otras cuentas.

Plan Free, price_free, precio 0, facturación EAS_BUILD no medida; periodo del 1 de noviembre al 1 de diciembre. Un build Android usado de 15, 14 disponibles por contador, sobreconsumo vacío y coste 0. Sin cambio de plan. Si esto cambia o aparece un requisito material nuevo, detener y reconciliar antes de reintentar.

No hay GOOGLE_SERVICES_JSON para production en el proyecto ni en su owner según metadata de nombres. No se descargaron archivos o valores. La configuración omite ese archivo cuando falta; las notificaciones push de producción no quedan acreditadas y no se crea un recurso Firebase como parte de esta tanda.

## Operación prevista

Única ejecución oficial de EAS CLI 24.12.1, build Android/profile production, non-interactive y no-wait, sin auto-submit. Ese flujo consulta la credencial predeterminada por package; sin una para el package nuevo genera y custodia una exclusiva. El modo no interactivo evita la oferta de copiar credenciales heredadas. No se usarán asistentes de descarga ni se expondrán secretos. Registrar únicamente IDs y huellas públicas; comprobar metadata y build ID antes de repetir cualquier operación incierta.

Trabajo en curso: checkpoint anterior a la creación/build. Aún no hay clave o build creados en esta etapa. Próxima acción: ejecutar una vez, registrar ID/URL, esperar estado; después descargar AAB por la ruta autorizada y verificar binario con herramientas existentes. Las verificaciones pendientes de la cuenta de Play no impiden preparar este AAB autorizado.

Recibos locales en /Users/brandeastudio/marketplace/.local/android-aab-20261108/. Las fuentes de preview, scheme kora, retornos y permisos se conservan. El binario final, su firma y 16 KB no se dan por aprobados antes de inspeccionarlos.
