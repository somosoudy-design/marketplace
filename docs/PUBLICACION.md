# Lista de verificación para publicar en tiendas

Esta lista corresponde al **lanzamiento comercial en tiendas**, no al estado de evaluación. Android APK5 ya existe y recibe EAS Update en `preview`; el panel está en https://kora-panel.expo.app. La web compradora está implementada y probada localmente, sin alojamiento público configurado. La autorización vigente permite actualizaciones incrementales de evaluación; no habilita compras reales, un APK nuevo, App Store/Google Play ni contratación. iOS sigue pospuesto. Estado concreto y bloqueos: [CALIDAD_INTEGRAL_2026-10-31.md](CALIDAD_INTEGRAL_2026-10-31.md).

## Antes de la primera build pública

- [ ] Nombre y marca definitivos en `config/brand.json` (nombre, esquema, `iosBundleId`, `androidPackage`,
      dominio, correo de soporte). El identificador de app no se puede cambiar después de publicar.
- [ ] Iconos, icono adaptativo de Android, icono de notificación y splash definitivos
      (`apps/mobile/assets/images`; los actuales son provisionales generados por `tools/demo-assets`).
- [ ] Proyecto Supabase de producción dedicado, con migraciones aplicadas y **sin seed**.
- [ ] Hook de token, SMTP, `pg_cron`/`pg_net` y secretos de Vault configurados ([ENTORNO.md](ENTORNO.md)).
- [ ] Datos de cobro reales en los métodos manuales; métodos automáticos solo si sus credenciales existen.
- [ ] Tasas: fuentes probadas en vivo desde el proyecto real o tasa manual vigente.
- [ ] Catálogo real: fotos con derechos, precios actuales, especificaciones verificadas. Eliminar o
      suspender todo lo marcado `is_demo`.
- [ ] Revisión de categorías reguladas (odontología/equipamiento) con asesoría sobre permisos sanitarios.
- [ ] Términos y condiciones, política de privacidad, política de devoluciones y datos legales del
      comercio, publicados en el dominio y enlazados desde la app.

## Cuentas y credenciales

- [x] Proyecto Expo marketplacebrand/marketplace vinculado con `projectId` en `config/expo.json`; workflows de preview/panel operativos.
- [ ] Apple Developer Program (pago anual) y App Store Connect.
- [ ] Google Play Console (pago único) y firma de apps de Play.
- [ ] Validar push Android físicamente de extremo a extremo con las credenciales existentes; aceptación del proveedor no certifica recepción. APNs/iOS fuera del alcance vigente.

## Builds

- [x] APK5 preview Android instalado por Oliver. Mantener runtime `eb5ed1179b9c76c9c3cf27333aa48306728eb4ba`; **no generar otro APK** por esta lista.
- [ ] Probar en Android e iOS reales: registro, compra, pago manual con comprobante, pago en línea si
      aplica, push, enlaces profundos, botón Atrás y gestos, modo oscuro, tamaños de pantalla, conexión lenta.
- [ ] `eas build --profile production --platform all`.
- [ ] `eas submit` a pruebas internas (TestFlight / prueba interna de Play) antes de producción.

## Requisitos de privacidad y fichas de tienda

- [ ] App Privacy (Apple) y Data safety (Google): la app recoge correo, nombre, teléfono, direcciones,
      cédula/RIF opcional, historial de compras, comprobantes de pago e identificadores de dispositivo
      para push. No hay publicidad ni rastreo entre apps.
- [ ] Eliminación de cuenta: disponible dentro de la app (Cuenta > Preferencias y privacidad > Eliminar cuenta) y procesada por un
      administrador; publicar además una URL web para solicitarla (requisito de Google Play).
- [ ] Permisos: solo notificaciones, fotos y cámara (para comprobantes y reclamos). Textos de permiso ya
      redactados en `app.config.ts`.
- [ ] Cifrado: `usesNonExemptEncryption: false` (solo HTTPS estándar).
- [ ] Capturas, descripción corta y larga, categoría (Compras), clasificación de contenido, correo y URL
      de soporte.
- [ ] Revisar las políticas de pagos de cada tienda: los bienes físicos pueden cobrarse fuera del sistema
      de compras integradas.

## Dominio y enlaces

- [ ] `/.well-known/apple-app-site-association` con el Team ID y el bundle id.
- [ ] `/.well-known/assetlinks.json` con el paquete y la huella SHA-256 del certificado de firma de Play.
- [x] Panel web de evaluación desplegado con HTTPS en https://kora-panel.expo.app.
- [ ] Alojamiento HTTPS del storefront comprador y dominios/callbacks de lanzamiento, configurados y comprobados antes de activar proveedores externos.

## Operación

- [ ] Copias de seguridad: activar PITR o respaldos diarios en Supabase y probar una restauración.
- [ ] Alertas: errores de funciones, webhooks rechazados, tasas vencidas, pagos en verificación por más
      de X horas.
- [ ] Al menos dos superadministradores y procedimiento de revocación de accesos.
