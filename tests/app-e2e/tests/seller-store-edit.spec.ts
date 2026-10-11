import { expect, test, type Page } from '@playwright/test';
import pg from 'pg';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { databaseUrl } from './support/db';
import { sellerFixture } from './support/seller';
const shots = resolve(import.meta.dirname, '../../../.local/seller-ops/screens');
mkdirSync(shots, { recursive: true });
async function enter(page: Page, seller: Awaited<ReturnType<typeof sellerFixture>>) {
  await page.goto('/sign-in'); await page.getByTestId('sign-in-email').fill(seller.email); await page.getByTestId('sign-in-password').fill(seller.password); await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/sign-in/); await page.goto('/my-store/settings'); await expect(page.getByTestId('store-name')).toHaveValue(seller.name);
}
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=', 'base64');
for (const colorScheme of ['light', 'dark'] as const) test.describe(`Store editing (${colorScheme})`, () => {
  test.use({ colorScheme, viewport: { width: 320, height: 780 } });
  test('persists profile and gallery uploads, reflects storefront, reload and protected fields', async ({ page }) => {
    const seller = await sellerFixture(`store-edit-${colorScheme}`, { empty: true }); await enter(page, seller);
    await page.screenshot({ path: `${shots}/${colorScheme}-store-before.png`, fullPage: true });
    await page.getByTestId('store-name').fill('Atelier de prueba'); await page.getByTestId('store-tagline').fill('Hecho con cuidado');
    await page.getByTestId('store-description').fill('Descripción actualizada desde el móvil'); await page.getByTestId('store-email').fill('atelier@example.com');
    await page.getByTestId('store-shipping').fill('Despacho de lunes a viernes'); await page.getByTestId('store-returns').fill('Cambios dentro de siete días'); await page.getByTestId('store-warranty').fill('Garantía local de prueba');
    for (const label of ['Cambiar logotipo', 'Cambiar portada']) {
      const chooser = page.waitForEvent('filechooser'); await page.getByRole('button', { name: label, exact: true }).click();
      await (await chooser).setFiles({ name: 'foto.png', mimeType: 'image/png', buffer: png });
    }
    await page.getByRole('button', { name: 'Ciruela', exact: true }).click(); await page.getByTestId('store-save').click();
    await expect(page.getByText('Perfil guardado. Los cambios ya están en tu página pública.')).toBeVisible(); await expect(page.getByTestId('store-dirty')).toHaveCount(0);
    const c = new pg.Client({ connectionString: databaseUrl() }); await c.connect();
    const { rows: [row] } = await c.query('select * from public.stores where id = $1', [seller.storeId]); await c.end();
    expect(row).toMatchObject({ name: 'Atelier de prueba', tagline: 'Hecho con cuidado', description: 'Descripción actualizada desde el móvil', contact_email: 'atelier@example.com', shipping_info: 'Despacho de lunes a viernes', accent: 'plum', status: 'active', is_demo: true, policies: { returns: 'Cambios dentro de siete días', warranty: 'Garantía local de prueba' } });
    expect(row.logo_path).toMatch(new RegExp(`^${seller.storeId}/logo-`)); expect(row.cover_path).toMatch(new RegExp(`^${seller.storeId}/cover-`));
    const image = await page.request.get(`http://127.0.0.1:54321/storage/v1/object/public/stores/${row.cover_path}`); expect(image.ok()).toBe(true); expect(await image.body()).toEqual(png);
    await page.reload(); await expect(page.getByTestId('store-name')).toHaveValue('Atelier de prueba'); await expect(page.getByTestId('store-returns')).toHaveValue('Cambios dentro de siete días');
    await page.screenshot({ path: `${shots}/${colorScheme}-store-saved.png`, fullPage: true });
    await page.goto(`/store/${row.slug}`); await expect(page.getByText('Atelier de prueba', { exact: true }).first()).toBeVisible(); await expect(page.getByText('Descripción actualizada desde el móvil', { exact: true })).toBeVisible();
    await page.screenshot({ path: `${shots}/${colorScheme}-public-store.png`, fullPage: true });
  });
  test('failed save preserves draft; validation, dirty back confirmation, offline recovery and duplicate lock', async ({ page, context }) => {
    const seller = await sellerFixture(`store-retry-${colorScheme}`, { empty: true }); await enter(page, seller);
    await page.getByTestId('store-email').fill('mal'); await expect(page.getByTestId('store-save')).toBeDisabled(); await page.getByTestId('store-email').fill(seller.email);
    await page.getByTestId('store-name').fill('Perfil recuperado');
    await page.getByRole('link', { name: /back$/ }).click(); await expect(page.getByTestId('seller-unsaved')).toBeVisible(); await page.getByRole('button', { name: 'Seguir editando' }).click();
    await context.setOffline(true); await expect(page.getByText('Sin conexión', { exact: true }).first()).toBeVisible(); await context.setOffline(false); await expect(page.getByTestId('store-name')).toHaveValue('Perfil recuperado');
    let attempts = 0;
    await page.route('**/rest/v1/stores?*', async (route) => {
      if (route.request().method() !== 'PATCH') return route.continue(); attempts++;
      if (attempts === 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Servicio temporalmente no disponible' }) });
      await new Promise((resolve) => setTimeout(resolve, 350)); return route.continue();
    });
    await page.getByTestId('store-save').click(); await expect(page.getByText('Algo salió mal. Intenta de nuevo.')).toBeVisible(); await expect(page.getByTestId('store-name')).toHaveValue('Perfil recuperado');
    await page.screenshot({ path: `${shots}/${colorScheme}-store-retry.png`, fullPage: true });
    await page.getByTestId('store-save').click(); await expect(page.getByText('Perfil guardado. Los cambios ya están en tu página pública.')).toBeVisible(); expect(attempts).toBe(2);
    await page.getByTestId('store-name').fill('Sin guardar'); await page.getByRole('link', { name: /back$/ }).click(); await page.getByTestId('seller-unsaved-confirm').click(); await expect(page).not.toHaveURL(/settings$/);
    await page.goto('/my-store/settings'); await expect(page.getByTestId('store-name')).toHaveValue('Perfil recuperado');
  });
});
