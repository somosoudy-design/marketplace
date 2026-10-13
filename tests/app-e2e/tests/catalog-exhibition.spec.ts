import { expect, test, type Page } from '@playwright/test';

// Run once against the normal export and once against an explicit local private-preview export.
// No real photograph is asserted until a licensed batch exists. Current images must remain the originals.
const privatePreview = process.env.KORA_CATALOG_PRESENTATION_TEST === 'private-preview';

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

    test('Home and results preserve product images, sample semantics and navigation', async ({ page }, testInfo) => {
      await page.goto('/');
      const notice = page.locator('[data-testid="catalog-exhibition-notice"]:visible');
      const hero = page.getByTestId('home-hero');
      await expect(hero).toContainText(privatePreview ? 'Producto mostrado' : 'Producto mostrado · Demo');
      await expect(notice).toHaveCount(privatePreview ? 1 : 0);
      if (privatePreview) {
        await expect(notice).toHaveAccessibleName(/precios son ejemplos, no ofertas reales/);
        await expect(hero).not.toContainText('Demo');
      }
      const first = page.getByTestId('home-recommended').locator('[data-testid^="product-card-"]').first();
      await expect(first).toHaveAccessibleName(/producto de demostración/);
      if (privatePreview) await expect(first.getByText('Demo', { exact: true })).toHaveCount(0);
      else await expect(first.getByText('Demo', { exact: true })).toHaveCount(1);
      await expect(first.locator('img')).toHaveAttribute('src', /storage\/v1\/object\/public\/catalog\/demo\//);
      await capture(page, testInfo.outputPath('01-home.png'));
      await page.getByRole('tab', { name: 'Buscar', exact: true }).click();
      await expect(page.getByTestId('catalog-search')).toBeVisible();
      await expect(notice).toHaveCount(privatePreview ? 1 : 0);
      const results = page.waitForResponse((response) => response.url().includes('/rpc/search_products') && response.request().postDataJSON()?.p_query === 'UGREEN');
      await page.getByTestId('catalog-search').fill('UGREEN');
      const response = await results;
      expect(response.ok()).toBe(true);
      const cable = page.getByTestId('explore-list').getByTestId('product-card-ugreen-cable-usb-c-100w');
      await expect(cable).toBeVisible();
      await expect(page.getByTestId('explore-list').getByTestId('product-card-sheglam-labial-liquido-mate')).toHaveCount(0);
      await capture(page, testInfo.outputPath('02-results.png'));
      await cable.click();
      await expect(page.getByTestId('product-title')).toContainText('UGREEN cable USB-C a USB-C');
      await page.getByTestId('product-back').click();
      await expect(page.getByTestId('catalog-search')).toHaveValue('UGREEN');
    });

    test('direct product and cart keep the original photo and exact $9 subtotal', async ({ page }, testInfo) => {
      await page.goto('/p/ugreen-cable-usb-c-100w');
      await expect(page.getByTestId('product-title')).toBeVisible();
      await expect(page.getByTestId('product-demo')).toHaveCount(privatePreview ? 0 : 1);
      await expect(page.locator('[data-testid="catalog-exhibition-notice"]:visible')).toHaveCount(privatePreview ? 1 : 0);
      const gallerySource = await page.getByTestId('product-gallery').locator('img').first().getAttribute('src');
      expect(gallerySource).toContain('ugreen-cable-usb-c-100w-1.webp');
      await capture(page, testInfo.outputPath('03-product.png'));
      await page.getByTestId('product-add').click();
      await expect(page.getByTestId('added-to-cart')).toBeVisible();
      await page.getByTestId('product-cta').click();
      await expect(page).toHaveURL(/\/cart$/);
      await expect(page.getByTestId('cart-subtotal')).toHaveText(/\$\s?9,00/);
      await expect(page.locator('[data-testid="catalog-exhibition-notice"]:visible')).toHaveCount(privatePreview ? 1 : 0);
      await expect(page.locator('[data-testid^="cart-line-"] img').first()).toHaveAttribute('src', gallerySource!);
      await capture(page, testInfo.outputPath('04-cart.png'));
    });

    test('320px keeps the test identifier, controls and one-line names without overflow', async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 320, height: 892 });
      for (const route of ['/', '/explore']) {
        await page.goto(route);
        await expect(page.getByTestId(route === '/' ? 'home-hero' : 'catalog-search')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
        if (privatePreview) {
          await expect(page.getByTestId('catalog-exhibition-notice')).toBeVisible();
          const clipped = await page.getByTestId('catalog-exhibition-notice').evaluate((n) => n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1);
          expect(clipped).toBe(false);
        }
        await capture(page, testInfo.outputPath(route === '/' ? '05-home-320.png' : '06-search-320.png'));
      }
    });

    test('favorites keep the original product images for an existing local buyer', async ({ page }, testInfo) => {
      // Documented seed account, never a personal credential or remote login.
      await page.goto('/sign-in');
      await page.getByTestId('sign-in-email').fill('comprador@example.com');
      await page.getByTestId('sign-in-password').fill('Demo-1234');
      await page.getByTestId('sign-in-submit').click();
      await expect(page).not.toHaveURL(/sign-in/);
      await page.goto('/favorites');
      await expect(page.getByTestId('favorites-count')).toContainText('productos guardados');
      const saved = page.getByTestId('favorites-list').locator('[data-testid^="product-card-"]').first();
      await expect(saved).toHaveAccessibleName(/producto de demostración/);
      await expect(saved.locator('img')).toHaveAttribute('src', /storage\/v1\/object\/public\/catalog\/demo\//);
      if (privatePreview) {
        await expect(saved.getByText('Demo', { exact: true })).toHaveCount(0);
        await expect(page.locator('[data-testid="catalog-exhibition-notice"]:visible')).toHaveCount(1);
      }
      await capture(page, testInfo.outputPath('07-favorites.png'));
    });
  });
}
