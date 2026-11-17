import { expect, test } from '@playwright/test';

test('el catálogo reúne filtros y resultados y conserva la familia seleccionada', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/buscar');
  const first = page.getByTestId('product-card').first();
  await expect(first).toBeVisible();
  const firstBox = await first.boundingBox();
  const sidebarBox = await page.locator('#catalog-filters').boundingBox();
  expect(Math.abs(firstBox!.y - sidebarBox!.y)).toBeLessThan(4);
  const family = page.locator('.category-family').filter({ has: page.getByRole('radio', { name: 'Tecnología', exact: true }) });
  await family.locator('summary').click();
  await family.getByRole('radio', { name: 'Cargadores', exact: true }).check();
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page).toHaveURL(/category=cargadores/);
  await expect(page.getByRole('radio', { name: 'Cargadores', exact: true })).toBeChecked();
  await expect(page.getByRole('link', { name: 'Quitar filtro Cargadores' })).toBeVisible();
});

test('la versión móvil permite filtrar y ordenar también sin JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.goto('/buscar');
    const select = page.getByLabel('Disponibilidad', { exact: true });
    await expect(select).toBeVisible();
    await select.selectOption('on_order');
    await page.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(page).toHaveURL(/availability=on_order/);
    await page.getByLabel('Ordenar por', { exact: true }).selectOption('price_desc');
    await page.getByRole('button', { name: 'Ordenar', exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('sort')).toBe('price_desc');
    expect(new URL(page.url()).searchParams.get('availability')).toBe('on_order');
  } finally { await context.close(); }
});
