// Automated browser checks complement visual review; they do not certify native accessibility.
// Usage: node tools/design/accessibility.mjs /path/to/axe.min.js .local/evidence
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../tests/app-e2e/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const [axePath, out] = process.argv.slice(2);
if (!axePath || !out) throw new Error('Provide axe.min.js and a local evidence directory');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const results = [];
try {
  for (const colorScheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 320, height: 780 }, colorScheme, locale: 'es-VE' });
    for (const route of ['/', '/explore', '/p/ugreen-cable-usb-c-100w', '/cart', '/account', '/sign-in', 'options', 'empty']) {
      const target = route === 'options' || route === 'empty' ? '/explore' : route;
      await page.goto(`http://127.0.0.1:8089${target}`);
      await page.evaluate(() => document.fonts.ready);
      if (route === '/' || target === '/explore') await expect(page.locator('[data-testid^="product-surface-"]:visible').first()).toBeVisible();
      if (route === '/p/ugreen-cable-usb-c-100w') await expect(page.getByTestId('product-title')).toBeVisible();
      if (route === 'options') {
        await page.locator('body').ariaSnapshot();
        await page.getByTestId('chip-sort').click();
        await expect(page.getByRole('dialog')).toBeVisible();
      }
      if (route === 'empty') {
        await page.locator('body').ariaSnapshot();
        await page.getByTestId('catalog-search').fill('zzzz-no-existe');
        await expect(page.getByRole('button', { name: 'Restablecer búsqueda', exact: true })).toBeVisible();
      }
      await page.addScriptTag({ path: axePath });
      const report = await page.evaluate(async () => {
        const report = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } });
        return {
          violations: report.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })),
          incomplete: report.incomplete.map(({ id, nodes }) => ({ id, count: nodes.length })),
        };
      });
      results.push({ colorScheme, route, ...report });
      console.log(JSON.stringify({ colorScheme, route, violations: report.violations.length, incomplete: report.incomplete.length }));
    }
    await page.close();
  }
  writeFileSync(`${out}/accessibility.json`, JSON.stringify(results, null, 2));
  if (results.some((r) => r.violations.length)) process.exitCode = 1;
} finally { await browser.close(); }
