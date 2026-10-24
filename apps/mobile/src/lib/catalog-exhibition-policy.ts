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
  author?: string;
  license?: string;
  licenseUrl?: string;
  originUrl?: string;
  /** Original synthetic illustration of an unbranded demo; never described as an authentic photograph. */
  kind?: 'generated-demo';
  variantId?: string;
  referenceOnly?: boolean;
  disclosure?: string;
}

/** Keep the original order except the cleared photographs which lead the private showcase. */
export function prioritizeExhibitionPhotos<T extends { id: string; image_path: string | null }>(
  enabled: boolean, photos: readonly ExhibitionPhoto[], products: readonly T[],
): T[] {
  if (!enabled) return [...products];
  const ready = (p: T) => !!exhibitionPhoto(true, photos, p.id, p.image_path);
  return [...products.filter(ready), ...products.filter((p) => !ready(p))];
}

export function exhibitionPhoto(
  enabled: boolean, photos: readonly ExhibitionPhoto[], productId?: string, path?: string | null, variantId?: string, isDemo?: boolean,
): ExhibitionPhoto | undefined {
  if (!enabled || !productId || !path) return undefined;
  const matches = photos.filter((photo) => photo.productId === productId && photo.originalPath === path && (isDemo === true || photo.kind !== 'generated-demo'));
  if (variantId) {
    const exact = matches.find((photo) => photo.variantId === variantId);
    if (exact) return exact;
    // Never substitute another known color for a variant without a matching visual.
    if (matches.some((photo) => photo.variantId)) return undefined;
  }
  return matches.find((photo) => !photo.variantId);
}

/** Private, non-personalized curation: newly generated demos lead without changing backend ranks or claims. */
export function prioritizeGeneratedExhibition<T extends { id: string; image_path: string | null; is_demo: boolean }>(
  enabled: boolean, photos: readonly ExhibitionPhoto[], products: readonly T[],
): T[] {
  const ready = (p: T) => p.is_demo && exhibitionPhoto(enabled, photos, p.id, p.image_path, undefined, p.is_demo)?.kind === 'generated-demo';
  return [...products.filter(ready), ...products.filter((p) => !ready(p))];
}

/** Categories carry an image path, not a product identity: accept only an unambiguous registered source. */
export function exhibitionCategoryPhoto(enabled: boolean, photos: readonly ExhibitionPhoto[], path?: string | null): ExhibitionPhoto | undefined {
  if (!enabled || !path) return undefined;
  const matches = photos.filter((photo) => photo.originalPath === path && !photo.variantId);
  return new Set(matches.map((photo) => photo.productId)).size === 1 ? matches[0] : undefined;
}
