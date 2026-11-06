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
