// Scoped visual/accessibility verification: Search and the shared cards only; local demo data.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../tests/app-e2e/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const [out, axePath] = process.argv.slice(2);
if (!out || !axePath) throw new Error('Provide an evidence directory and axe.min.js');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const results = [];
try {
  for (const colorScheme of ['light', 'dark']) {
    for (const state of ['filters', 'active', 'variants', 'loading']) {
      const page = await browser.newPage({ viewport: { width: 320, height: 780 }, colorScheme, locale: 'es-VE', reducedMotion: 'reduce' });
      let release;
      if (state === 'loading') {
        const held = new Promise((resolve) => { release = resolve; });
        await page.route('**/rest/v1/rpc/search_products*', async (route) => { await held; await route.continue(); });
      }
      if (state === 'variants') await page.route('**/rest/v1/rpc/search_products*', async (route) => {
        const response = await route.fetch(); const [p] = await response.json();
        // Isolated response fixtures, labelled here and in the report; never saved or shipped.
        await route.fulfill({ json: [
          { ...p, slug: 'fixture-normal', title: 'Prueba · Producto normal', is_demo: false, availability: 'available', compare_at_usd: null, stock_total: 100 },
          { ...p, id: '00000000-0000-0000-0000-000000000021', slug: 'fixture-offer', title: 'Prueba · Producto en oferta', is_demo: false, availability: 'available', price_usd: 10, compare_at_usd: 20, stock_total: 2 },
          { ...p, id: '00000000-0000-0000-0000-000000000022', slug: 'fixture-empty', title: 'Prueba · Producto agotado', is_demo: false, availability: 'sold_out', stock_total: 0 },
          { ...p, id: '00000000-0000-0000-0000-000000000023', slug: 'fixture-order', title: 'Prueba · Producto por encargo', is_demo: false, availability: 'on_order' },
        ] });
      });
      await page.goto('http://127.0.0.1:8089/explore');
      if (state === 'loading') await expect(page.getByTestId('catalog-card-loading').first()).toBeVisible();
      else await expect(page.locator('[data-testid^="product-surface-"]').first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      if (state === 'filters' || state === 'active') {
        await page.locator('body').ariaSnapshot();
        await page.getByTestId('catalog-filter').click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.getByTestId('chip-availability-available').click();
        await page.getByRole('radio', { name: '15 a 50 USD', exact: true }).click();
        if (state === 'active') {
          await page.getByTestId('catalog-apply-filters').click();
          await expect(page.getByTestId('catalog-count')).toHaveAttribute('aria-busy', 'false');
          await page.waitForLoadState('networkidle');
        }
      }
      if (state !== 'loading') await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `${out}/320-${colorScheme}-${state}.png` });
      await page.addScriptTag({ path: axePath });
      const report = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } });
        return { violations: r.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })), incomplete: r.incomplete.map(({ id, nodes }) => ({ id, count: nodes.length })) };
      });
      results.push({ colorScheme, state, ...report });
      console.log(`${colorScheme}/${state}: ${report.violations.length} violations; ${report.incomplete.length} incomplete checks`);
      if (release) release();
      await page.close();
    }
    const wide = await browser.newPage({ viewport: { width: 768, height: 1000 }, colorScheme });
    await wide.goto('http://127.0.0.1:8089/explore');
    await expect(wide.locator('[data-testid^="product-surface-"]').first()).toBeVisible();
    await wide.waitForLoadState('networkidle');
    await wide.screenshot({ path: `${out}/768-${colorScheme}-catalog.png` });
    await wide.close();
  }
  writeFileSync(`${out}/accessibility.json`, JSON.stringify(results, null, 2));
  if (results.some((r) => r.violations.length)) process.exitCode = 1;
} finally { await browser.close(); }
