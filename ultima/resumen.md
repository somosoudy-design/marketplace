### Recorridos con Maestro (2.11.0) sobre apk2.apk
```
01-visitante: pasó al segundo intento; el primero falló así:
	at org.apache.logging.log4j.spi.AbstractLogger.logMessageSafely(AbstractLogger.java:2904)
	at org.apache.logging.log4j.spi.AbstractLogger.logMessage(AbstractLogger.java:2653)
	at org.apache.logging.log4j.spi.AbstractLogger.logIfEnabled(AbstractLogger.java:2393)
	at org.apache.logging.slf4j.Log4jLogger.info(Log4jLogger.java:173)
	at maestro.drivers.AndroidDriver.close(AndroidDriver.kt:180)
	at maestro.Maestro.close(Maestro.kt:602)
	at maestro.cli.session.MaestroSessionManager$MaestroSession.close(MaestroSessionManager.kt:471)
	at maestro.cli.session.MaestroSessionManager.newSession$lambda$2(MaestroSessionManager.kt:129)
	at kotlin.concurrent.ThreadsKt$thread$thread$1.run(Thread.kt:30)
Caused by: java.io.IOException: Stream Closed
	at java.base/java.io.FileOutputStream.writeBytes(Native Method)
	at java.base/java.io.FileOutputStream.write(FileOutputStream.java:349)
	at org.apache.logging.log4j.core.appender.OutputStreamManager.writeToDestination(OutputStreamManager.java:263)
	... 30 more

01a-volver: pasó
01b-volver-favoritos: pasó al segundo intento; el primero falló así:

Waiting for flows to complete...
[Failed] Volver de Favoritos con la flecha (1s)

1/1 Flow Failed

01c-volver-favoritos-atras: pasó
01d-tienda-enlace: pasó
02-cuenta: FALLÓ (dos intentos)

Waiting for flows to complete...
[Failed] Comprador con cuenta hasta la cotización y cancelación (3s)

1/1 Flow Failed

-- segundo intento --

Waiting for flows to complete...
[Failed] Comprador con cuenta hasta la cotización y cancelación (6m 52s) (Assertion is false: "Pedido P-.* recibido" is visible)

1/1 Flow Failed

Exception in thread "Thread-5" java.io.IOException: Command failed (host:transport:emulator-5554): device offline
	at dadb.adbserver.AdbServer.send$dadb(AdbServer.kt:103)
	at dadb.adbserver.AdbServerDadb.open(AdbServer.kt:148)
	at dadb.Dadb$DefaultImpls.openShell(Dadb.kt:42)
	at dadb.adbserver.AdbServerDadb.openShell(AdbServer.kt:122)
	at dadb.Dadb$DefaultImpls.shell(Dadb.kt:35)
	at dadb.adbserver.AdbServerDadb.shell(AdbServer.kt:122)
	at maestro.android.AndroidDeviceConnection.shell(AndroidDeviceConnection.kt:153)
	at maestro.drivers.AndroidDriver.shell(AndroidDriver.kt:1352)
	at maestro.drivers.AndroidDriver.isPackageInstalled(AndroidDriver.kt:1335)
	at maestro.drivers.AndroidDriver.bestEffortUninstall(AndroidDriver.kt:1310)
	at maestro.drivers.AndroidDriver.uninstallMaestroDriverApp$lambda$89(AndroidDriver.kt:1296)
	at maestro.utils.Metrics.measured(Metrics.kt:48)
	at maestro.drivers.AndroidDriver.uninstallMaestroDriverApp(AndroidDriver.kt:1295)
	at maestro.drivers.AndroidDriver.close(AndroidDriver.kt:182)
	at maestro.Maestro.close(Maestro.kt:602)
	at maestro.cli.session.MaestroSessionManager$MaestroSession.close(MaestroSessionManager.kt:471)
	at maestro.cli.session.MaestroSessionManager.newSession$lambda$2(MaestroSessionManager.kt:129)
	at kotlin.concurrent.ThreadsKt$thread$thread$1.run(Thread.kt:30)
-- logcat de la app --
10-10 15:52:10.480   557  1584 D CoreBackPreview: Window{6ee27be u0 Splash Screen com.example.kora.preview}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@46101ca, mPriority=0, mI
10-10 15:52:11.331   557  1584 D CoreBackPreview: Window{7f447fc u0 com.example.kora.preview/com.example.kora.preview.MainActivity}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@
10-10 15:52:12.848   557   575 D CoreBackPreview: Window{6ee27be u0 Splash Screen com.example.kora.preview}: Setting back callback null
10-10 15:52:52.398  9203  9203 E FrameTracker: force finish cuj, time out: J<IME_INSETS_SHOW_ANIMATION::0@0@com.example.kora.preview>
10-10 15:53:15.254  9203  9203 E FrameTracker: force finish cuj, time out: J<IME_INSETS_HIDE_ANIMATION::1@0@com.example.kora.preview>
10-10 15:53:48.304  9203  9203 E FrameTracker: force finish cuj, time out: J<IME_INSETS_SHOW_ANIMATION::0@0@com.example.kora.preview>
10-10 15:53:51.981   557  1906 D CoreBackPreview: Window{b058b3 u0 com.example.kora.preview/com.example.kora.preview.MainActivity}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@4
10-10 15:53:55.751   557  1585 D CoreBackPreview: Window{b058b3 u0 com.example.kora.preview/com.example.kora.preview.MainActivity}: Setting back callback null
10-10 15:53:59.870  9203  9203 E FrameTracker: force finish cuj, time out: J<IME_INSETS_HIDE_ANIMATION::1@0@com.example.kora.preview>
10-10 15:54:13.536  9203  9203 E FrameTracker: force finish cuj, time out: J<IME_INSETS_HIDE_ANIMATION::1@0@com.example.kora.preview>
10-10 15:54:46.003   557  1585 D CoreBackPreview: Window{24349ea u0 com.example.kora.preview/com.example.kora.preview.MainActivity}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@
10-10 15:54:48.731   557  1585 D CoreBackPreview: Window{24349ea u0 com.example.kora.preview/com.example.kora.preview.MainActivity}: Setting back callback null
03-foto-perfil: pasó al segundo intento; el primero falló así:

Waiting for flows to complete...
[Failed] Foto de perfil abre el selector de fotos (1s)

1/1 Flow Failed

```
