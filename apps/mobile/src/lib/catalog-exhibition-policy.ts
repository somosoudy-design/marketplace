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
  additionalSources?: readonly { label: string; url: string }[];
  /** Synthetic sample or official sample reference; both require confirmed is_demo. */
  kind?: 'generated-demo' | 'manufacturer-reference';
  variantId?: string;
  referenceOnly?: boolean;
  disclosure?: string;
}

/** An individual override can fail independently from another page or variant. */
export function exhibitionSourceKey(productId: string | undefined, path: string | null | undefined, photo: ExhibitionPhoto | undefined): string | undefined {
  return photo ? `${productId}:${photo.sha256}:${path}` : undefined;
}

/** Remove only recognised seed boilerplate in the explicitly internal commercial presentation. */
export function commercialCatalogText(enabled: boolean, text: string | null | undefined, isDemo?: boolean): string | null | undefined {
  if (!enabled || !isDemo || !text) return text;
  return text
    .replace(/\b(?:Producto|Artículo) de demostración\.?\s*/giu, '')
    .replace(/^((?:Audífonos|Tienda|Cama|Comedero|Correa|Juguete|Esponjas)\b[^.\n]{0,70}) de demostración\b/iu, '$1')
    .replace(/\s*\(demostración\)/giu, '')
    .trim();
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
  const matches = photos.filter((photo) => photo.productId === productId && photo.originalPath === path && (isDemo === true || (photo.kind !== 'generated-demo' && photo.kind !== 'manufacturer-reference')));
  if (variantId) {
    const exact = matches.find((photo) => photo.variantId === variantId);
    if (exact) return exact;
    // Never substitute another known color for a variant without a matching visual.
    if (matches.some((photo) => photo.variantId)) return undefined;
  }
  return matches.find((photo) => !photo.variantId);
}

/** Hide superseded legacy illustrations; fresh seller/imported paths retain the backend order. */
export function exhibitionGallery<T extends { path: string }>(
  enabled: boolean, photos: readonly ExhibitionPhoto[], productId: string, images: T[], isDemo?: boolean,
): T[] {
  if (!enabled) return images;
  const mappedPaths = new Set(images.filter((image) => exhibitionPhoto(enabled, photos, productId, image.path, undefined, isDemo)).map((image) => image.path));
  if (!mappedPaths.size) return images;
  return images.filter((image) => !image.path.startsWith('demo/') || mappedPaths.has(image.path));
}

/** Private curation: sample products with a prepared image lead without changing backend ranks or claims. */
export function prioritizeGeneratedExhibition<T extends { id: string; image_path: string | null; is_demo: boolean }>(
  enabled: boolean, photos: readonly ExhibitionPhoto[], products: readonly T[],
): T[] {
  const ready = (p: T) => {
    const kind = p.is_demo && exhibitionPhoto(enabled, photos, p.id, p.image_path, undefined, p.is_demo)?.kind;
    return kind === 'generated-demo' || kind === 'manufacturer-reference';
  };
  return [...products.filter(ready), ...products.filter((p) => !ready(p))];
}

/** Categories carry an image path, not a product identity: accept only an unambiguous registered source. */
export function exhibitionCategoryPhoto(enabled: boolean, photos: readonly ExhibitionPhoto[], path?: string | null): ExhibitionPhoto | undefined {
  if (!enabled || !path) return undefined;
  const matches = photos.filter((photo) => photo.originalPath === path && !photo.variantId);
  return new Set(matches.map((photo) => photo.productId)).size === 1 ? matches[0] : undefined;
}
