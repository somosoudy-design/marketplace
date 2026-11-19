# Activación de cuotas: acción delimitada, todavía sin ejecutar

## Fuente y destino exactos

Destino único: Marketplace, `mimnotafmfasvwrclxan`, organización `lspwtzxmraagilwwnqrl`, rama `main Production`, mediante la sesión legítima del SQL Editor oficial. No usar `db push` sobre HEAD compartido ni el conector que había denegado acceso. La consulta completa de preflight ya se ejecutó una vez; no hay que repetirla para cerrar esta revisión.

Acción propuesta: aplicar **una sola vez** `supabase/migrations/20261107203116_mayami_deferred_three_payments.sql`, de la fuente `1e8938ad1beedab31514bc52512d4f78fe7ddfa9`, idéntica en la integración `da803460fcc3f819b0bbd896de58438207ace5d7`. SHA256: `5f929adbcc1ccc5063599ce88bd54ce101f2749d2df617d8dea5b559ceb0d653`, 13.299 bytes. No editar cuerpos, guardas, grants ni la configuración real del plan.

Ésta es una propuesta documental. No se preparó ni ejecutó un batch nuevo en esta tanda. Antes de una ejecución autorizada, el integrador debe materializar y revisar el batch final con la fuente literal, fijar su SHA y comprobarlo contra el texto completo del editor, como en los precedentes de cierre. El archivo de migración no contiene transacción ni registro de historial propios.

## Operación atómica propuesta

1. Reutilizar el mecanismo existente del SQL Editor: un único batch con `BEGIN`, `SET LOCAL lock_timeout='5s'`, `SET LOCAL statement_timeout='120s'`, guardas, fuente literal una vez, aserciones y `COMMIT`. No ejecutar sentencias sueltas ni confirmar CREATE del helper antes del REVOKE.
2. Las aserciones inmediatas del mismo batch deben exigir versión ausente, helper ausente, cuerpos previos `2052c218ca383e8366fd8bf85b27a833` / `62fee35a611d6593055bad973f016d6b`, atributos/ACL/esquemas/defaults y términos sin deriva. Estas guardas atómicas previenen cambios posteriores al recibo; no son una repetición del preflight completo. Capturar sólo metadatos, plan e historial de migraciones para comparar preservación. Si algo difiere, abortar sin modificar guardas.
3. Ejecutar el archivo exacto, sin DDL auxiliar de cierre, roles, políticas o proveedor. Antes de COMMIT exigir cuerpos finales: builder `c0cdff602e045c6bc2a976b1ed5f57c7`, reader `b8a5d5fc7b0699d66911a19cebecad53`, helper `e97402dedabb61fef26cc8ee7194c0b4`. Exigir atributos y ACL de los dos existentes iguales al pre, helper sólo del propietario y cierre/esquemas/defaults/planes intactos.
4. Registrar exactamente una fila estándar nueva en `supabase_migrations.schema_migrations(version,name,statements)` con `('20261107203116','mayami_deferred_three_payments',ARRAY[]::text[])`, siguiendo el precedente. No UPSERT, sustitución ni borrado. El array vacío no almacena el DDL: la fuente y el batch deben conservarse por SHA. Verificar total previo + 1, fila nueva única exacta y todas las filas anteriores idénticas antes de COMMIT.
5. Confirmar COMMIT mediante una transacción independiente de sólo lectura, focal en los tres cuerpos, atributos/ACL, helper privado, versión y preservación del cierre/plan. Un SELECT previo al COMMIT no confirma persistencia. Si el resultado de UI es incierto, reconciliar antes de cualquier reintento. No ejecutar compras, pagos, cierres, fixtures o RPC comerciales para demostrar instalación.

Ante un fallo anterior al COMMIT, el batch debe abortar íntegro. Después de un COMMIT, cualquier reversión sería otra acción DDL delimitada con fuente confiable: **no usar las dos definiciones capturadas del recibo como respaldo literal**. Esta propuesta no autoriza una reversión ni una activación.

## Permisos y seguridad

| Objeto | Estado observado y resultado propuesto |
|---|---|
| `_build_checkout(uuid,uuid,jsonb,text)` | Conserva propietario postgres, PL/pgSQL, STABLE, DEFINER y `search_path=public`; EXECUTE sólo de postgres y service_role. No acceso nuevo de anon/authenticated. |
| `product_detail_commercial(uuid)` | Conserva postgres, PL/pgSQL, STABLE, INVOKER y `search_path=public,pg_temp`; EXECUTE postgres/anon/authenticated. No se cambia a DEFINER y sigue sujeto a RLS. |
| Helper nuevo en `checkout_private` | SQL, IMMUTABLE, INVOKER, `search_path=public,pg_temp`; REVOKE ALL de PUBLIC, anon, authenticated y service_role deja acceso sólo del propietario en el estado observado. Es una ACL nueva restrictiva, no un permiso API ampliado. |
| Configuración existente | Sin GRANT nuevo, ALTER DEFAULT PRIVILEGES, roles, esquemas, RLS, policies, triggers, Auth hook o configuración de servicios. El esquema privado ya niega USAGE/CREATE a roles API. |

`CREATE OR REPLACE` conserva propietario y permisos de las funciones existentes, mientras que otras propiedades se fijan con la declaración. Por eso deben conservarse las declaraciones y verificarse los atributos observados; no hacer DROP/recrear. [PostgreSQL 17: CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html). Los defaults observados sólo tienen entradas específicas de `public`; no se trasladan a `checkout_private` ni se modifican. [PostgreSQL 17: ALTER DEFAULT PRIVILEGES](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html).

El CREATE nuevo tiene el EXECUTE implícito inicial normal de PUBLIC hasta el REVOKE dentro de la transacción; no debe quedar un estado intermedio confirmado. Ninguna cuenta o nuevo rol recibe acceso en este trabajo.

## Efecto comercial y riesgos

La excepción de `three_parts` amplía **importe mínimo y flujos** para carritos íntegramente válidos con productos `reservable`/`on_order` y al menos USD 0,03 en productos. Puede admitir `seller_shipping` aunque el plan siga guardando `local_stock`/`import_order`. No debe describirse sólo como eliminación del mínimo USD 60. Para carritos mixtos y otros planes permanece la rama de elegibilidad previa. El plan real, precios, recargos, intervalos y registros históricos no se actualizan por esta migración.

El comportamiento nuevo se aplicaría a futuras lecturas/cotizaciones/checkout, también desde clientes anteriores que llamen al backend; instalar SQL no publica ni entrega una app nueva. El calendario previsto sigue siendo tres pagos totales, incluido el de hoy, con intervalos de 15 días; esta migración no altera `_plan_schedule`. Su cuerpo hospedado y un checkout real no se probaron en este preflight.

Preservar `require_user`, wrappers revisados, políticas restrictivas `account_open_only` y triggers `account_00_open`. Los 17 ámbitos observados coinciden; no es una nueva auditoría global de todo el cierre. Los MD5 de cuerpos calculados por el servidor coinciden con la fuente, pero las dos cadenas `definition` del recibo no conservan esos bytes exactos. La causa no queda acreditada. No usarlas para restaurar SQL. La fuente del cambio es exclusivamente el archivo fijado por SHA.

La revisión permite preparar la activación acotada. **La migración sigue sin aplicar**, sin publicaciones, pruebas nativas, pagos o cargos. Su ejecución es una etapa posterior con autorización específica.
