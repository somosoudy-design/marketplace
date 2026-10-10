### Recorridos con Maestro (2.11.0) sobre apk2.apk
```
01-visitante: pasó
01a-volver: pasó
01b-volver-favoritos: pasó
01c-volver-favoritos-atras: pasó
01d-tienda-enlace: pasó
02-cuenta: pasó al segundo intento; el primero falló así:

Waiting for flows to complete...
[Failed] Comprador con cuenta hasta la cotización y cancelación (2s)

1/1 Flow Failed

03-foto-perfil: FALLÓ (dos intentos)

Waiting for flows to complete...
[Failed] Foto de perfil abre el selector de fotos (1s)

1/1 Flow Failed

-- segundo intento --

Waiting for flows to complete...
[Failed] Foto de perfil abre el selector de fotos (13s)

1/1 Flow Failed

-- logcat de la app --
10-10 15:39:01.144   559  1110 D CoreBackPreview: Window{5253ee0 u0 Splash Screen com.example.kora.preview}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@7c55437, mPriority=0, mI
10-10 15:39:01.675   559  2381 D CoreBackPreview: Window{48a7e5d u0 com.example.kora.preview/com.example.kora.preview.MainActivity}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@
10-10 15:39:03.040   559  2381 D CoreBackPreview: Window{5253ee0 u0 Splash Screen com.example.kora.preview}: Setting back callback null
```
