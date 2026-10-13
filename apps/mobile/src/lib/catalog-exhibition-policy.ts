/** Presentation only. Never changes product data, permissions or purchase eligibility. */
export interface ExhibitionContext {
  optIn?: string;
  platform: string;
  channel: string | null;
  backendUrl: string;
  webHostname?: string;
}

const TEST_BACKEND = 'https://mimnotafmfasvwrclxan.supabase.co';
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

export function exhibitionEnabled(context: ExhibitionContext): boolean {
  if (context.optIn !== 'private-preview') return false;
  let backend: URL;
  try { backend = new URL(context.backendUrl); } catch { return false; }
  const testBackend = backend.origin === TEST_BACKEND ||
    (LOOPBACK.has(backend.hostname) && backend.protocol === 'http:' && backend.port === '54321');
  if (!testBackend) return false;
  if (context.platform === 'web') return LOOPBACK.has(context.webHostname ?? '');
  return context.platform === 'android' && context.channel === 'preview';
}

export interface ExhibitionPhoto {
  productId: string;
  /** Exact original storage path: changing a seller's image invalidates the override. */
  originalPath: string;
  /** Metro's literal require(asset) result; no external URLs or downloads. */
  source: number;
  sha256: string;
  width: number;
  height: number;
}

export function exhibitionPhoto(
  enabled: boolean, photos: readonly ExhibitionPhoto[], productId?: string, path?: string | null,
): ExhibitionPhoto | undefined {
  if (!enabled || !productId || !path) return undefined;
  return photos.find((photo) => photo.productId === productId && photo.originalPath === path);
}
