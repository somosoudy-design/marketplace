import { test, expect } from '@playwright/test';
import pg from 'pg';
import { databaseUrl } from '../tests/support/db';

test('enlace compartido de tienda abre su catálogo y conserva el filtro', async ({ page }) => {
  const db = new pg.Client({ connectionString: databaseUrl() });
  await db.connect();
  let slug: string;
  try {
    const { rows } = await db.query("select slug from public.stores where status = 'active' order by slug limit 1");
    expect(rows).toHaveLength(1);
    slug = rows[0].slug;
  } finally {
    await db.end();
  }
  await page.route('https://mimnotafmfasvwrclxan.supabase.co/**', route => route.abort('blockedbyclient'));
  await page.goto(`/tienda/${encodeURIComponent(slug)}`);
  await expect(page).toHaveURL(new RegExp(`/buscar\\?store=${encodeURIComponent(slug)}$`));
  await expect(page.getByRole('heading', { name: 'Productos de la tienda' })).toBeVisible();
  await expect(page.locator('input[name=store]')).toHaveValue(slug);
  await page.reload();
  await expect(page.locator('input[name=store]')).toHaveValue(slug);
});

test('enlace de tienda inexistente devuelve 404 y permite volver al catálogo', async ({ page }) => {
  const response = await page.goto('/tienda/no-existe-tienda-compartida-84573');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Esta página no está disponible' })).toBeVisible();
  await page.getByRole('link', { name: 'Explorar productos' }).click();
  await expect(page).toHaveURL(/\/buscar$/);
});
