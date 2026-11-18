import { test, expect } from '@playwright/test';

test('la dirección oficial se comparte desde el perfil y mantiene sus pestañas', async ({ page }) => {
  const path = '/tienda/mayami';
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'MAYAMI', exact: true })).toBeVisible();
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://mayami.app' + path);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://mayami.app' + path);
  await page.getByRole('button', { name: 'Compartir tienda' }).click();
  await expect(page.getByLabel('Enlace de la tienda')).toHaveValue('https://mayami.app' + path);
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Sobre la tienda' }).click();
  await expect(page).toHaveURL(/\/tienda\/mayami\?vista=tienda$/);
  await page.getByRole('link', { name: 'Productos', exact: true }).click();
  await expect(page).toHaveURL(/\/tienda\/mayami$/);
  await expect(page.locator('.filter-form')).toHaveAttribute('action', path);
  await expect(page.locator('.search-sort')).toHaveAttribute('action', path);
});

test('los alias son permanentes y conservan los filtros, sin aceptar un cambio de tienda', async ({ request }) => {
  for (const alias of ['/tienda/kora', '/tienda/cora', '/buscar?store=kora']) {
    const sep = alias.includes('?') ? '&' : '?';
    const url = alias + sep + 'category=audio&sort=price_asc&vista=tienda';
    const res = await request.get(url, { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    const target = new URL(res.headers()['location']!, res.url());
    expect(target.pathname).toBe('/tienda/mayami');
    expect(Object.fromEntries(target.searchParams)).toEqual({ category: 'audio', sort: 'price_asc', vista: 'tienda' });
  }
  const res = await request.get('/tienda/mayami?store=patitas&category=audio', { maxRedirects: 0 });
  expect(res.status()).toBe(308);
  expect(new URL(res.headers()['location']!, res.url()).pathname).toBe('/tienda/mayami');
});

test('la tienda independiente mantiene su dirección y catálogo al filtrar', async ({ page }) => {
  const path = '/tienda/patitas';
  await page.goto(path);
  await expect(page.getByRole('heading', { name: 'Patitas & Co.', exact: true })).toBeVisible();
  await expect(page.locator('form.search-sort')).toHaveAttribute('action', path);
  await page.locator('select[name=sort]').selectOption('price_asc');
  await expect(page).toHaveURL(/\/tienda\/patitas\?.*sort=price_asc/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Patitas & Co.', exact: true })).toBeVisible();
});

test('enlace de tienda inexistente devuelve 404 y permite volver al catálogo', async ({ page }) => {
  const response = await page.goto('/tienda/no-existe-tienda-compartida-84573');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Esta página no está disponible' })).toBeVisible();
  await page.getByRole('link', { name: 'Explorar productos' }).click();
  await expect(page).toHaveURL(/\/buscar$/);
});
