### Recorridos con Maestro (2.11.0) sobre apk2.apk
```
01-visitante: pasó
01a-volver: pasó
01b-volver-favoritos: pasó
01c-volver-favoritos-atras: pasó
02-cuenta: FALLÓ (dos intentos)

Exception in thread "Thread-5" java.io.IOException: Command failed (host:transport:emulator-5554): device 'emulator-5554' not found
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
-- segundo intento --

Waiting for flows to complete...
[Failed] Comprador con cuenta hasta la cotización y cancelación (38s) (Assertion is false: id: sign-in-email is visible)

1/1 Flow Failed

-- logcat de la app --
10-10 13:40:08.737   560   579 D CoreBackPreview: Window{58d32c3 u0 Splash Screen com.example.kora.preview}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@e573fbe, mPriority=0, mI
10-10 13:40:09.138   560  1789 D CoreBackPreview: Window{8534ea3 u0 com.example.kora.preview/com.example.kora.preview.MainActivity}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@
```
