# Seguridad focal de MAYAMI · 8 de noviembre de 2026

Tanda en curso, sin build ni publicación. Sólo los tres puntos acreditados del reel: ownership de datos, CSRF y secretos incluso en historial. El reel no se usa como prueba de otros controles. Evidencia histórica se distingue de fuente actual y de ensayos de hoy.

| Área | Hallazgo y evidencia | Estado |
|---|---|---|
| Ownership | RLS buyer/admin en orders/payments; store_member para entregas/líneas. create_payment_quote/submit_payment toman el actor del servidor; proof_path propio. Catálogo/stores públicos; payment-proofs/claims/avatars privados. Pruebas locales y recibos hospedados previos reutilizados, sin repetir cierre. | Pendientes sólo2casos locales nuevos: HTTP comprobante por rol e IDsRPC cruzados. |
| CSRF/sesión | Escrituras por Bearer explícito, sin cookies automáticas de auth; no añadir tokenCSRF por costumbre. Sí se reproduce localmente login-CSRF: callback implícito/panel auto-detect aceptan sesiónA sobreB sin intento.5caracterizaciones del código publicado/preparado + SDK, no explotación remota. | Corregido localmente en4fuentes;9regresiones nuevas y21focales existentes PASS, tipos/lint PASS. No desplegado. |
| Secretos | Scanner especializado y gateCI no encontrados. Léxico de4695blobs/195709234bytes en610commits/7refs disponibles; HEAD2627entradas completo,1388objetos históricos faltantes.43candidatos clasificados como31expresiones,10fixtures,2URLslocal/test;8ocurrenciasanon públicas,0secretos confirmados por este método. | No declarar repo libre de secretos; falta cobertura histórica completa y scannerCI. Sin valores de secretos en informe, sin credencial probada o rotada. |

## Corrección y pruebas de hoy

4fuentes y una regresión portátil: ClientOptions.flowType opcional sin cambiar defaults nativos; browser web PKCE; callback sólo canje de code con verifierSDK y rechazo previo de access/refresh en fragmento; paneldetectSessionInUrlfalse. Mantiene destinos internos, recuperación, OTP y contraseña. Enlaces implícitos antiguos fallan deliberadamente y requieren enlace/código nuevo; abrir el nuevo enlace web en el mismo navegador permite usar su verifier, o usarOTP6dígitos. No activar experimental flow IDs ni Google.

`node --test tools/auth/web-session-boundary.test.mjs`:9/9 con fuenteTS/SDK reales y React/Next/transportes controlados enRAM; sin GoTrue real ni red externa. Incluye hashes parciales/mixtos, B preservada, code ajeno sin verifier denegado, signup/recoveryS256 propios, VerifyCode ambos propósitos y panelpassword. `vitest` focal exacto:21/21 (email-auth-url y auth-callback-isolation); API/storefront/admin tipos y lint focal aprobados. Un primer comando descubrió también copias obsoletas de.local; sus fallosENOENT y19fallos de esos snapshots se conservan, sin atribuirlos a producto. Se corrigió sólo el alcance del runner; las dos suites canónicas pasan sin modificar sus pruebas. No se repitió la matrizGoogle97 ni se compiló la app.

## Producción y límites

Web publicada064f4729, panelda9085c por recibos; Google88461178 local/apagado; cuotas locales no aplicadas. Recibo hospedado16:03 con ownerRLS de orders/payments/items/fulfillments y guardas de cierre conservadas, no nueva matrizHTTP Storage. Cierre hospedado simple anterior ya concluido, Storage estaba vacío: no acredita borrado físico de archivo cargado ni JWT literal en ese ensayo. No se encontró rutaKYC/cédula en superficie inventariada; no inventar ese sistema. URLs firmadas son bearer temporal, distinto de poder emitirlas.

El hueco de login-CSRF está reproducido con el código publicado, pero sólo corregido localmente. Cualquier publicación posterior exige reconciliar los cuatro archivos sobre las fuentes publicadas vigentes y aprobación de esa acción; no publicar HEAD combinado ni activar OAuth/cuotas/backend. La inspección no recertifica APK, seguridad total, producción actual por nuevas consultas o aceptaciónPlay.

Referencias primarias: [SupabasePKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [OWASPCS RF y login](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html). Changelog consultado; no upgrade ni cambio de seguridad hospedada. Memoria histórica sólo orientó verificación y no sustituyó recibos actuales.

Evidencia persistente: `/Users/brandeastudio/marketplace/.local/security-review-20261108/`, scanner/stdJSON sin valores, caracterización5, regresión9, logs21/tipos/lint, inventario y revisiónCSRF. Hashes/cambios en propuestas/seguridad/VALIDATION_CHECKPOINT.json y security-local.patch. Ownership focal aún no ejecutado en este checkpoint; siguiente paso acotado es el runner conservado, no reconstruir infraestructura.
