### Recorridos con Maestro (2.11.0) sobre apk2.apk
```
01-visitante: pasó
01a-volver: pasó
01b-volver-favoritos: pasó
01c-volver-favoritos-atras: pasó
02-cuenta: FALLÓ

Waiting for flows to complete...
[Failed] Comprador con cuenta hasta la cotización y cancelación (39s)

1/1 Flow Failed

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
-- logcat de la app --
10-10 04:48:48.739   565  1775 I ActivityManager: Killing 7693:com.example.kora.preview/u0a212 (adj 0): stop com.example.kora.preview due to from pid 8189
10-10 04:48:48.742   565  1775 W ActivityTaskManager: Force removing ActivityRecord{3b37d8e u0 com.example.kora.preview/.MainActivity t18 f}}: app died, no saved state
10-10 04:48:48.895   565  1754 W WindowManager: Exception thrown during dispatchAppVisibility Window{1b1e34d u0 com.example.kora.preview/com.example.kora.preview.MainActivity}
10-10 04:48:49.055   565  1775 D CoreBackPreview: Window{aa4874a u0 Splash Screen com.example.kora.preview}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@eac09f0, mPriority=0, mI
10-10 04:48:49.470   565  1430 D CoreBackPreview: Window{9e1ad02 u0 com.example.kora.preview/com.example.kora.preview.MainActivity}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@
10-10 04:48:50.790   565  1766 D CoreBackPreview: Window{aa4874a u0 Splash Screen com.example.kora.preview}: Setting back callback null
10-10 04:49:21.255  8201  8201 E FrameTracker: force finish cuj, time out: J<IME_INSETS_SHOW_ANIMATION::0@0@com.example.kora.preview>
```
