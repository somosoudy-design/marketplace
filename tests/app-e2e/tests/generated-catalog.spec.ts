import { expect, test, type Page } from '@playwright/test';
import type { ProductDetail } from '@kora/api';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../../../apps/mobile/assets/catalog-exhibition/generated-manifest.json', import.meta.url), 'utf8')) as { resources: { productId: string }[] };

const enabled = process.env.KORA_GENERATED_CATALOG_TEST === 'readonly';
const readRpc = new Set(['home_feed', 'search_products', 'product_detail', 'product_reviews', 'rate_status', 'pricing_today', 'support_info', 'public_support']);
const productId = '0d93e509-6738-4d99-88ec-a5a1f5d08fdf';
const sandId = 'f984e205-a702-4f95-b0e2-c2249127a4a0';

async function readOnly(page: Page) {
  await page.route('**/rest/v1/**', (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname !== 'mimnotafmfasvwrclxan.supabase.co') throw new Error('Only Marketplace preview');
    if (url.pathname.endsWith('/rpc/track_event')) return route.fulfill({ status: 204, body: '' });
    if (request.method() === 'GET' || request.method() === 'POST' && readRpc.has(url.pathname.split('/').at(-1)!)) return route.continue();
    throw new Error(`Unexpected remote mutation: ${url.pathname}`);
  });
}

async function readyImage(page: Page) {
  const gallery = page.locator('[data-testid="product-gallery"]:visible');
  await expect(gallery.getByTestId(`exhibition-photo-${productId}`)).toBeVisible();
  await expect.poll(() => gallery.locator('img').evaluateAll((imgs) => imgs.length === 1 && imgs.every((img) => img.complete && img.naturalWidth >= 768))).toBe(true);
  return gallery.locator('img').getAttribute('src');
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`original demo catalogue ${colorScheme}`, () => {
    test.skip(!enabled, 'Explicit private-preview, read-only Marketplace test');
    test.use({ colorScheme, viewport: { width: 412, height: 892 } });
    test.beforeEach(async ({ page }) => readOnly(page));

    test('new imagery is visible in Home, search, detail and back without repetitive Demo badges', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('home-recommended').locator('[data-testid^="exhibition-photo-"]').first()).toBeVisible();
      await expect(page.getByTestId('home-masthead')).toContainText('Incluye imágenes generadas');
      await page.getByRole('tab', { name: 'Buscar', exact: true }).click();
      await page.getByTestId('catalog-search').fill('Audífonos');
      const card = page.getByTestId('explore-list').getByTestId('product-card-audifonos-anc-over-ear');
      await expect(card.getByTestId(`exhibition-photo-${productId}`)).toBeVisible();
      await expect(card).not.toContainText('Demo');
      await card.click(); await readyImage(page);
      await expect(page.getByTestId('exhibition-generated-credit')).toContainText('generada');
      await expect(page.getByTestId('product-demo')).toHaveCount(0);
      await page.getByTestId('product-favorite').click();
      await expect(page.getByTestId('sign-in-submit')).toBeVisible();
      await page.goBack(); await expect(page.getByTestId('product-title')).toBeVisible();
      await page.locator('[data-testid="product-back"]:visible').click();
      await expect(page.getByTestId('catalog-search')).toHaveValue('Audífonos');
    });

    test('all 25 existing products load their local resource and specific disclosure without old illustration slides', async ({ page }) => {
      test.setTimeout(150_000);
      const products = [...new Set(manifest.resources.map((r) => r.productId))];
      expect(products).toHaveLength(25);
      for (const id of products) {
        await page.goto(`/product/${id}`);
        const gallery = page.locator('[data-testid="product-gallery"]:visible');
        await expect(gallery.getByTestId(`exhibition-photo-${id}`)).toHaveCount(1);
        await expect.poll(() => gallery.locator('img').evaluateAll((imgs) => imgs.length === 1 && imgs.every((img) => img.complete && img.naturalWidth >= 768))).toBe(true);
        await expect(gallery.locator('img')).not.toHaveAttribute('src', /\/storage\/v1\//);
        await expect(page.getByTestId('exhibition-generated-credit')).toContainText(/generada/i);
        await expect(page.getByTestId('product-demo')).toHaveCount(0);
      }
    });

    test('selected color survives add, guest cart, reopen and does not change price or duplicate quantity', async ({ page }) => {
      await page.goto(`/product/${productId}`);
      const sage = await readyImage(page);
      await page.getByTestId('variant-Arena').click();
      await expect.poll(() => page.getByTestId('product-gallery').locator('img').getAttribute('src')).not.toBe(sage);
      const sand = await readyImage(page);
      await page.getByTestId('product-add').click();
      await expect(page.getByTestId('added-to-cart')).toBeVisible();
      await page.getByTestId('added-to-cart').click();
      const line = page.getByTestId(`cart-line-${sandId}`);
      await expect(line).toContainText('Arena');
      await expect(line.getByTestId(`exhibition-photo-${productId}`).locator('img')).toHaveAttribute('src', sand!);
      await expect(page.getByTestId('cart-subtotal')).toContainText('89');
      await line.getByRole('link').click(); await readyImage(page);
      // Reopening starts with the backend's first variant; the saved cart still keeps its selected Arena.
      await page.locator('[data-testid="product-back"]:visible').click();
      await expect(line.getByTestId(`exhibition-photo-${productId}`).locator('img')).toHaveAttribute('src', sand!);
      await page.getByTestId('cart-continue').click();
      await expect(page.getByTestId('sign-in-submit')).toBeVisible();
    });

    test('unknown or changed demo status in a cart DTO falls back to storage after public verification', async ({ page }) => {
      const response = page.waitForResponse((r) => r.url().endsWith('/rpc/product_detail') && r.ok());
      await page.goto(`/product/${productId}`); const actual: ProductDetail = await (await response).json();
      await page.getByTestId('variant-Arena').click(); await page.getByTestId('product-add').click();
      await expect(page.getByTestId('added-to-cart')).toBeVisible(); await page.getByTestId('added-to-cart').click();
      const line = page.getByTestId(`cart-line-${sandId}`);
      await expect(line.getByTestId(`exhibition-photo-${productId}`)).toBeVisible();
      await page.route('**/rpc/product_detail', (route) => route.fulfill({ json: { ...actual, is_demo: false } }));
      await page.reload();
      await expect(line.locator('img')).toHaveAttribute('src', /\/storage\/v1\//);
      await expect(line.getByTestId(`exhibition-photo-${productId}`)).toHaveCount(0);
      await page.route('**/rpc/product_detail', (route) => route.fulfill({ status: 503, json: { message: 'Controlled read failure' } }));
      await page.reload();
      await expect(line.locator('img')).toHaveAttribute('src', /\/storage\/v1\//);
      await expect(line.getByTestId(`exhibition-photo-${productId}`)).toHaveCount(0);
    });
  });
}
