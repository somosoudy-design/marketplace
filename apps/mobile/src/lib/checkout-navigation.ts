import { Platform } from 'react-native';

type CheckoutBackGuard = { shouldHandle: () => boolean; onBack: () => void; isSubmitting: () => boolean };
let active: CheckoutBackGuard | null = null;
let restoring = false;

// Imported by the root layout before navigation mounts. A screen's later popstate listener can
// be removed when Expo restores the root history entry, before that listener receives the event.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('popstate', (event) => {
    if (restoring) { event.stopImmediatePropagation(); restoring = false; return; }
    const guard = active;
    if (!guard?.shouldHandle()) return;
    event.stopImmediatePropagation();
    restoring = true;
    window.history.forward();
    guard.onBack();
  }, true);
  window.addEventListener('beforeunload', (event) => { if (active?.isSubmitting()) event.preventDefault(); });
}

/** Only the focused checkout owns this guard; it never adds or rewrites browser history entries. */
export function registerCheckoutWebBack(guard: CheckoutBackGuard) {
  active = guard;
  return () => { if (active === guard) active = null; };
}
