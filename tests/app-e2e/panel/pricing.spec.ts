import { expect, test } from '@playwright/test';
import { lumenProduct, settingsSnapshot, withDayGap } from '../tests/support/db';
import { signIn } from './helpers';

// Price engine in the panel (docs/PRECIOS.md): the admin takes the day's gap; a store records what a product costs
// and its price follows the cost, the rule and the gap. Demo rates: BCV 100, P2P 101,50 -> gap 1,5 %.

test('the admin takes the day\'s gap and a store prices a product from its cost', async ({ page, browser, baseURL }) => {
  const restore = await settingsSnapshot(['pricing.import']);
  const expireGap = await withDayGap(); // also refreshes the demo rates the button below reads
  const product = await lumenProduct(`Lámpara de prueba ${Date.now()}`);
  try {
    // the admin sees the gap in force and takes it again from the rates in force
    await signIn(page, 'admin@example.com');
    await page.goto('/admin/tasas');
    await expect(page.getByTestId('gap-current')).toContainText('1,5 %');
    await page.getByTestId('gap-take').click();
    await expect(page.getByText(/Brecha del día 1,5 %/)).toBeVisible();
    // the rule: 30 % margin on the landed cost, 10 USD per kg, 2 USD logistics, endings ,99
    await page.goto('/admin/configuracion?tab=settings');
    await page.getByTestId('setting-per-kg').fill('10');
    await page.getByTestId('setting-fixed').fill('2');
    const reviewed = page.getByRole('switch', { name: 'Regla revisada y lista para usar' });
    if ((await reviewed.getAttribute('aria-checked')) !== 'true') await reviewed.click();
    await page.getByTestId('settings-save-pricing').click();
    await expect(page.getByText('Regla de precios: cambios guardados')).toBeVisible();

    // the store records the Amazon cost: 40 + 5 freight + 2 = 47; +30 % = 61,10; × 1,015 -> $62,99 BCV
    const store = await (await browser.newContext({ baseURL, viewport: { width: 1360, height: 900 }, locale: 'es-VE' })).newPage();
    await signIn(store, 'tiendas@example.com');
    await store.getByLabel('Tienda').selectOption({ label: 'Casa Lumen' }).catch(() => undefined);
    await store.goto(`/vendedor/productos/editar?id=${product.id}`);
    const costs = store.getByTestId('product-costs');
    await expect(store.getByText('Brecha del día 1,5 %')).toBeVisible(); // in the card header
    await store.getByTestId('costs-url').fill('https://www.amazon.com/dp/B0LAMPARA');
    await store.getByTestId('costs-variant-Única').fill('40');
    await expect(store.getByTestId('costs-price-Única')).toHaveText('$62,99');
    // Zelle / USDT pay the price through the gap once: 62,99 × 100 / 101,50
    await expect(costs).toContainText('$62,06');
    await store.getByTestId('costs-save').click();
    await expect(store.getByText('Costos guardados. Precio: $62,99 a tasa BCV.')).toBeVisible();
    await store.reload();
    await expect(store.getByLabel('Precio de la variante 1')).toHaveValue('62.99');

    // a product priced by hand keeps its price
    await store.getByTestId('costs-auto').getByRole('switch').click();
    await store.getByTestId('costs-variant-Única').fill('45');
    await store.getByTestId('costs-save').click();
    await expect(store.getByText('Costos guardados.', { exact: true })).toBeVisible();
    await store.reload();
    await expect(store.getByLabel('Precio de la variante 1')).toHaveValue('62.99');
  } finally {
    await product.remove();
    await expireGap();
    await restore();
  }
});
