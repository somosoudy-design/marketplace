### Recorridos con Maestro (2.11.0) sobre apk1.apk
```
01-visitante: pasó
01a-volver: FALLÓ

Waiting for flows to complete...
[Failed] Volver con atrás de Android (29s) (Assertion is false: id: home-search is visible)

1/1 Flow Failed

-- logcat de la app --
10-10 02:49:27.620   567  1619 I ActivityManager: Killing 5466:com.example.kora.preview/u0a211 (adj 0): stop com.example.kora.preview due to from pid 5971
10-10 02:49:27.621   567  1619 W ActivityTaskManager: Force removing ActivityRecord{aa4bce2 u0 com.example.kora.preview/.MainActivity t13 f}}: app died, no saved state
10-10 02:49:27.752   567   650 W WindowManager: Exception thrown during dispatchAppVisibility Window{3ded2cb u0 com.example.kora.preview/com.example.kora.preview.MainActivity EXITING}
10-10 02:49:28.326   567   650 D CoreBackPreview: Window{17ce39c u0 com.example.kora.preview/com.example.kora.preview.MainActivity}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@
10-10 02:49:38.246   567   823 D CoreBackPreview: Window{17ce39c u0 com.example.kora.preview/com.example.kora.preview.MainActivity}: Setting back callback null
01b-volver-favoritos: pasó
01c-volver-favoritos-atras: FALLÓ

Waiting for flows to complete...
[Failed] Volver de Favoritos con atrás de Android (29s) (Assertion is false: id: home-search is visible)

1/1 Flow Failed

-- logcat de la app --
10-10 02:50:24.727   567   585 I ActivityManager: Killing 6476:com.example.kora.preview/u0a211 (adj 0): stop com.example.kora.preview due to from pid 6949
10-10 02:50:24.729   567   585 W ActivityTaskManager: Force removing ActivityRecord{ba7eb u0 com.example.kora.preview/.MainActivity t15 f}}: app died, no saved state
10-10 02:50:24.898   567  2618 W WindowManager: Exception thrown during dispatchAppVisibility Window{6891543 u0 com.example.kora.preview/com.example.kora.preview.MainActivity}
10-10 02:50:25.572   567   585 D CoreBackPreview: Window{e7ac2e6 u0 com.example.kora.preview/com.example.kora.preview.MainActivity}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@
10-10 02:50:35.721   567   585 D CoreBackPreview: Window{e7ac2e6 u0 com.example.kora.preview/com.example.kora.preview.MainActivity}: Setting back callback null
02-cuenta: pasó
```
