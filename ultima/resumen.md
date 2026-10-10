### Recorridos con Maestro (2.11.0) sobre apk2.apk
```
01-visitante: pasó
01a-volver: pasó
01b-volver-favoritos: pasó
01c-volver-favoritos-atras: pasó
02-cuenta: FALLÓ (dos intentos)

Waiting for flows to complete...
[Failed] Comprador con cuenta hasta la cotización y cancelación (2m 49s) (Assertion is false: id: quote-amount is visible)

1/1 Flow Failed

-- segundo intento --

Waiting for flows to complete...
[Failed] Comprador con cuenta hasta la cotización y cancelación (2m 42s) (Assertion is false: id: quote-amount is visible)

1/1 Flow Failed

-- logcat de la app --
10-10 14:05:58.465   561   818 D CoreBackPreview: Window{88cbd6f u0 Splash Screen com.example.kora.preview}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@8cd3bb2, mPriority=0, mI
10-10 14:05:59.059   561   818 D CoreBackPreview: Window{1764e0 u0 com.example.kora.preview/com.example.kora.preview.MainActivity}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@7
10-10 14:06:00.852   561  1270 D CoreBackPreview: Window{88cbd6f u0 Splash Screen com.example.kora.preview}: Setting back callback null
10-10 14:07:28.789   561   651 D CoreBackPreview: Window{fe2e7af u0 com.example.kora.preview/com.example.kora.preview.MainActivity}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@
10-10 14:07:32.293   561  1011 D CoreBackPreview: Window{fe2e7af u0 com.example.kora.preview/com.example.kora.preview.MainActivity}: Setting back callback null
10-10 14:07:51.904  8855  8855 E FrameTracker: force finish cuj, time out: J<IME_INSETS_SHOW_ANIMATION::0@0@com.example.kora.preview>
```
