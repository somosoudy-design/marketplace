import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// All product data and Storage responses are local fixtures; external hosts and mutations are blocked.
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const sources: { productId: string; title: string; variantId: string; variant: string; originalPath: string; sha256Original: string }[] =
  JSON.parse(readFileSync(resolve(repo, 'docs/catalogo-exhibicion/REFERENCIAS_OFICIALES_2026-10-28.json'), 'utf8')).fuentes;
const fallback = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/X1sAAAAASUVORK5CYII=', 'base64');

function product(source: typeof sources[number]) {
  const slug = `fixture-${source.productId}`;
  return {
    id: source.productId, slug, title: source.title, subtitle: null, description: 'Producto de referencia local',
    brand_name: source.title.startsWith('UGREEN') ? 'UGREEN' : 'SHEGLAM', highlights: [], option_names: [],
    store_id: '00000000-0000-4000-a000-000000000001', store_name: 'Tienda local', store_slug: 'local', store_kind: 'platform', store_status: 'active',
    category_id: '00000000-0000-4000-a000-000000000002', category_slug: 'fixture', category_name: 'Categoría', tone: 'mist',
    availability: 'available', origin: 'local', price_usd: 19, compare_at_usd: null, image_path: source.originalPath,
    stock_total: 8, lead_min_days: null, lead_max_days: null, popularity: 1, published_at: null, is_demo: true, moderation_status: 'published',
    rating_avg: null, rating_count: 0, max_per_order: 5, weight_kg: null, is_favorite: false, alert_requested: false, related: [],
    images: [{ path: source.originalPath, alt: source.title, width: 800, height: 1000 }, { path: source.originalPath.replace('-1.webp', '-2.webp'), alt: source.title, width: 800, height: 1000 }],
    variants: [{ id: source.variantId, title: source.variant, options: {}, sku: null, active: true, price_usd: 19, stock: 8 }],
    store: { id: '00000000-0000-4000-a000-000000000001', name: 'Tienda local', slug: 'local', logo_path: null, accent: 'plum', kind: 'platform', shipping_info: null, rating_avg: null, rating_count: 0 },
  };
}

async function fixtureOnly(page: Page, failAsset?: string) {
  const products = sources.map(product), blocked: string[] = [];
  await page.route('**/*', async (route) => {
    const req = route.request(), url = new URL(req.url());
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) { blocked.push(`${req.method()} ${url.pathname}`); return route.abort(); }
    if (failAsset && url.pathname.includes(failAsset)) return route.abort('failed');
    if (url.pathname.includes('/storage/v1/object/public/catalog/')) return route.fulfill({ contentType: 'image/png', body: fallback });
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: { user: null } });
    if (!url.pathname.startsWith('/rest/v1/')) return route.continue();
    const rpc = url.pathname.split('/').at(-1), body = req.method() === 'POST' ? req.postDataJSON() : {};
    if (rpc === 'track_event' || rpc === 'track_recommendation') return route.fulfill({ status: 204, body: '' });
    if (rpc === 'home_feed') return route.fulfill({ json: { stores: [], categories: [], collections: [], recommended: products, recently_viewed: [], personalized: false } });
    if (rpc === 'search_products') return route.fulfill({ json: products.filter((p) => !body.p_query || p.title.toLowerCase().includes(String(body.p_query).toLowerCase())) });
    if (rpc === 'product_detail') return route.fulfill({ json: products.find((p) => p.id === body.p_id) ?? null });
    if (rpc === 'product_reviews') return route.fulfill({ json: { summary: { count: 0, avg: null, distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } }, items: [] } });
    if (rpc === 'rate_status') return route.fulfill({ json: { pair: 'USD/VES', available: false, reason: 'stale_or_missing', last: null } });
    if (rpc === 'pricing_today') return route.fulfill({ json: { available: false, reason: 'disabled' } });
    if (req.method() === 'GET') return route.fulfill({ json: [] });
    blocked.push(`${req.method()} ${url.pathname}`); return route.abort();
  });
  return { products, blocked };
}

test('a reference survives the guest cart snapshot and an unavailable reference falls back safely', async ({ page }) => {
  const { blocked } = await fixtureOnly(page);
  const item = sources[0]!;
  await page.goto('/');
  const homeImage = page.getByTestId(`exhibition-photo-${item.productId}`).locator('img').first();
  await expect(homeImage).toHaveAttribute('src', new RegExp(item.sha256Original.slice(0, 12)));
  await page.goto(`/product/${item.productId}`);
  await page.getByTestId('product-add').click(); await page.getByTestId('added-to-cart').click();
  const cartImage = page.getByTestId(`cart-line-${item.variantId}`).getByTestId(`exhibition-photo-${item.productId}`).locator('img');
  await expect(cartImage).toHaveAttribute('src', new RegExp(item.sha256Original.slice(0, 12)));
  expect(blocked).toEqual([]);
});

test('failed local reference hides its attribution and returns to the original Storage image', async ({ page }) => {
  const item = sources[0]!, { blocked } = await fixtureOnly(page, item.sha256Original.slice(0, 12));
  await page.goto(`/product/${item.productId}`);
  const gallery = page.getByTestId('product-gallery');
  await expect(gallery.locator('img').first()).toHaveAttribute('src', new RegExp(item.originalPath));
  await expect(page.getByTestId('product-reference-image')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Información de la imagen', exact: true })).toHaveCount(0);
  expect(blocked).toEqual([]);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`official reference assets render in search and detail (${colorScheme})`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 320, height: 892 });
    const { products, blocked } = await fixtureOnly(page);
    await page.goto('/explore');
    for (const [index, item] of sources.entries()) {
      const card = page.getByTestId(`product-card-${products[index]!.slug}`);
      await expect(card).toBeAttached();
      const photo = card.getByTestId(`exhibition-photo-${item.productId}`).locator('img');
      await expect(photo).toHaveAttribute('src', new RegExp(item.sha256Original.slice(0, 12)));
    }
    await page.screenshot({ path: testInfo.outputPath('search.png') });
    for (const [index, item] of sources.entries()) {
      await page.goto(`/product/${item.productId}`);
      await expect(page.getByTestId('product-title')).toHaveText(item.title);
      await expect(page.getByTestId('product-reference-image')).toHaveText('Imagen referencial; la presentación y los accesorios pueden variar.');
      const image = page.getByTestId('product-gallery').getByTestId(`exhibition-photo-${item.productId}`).locator('img').first();
      await expect(image).toHaveAttribute('src', new RegExp(item.sha256Original.slice(0, 12)));
      await page.screenshot({ path: testInfo.outputPath(`detail-top-${index}.png`) });
      await page.getByRole('button', { name: 'Información de la imagen', exact: true }).click();
      const sheet = page.getByTestId('product-image-info-sheet');
      await expect(sheet.getByText(/Imagen referencial/)).toBeVisible();
      await expect(sheet.getByRole('link', { name: `Fuente: ${index < 4 ? 'UGREEN' : 'SHEGLAM'}` })).toBeVisible();
      await expect(sheet.getByRole('link', { name: /Licencia de la imagen/ })).toHaveCount(0);
      await page.getByTestId('product-image-info-sheet-close').click();
      if (index === 0 || index === 4) await page.screenshot({ path: testInfo.outputPath(`detail-${index}.png`) });
    }
    expect(blocked).toEqual([]);
  });
}
