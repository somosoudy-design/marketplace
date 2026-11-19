# Cobros manuales de Mayami · 6 de noviembre de 2026

Zelle USD y Binance interna USDT están habilitados en mayami.app con los datos suministrados por Oliver. Aplicación única y verificación posterior: **6 de noviembre, 14:12 UTC**. Ambos requieren referencia y comprobante; cada reporte queda pendiente hasta que Mayami comprueba el abono. La tienda continúa abierta oficialmente en Workers Free.

El cambio es configuración en el proyecto Marketplace autorizado. La web desplegada ya lee los métodos habilitados; no requiere migración ni despliegue del Worker.

- **Zelle:** sólo cambian `instructions` y `enabled`. Conserva sus parámetros financieros y la referencia y el comprobante obligatorios.
- **Binance interna:** nueva fila `binance_internal`, manual, USDT. Muestra plataforma, correo, alias y moneda; pide el ID interno completo y el comprobante. Hereda base divisas, ajustes, comisiones, límites y vigencia de la configuración USDT existente. El código TRC-20 y Binance Pay automático conservan su estado deshabilitado.
- **Otros seis métodos:** sus filas permanecen intactas y deshabilitadas. Se conservan todos los pedidos, cotizaciones, pagos y obligaciones.

## Validación

[CI 42231006870: SUCCESS](https://github.com/somosoudy-design/marketplace/actions/runs/42231006870), fuente `41b5e67`: **57 UI, 24 Node y 3 pruebas de marca**, además de tipos, lint, build y guards. Dos capturas finales a 320 px, Zelle claro y Binance oscuro, aprobadas independientemente; etiquetas y controles completos, sin solapes ni desbordes. Los ajustes de foco/scroll y validación nativa afectaron únicamente las pruebas; su historial está en HISTORIAL_AGENTES.md.

Los dos recorridos nuevos usan contactos `example.com` y un método configurado en divisas. Comprueban referencia vacía mediante validación HTML nativa, referencia corta mediante la alerta de la aplicación y comprobante ausente, siempre sin subida ni envío de pago. Después comprueban copia de datos, una subida y un reporte `pending_verification`, con importe reconocido y pagado en cero, sin asignaciones, eventos ni proveedor automático. Los dos hosts alojados están bloqueados en CI; las fixtures exigen loopback.

Se tomó un respaldo íntegro y se ensayó la operación atómica con una excepción final que revierte todo. Una segunda lectura confirmó las siete filas originales intactas antes de aplicar. La sesión autorizada del propietario devolvió `Success. No rows returned` en la aplicación única; el trigger existente verificó ambos eventos de auditoría.

El snapshot posterior confirma ocho métodos, sólo dos habilitados, seis filas anteriores intactas, Zelle con únicamente los dos campos autorizados cambiados y Binance exactamente igual a la propuesta revisada. Las colecciones completas, ordenadas por ID, conservan sus huellas MD5:

| Colección | Filas antes y después | Contenido |
|---|---:|---|
| Pedidos | 36 | Idéntico |
| Cotizaciones | 22 | Idéntico |
| Pagos | 6 | Idéntico |
| Obligaciones | 39 | Idéntico |

La lectura anónima real devuelve los dos métodos y sus destinatarios correctos con HTTP 200. Se verifican base divisas, referencia y comprobante obligatorios. Las seis tablas privadas consultadas (`orders`, `payment_quotes`, `payments`, `payment_obligations`, `ledger_entries`, `audit_log`) conservan HTTP 401 / código 42501. La raíz pública https://mayami.app/ responde 200.

Revisión independiente de fuente: `review_payment`, `_apply_payment`, la API y el panel operan por ID y estado, y admiten el nuevo código manual. No hubo cambios en esas funciones.

## Alcance y continuidad

No se realizaron transferencias reales ni se comprobó con fondos el alta o recepción de las cuentas. El administrador debe comprobar cada abono antes de confirmarlo. El nuevo canal no se probó en teléfono físico; no se publicó APK, OTA ni iOS.

Workers Free continúa vigente. Este cambio de datos no aporta un motivo técnico para activar Workers Paid; no se contrataron servicios ni se cambiaron planes. La auditoría CPU y sus límites permanecen en [el informe anterior](WORKERS_FREE_MAYAMI_2026-11-06.md); esta configuración no incluye una nueva medición.

No repetir los scripts de activación: sus guardas rechazan el estado posterior. Fuente ejecutable `116e569` y versión del Worker `897b0966-ade6-4799-ad8e-4b250d384ad2` conservadas.

Evidencia privada ignorada: `.local/mayami-payments-20261106/`. Los datos reales de recepción están en la configuración operativa y respaldos privados; las pruebas públicas usan `example.com`.

- Snapshot anterior SHA256: `8860edfa73c6b366882ec9235cd35bd66a46e65113c7d55541e043034ab86de7`.
- Snapshot posterior SHA256: `76acd03bb2c07b3f1fd173cf4e777e335ed4a9356b6f72da7ba3917cd69af614`.
- ZIP final de CI: artefacto `13509126477`, 9.749.458 bytes, SHA256 `f70f80a80717b4bb7db30193eb431f17da314951b95009798b666aee4e003dc0`. CRC y dos PNG originales comprobados.
