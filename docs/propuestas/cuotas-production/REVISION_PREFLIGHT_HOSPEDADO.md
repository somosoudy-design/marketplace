# Revisión focal del preflight hospedado

Root verificó el SHA256 del recibo original y 171 comparaciones de metadatos/ejecución contra EXPECTATIONS.json. Son comparaciones del JSON guardado, no 171 pruebas nuevas del producto ni consultas remotas. Resultado: metadatos compatibles para preparar la activación, con limitación de captura de las dos definiciones.

Revisores independientes: closure_source_check y android_identity_audit. La revisión usó sólo archivos locales; no se repitieron preflight, pruebas o acciones de navegador. Se confirmaron guardas previas, helper y versión ausentes, términos exactos y atributos/ACL observados. En las 17 tablas inspeccionadas siguen RLS, account_open_only restrictiva y account_00_open habilitado. Las dos migraciones de cierre figuran una vez y require_user conserva su cuerpo/atributos posteriores al cierre.

La migración no amplía accesos API, mantiene los dos propietarios/ACL y crea un helper INVOKER privado con REVOKE explícito. Sí amplía la elegibilidad comercial por mínimo y flujo para carritos íntegramente reservables/por encargo. Su CREATE/REVOKE debe ser atómico. El cierre y el historial no deben reescribirse desde una instantánea antigua.

Limitación verificada por root y ambos revisores: los cuerpos extraídos de las dos cadenas definition capturadas producen MD5 distintos de los campos calculados por el servidor. No son respaldo byte a byte. No se atribuye la causa como hecho; los guard hashes del servidor y la fuente original coinciden. El artefacto DDL propuesto es sólo el archivo exacto SHA256 5f929adbcc1ccc5063599ce88bd54ce101f2749d2df617d8dea5b559ceb0d653.

El indicador auxiliar matches_closure_rewrite_predicate_now no limita namespace y puede marcar session_open privado; no prueba que esa función sea candidata real a la reescritura del cierre. No se interpreta como deriva ni se modifica función alguna.

Dictamen favorable para preparación documental, no para afirmar activación ya realizada. No se produjo ni parseó un batch nuevo. Las condiciones de ejecución y reconciliación están en ACTIVACION_PROPUESTA.md.
