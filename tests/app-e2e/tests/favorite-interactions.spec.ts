import { test, expect } from '@playwright/test';
import { newBuyer, databaseUrl } from './support/db';
import pg from 'pg';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const dir = resolve(import.meta.dirname, '../../../.local/reference-interactions');
mkdirSync(dir, { recursive: true });
async function dbRead(sql: string, args: unknown[] = []) {
  const u = databaseUrl();
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(u).hostname)) throw new Error('Local exact host required');
  const db = new pg.Client({ connectionString: u });
  await db.connect();
  try {
    return (await db.query(sql, args)).rows;
  } finally {
    await db.end();
  }
}
async function signIn(page: any, b: any) {
  await page.goto('/sign-in');
  await page.getByTestId('sign-in-email').fill(b.email);
  await page.getByTestId('sign-in-password').fill(b.password);
  await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/sign-in/);
}
const nextFrames = (page: any) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
test.beforeEach(async ({ page }) => {
  await page.route('https://*.supabase.co/**', (r) => r.abort());
});

test('favorito pendiente bloquea doble toque y conserva resultado real', async ({ page }) => {
  const buyer = await newBuyer('ui-ref-review-guard');
  await signIn(page, buyer);
  await page.goto('/p/ugreen-cable-usb-c-100w');
  const fav = page.getByTestId('product-favorite');
  await expect(fav).toHaveAttribute('aria-label', 'Guardar en favoritos');
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  let seen!: () => void;
  const started = new Promise<void>((r) => (seen = r));
  const methods: string[] = [];
  await page.route('**/rest/v1/favorites**', async (r) => {
    const m = r.request().method();
    if (m === 'POST') {
      methods.push(m);
      seen();
      await held;
    } else if (m === 'DELETE') methods.push(m);
    await r.continue();
  });
  try {
    await fav.click();
    await started;
    await expect(fav).toHaveAttribute('aria-disabled', 'true');
    await fav.dispatchEvent('click');
    await fav.dispatchEvent('click');
    await nextFrames(page);
    expect(methods).toEqual(['POST']);
  } finally {
    release();
  }
  await expect(fav).toHaveAttribute('aria-label', 'Quitar de favoritos');
  await expect(fav).not.toHaveAttribute('aria-disabled', 'true');
  await expect(fav).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(async () => (await dbRead('select count(*)::int n from favorites where user_id=$1', [buyer.id]))[0].n)
    .toBe(1);
  const box = await fav.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: `${dir}/after-favorite-guard.png` });
  await fav.click();
  await expect(fav).toHaveAttribute('aria-pressed', 'false');
  await expect
    .poll(async () => (await dbRead('select count(*)::int n from favorites where user_id=$1', [buyer.id]))[0].n)
    .toBe(0);
});

test('fallo de favorito informa, revierte y permite reintento sin navegar', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  const buyer = await newBuyer('ui-ref-review-error');
  await signIn(page, buyer);
  await page.goto('/');
  const region = page.getByTestId('home-recommended');
  const fav = region.locator('[data-testid^="card-favorite-"]').first();
  await expect(fav).toBeVisible();
  const initialUrl = page.url();
  let calls = 0;
  await page.route('**/rest/v1/favorites**', async (r) => {
    if (r.request().method() === 'POST' && calls++ === 0) {
      await r.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'PGRST000', message: 'Fallo local simulado de escritura' }),
      });
      return;
    }
    await r.continue();
  });
  await fav.click();
  await expect(fav).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText(/No pudimos|No se pudo/i).first()).toBeVisible();
  expect(page.url()).toBe(initialUrl);
  await page.screenshot({ path: `${dir}/after-favorite-error-dark.png` });
  await page.getByTestId('favorite-error').getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByTestId('favorite-error')).not.toBeVisible();
  await expect(fav).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(async () => (await dbRead('select count(*)::int n from favorites where user_id=$1', [buyer.id]))[0].n)
    .toBe(1);
  expect(page.url()).toBe(initialUrl);
});

test('fallo tardío de A no revierte B guardado en paralelo', async ({ page }) => {
  const buyer = await newBuyer('ui-ref-review-parallel');
  await signIn(page, buyer);
  await page.goto('/');
  const region = page.getByTestId('home-recommended');
  const targets = region.locator('[data-testid^="card-favorite-"]');
  await expect(targets.first()).toBeVisible();
  const a = targets.nth(0),
    b = targets.nth(1);
  const slugA = (await a.getAttribute('data-testid'))!.replace('card-favorite-', '');
  const slugB = (await b.getAttribute('data-testid'))!.replace('card-favorite-', '');
  const products = await dbRead('select id,slug from products where slug=any($1)', [[slugA, slugB]]);
  const idA = products.find((x) => x.slug === slugA)!.id,
    idB = products.find((x) => x.slug === slugB)!.id;
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  let seen!: () => void;
  const started = new Promise<void>((r) => (seen = r));
  let holdRefresh = false;
  let releaseRefresh!: () => void;
  const refreshHeld = new Promise<void>((r) => (releaseRefresh = r));
  await page.route('**/rest/v1/favorites**', async (r) => {
    const m = r.request().method();
    if (m === 'POST' && r.request().postDataJSON().product_id === idA) {
      seen();
      await held;
      await r.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'PGRST000', message: 'Fallo local de A' }),
      });
      return;
    }
    if (m === 'GET' && holdRefresh) await refreshHeld;
    await r.continue();
  });
  try {
    await a.click();
    await started;
    await b.click();
    await expect
      .poll(
        async () =>
          (await dbRead('select count(*)::int n from favorites where user_id=$1 and product_id=$2', [buyer.id, idB]))[0]
            .n,
      )
      .toBe(1);
    await expect(b).toHaveAttribute('aria-pressed', 'true');
    holdRefresh = true;
    const failed = page.waitForResponse((r) => r.url().includes('/rest/v1/favorites') && r.status() === 503);
    release();
    await (await failed).finished();
    await expect(a).toHaveAttribute('aria-pressed', 'false');
    await nextFrames(page);
    await expect(b).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: `${dir}/after-favorite-parallel.png` });
  } finally {
    release();
    releaseRefresh();
  }
  const rows = await dbRead('select product_id from favorites where user_id=$1', [buyer.id]);
  expect(rows.map((r) => r.product_id)).toEqual([idB]);
});

test('respuesta tardía de una cuenta cerrada no introduce sus favoritos en la nueva sesión', async ({ page }) => {
  const a = await newBuyer('ui-ref-review-session-a'),
    b = await newBuyer('ui-ref-review-session-b');
  await dbRead(
    "insert into favorites(user_id,product_id) select $1,id from products where slug='ugreen-cable-usb-c-100w'",
    [a.id],
  );
  await signIn(page, a);
  await page.goto('/');
  const pending = page
    .getByTestId('home-recommended')
    .locator('[data-testid^="card-favorite-"][aria-pressed="false"]')
    .first();
  await expect(pending).toBeVisible();
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  let seen!: () => void;
  const started = new Promise<void>((r) => (seen = r));
  let holdRefresh = false;
  let releaseRefresh!: () => void;
  const refreshHeld = new Promise<void>((r) => (releaseRefresh = r));
  await page.route('**/rest/v1/favorites**', async (r) => {
    if (r.request().method() === 'POST' && r.request().postDataJSON().user_id === a.id) {
      seen();
      await held;
      await r.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'PGRST000', message: 'Fallo local tardío de cuenta A' }),
      });
      return;
    }
    if (r.request().method() === 'GET' && holdRefresh) await refreshHeld;
    await r.continue();
  });
  try {
    await pending.click();
    await started;
    await page.getByRole('tab', { name: 'Cuenta', exact: true }).click();
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    await page.getByTestId('account-sign-in').click();
    await page.getByTestId('sign-in-email').fill(b.email);
    await page.getByTestId('sign-in-password').fill(b.password);
    await page.getByTestId('sign-in-submit').click();
    await expect(page).not.toHaveURL(/sign-in/);
    await page.getByRole('tab', { name: 'Buscar', exact: true }).click();
    await page.getByTestId('catalog-search').fill('cable');
    const cable = page.getByTestId('card-favorite-ugreen-cable-usb-c-100w');
    await expect(cable).toBeVisible();
    await expect(cable).toHaveAttribute('aria-pressed', 'false');
    holdRefresh = true;
    const failed = page.waitForResponse((r) => r.url().includes('/rest/v1/favorites') && r.status() === 503);
    release();
    await (await failed).finished();
    await nextFrames(page);
    await expect(cable).toHaveAttribute('aria-pressed', 'false');
    await page.screenshot({ path: `${dir}/after-favorite-session.png` });
  } finally {
    release();
    releaseRefresh();
  }
  expect((await dbRead('select count(*)::int n from favorites where user_id=$1', [b.id]))[0].n).toBe(0);
});

test('reintento tras escritura y refresco fallidos ejecuta de nuevo la intención al recuperar red', async ({
  page,
}) => {
  const buyer = await newBuyer('ui-ref-review-offline-retry');
  await signIn(page, buyer);
  await page.goto('/p/ugreen-cable-usb-c-100w');
  const fav = page.getByTestId('product-favorite');
  await expect(fav).toHaveAttribute('aria-label', 'Guardar en favoritos');
  let posts = 0,
    denyReads = false;
  await page.route('**/rest/v1/favorites**', async (r) => {
    if (r.request().method() === 'POST') {
      posts++;
      if (posts === 1) {
        denyReads = true;
        await r.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'PGRST000', message: 'Escritura local no disponible' }),
        });
        return;
      }
    }
    if (r.request().method() === 'GET' && denyReads) {
      await r.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'PGRST000', message: 'Lectura local no disponible' }),
      });
      return;
    }
    await r.continue();
  });
  await fav.click();
  await expect(page.getByTestId('favorite-error')).toBeVisible();
  await expect(fav).toHaveAttribute('aria-label', 'Reintentar favoritos', { timeout: 20000 });
  denyReads = false;
  await page.getByTestId('favorite-error').getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect.poll(() => posts).toBe(2);
  await expect(page.getByTestId('favorite-error')).not.toBeVisible();
  await expect(fav).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(async () => (await dbRead('select count(*)::int n from favorites where user_id=$1', [buyer.id]))[0].n)
    .toBe(1);
});

test('quitar desde Favoritos conserva tarjeta mientras espera, muestra error y reintenta de verdad', async ({
  page,
}) => {
  const buyer = await newBuyer('ui-ref-review-remove');
  await dbRead(
    "insert into favorites(user_id,product_id) select $1,id from products where slug='ugreen-cable-usb-c-100w'",
    [buyer.id],
  );
  await signIn(page, buyer);
  await page.goto('/favorites');
  const favorite = page.getByTestId('card-favorite-ugreen-cable-usb-c-100w');
  await expect(favorite).toHaveAttribute('aria-pressed', 'true');
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
    await favorite.click();
    await started;
    await expect(page.getByTestId('product-surface-ugreen-cable-usb-c-100w')).toBeVisible();
    await expect(favorite).toHaveAttribute('aria-disabled', 'true');
  } finally {
    release();
  }
  await expect(page.getByTestId('favorite-error')).toBeVisible();
  await expect(favorite).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: `${dir}/after-favorites-remove-error.png` });
  await page.getByTestId('favorite-error').getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByTestId('favorite-error')).not.toBeVisible();
  await expect(page.getByText('Aún no tienes favoritos', { exact: true })).toBeVisible();
  await expect
    .poll(async () => (await dbRead('select count(*)::int n from favorites where user_id=$1', [buyer.id]))[0].n)
    .toBe(0);
});
