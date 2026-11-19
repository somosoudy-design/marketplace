// Encode the complete ID, so links can resolve independently of variant order or stock.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function encodeProductId(id: string) {
  if (!uuid.test(id)) return null;
  const bytes = id.replaceAll('-', '').match(/../g)!;
  return btoa(String.fromCharCode(...bytes.map(byte => Number.parseInt(byte, 16))))
    .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function decodeProductId(code: string) {
  // The final four bits are padding. Reject aliases with nonzero padding bits.
  if (!/^[A-Za-z0-9_-]{21}[AQgw]$/.test(code)) return '';
  const bytes = atob(code.replaceAll('-', '+').replaceAll('_', '/') + '==');
  const hex = Array.from(bytes, byte => byte.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

type QueryValue = string | readonly string[] | undefined;
const values = (value: QueryValue): readonly string[] => typeof value === 'string' ? [value] : value ?? [];

export function requestedProductVariant(legacy: QueryValue, compact: QueryValue) {
  const previous = values(legacy);
  if (previous.length) return previous.length === 1 ? previous[0] : undefined;
  const current = values(compact);
  if (!current.length) return undefined;
  // An invalid compact link is an unavailable selection, never an automatic switch to another option.
  return current.length === 1 ? decodeProductId(current[0]!) : '';
}

export function productSharePath(slug: string, variantId?: string, productId?: string) {
  const id = productId && encodeProductId(productId);
  const path = id ? '/p/i/' + id : '/p/' + encodeURIComponent(slug);
  if (!variantId) return path;
  const code = encodeProductId(variantId);
  return path + (code ? '?v=' + code : '?variant=' + encodeURIComponent(variantId));
}
