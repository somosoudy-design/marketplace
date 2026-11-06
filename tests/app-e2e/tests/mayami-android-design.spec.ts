import { expect, test } from '@playwright/test';

for (const width of [320, 360, 390, 412]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`Mayami Android ${width} ${colorScheme}`, async ({ browser }, info) => {
      const context = await browser.newContext({ viewport: { width, height: 892 }, colorScheme });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('/');
      await expect(page.getByTestId('home-search')).toBeVisible();
      await expect(page.getByTestId('home-hero')).toBeVisible();
      await expect(page.getByTestId('category-tecnologia')).toBeVisible();
      await expect(page.locator('[data-testid^="home-recommended"] [data-testid="card-title"]').first()).toBeVisible();
      const category = await page.getByTestId('category-tecnologia').boundingBox();
      expect(category!.height).toBeGreaterThanOrEqual(44);
      const titles = page.locator('[data-testid^="home-recommended"] [data-testid="card-title"]');
      expect(await titles.evaluateAll((nodes) => nodes.every((node) => node.scrollHeight <= node.clientHeight + 1))).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect.poll(() => page.locator('img:visible').evaluateAll((images) => images.every((image) => {
        const box = image.getBoundingClientRect();
        return box.bottom <= 0 || box.top >= innerHeight || box.right <= 0 || box.left >= innerWidth || !box.width || !box.height || (image.complete && image.naturalWidth > 0);
      }))).toBe(true);
      await page.screenshot({ path: info.outputPath('inicio.png') });
      await page.getByTestId('home-search').click();
      await expect(page.getByTestId('catalog-search')).toBeFocused();
      await expect(page.locator('[data-testid^="product-card-"]:visible').first()).toBeVisible();
      await page.screenshot({ path: info.outputPath('catalogo.png') });
      expect(errors).toEqual([]);
      await context.close();
    });
  }
}

test('the legacy Mayami store avatar uses the current mark', async ({ page }, info) => {
  await page.route('**/rest/v1/rpc/home_feed*', async (route) => {
    const response = await route.fetch();
    const feed = await response.json();
    const store = feed.stores.find((item: { slug: string }) => item.slug === 'kora');
    store.id = '5afbabbf-0678-40ee-a5d8-540f53efe114';
    store.name = 'Mayami';
    store.logo_path = 'demo/kora-logo.webp';
    await route.fulfill({ json: feed });
  });
  await page.goto('/');
  const logo = page.getByTestId('mayami-store-logo');
  await expect(logo).toBeVisible();
  await logo.scrollIntoViewIfNeeded();
  await expect.poll(() => logo.evaluate((node) => {
    const image = node instanceof HTMLImageElement ? node : node.querySelector('img');
    return !!image && image.complete && image.naturalWidth > 0;
  })).toBe(true);
  await page.screenshot({ path: info.outputPath('tienda-mayami.png') });
});
