### Recorridos con Maestro (2.11.0) sobre apk2.apk
```
01-visitante: pasó
01a-volver: pasó
01b-volver-favoritos: pasó
01c-volver-favoritos-atras: pasó
02-cuenta: FALLÓ (dos intentos)

Waiting for flows to complete...
[Failed] Comprador con cuenta hasta la cotización y cancelación (2m 41s) (Assertion is false: id: quote-amount is visible)

1/1 Flow Failed

-- segundo intento --

Waiting for flows to complete...
[Failed] Comprador con cuenta hasta la cotización y cancelación (41s) (Assertion is false: id: sign-in-email is visible)

1/1 Flow Failed

-- logcat de la app --
10-10 13:24:52.757   557  2338 D CoreBackPreview: Window{fb1f26e u0 Splash Screen com.example.kora.preview}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@41acbd2, mPriority=0, mI
10-10 13:24:53.292   557  1952 D CoreBackPreview: Window{8fd200 u0 com.example.kora.preview/com.example.kora.preview.MainActivity}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@4
10-10 13:24:55.042   557  1952 D CoreBackPreview: Window{fb1f26e u0 Splash Screen com.example.kora.preview}: Setting back callback null
```
