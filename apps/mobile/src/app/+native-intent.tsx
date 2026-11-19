// WebBrowser owns warm Google returns. Expo Router also receives Android's VIEW intent and must
// not mount another callback screen or exchange the same code. Keep ordinary product/email links.
export function redirectSystemPath({ path, initial }: { path: string | null; initial: boolean }) {
  if (!path) return path;
  try {
    const url = new URL(path);
    if (url.protocol === 'kora:' && url.host === 'auth-callback' && (!url.pathname || url.pathname === '/') && url.searchParams.has('google_flow')) {
      // A new process has no original verifier. Offer a fresh start without exposing the grant in navigation.
      return initial ? '/sign-in?googleRetry=1' : null;
    }
  } catch {
    // The router also accepts relative paths.
  }
  return path;
}
