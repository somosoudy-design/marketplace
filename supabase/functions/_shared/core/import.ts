// GENERATED from packages/core/src/import/index.ts by tools/sync-edge-shared.mjs. Do not edit; run `pnpm edge:sync`.
/**
 * Admin URL importer. Respects provider terms: marketplaces that forbid automated extraction are
 * identified but never fetched; for the rest we read ONLY the single page the admin pasted and only
 * the structured metadata the page publishes for link previews (JSON-LD Product / Open Graph).
 * Images are never published automatically: the admin must confirm usage rights.
 */
export type ImportPolicy = 'metadata' | 'manual';
export interface ProviderInfo { key: string; name: string; policy: ImportPolicy; note: string }

const PROVIDERS: Array<{ match: RegExp } & ProviderInfo> = [
  { match: /(^|\.)amazon\.[a-z.]+$/, key: 'amazon', name: 'Amazon', policy: 'manual', note: 'Sus condiciones prohíben la extracción automatizada. Carga manual.' },
  { match: /(^|\.)(shein|sheinside)\.[a-z.]+$/, key: 'shein', name: 'SHEIN', policy: 'manual', note: 'Carga manual.' },
  { match: /(^|\.)aliexpress\.[a-z.]+$/, key: 'aliexpress', name: 'AliExpress', policy: 'manual', note: 'Carga manual.' },
  { match: /(^|\.)temu\.com$/, key: 'temu', name: 'Temu', policy: 'manual', note: 'Carga manual.' },
  { match: /(^|\.)ebay\.[a-z.]+$/, key: 'ebay', name: 'eBay', policy: 'manual', note: 'Carga manual.' },
  { match: /(^|\.)ugreen\.com$/, key: 'ugreen', name: 'UGREEN (sitio oficial)', policy: 'metadata', note: 'Se leen solo metadatos públicos de la página. Confirma derechos de imagen antes de publicar.' },
  { match: /(^|\.)sheglam\.com$/, key: 'sheglam', name: 'SHEGLAM (sitio oficial)', policy: 'metadata', note: 'Se leen solo metadatos públicos de la página. Confirma derechos de imagen antes de publicar.' },
];

export function detectProvider(rawUrl: string): ProviderInfo & { url: string } {
  let u: URL;
  try { u = new URL(rawUrl.trim()); } catch { throw new Error('URL inválida'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('Solo se aceptan enlaces http(s)');
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(u.hostname) || u.hostname.endsWith('.internal')) throw new Error('Dirección no permitida');
  const host = u.hostname.toLowerCase();
  const p = PROVIDERS.find((x) => x.match.test(host));
  return p ? { key: p.key, name: p.name, policy: p.policy, note: p.note, url: u.toString() }
    : { key: 'generic', name: host, policy: 'metadata', note: 'Sitio genérico: se leen solo metadatos públicos.', url: u.toString() };
}

/** Display name for a stored provider key (generic imports store the key 'generic'). */
export function providerName(key: string | null | undefined): string {
  if (!key) return '—';
  return PROVIDERS.find((p) => p.key === key)?.name ?? (key === 'generic' ? 'Sitio genérico' : key);
}

export interface ExtractedProduct {
  title: string | null;
  description: string | null;
  images: string[];
  price: number | null;
  currency: string | null;
  brand: string | null;
  sku: string | null;
  variants: Array<{ title: string; price: number | null; sku: string | null }>;
}

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
const meta = (html: string, prop: string) => {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop.replace(':', '\\:')}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop.replace(':', '\\:')}["']`, 'i');
  const m = html.match(re);
  return m ? decode(m[1] ?? m[2] ?? '') : null;
};

export function extractProductMetadata(html: string, baseUrl: string): ExtractedProduct {
  const out: ExtractedProduct = { title: null, description: null, images: [], price: null, currency: null, brand: null, sku: null, variants: [] };
  // JSON-LD first (richest, explicitly published for machines)
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]!.trim());
      const nodes: any[] = Array.isArray(data) ? data : data['@graph'] ?? [data];
      const product = nodes.find((n) => [].concat(n?.['@type']).includes('Product' as never) || n?.['@type'] === 'ProductGroup');
      if (!product) continue;
      out.title ??= product.name ?? null;
      out.description ??= product.description ?? null;
      out.brand ??= typeof product.brand === 'string' ? product.brand : product.brand?.name ?? null;
      out.sku ??= product.sku ?? null;
      const imgs = [].concat(product.image ?? []).map((i: any) => (typeof i === 'string' ? i : i?.url)).filter(Boolean);
      out.images.push(...imgs);
      const offers = [].concat(product.offers?.offers ?? product.offers ?? []) as any[];
      const firstOffer = offers[0];
      if (firstOffer) { out.price ??= Number(firstOffer.price ?? firstOffer.lowPrice) || null; out.currency ??= firstOffer.priceCurrency ?? null; }
      for (const v of [].concat(product.hasVariant ?? []) as any[]) {
        const vo = [].concat(v.offers ?? [])[0] as any;
        out.variants.push({ title: v.name ?? v.sku ?? 'Variante', price: vo ? Number(vo.price) || null : null, sku: v.sku ?? null });
      }
    } catch { /* ignore malformed blocks */ }
  }
  out.title ??= meta(html, 'og:title') ?? (html.match(/<title>([^<]*)<\/title>/i)?.[1] ? decode(html.match(/<title>([^<]*)<\/title>/i)![1]!) : null);
  out.description ??= meta(html, 'og:description') ?? meta(html, 'description');
  const ogImage = meta(html, 'og:image');
  if (ogImage) out.images.push(ogImage);
  const ogPrice = meta(html, 'product:price:amount') ?? meta(html, 'og:price:amount');
  if (out.price === null && ogPrice) out.price = Number(ogPrice.replace(',', '.')) || null;
  out.currency ??= meta(html, 'product:price:currency') ?? meta(html, 'og:price:currency');
  out.images = [...new Set(out.images.map((i) => { try { return new URL(i, baseUrl).toString(); } catch { return null; } }).filter((x): x is string => !!x))].slice(0, 8);
  return out;
}
