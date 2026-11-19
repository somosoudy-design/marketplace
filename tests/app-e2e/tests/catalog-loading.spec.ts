import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const dir = resolve(import.meta.dirname, '../../../.local/reference-interactions');
mkdirSync(dir, { recursive: true });
for (const width of [320, 412])
  test(`catálogo ${width}: carga mantiene geometría y respeta movimiento reducido`, async ({ page }) => {
    await page.setViewportSize({ width, height: 892 });
    await page.route('https://*.supabase.co/**', (r) => r.abort());
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route('**/rpc/search_products', async (r) => {
      await held;
      await r.continue();
    });
    await page.goto('/explore');
    const placeholder = page.getByTestId('catalog-card-loading').first();
    await expect(placeholder).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const before = await placeholder.boundingBox();
    const opacitySamples = await placeholder.evaluate(
      (node) =>
        new Promise<string[]>((resolve) => {
          const samples: string[] = [];
          const start = performance.now();
          const sample = () => {
            samples.push([...node.querySelectorAll('*')].map((n) => getComputedStyle(n).opacity).join(','));
            if (performance.now() - start < 180) requestAnimationFrame(sample);
            else resolve(samples);
          };
          sample();
        }),
    );
    expect(new Set(opacitySamples).size).toBe(1);
    await page.screenshot({ path: `${dir}/after-catalog-loading-${width}.png` });
    release();
    const product = page.locator('[data-testid^="product-surface-"]').first();
    await expect(product).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const after = await product.boundingBox();
    expect(Math.abs(before!.height - after!.height)).toBeLessThanOrEqual(2);
    expect(before!.y).toBe(after!.y);
    expect(before!.width).toBe(after!.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({ path: `${dir}/after-catalog-loaded-${width}.png` });
    writeFileSync(
      `${dir}/after-loading-geometry-${width}.json`,
      JSON.stringify(
        { width, placeholder: before, product: after, heightDifference: before!.height - after!.height },
        null,
        2,
      ),
    );
  });
