### Recorridos con Maestro (2.11.0) sobre apk2.apk
```
01-visitante: pasó
01a-volver: pasó
01b-volver-favoritos: pasó
01c-volver-favoritos-atras: pasó
02-cuenta: FALLÓ

Waiting for flows to complete...
[Failed] Comprador con cuenta hasta la cotización y cancelación (1m 15s) (Assertion is false: id: .*:id/permission_deny_button is visible)

1/1 Flow Failed

-- logcat de la app --
10-10 04:58:27.673   552  1551 I ActivityManager: Killing 7686:com.example.kora.preview/u0a212 (adj 0): stop com.example.kora.preview due to from pid 8165
10-10 04:58:27.676   552  1551 W ActivityTaskManager: Force removing ActivityRecord{3176614 u0 com.example.kora.preview/.MainActivity t18 f}}: app died, no saved state
10-10 04:58:28.054   552  2080 D CoreBackPreview: Window{73a44bc u0 Splash Screen com.example.kora.preview}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@81dd7c1, mPriority=0, mI
10-10 04:58:28.582   552  2050 D CoreBackPreview: Window{5b3857f u0 com.example.kora.preview/com.example.kora.preview.MainActivity}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@
10-10 04:58:29.957   552  2080 D CoreBackPreview: Window{73a44bc u0 Splash Screen com.example.kora.preview}: Setting back callback null
10-10 04:58:59.623  8176  8176 E FrameTracker: force finish cuj, time out: J<IME_INSETS_SHOW_ANIMATION::0@0@com.example.kora.preview>
```
