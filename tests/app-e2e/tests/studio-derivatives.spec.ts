import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

interface StudioResource { productId: string; variantId: string | null; optimizedSha256: string; author: string; license: string }
const manifest = JSON.parse(readFileSync(new URL('../../../apps/mobile/assets/catalog-exhibition/studio-manifest.json', import.meta.url), 'utf8')) as { resources: StudioResource[] };

const enabled = process.env.KORA_STUDIO_DERIVATIVES_TEST === 'readonly' && process.env.KORA_CATALOG_PRESENTATION_TEST === 'private-preview';
const samsung = 'e7a91cd8-d3a2-4436-986c-71d1d95da813';
const solo = '03c25cc2-2186-466f-a3a5-0f0201dfad81';
const reads = new Set(['home_feed', 'search_products', 'product_detail', 'product_reviews', 'rate_status', 'pricing_today', 'support_info', 'public_support']);

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`licensed studio derivatives ${colorScheme}`, () => {
    test.skip(!enabled, 'Explicit read-only Marketplace demo validation only');
    test.use({ colorScheme, viewport: { width: 320, height: 892 } });
    test.beforeEach(async ({ page }) => {
      await page.route('**/rest/v1/**', (route) => {
        const req = route.request(), url = new URL(req.url());
        if (url.hostname !== 'mimnotafmfasvwrclxan.supabase.co') throw new Error('Wrong backend');
        if (url.pathname.endsWith('/track_event')) return route.fulfill({ status: 204, body: '' });
        if (req.method() === 'GET' || req.method() === 'POST' && reads.has(url.pathname.split('/').at(-1)!)) return route.continue();
        throw new Error(`Unexpected remote mutation: ${url.pathname}`);
      });
    });

    test('all five products load the reviewed studio asset, source attribution and compatible license', async ({ page }) => {
      test.setTimeout(90_000);
      for (const id of new Set(manifest.resources.map((r) => r.productId))) {
        const resource = manifest.resources.find((r) => r.productId === id)!;
        await page.goto(`/product/${id}`);
        const detail = page.locator('[data-testid="product-scroll"]:visible');
        const gallery = detail.getByTestId('product-gallery');
        await expect(gallery.getByTestId(`exhibition-photo-${id}`)).toHaveCount(1);
        await expect.poll(() => gallery.locator('img').evaluateAll((images, name) => images.length === 1 && images.every((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth === 1024 && (img as HTMLImageElement).src.includes(name)), resource.optimizedSha256.slice(0, 12))).toBe(true);
        await expect(page.getByTestId('exhibition-generated-credit')).toHaveCount(0);
        await page.getByRole('button', { name: 'Información de la imagen', exact: true }).click();
        const sheet = page.getByTestId('product-image-info-sheet');
        await expect(sheet).toBeVisible();
        await expect(sheet.getByTestId('exhibition-generated-credit')).toHaveText('Imagen editada digitalmente a partir de una fotografía.');
        const attribution = sheet.getByTestId('exhibition-photo-credit');
        await expect(attribution).toContainText(resource.author);
        await expect(attribution.getByRole('link', { name: resource.license, exact: true })).toBeVisible();
        await expect(attribution.getByRole('link', { name: `Fuente: ${resource.author}`, exact: true })).toBeVisible();
        if (id === samsung) await expect(attribution.getByRole('link', { name: 'Detalle original', exact: true })).toBeVisible();
        await page.getByTestId('product-image-info-sheet-close').click();
        await expect(sheet).toBeHidden();
        await expect(page.locator('[data-testid="catalog-exhibition-notice"]:visible')).toHaveCount(0);
        await expect(page.getByTestId('product-demo')).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
      }
    });

    test('Samsung solo removes the cable visually and keeps that exact variant in the guest cart', async ({ page }, info) => {
      const response = page.waitForResponse((r) => r.url().endsWith('/rpc/product_detail') && r.ok());
      await page.goto(`/product/${samsung}`);
      const dto = await (await response).json();
      const selected = dto.variants.find((v: { id: string }) => v.id === solo);
      const kit = manifest.resources.find((r) => r.productId === samsung && r.variantId !== solo)!;
      const alone = manifest.resources.find((r) => r.variantId === solo)!;
      const gallery = page.locator('[data-testid="product-gallery"]:visible');
      await expect(gallery.locator('img')).toHaveAttribute('src', new RegExp(kit.optimizedSha256.slice(0, 12)));
      await page.getByTestId('product-selection-summary').click();
      await page.getByTestId('variant-Solo cargador · Negro').click();
      await expect(gallery.locator('img')).toHaveAttribute('src', new RegExp(alone.optimizedSha256.slice(0, 12)));
      await expect.poll(() => gallery.locator('img').evaluateAll((xs) => xs.every((x) => (x as HTMLImageElement).complete && (x as HTMLImageElement).naturalWidth === 1024))).toBe(true);
      await page.getByTestId('product-scroll').evaluate((node) => node.scrollTo(0, 0));
      await page.screenshot({ path: info.outputPath('samsung-solo.png') });
      await page.getByTestId('product-add').click();
      await expect(page.getByTestId('added-to-cart')).toBeVisible();
      await page.getByTestId('added-to-cart').click();
      const line = page.getByTestId(`cart-line-${solo}`);
      await expect(line).toContainText('Solo cargador');
      await expect(line.getByTestId(`exhibition-photo-${samsung}`).locator('img')).toHaveAttribute('src', new RegExp(alone.optimizedSha256.slice(0, 12)));
      await expect(page.getByTestId('cart-subtotal')).toContainText(Number(selected.price_usd).toFixed(2).replace('.', ','));
      await page.screenshot({ path: info.outputPath('carrito-solo.png') });
      await page.getByTestId('cart-continue').click();
      await expect(page.getByTestId('sign-in-submit')).toBeVisible();
    });
  });
}
