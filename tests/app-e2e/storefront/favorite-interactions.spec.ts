import { test, expect } from '@playwright/test';
import { newBuyer, databaseUrl } from '../tests/support/db';
import pg from 'pg';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const dir = resolve(import.meta.dirname, '../../../.local/reference-web-interactions');
mkdirSync(dir, { recursive: true });
async function dbRead(sql: string, args: unknown[] = []) {
  const url = databaseUrl();
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname))
    throw new Error('Local exact host required');
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  try {
    return (await db.query(sql, args)).rows;
  } finally {
    await db.end();
  }
}
async function signIn(page: any, b: any) {
  await page.goto('/cuenta');
  await page.getByLabel('Correo electrónico').fill(b.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(b.password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi cuenta' })).toBeVisible();
}
test.beforeEach(async ({ page }) => {
  await page.route('https://*.supabase.co/**', (r) => r.abort());
  await page.setViewportSize({ width: 320, height: 892 });
});

test('web: guard de favorito y retry tras escritura/lectura fallida conservan intención y accesibilidad', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  const buyer = await newBuyer('ui-ref-web-review-retry');
  await signIn(page, buyer);
  await page.goto('/p/ugreen-cable-usb-c-100w');
  const fav = page.locator('.detail-title .favorite');
  await expect(fav).toBeEnabled();
  let posts = 0,
    deletes = 0,
    denyReads = false;
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  let seen!: () => void;
  const started = new Promise<void>((r) => (seen = r));
  await page.route('**/rest/v1/favorites**', async (r) => {
    const m = r.request().method();
    if (m === 'POST') {
      posts++;
      if (posts === 1) {
        seen();
        await held;
        denyReads = true;
        await r.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'PGRST000', message: 'Escritura local no disponible' }),
        });
        return;
      }
    } else if (m === 'DELETE') deletes++;
    if (m === 'GET' && denyReads) {
      await r.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'PGRST000', message: 'Lectura local no disponible' }),
      });
      return;
    }
    await r.continue();
  });
  try {
    await fav.click();
    await started;
    await expect(fav).toBeDisabled();
    await fav.dispatchEvent('click');
    await fav.dispatchEvent('click');
    expect(posts).toBe(1);
    expect(deletes).toBe(0);
  } finally {
    release();
  }
  const dialog = page.getByRole('dialog', { name: 'No pudimos actualizar favoritos' });
  await expect(dialog).toBeVisible();
  await expect(fav).toHaveAttribute('aria-label', /^Reintentar cargar/, { timeout: 20000 });
  await expect(dialog.getByRole('alert')).toContainText('El cambio no se guardó');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  const close = dialog.getByRole('button', { name: 'Cerrar', exact: true });
  const closeBox = await close.boundingBox();
  expect(closeBox!.height).toBeGreaterThanOrEqual(44);
  expect(closeBox!.width).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: `${dir}/after-web-favorite-retry-dark.png` });
  denyReads = false;
  await dialog.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect.poll(() => posts).toBe(2);
  await expect(dialog).not.toBeVisible();
  await expect(fav).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('dialog [role="alert"]')).toHaveCount(0);
  await expect
    .poll(async () => (await dbRead('select count(*)::int n from favorites where user_id=$1', [buyer.id]))[0].n)
    .toBe(1);
});

test('web: quitar desde favoritos mantiene tarjeta y diálogo ante error antes de reintentar', async ({ page }) => {
  const buyer = await newBuyer('ui-ref-web-review-remove');
  await dbRead(
    "insert into favorites(user_id,product_id) select $1,id from products where slug='ugreen-cable-usb-c-100w'",
    [buyer.id],
  );
  await signIn(page, buyer);
  await page.goto('/favoritos');
  const card = page.getByTestId('product-card');
  await expect(card).toHaveCount(1);
  const fav = card.locator('.favorite');
  await expect(fav).toHaveAttribute('aria-pressed', 'true');
  let deletes = 0;
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  let seen!: () => void;
  const started = new Promise<void>((r) => (seen = r));
  await page.route('**/rest/v1/favorites**', async (r) => {
    if (r.request().method() === 'DELETE' && deletes++ === 0) {
      seen();
      await held;
      await r.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'PGRST000', message: 'Eliminación local no disponible' }),
      });
      return;
    }
    await r.continue();
  });
  try {
    await fav.click();
    await started;
    await expect(card).toBeVisible();
    await expect(fav).toBeDisabled();
  } finally {
    release();
  }
  const dialog = page.getByRole('dialog', { name: 'No pudimos actualizar favoritos' });
  await expect(dialog).toBeVisible();
  await expect(fav).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: `${dir}/after-web-favorite-remove-error.png` });
  await dialog.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tus favoritos empiezan aquí' })).toBeVisible();
  await expect(card).toHaveCount(0);
  await expect(dialog).not.toBeVisible();
  await expect
    .poll(async () => (await dbRead('select count(*)::int n from favorites where user_id=$1', [buyer.id]))[0].n)
    .toBe(0);
});
