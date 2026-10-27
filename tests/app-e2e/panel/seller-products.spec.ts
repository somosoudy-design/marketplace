import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import pg from 'pg';
import { asOn, databaseUrl, lumenProduct } from '../tests/support/db';
import { PNG, signIn } from './helpers';

const name = () => `Panel vendedor 26oct ${randomUUID()}`;
const variants = (page: Page) => page.getByRole('textbox', { name: /^Variante \d+$/ });
const saved = (page: Page) => page.getByRole('status').filter({ hasText: 'Guardado' });
async function query<T>(sql: string, args: unknown[] = []) {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try { return (await client.query(sql, args)).rows as T[]; }
  finally { await client.end(); }
}
async function rows(id: string) {
  const [row] = await query<{ variants: number; images: number }>(`select
    (select count(*)::int from public.product_variants where product_id=$1) variants,
    (select count(*)::int from public.product_images where product_id=$1) images`, [id]);
  return row!;
}
async function openSeller(page: Page) {
  await signIn(page, 'tiendas@example.com');
  await page.getByLabel('Tienda', { exact: true }).selectOption({ label: 'Casa Lumen' });
}
async function addPhoto(page: Page) {
  await page.locator('input[type=file]').setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: PNG });
}
async function createDraft(page: Page, title: string) {
  await page.goto('/vendedor/productos/nuevo');
  await page.getByLabel('Nombre', { exact: true }).fill(title);
  await page.getByRole('combobox', { name: 'Categoría', exact: true }).selectOption({ label: 'Hogar' });
  await page.getByLabel('Precio de la variante 1', { exact: true }).fill('20');
  await page.getByLabel('Inventario de la variante 1', { exact: true }).fill('5');
}
async function save(page: Page, label = 'Guardar cambios') {
  await saved(page).waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: label, exact: true }).click();
  await expect(saved(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar cambios', exact: true })).toBeEnabled();
}

// All writes target an isolated fixture on the local stack. The existing fixture helper removes only its UUID.
test('a second save updates the returned variant and image IDs without duplicating them', async ({ page }) => {
  const product = await lumenProduct(name());
  try {
    await openSeller(page);
    await page.goto(`/vendedor/productos/editar?id=${product.id}`);
    await page.getByRole('button', { name: 'Agregar variante', exact: true }).click();
    await page.getByLabel('Variante 2', { exact: true }).fill('Adicional');
    await addPhoto(page);
    await save(page);
    expect(await rows(product.id)).toEqual({ variants: 2, images: 1 });
    const ids = await query<{ id: string }>('select id from public.product_variants where product_id=$1 order by sort', [product.id]);
    await page.getByLabel('Nombre', { exact: true }).fill('Ficha ajustada');
    await save(page);
    expect(await rows(product.id)).toEqual({ variants: 2, images: 1 });
    expect(await query('select id from public.product_variants where product_id=$1 order by sort', [product.id])).toEqual(ids);
    await page.reload();
    await expect(variants(page)).toHaveCount(2);
    await expect(page.getByRole('img', { name: 'Foto 1', exact: true })).toBeVisible();
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Ficha ajustada');
    await page.setViewportSize({ width: 375, height: 900 });
    await expect(page.getByTestId('product-costs')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
    for (const control of [page.getByLabel('Nombre', { exact: true }), page.getByLabel('Inventario de la variante 2', { exact: true }), page.getByRole('button', { name: 'Guardar cambios', exact: true })]) {
      expect(await control.evaluate((el) => el.getBoundingClientRect().right)).toBeLessThanOrEqual(375);
    }
    // Target sizes must remain usable even if the browser's root font is smaller than 16px.
    await page.evaluate(() => { document.documentElement.style.fontSize = '12px'; });
    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [name, label] of [
        ['Variante 1', 'Variante'],
        ['Precio de la variante 1', 'Precio (USD)'],
        ['Inventario de la variante 1', 'Inventario'],
        ['SKU de la variante 1', 'SKU'],
      ] as const) {
        const input = page.getByLabel(name, { exact: true });
        await expect(input.locator('..').getByText(label, { exact: true })).toBeVisible();
        const rect = await input.boundingBox();
        expect(rect!.height).toBeGreaterThanOrEqual(44);
      }
      for (const control of [page.getByRole('button', { name: 'Agregar variante', exact: true }), page.getByRole('button', { name: 'Pausar', exact: true }).first(), page.locator('input[type=file]').locator('..')]) {
        const rect = await control.boundingBox();
        expect(rect!.width).toBeGreaterThanOrEqual(44);
        expect(rect!.height).toBeGreaterThanOrEqual(44);
      }
      const buttons = [
        page.getByRole('button', { name: 'Mover a la izquierda', exact: true }),
        page.getByRole('button', { name: 'Mover a la derecha', exact: true }),
        page.getByRole('button', { name: 'Quitar foto 1', exact: true }),
      ];
      const boxes = await Promise.all(buttons.map((button) => button.boundingBox()));
      for (const box of boxes) {
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!, b = boxes[j]!;
        const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlap).toBe(false);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    }
  } finally { await product.remove(); }
});

test('a failed image row keeps the created product, variant IDs and upload for retry', async ({ page }) => {
  const title = name();
  let rejectImage = true;
  let uploads = 0;
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/storage/v1/object/catalog/')) uploads++; });
  await page.route('**/rest/v1/product_images*', async (route) => {
    if (rejectImage && route.request().method() === 'POST') {
      rejectImage = false;
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: '22023', hint: 'invalid_input', message: 'Local fixture failure' }) });
    }
    return route.continue();
  });
  try {
    await openSeller(page);
    await createDraft(page, title);
    await addPhoto(page);
    await page.getByRole('button', { name: 'Crear producto', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Revisa los datos' })).toBeVisible();
    const [created] = await query<{ id: string }>('select id from public.products where title=$1', [title]);
    expect(created).toBeTruthy();
    expect(await rows(created!.id)).toEqual({ variants: 1, images: 0 });
    const original = await query('select id from public.product_variants where product_id=$1', [created!.id]);
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue(title);
    await save(page, 'Crear producto');
    await expect(page).toHaveURL(new RegExp(`id=${created!.id}`));
    expect(await query('select id from public.products where title=$1', [title])).toEqual([{ id: created!.id }]);
    expect(await query('select id from public.product_variants where product_id=$1', [created!.id])).toEqual(original);
    expect(await rows(created!.id)).toEqual({ variants: 1, images: 1 });
    expect(uploads).toBe(1);
    await page.reload();
    await expect(page.getByRole('img', { name: 'Foto 1', exact: true })).toBeVisible();
  } finally { await query('delete from public.products where title=$1', [title]); }
});

test('retrying a failed final read does not insert the completed variant or image again', async ({ page }) => {
  const product = await lumenProduct(name());
  let rejectRead = true;
  await page.route('**/rest/v1/products?*', async (route) => {
    const request = route.request();
    const select = new URL(request.url()).searchParams.get('select');
    if (rejectRead && request.method() === 'GET' && select === 'id,moderation_status') {
      rejectRead = false;
      return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: '42501', message: 'Local fixture failure' }) });
    }
    return route.continue();
  });
  try {
    await openSeller(page);
    await page.goto(`/vendedor/productos/editar?id=${product.id}`);
    await page.getByRole('button', { name: 'Agregar variante', exact: true }).click();
    await page.getByLabel('Variante 2', { exact: true }).fill('Conservada');
    await addPhoto(page);
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'No tienes permiso' })).toBeVisible();
    expect(await rows(product.id)).toEqual({ variants: 2, images: 1 });
    await save(page);
    expect(await rows(product.id)).toEqual({ variants: 2, images: 1 });
  } finally { await product.remove(); }
});

test('a new draft resets when changing stores and a late save cannot navigate the new store', async ({ page }) => {
  const title = name();
  let release!: () => void;
  let started!: () => void;
  const pending = new Promise<void>((resolve) => { started = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/rest/v1/products?*', async (route) => {
    if (route.request().method() === 'POST') { started(); await gate; }
    await route.continue();
  });
  try {
    await openSeller(page);
    await createDraft(page, title);
    await page.getByRole('button', { name: 'Crear producto', exact: true }).click();
    await pending;
    await expect(page.getByLabel('Nombre', { exact: true })).toBeDisabled();
    const selector = page.getByLabel('Tienda', { exact: true });
    await selector.selectOption({ label: 'Nova Gadgets' });
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('');
    await expect(page.getByRole('heading', { name: 'Nuevo producto', exact: true })).toBeVisible();
    const finished = page.waitForResponse((res) => res.request().method() === 'GET' && new URL(res.url()).searchParams.get('select') === 'id,moderation_status');
    release();
    await finished;
    await expect.poll(async () => (await query<{ store: string }>('select s.name store from public.products p join public.stores s on s.id=p.store_id where p.title=$1', [title]))[0]?.store).toBe('Casa Lumen');
    await expect(page).toHaveURL(/\/vendedor\/productos\/nuevo$/);
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('');
    await expect(saved(page)).toHaveCount(0);
    await selector.selectOption({ label: 'Casa Lumen' });
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('');
  } finally { release(); await query('delete from public.products where title=$1', [title]); }
});

test('a foreign product URL offers no editing controls and the database denies its update', async ({ page }) => {
  const title = name();
  const product = await lumenProduct(title);
  try {
    await signIn(page, 'vendedor@example.com');
    await page.goto(`/vendedor/productos/editar?id=${product.id}`);
    await expect(page.getByText('Este producto pertenece a otra de tus tiendas. Cámbiala en el selector para editarlo.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar cambios', exact: true })).toHaveCount(0);
    const client = new pg.Client({ connectionString: databaseUrl() });
    await client.connect();
    try {
      expect(await asOn(client)('00000000-0000-4000-a000-000000000002', "with denied as (update public.products set title='Ajeno' where id=$1 returning id) select count(*)::int count from denied", [product.id])).toEqual({ count: 0 });
    } finally { await client.end(); }
    expect(await query('select title from public.products where id=$1', [product.id])).toEqual([{ title }]);
  } finally { await product.remove(); }
});
