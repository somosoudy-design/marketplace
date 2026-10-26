import { expect, test, type Page } from '@playwright/test';
import type { ProductDetail, ProductCard } from '@kora/api';

// Run once against the normal export and once against an explicit local private-preview export.
// Normal and private exports preserve exact product/variant sources; licensed synthetic resources remain disclosed on demand.
const privatePreview = process.env.KORA_CATALOG_PRESENTATION_TEST === 'private-preview';


const reads = new Set(['home_feed', 'search_products', 'product_detail', 'product_reviews', 'rate_status', 'pricing_today', 'support_info', 'public_support']);
const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
async function guardBackend(page: Page) {
  await page.route('**/rest/v1/**', (route) => {
    const request = route.request(), url = new URL(request.url());
    if (localHosts.has(url.hostname)) return route.continue();
    if (url.hostname !== 'mimnotafmfasvwrclxan.supabase.co' || !privatePreview) throw new Error('Remote catalogue requires explicit Marketplace private-preview mode');
    if (url.pathname.endsWith('/rpc/track_event')) return route.fulfill({ status: 204, body: '' });
    if (request.method() === 'GET' || request.method() === 'POST' && reads.has(url.pathname.split('/').at(-1)!)) return route.continue();
    throw new Error(`Unexpected remote mutation: ${url.pathname}`);
  });
  await page.route('**/auth/v1/**', (route) => {
    if (!localHosts.has(new URL(route.request().url()).hostname)) throw new Error('Remote login/auth forbidden in catalogue tests');
    return route.continue();
  });
}

async function capture(page: Page, path: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  await expect.poll(() => page.locator('img').evaluateAll((images) => images.every((img) => {
    const r = img.getBoundingClientRect();
    if (!r.width || !r.height || r.top >= innerHeight || r.bottom <= 0 || r.left >= innerWidth || r.right <= 0) return true;
    return (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0;
  }))).toBe(true);
  await page.screenshot({ path });
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`catalogue presentation (${colorScheme}, ${privatePreview ? 'private' : 'standard'})`, () => {
    test.use({ colorScheme, viewport: { width: 412, height: 892 } });
    test.beforeEach(async ({ page }) => guardBackend(page));

    test('Home and results preserve product images, sample semantics and navigation', async ({ page }, testInfo) => {
      await page.goto('/');
      const notice = page.locator('[data-testid="catalog-exhibition-notice"]:visible');
      const hero = page.getByTestId('home-hero');
      await expect(hero).toBeVisible();
      await expect(hero.getByRole('link')).toHaveCount(1);
      await expect(page.getByTestId('home-search')).toBeVisible();
      await expect(notice).toHaveCount(0);
      if (privatePreview) {
        await expect(hero).not.toContainText('Demo');
      }
      const first = page.getByTestId('home-recommended').locator('[data-testid^="product-card-"]').first();
      if (privatePreview) await expect(first).not.toHaveAccessibleName(/producto de demostración/);
      else await expect(first).toHaveAccessibleName(/producto de demostración/);
      if (privatePreview) await expect(first.getByText('Demo', { exact: true })).toHaveCount(0);
      else await expect(first.getByText('Demo', { exact: true })).toHaveCount(1);
      if (privatePreview) await expect(first.locator('img')).toHaveAttribute('src', /\S+/);
      else await expect(first.locator('img')).toHaveAttribute('src', /storage\/v1\/object\/public\/catalog\/demo\//);
      await capture(page, testInfo.outputPath('01-home.png'));
      await page.getByRole('tab', { name: 'Buscar', exact: true }).click();
      await expect(page.getByTestId('catalog-search')).toBeVisible();
      await expect(notice).toHaveCount(0);
      const results = page.waitForResponse((response) => response.url().includes('/rpc/search_products') && response.request().postDataJSON()?.p_query === 'UGREEN');
      await page.getByTestId('catalog-search').fill('UGREEN');
      const response = await results;
      expect(response.ok()).toBe(true);
      const dto = (await response.json() as ProductCard[]).find((p) => p.slug === 'ugreen-cable-usb-c-100w')!;
      expect(dto).toBeDefined();
      const cable = page.getByTestId('explore-list').getByTestId('product-card-ugreen-cable-usb-c-100w');
      await expect(cable).toBeVisible();
      await expect(page.getByTestId('explore-list').getByTestId('product-card-sheglam-labial-liquido-mate')).toHaveCount(0);
      await capture(page, testInfo.outputPath('02-results.png'));
      await cable.click();
      await expect(page.getByTestId('product-title')).toHaveText(dto.title);
      await page.getByTestId('product-back').click();
      await expect(page.getByTestId('catalog-search')).toHaveValue('UGREEN');
    });

    test('direct product and cart keep the resolved photo and selected DTO price', async ({ page }, testInfo) => {
      const detailResponse = page.waitForResponse((r) => r.url().endsWith('/rpc/product_detail') && r.ok());
      await page.goto('/p/ugreen-cable-usb-c-100w');
      const dto: ProductDetail = await (await detailResponse).json();
      const selected = dto.variants.find((v) => v.active) ?? dto.variants[0];
      await expect(page.getByTestId('product-title')).toBeVisible();
      await expect(page.getByTestId('product-demo')).toHaveCount(privatePreview ? 0 : 1);
      await expect(page.locator('[data-testid="catalog-exhibition-notice"]:visible')).toHaveCount(0);
      const gallerySource = await page.getByTestId('product-gallery').locator('img').first().getAttribute('src');
      expect(gallerySource).toBeTruthy();
      if (!privatePreview) expect(gallerySource).toContain(dto.image_path!);
      await capture(page, testInfo.outputPath('03-product.png'));
      await page.getByTestId('product-add').click();
      await expect(page.getByTestId('added-to-cart')).toBeVisible();
      await page.getByTestId('product-cta').click();
      await expect(page).toHaveURL(/\/cart$/);
      await expect(page.getByTestId('cart-subtotal')).toContainText(Number(selected.price_usd).toFixed(2).replace('.', ','));
      await expect(page.locator('[data-testid="catalog-exhibition-notice"]:visible')).toHaveCount(0);
      await expect(page.locator('[data-testid^="cart-line-"] img').first()).toHaveAttribute('src', gallerySource!);
      await capture(page, testInfo.outputPath('04-cart.png'));
    });

    test('320px keeps commercial controls readable without overflow', async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 320, height: 892 });
      for (const route of ['/', '/explore']) {
        await page.goto(route);
        await expect(page.getByTestId(route === '/' ? 'home-hero' : 'catalog-search')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
        if (privatePreview) {
          await expect(page.getByTestId('catalog-exhibition-notice')).toHaveCount(0);
          await expect(page.getByText('Demo', { exact: true })).toHaveCount(0);
        }
        await capture(page, testInfo.outputPath(route === '/' ? '05-home-320.png' : '06-search-320.png'));
      }
    });

    test('favorites keep the original product images for an existing local buyer', async ({ page }, testInfo) => {
      // Verify backend BEFORE entering any seed credential. This case is LOCAL-only.
      const homeResponse = page.waitForResponse((r) => r.url().endsWith('/rpc/home_feed'));
      await page.goto('/');
      test.skip(!localHosts.has(new URL((await homeResponse).url()).hostname), 'Seed-account favorites coverage is LOCAL-only; remote login forbidden');
      await page.goto('/sign-in');
      await page.getByTestId('sign-in-email').fill('comprador@example.com');
      await page.getByTestId('sign-in-password').fill('Demo-1234');
      await page.getByTestId('sign-in-submit').click();
      await expect(page).not.toHaveURL(/sign-in/);
      await page.goto('/favorites');
      await expect(page.getByTestId('favorites-count')).toContainText('productos guardados');
      const saved = page.getByTestId('favorites-list').locator('[data-testid^="product-card-"]').first();
      if (privatePreview) await expect(saved).not.toHaveAccessibleName(/producto de demostración/);
      else await expect(saved).toHaveAccessibleName(/producto de demostración/);
      if (!privatePreview) await expect(saved.locator('img')).toHaveAttribute('src', /storage\/v1\/object\/public\/catalog\/demo\//);
      else await expect(saved.locator('img')).toHaveAttribute('src', /\S+/);
      if (privatePreview) {
        await expect(saved.getByText('Demo', { exact: true })).toHaveCount(0);
        await expect(page.locator('[data-testid="catalog-exhibition-notice"]:visible')).toHaveCount(0);
      }
      await capture(page, testInfo.outputPath('07-favorites.png'));
    });
  });
}
