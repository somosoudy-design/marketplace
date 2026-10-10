### Recorridos con Maestro (2.11.0) sobre apk1.apk
```
01-visitante: FALLÓ

Waiting for flows to complete...
[Failed] Visitante compra sin cuenta (45s) (Assertion is false: ".*12.*", id: cart-subtotal is visible)

1/1 Flow Failed

-- logcat de la app --
10-10 02:34:54.406   556  1910 D CoreBackPreview: Window{1639963 u0 com.example.kora.preview/com.example.kora.preview.MainActivity}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@
01a-volver: FALLÓ

Waiting for flows to complete...
[Failed] Volver con atrás de Android (32s) (Assertion is false: id: home-search is visible)

1/1 Flow Failed

-- logcat de la app --
10-10 02:35:48.145   556  1937 I ActivityManager: Killing 5215:com.example.kora.preview/u0a211 (adj 0): stop com.example.kora.preview due to from pid 5780
10-10 02:35:48.145   556  1937 W ActivityTaskManager: Force removing ActivityRecord{30f7f64 u0 com.example.kora.preview/.MainActivity t12 f}}: app died, no saved state
10-10 02:35:48.418   556  1137 W WindowManager: Exception thrown during dispatchAppVisibility Window{1639963 u0 com.example.kora.preview/com.example.kora.preview.MainActivity}
10-10 02:35:49.355   556  1941 D CoreBackPreview: Window{15c76d2 u0 com.example.kora.preview/com.example.kora.preview.MainActivity}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@
10-10 02:36:01.439   556  1941 D CoreBackPreview: Window{15c76d2 u0 com.example.kora.preview/com.example.kora.preview.MainActivity}: Setting back callback null
01b-volver-favoritos: pasó
01c-volver-favoritos-atras: FALLÓ

Waiting for flows to complete...
[Failed] Volver de Favoritos con atrás de Android (31s) (Assertion is false: id: home-search is visible)

1/1 Flow Failed

-- logcat de la app --
10-10 02:36:54.147   556  1921 I ActivityManager: Killing 6300:com.example.kora.preview/u0a211 (adj 0): stop com.example.kora.preview due to from pid 6820
10-10 02:36:54.147   556  1921 W ActivityTaskManager: Force removing ActivityRecord{1f6f65b u0 com.example.kora.preview/.MainActivity t14 f}}: app died, no saved state
10-10 02:36:54.299   556  1009 W WindowManager: Exception thrown during dispatchAppVisibility Window{7c77646 u0 com.example.kora.preview/com.example.kora.preview.MainActivity EXITING}
10-10 02:36:55.200   556  1524 D CoreBackPreview: Window{95d8ac6 u0 com.example.kora.preview/com.example.kora.preview.MainActivity}: Setting back callback OnBackInvokedCallbackInfo{mCallback=android.window.IOnBackInvokedCallback$Stub$Proxy@
10-10 02:36:55.391   144   144 I lowmemorykiller: lmkd data connection established
10-10 02:36:55.414   144   144 I lowmemorykiller: Using psi monitors for memory pressure detection
10-10 02:36:55.414   144   144 I lowmemorykiller: Properties reinitilized
10-10 02:36:55.414  6874  6874 I lowmemorykiller: lmkd updated properties successfully
10-10 02:36:55.414   144   144 I lowmemorykiller: lmkd data connection dropped
10-10 02:36:55.414   144   144 I lowmemorykiller: closing lmkd data connection
10-10 02:36:55.585     0     0 I init    : Service 'exec 25 (/system/bin/lmkd --reinit)' (pid 6874) exited with status 0 oneshot service took 0.091000 seconds in background
10-10 02:37:06.064   556  1925 D CoreBackPreview: Window{95d8ac6 u0 com.example.kora.preview/com.example.kora.preview.MainActivity}: Setting back callback null
02-cuenta: pasó
```
