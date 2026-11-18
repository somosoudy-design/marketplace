import { expect, test } from '@playwright/test';

for (const width of [320, 390, 820, 1440]) {
  test(`búsqueda, navegación y pie se adaptan a ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/buscar?q=sincoincidenciamayami');
    const edit = page.getByLabel('Editar búsqueda');
    await expect(edit).toBeVisible();
    const header = page.locator('.app-shell > header');
    if (width <= 700) {
      const logo = await header.locator('.wordmark').boundingBox();
      const search = await header.getByRole('search').boundingBox();
      expect(Math.abs(logo!.y - search!.y)).toBeLessThan(2);
      const form = await edit.boundingBox();
      const bottomNavigation = await page.getByRole('navigation', { name: 'Navegación principal' }).boundingBox();
      expect(form!.y + form!.height).toBeLessThan(bottomNavigation!.y);
    }
    if (width <= 900) {
      const filters = await page.getByRole('button', { name: /Filtros/ }).first().boundingBox();
      const sort = await page.getByLabel('Ordenar por', { exact: true }).boundingBox();
      expect(Math.abs(filters!.y + filters!.height / 2 - sort!.y - sort!.height / 2)).toBeLessThan(1);
    }
    const footer = page.locator('.app-shell > footer');
    const legal = await footer.getByRole('heading', { name: 'Legal' }).boundingBox();
    const help = await footer.getByRole('heading', { name: 'Ayuda' }).boundingBox();
    expect(Math.abs(legal!.y - help!.y)).toBeLessThan(1);
    await footer.getByRole('link', { name: 'Contacto' }).click();
    await expect(page).toHaveURL(/\/contacto$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

for (const [width, height] of [[320, 700], [390, 844]]) {
  test(`ficha móvil a ${width} px muestra la galería antes del título y esconde la ruta`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/buscar');
    const productHref = await page.locator('.product-card .product-link').first().getAttribute('href');
    await page.goto(new URL(productHref!, page.url()).href);
    await page.evaluate(() => document.fonts.ready);

    const title = page.getByRole('heading', { level: 1 });
    await expect(title).toHaveCount(1);
    await expect(page.locator('.product-page .breadcrumbs')).toBeHidden();
    const photo = page.locator('.product-gallery > .product-photo');
    const frame = await photo.boundingBox();
    expect(Math.abs(frame!.width - frame!.height)).toBeLessThan(1);
    const layout = await title.evaluate((heading) => ({
      title: heading.getBoundingClientRect().toJSON(),
      galleryBottom: document.querySelector('.product-gallery')!.getBoundingClientRect().bottom,
      purchaseTop: document.querySelector('.purchase-action')!.getBoundingClientRect().top,
    }));
    expect(layout.galleryBottom).toBeLessThan(layout.title.top);
    expect(layout.title.bottom).toBeLessThan(layout.purchaseTop);
  });
}

test('registro y recuperación conservan la cabecera compacta a 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const route of ['/registro', '/recuperar']) {
    await page.goto(route);
    const header = page.locator('.app-shell > header');
    const bounds = await header.boundingBox();
    expect(bounds!.height).toBeLessThanOrEqual(70);
    await expect(header.getByRole('link', { name: /inicio/i })).toBeVisible();
    await expect(header.getByRole('link', { name: /carrito/i })).toBeVisible();
    await expect(page.getByLabel('Correo electrónico')).toBeVisible();
  }
});

test('los accesos privados identifican la cuenta y conservan el destino del comprador', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['/checkout', '/pedidos', '/direcciones']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1, name: /Inicia sesión/ })).toBeVisible();
    await expect(page.locator('main .state-icon .lucide-user-round')).toBeVisible();
    const href = await page.getByRole('link', { name: 'Iniciar sesión', exact: true }).getAttribute('href');
    expect(new URL(href!, page.url()).searchParams.get('volver')).toBe(route);
  }
});
