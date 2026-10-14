import { expect, test } from '@playwright/test';

// Explicit remote, read-only photo validation; regular local seed runs have different product UUIDs.
const enabled = process.env.KORA_EXHIBITION_RESOURCES_TEST === 'licensed-five';
const products = [
  ['ugreen-nexode-65w','e7a91cd8-d3a2-4436-986c-71d1d95da813','Samsung cargador USB-C 45 W'],
  ['ugreen-power-bank-20000','01a43334-e485-41cc-a12a-c049e933665d','Anker PowerCore'],
  ['ugreen-cable-usb-c-100w','22516bf2-7283-45c1-a3a5-2449797a25db','UGREEN lector SD'],
  ['ugreen-revodok-hub-6-en-1','910cdfb7-9a3e-48e5-bd40-99269aea332a','StarTech.com hub'],
  ['ugreen-nexode-30w','6209f8ff-aeab-40e3-9168-9528a30ca55d','UGREEN cargador de carro'],
];
for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`licensed exhibition photos ${colorScheme}`, () => {
    test.skip(!enabled, 'Requires explicit private-preview export against Marketplace demo UUIDs');
    test.use({ colorScheme, viewport: { width:412, height:892 } });
    test('Home C, search, five matched details, attribution and real image loading', async ({ page }, testInfo) => {
      await page.route('**/rest/v1/rpc/submit_payment', (r) => r.abort());
      await page.route('**/rest/v1/rpc/place_order', (r) => r.abort());
      await page.goto('/');
      await expect(page.getByTestId('home-hero').locator('[data-testid^="exhibition-photo-"]')).toHaveCount(1);
      await expect(page.locator('[data-testid="catalog-exhibition-notice"]:visible')).toHaveCount(1);
      await expect(page.getByTestId('home-hero')).not.toContainText('Demo');
      await expect(page.getByTestId('home-recommended').locator('[data-testid^="exhibition-photo-"]').first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path:testInfo.outputPath('01-home.png') });
      await page.getByRole('tab',{ name:'Buscar',exact:true }).click();
      await expect(page.getByTestId('catalog-search')).toBeVisible();
      await page.getByTestId('catalog-search').fill('UGREEN lector');
      const reader = page.getByTestId('explore-list').getByTestId('product-card-ugreen-cable-usb-c-100w');
      await expect(reader).toContainText('UGREEN lector SD');
      await expect(reader.locator('[data-testid^="exhibition-photo-"]')).toHaveCount(1);
      await page.screenshot({ path:testInfo.outputPath('02-search.png') });
      for (const [slug,id,title] of products) {
        await page.goto(`/p/${slug}`);
        const detail = page.locator('[data-testid="product-scroll"]:visible');
        await expect(detail.getByTestId('product-title')).toContainText(title);
        await expect(page.getByTestId('product-demo')).toHaveCount(0);
        await expect(detail.getByTestId('catalog-exhibition-notice')).toContainText('Precios de ejemplo');
        const gallery = detail.getByTestId('product-gallery');
        const images = gallery.locator('img');
        await expect(images.first()).toBeVisible();
        await expect(gallery.getByTestId(`exhibition-photo-${id}`).first()).toBeVisible();
        await expect.poll(() => images.evaluateAll((imgs) => imgs.every((img) => img.complete && img.naturalWidth > 0))).toBe(true);
        for (const image of await images.all()) await expect(image).not.toHaveAttribute('src', /storage\/v1\/object\/public\/catalog\/demo/);
        await expect(detail.getByTestId('exhibition-photo-credit')).toBeVisible();
        await page.screenshot({ path:testInfo.outputPath(`product-${slug}.png`) });
      }
    });
  });
}
