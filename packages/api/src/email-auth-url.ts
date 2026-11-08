const MARKETPLACE = 'https://mimnotafmfasvwrclxan.supabase.co';
const PUBLIC_WEB = 'https://mayami.app';
const loopback = (url: URL) => ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);

/** An MIM-backed local client must never put its development origin in a production email. */
export function emailWebCallbackUrl(backendUrl: string, clientOrigin: string, path: string): string {
  const backend = new URL(backendUrl), client = new URL(clientOrigin);
  let origin: string;
  if (backend.origin === MARKETPLACE && backend.pathname === '/' && !backend.search && !backend.hash && !backend.username && !backend.password) origin = PUBLIC_WEB;
  else if (loopback(backend) && loopback(client) && ['http:', 'https:'].includes(backend.protocol) &&
      ['http:', 'https:'].includes(client.protocol) && !backend.username && !backend.password && !client.username && !client.password) origin = client.origin;
  else throw new Error('No hay un destino de correo verificado para este entorno.');
  const callback = new URL(path, origin);
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(path) || callback.origin !== origin || callback.hash || callback.pathname !== '/auth/callback') throw new Error('Destino de correo inválido.');
  for (const [key, value] of callback.searchParams) {
    if (callback.searchParams.getAll(key).length !== 1 || !['volver', 'tipo'].includes(key) ||
        (key === 'tipo' && value !== 'recuperar')) throw new Error('Propósito de correo inválido.');
  }
  return callback.toString();
}

/** Fixed APK callbacks reuse the installed kora scheme; local test links remain separate. */
export function productionNativeEmailCallback(backendUrl: string, path: string): string | null {
  if (backendUrl.replace(/\/$/, '') !== MARKETPLACE) return null;
  if (path !== '/auth-callback' && path !== '/reset-password') throw new Error('Destino nativo de correo inválido.');
  return 'kora:/' + path;
}
