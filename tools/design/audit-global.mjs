// Extra current-flow evidence for Product Design; LOCAL demo accounts only, no remote requests or checkout.
// Run after export:web while the local stack and serve.mjs (8089) are running.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../tests/app-e2e/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const out = process.argv[2];
if (!out) throw new Error('Provide an ignored evidence directory');
const scheme = process.argv[3] ?? 'light';
const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 320, height: 780 }, locale: 'es-VE', colorScheme: scheme });
const base = 'http://127.0.0.1:8089';
const evidence = [];
mkdirSync(out, { recursive: true });

async function open(path, ready) {
  await page.goto(base + path);
  await expect(ready()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
async function observe() { return page.locator('body').ariaSnapshot(); }
async function capture(name, notes = {}) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}.png` });
  evidence.push({ step: name, url: new URL(page.url()).pathname, notes, tree: await observe() });
}
async function size(locator) {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect(); const css = getComputedStyle(el);
    return { width: r.width, height: r.height, outline: css.outlineStyle, name: el.getAttribute('aria-label') };
  });
}

try {
  await open('/explore', () => page.getByTestId('chip-category-belleza'));
  await observe();
  await page.getByTestId('chip-category-belleza').click();
  await expect(page.getByTestId('chip-category-belleza')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('catalog-count')).toContainText('productos');
  await capture('21-search-category', { clearFilters: await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).count(), categoryTarget: await size(page.getByTestId('chip-category-belleza')) });
  await observe();
  await page.getByTestId('catalog-search').fill('zzzzproductoquenuncaexiste');
  await expect(page.getByText('No encontramos productos', { exact: true })).toBeVisible();
  await capture('22-search-empty');
  await observe();
  await page.getByTestId('catalog-search').fill('');
  await observe();
  await page.getByTestId('chip-sort').click();
  await expect(page.getByText('Ordenar por', { exact: true })).toBeVisible();
  await capture('23-search-sort');

  await open('/p/ugreen-cable-usb-c-100w', () => page.getByTestId('product-title'));
  await page.getByRole('button', { name: 'Aumentar cantidad', exact: true }).scrollIntoViewIfNeeded();
  await capture('24-product-quantity', { quantityTarget: await size(page.getByRole('button', { name: 'Aumentar cantidad', exact: true })) });

  await open('/sign-in', () => page.getByTestId('sign-in-submit'));
  await observe();
  await page.getByTestId('sign-in-submit').click();
  await expect(page.getByText('Escribe tu correo y tu contraseña.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mostrar contraseña', exact: true }).focus();
  await capture('25-sign-in-error', { passwordTarget: await size(page.getByRole('button', { name: 'Mostrar contraseña', exact: true })) });

  await observe();
  await page.getByTestId('sign-in-email').fill('vendedor@example.com');
  await observe();
  await page.getByTestId('sign-in-password').fill('Demo-1234');
  await observe();
  await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/sign-in/);
  await open('/account', () => page.getByTestId('account-my-store'));
  await capture('26-account-seller');
  await page.getByTestId('account-my-store').scrollIntoViewIfNeeded();
  await observe();
  await page.getByTestId('account-my-store').click();
  await expect(page.getByTestId('seller-store-name')).toBeVisible();
  await expect(page.getByTestId('seller-product-count')).toBeVisible();
  await capture('27-my-store');
  await page.getByTestId('seller-products-link').scrollIntoViewIfNeeded();
  await capture('28-my-store-navigation');

  await open('/settings', () => page.getByText('Apariencia', { exact: true }));
  const history = page.getByRole('button', { name: 'Borrar mi historial de navegación', exact: true });
  await history.scrollIntoViewIfNeeded();
  await capture('29-preferences-long-action', { actionTarget: await size(history) });
  writeFileSync(`${out}/evidence.json`, JSON.stringify(evidence, null, 2));
  console.log(`${evidence.length} extra screenshots: ${scheme}, 320px; local seller login only`);
} finally { await browser.close(); }
