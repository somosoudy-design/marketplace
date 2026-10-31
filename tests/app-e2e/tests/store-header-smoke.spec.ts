import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Proposed location: tests/app-e2e/tests/store-header-smoke.spec.ts.
// Read-only visitor navigation against the local stack; no account/cart/order fixtures.
const privatePreview = process.env.KORA_CATALOG_PRESENTATION_TEST === 'private-preview';
const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);

async function guardLocalBackend(page: Page) {
  await page.route(/\/(?:rest|auth|storage|functions|realtime)\/v1(?:\/|\?)/, async (route) => {
    if (!localHosts.has(new URL(route.request().url()).hostname)) {
      await route.abort('blockedbyclient');
      throw new Error('Store smoke requires a local backend; remote reads and authentication are forbidden.');
    }
    return route.continue();
  });
}

const stores = [
  { slug: 'kora', name: 'Kora', description: 'La tienda de la plataforma: tecnología, belleza y accesorios seleccionados, en stock local o por encargo.' },
  { slug: 'patitas', name: 'Patitas & Co.', description: 'Tienda de accesorios para mascotas.' },
];

async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(350);
  const folder = process.env.UX_STORE_SMOKE_OUT;
  if (folder) mkdirSync(folder, { recursive: true });
  const path = folder ? join(folder, `${name}.png`) : info.outputPath(`${name}.png`);
  writeFileSync(path.replace(/\.png$/, '.txt'), await page.locator('body').ariaSnapshot());
  await page.screenshot({ path });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(412);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`tienda privada (${colorScheme})`, () => {
    test.use({ colorScheme, viewport: { width: 412, height: 892 }, deviceScaleFactor: 1 });
    test.skip(!privatePreview, 'Requires an explicit private-preview export.');
    test.beforeEach(async ({ page, baseURL }) => {
      if (!baseURL || !localHosts.has(new URL(baseURL).hostname)) throw new Error('Store smoke requires a local app URL.');
      await guardLocalBackend(page);
    });

    test('dos tiendas conservan descripción, pie privado y regreso sin errores JavaScript', async ({ page }, info) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      for (const store of stores) {
        await page.goto('/');
        const section = page.getByTestId('home-stores');
        const link = section.getByTestId(`store-${store.slug}`);
        await expect(link).toBeAttached();
        await link.scrollIntoViewIfNeeded();
        await page.locator('body').ariaSnapshot();
        await link.click();
        await expect(page).toHaveURL(new RegExp(`/store/${store.slug}$`));
        await expect(page.getByTestId('store-name')).toHaveText(store.name);
        await expect(page.getByTestId('store-catalog')).toBeVisible();
        const description = page.getByText(store.description, { exact: true });
        await expect(description).toBeVisible();
        await page.locator('body').ariaSnapshot();
        await page.getByRole('button', { name: 'Leer descripción completa', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Mostrar menos', exact: true })).toBeVisible();
        await expect(description).toHaveText(store.description);
        await expect(page.getByText('Tienda de demostración: sus datos y productos son de prueba.', { exact: true })).toHaveCount(0);
        await expect(page.getByTestId('catalog-exhibition-notice')).toHaveCount(0);
        await capture(page, info, `${store.slug}-${colorScheme}-01-description`);
        const products = page.getByRole('heading', { name: 'Productos', exact: true });
        await products.evaluate((n) => {
          const scroll = document.querySelector('[data-testid="store-catalog"]') as HTMLElement;
          scroll.scrollTop += n.getBoundingClientRect().top - 220;
        });
        await expect(products).toBeVisible();
        await expect(page.getByTestId('store-catalog').locator('[data-testid^="product-card-"]').first()).toBeVisible();
        await expect(page.getByText('Tienda de demostración: sus datos y productos son de prueba.', { exact: true })).toHaveCount(0);
        await capture(page, info, `${store.slug}-${colorScheme}-02-products`);
        expect(errors).toEqual([]);
        await page.locator('body').ariaSnapshot();
        await page.getByTestId('store-back').click();
        await expect(page).toHaveURL(/\/$/);
        await expect(page.getByRole('tab', { name: 'Inicio', exact: true })).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByTestId('home-stores')).toBeVisible();
        expect(errors).toEqual([]);
      }
    });
  });
}
