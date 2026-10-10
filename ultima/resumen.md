### Recorridos con Maestro (2.11.0) sobre apk2.apk
```
01-visitante: FALLÓ (dos intentos)

Waiting for flows to complete...
[Failed] Visitante compra sin cuenta (1m 14s) (Assertion is false: "Enlace copiado" is visible)

1/1 Flow Failed

-- segundo intento --

Waiting for flows to complete...
[Failed] Visitante compra sin cuenta (43s) (Assertion is false: ".*12.*", id: cart-subtotal is visible)

1/1 Flow Failed

-- logcat de la app --
10-10 14:56:11.149   554  1821 D CoreBackPreview: Window{426be4 u0 Splash Screen com.example.kora.preview}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@17b3e8b, mPriority=0, mIs
10-10 14:56:11.577   554   571 D CoreBackPreview: Window{cbcc4f u0 com.example.kora.preview/com.example.kora.preview.MainActivity}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@3
10-10 14:56:13.102   554  1821 D CoreBackPreview: Window{426be4 u0 Splash Screen com.example.kora.preview}: Setting back callback null
10-10 14:56:14.503   141   141 I lowmemorykiller: lmkd data connection established
10-10 14:56:14.533   141   141 I lowmemorykiller: Using psi monitors for memory pressure detection
10-10 14:56:14.533   141   141 I lowmemorykiller: Properties reinitilized
10-10 14:56:14.533  6496  6496 I lowmemorykiller: lmkd updated properties successfully
10-10 14:56:14.533   141   141 I lowmemorykiller: lmkd data connection dropped
10-10 14:56:14.533   141   141 I lowmemorykiller: closing lmkd data connection
10-10 14:56:14.694     0     0 I init    : Service 'exec 25 (/system/bin/lmkd --reinit)' (pid 6496) exited with status 0 oneshot service took 0.070000 seconds in background
01a-volver: pasó
01b-volver-favoritos: pasó
01c-volver-favoritos-atras: pasó
02-cuenta: FALLÓ (dos intentos)

Waiting for flows to complete...
[Failed] Comprador con cuenta hasta la cotización y cancelación (6m 45s) (Assertion is false: "Pedido P-.* recibido" is visible)

1/1 Flow Failed

-- segundo intento --

Waiting for flows to complete...
[Failed] Comprador con cuenta hasta la cotización y cancelación (1m 4s) (Assertion is false: id: home-search is visible)

1/1 Flow Failed

-- logcat de la app --
10-10 15:05:19.132   554  2272 D CoreBackPreview: Window{113ad46 u0 Splash Screen com.example.kora.preview}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@ba9e5cc, mPriority=0, mI
10-10 15:05:19.511   554  1878 D CoreBackPreview: Window{2bd2732 u0 com.example.kora.preview/com.example.kora.preview.MainActivity}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@
10-10 15:05:21.743   554  2354 D CoreBackPreview: Window{113ad46 u0 Splash Screen com.example.kora.preview}: Setting back callback null
```
