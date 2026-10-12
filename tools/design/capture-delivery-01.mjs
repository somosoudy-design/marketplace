// Entrega 01: same viewports, data and states before/after. Local demo backend only.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../tests/app-e2e/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const out = process.argv[2];
if (!out) throw new Error('Provide an evidence directory');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const evidence = [];
try {
  for (const width of [412, 320]) for (const colorScheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: width === 412 ? 892 : 780 }, locale: 'es-VE', colorScheme });
    for (const state of ['catalog', 'category', 'sort', 'empty', 'scroll']) {
      const page = await context.newPage();
      await page.goto('http://127.0.0.1:8089/explore');
      await expect(page.locator('[data-testid^="product-card-"]').first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.locator('body').ariaSnapshot();
      if (state === 'category') {
        await page.getByTestId('chip-category-belleza').click();
        await expect(page.getByTestId('chip-category-belleza')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByTestId('catalog-count')).toContainText('productos');
      } else if (state === 'sort') {
        await page.getByTestId('chip-sort').click();
        await expect(page.getByRole('dialog')).toBeVisible();
      } else if (state === 'empty') {
        await page.getByTestId('catalog-search').fill('zzzz-no-existe');
        await expect(page.getByText('No encontramos productos', { exact: true })).toBeVisible();
        await page.getByTestId('catalog-search').blur();
      } else if (state === 'scroll') {
        await page.getByTestId('explore-list').evaluate((el) => el.scrollTo({ top: 600 }));
      }
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(350); // font/image fade and native-equivalent sheet settling
      const metrics = await page.evaluate(() => {
        const bounds = (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }; };
        const cards = [...document.querySelectorAll('[data-testid^="product-surface-"]')].map(bounds);
        const bottom = document.querySelector('[data-testid="buyer-tabs"]')?.getBoundingClientRect().top ?? innerHeight - 80;
        return { firstCard: cards[0], catalogHeightBeforeProducts: cards[0]?.y, viewport: { width: innerWidth, height: innerHeight }, fullyVisible: cards.filter((r) => r.y >= 0 && r.bottom <= bottom).length, partiallyVisible: cards.filter((r) => r.y < bottom && r.bottom > 0).length, catalogViewportBottom: bottom };
      });
      const name = `${width}-${colorScheme}-${state}`;
      await page.screenshot({ path: `${out}/${name}.png` });
      evidence.push({ name, metrics, tree: await page.locator('body').ariaSnapshot() });
      await page.close();
    }
    await context.close();
  }
  writeFileSync(`${out}/evidence.json`, JSON.stringify(evidence, null, 2));
  console.log(`Saved ${evidence.length} current screenshots and geometry in ${out}`);
} finally { await browser.close(); }
