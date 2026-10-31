import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark'] as const) {
  test(`Inicio integra apertura, categorías y productos sin perder sus destinos (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    for (const width of [320, 412]) {
      await page.setViewportSize({ width, height: 892 });
      await page.goto('/');
      const masthead = page.getByTestId('home-masthead');
      const hero = page.getByTestId('home-hero');
      const categories = page.getByTestId('home-category-bridge');
      const row = page.getByTestId('home-recommended');
      await expect(hero.getByRole('link')).toBeVisible();
      await expect(hero.getByTestId('home-editorial-name')).toBeVisible();
      await expect(hero.getByTestId('home-editorial-price')).toBeVisible();
      await expect(row.locator('[data-testid^="product-card-"]').first()).toBeVisible();
      const [headerBox, heroBox, categoryBox, rowBox] = await Promise.all([masthead.boundingBox(), hero.boundingBox(), categories.boundingBox(), row.boundingBox()]);
      expect(Math.abs(heroBox!.y - headerBox!.y - headerBox!.height)).toBeLessThan(1);
      expect(categoryBox!.y).toBeGreaterThanOrEqual(heroBox!.y + heroBox!.height);
      expect(rowBox!.y).toBeGreaterThanOrEqual(categoryBox!.y + categoryBox!.height);
      expect(rowBox!.y + rowBox!.height).toBeLessThan(815);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const category = page.getByTestId('category-tecnologia');
      await expect(category).toHaveAccessibleName('Tecnología');
      await expect(category.locator('svg')).toHaveCount(1);
      expect((await category.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByTestId('category-tecnologia').click();
    await expect(page).toHaveURL(/category=tecnologia/);
    await page.goBack();
    await page.getByTestId('home-search').click();
    await expect(page.getByTestId('catalog-search')).toBeFocused();
    await page.goBack();
    const opening = page.getByTestId('home-hero').getByRole('link');
    await opening.click();
    await expect(page).not.toHaveURL(/\/$/);
    await page.goBack();
    const favorite = page.getByTestId('home-recommended').locator('[data-testid^="card-favorite-"]').first();
    await favorite.click();
    await expect(page.getByTestId('sign-in-submit')).toBeVisible();
  });
}
