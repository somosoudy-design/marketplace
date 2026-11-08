import { test, expect, type Page } from '@playwright/test';
import pg from 'pg';
import { databaseUrl, newBuyer } from '../tests/support/db';
import { testUnpaidOrder } from './fixtures';
const local = () => {
  const url = databaseUrl();
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) throw new Error('Exact loopback required');
  return url;
};
async function withDb<T>(run: (db: pg.Client) => Promise<T>) {
  const db = new pg.Client({ connectionString: local() });
  await db.connect();
  try {
    return await run(db);
  } finally {
    await db.end();
  }
}
async function login(page: Page, buyer: { email: string; password: string }) {
  await page.goto('/cuenta');
  await page.getByLabel('Correo electrónico').fill(buyer.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(buyer.password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi cuenta' })).toBeVisible();
}
async function notices(label: string, count: number) {
  const buyer = await newBuyer(label);
  await withDb((db) =>
    db.query(
      `insert into notifications(user_id,kind,title,body,is_test,push_status,created_at)
    select $1,'system','Aviso '||n,'Información de tu compra',true,'skipped',now()-n*interval '1 minute'
    from generate_series(1,$2) n`,
      [buyer.id, count],
    ),
  );
  return buyer;
}
async function unread(id: string) {
  return withDb(
    async (db) =>
      (await db.query('select count(*)::int n from notifications where user_id=$1 and read_at is null', [id])).rows[0]
        .n,
  );
}
test.beforeEach(async ({ context }) => {
  await context.route('https://mimnotafmfasvwrclxan.supabase.co/**', (r) => r.abort('blockedbyclient'));
});
for (const [width, colorScheme] of [
  [320, 'dark'],
  [1440, 'light'],
] as const) {
  test(`notificaciones: contador exacto, paginación y lectura cargada ${width} ${colorScheme}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 960 });
    await page.emulateMedia({ colorScheme });
    const owner = await notices('web-inbox', 55);
    const foreign = await notices('web-inbox-other', 1);
    await withDb((db) =>
      db.query(`update notifications set title='Privado de otra cuenta' where user_id=$1`, [foreign.id]),
    );
    await login(page, owner);
    await page.getByRole('link', { name: 'Notificaciones, 55 sin leer', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Notificaciones' })).toBeVisible();
    await expect(page.locator('[data-testid^="notification-"]')).toHaveCount(50);
    await expect(page.getByText('Privado de otra cuenta')).toHaveCount(0);
    expect(await unread(owner.id)).toBe(55); // Opening never silently acknowledges unloaded notices.
    await page.screenshot({ path: info.outputPath('notificaciones.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Marcar las notificaciones cargadas como leídas' }).click();
    await expect(page.getByRole('link', { name: 'Notificaciones, 5 sin leer', exact: true })).toBeVisible();
    expect(await unread(owner.id)).toBe(5);
    await page.getByRole('button', { name: 'Ver más notificaciones' }).click();
    await expect(page.locator('[data-testid^="notification-"]')).toHaveCount(55);
    await expect(page.getByRole('button', { name: 'Ver más notificaciones' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Marcar las notificaciones cargadas como leídas' }).click();
    await expect(page.getByRole('link', { name: 'Notificaciones', exact: true })).toBeVisible();
    expect(await unread(owner.id)).toBe(0);
    expect(await unread(foreign.id)).toBe(1);
  });
}
test('notificaciones: lectura fallida se puede reintentar y cambiar cuenta aísla historial', async ({ page }) => {
  const owner = await notices('web-notice-retry', 2);
  const other = await newBuyer('web-notice-empty');
  await login(page, owner);
  await page.goto('/notificaciones');
  await expect(page.locator('[data-testid^="notification-"]')).toHaveCount(2);
  await page.route('**/rpc/mark_notifications_read', (r) => r.abort('failed'));
  await page.getByRole('button', { name: 'Marcar las notificaciones cargadas como leídas' }).click();
  await expect(page.locator('main').getByRole('alert')).toBeVisible();
  expect(await unread(owner.id)).toBe(2);
  await page.unroute('**/rpc/mark_notifications_read');
  await page.getByRole('button', { name: 'Volver a intentar' }).click();
  await expect(page.getByRole('link', { name: 'Notificaciones', exact: true })).toBeVisible();
  expect(await unread(owner.id)).toBe(0);
  await page.goto('/cuenta');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeVisible();
  await login(page, other);
  await page.goto('/notificaciones');
  await expect(page.getByRole('heading', { name: 'Todo al día' })).toBeVisible();
  await expect(page.getByText('Aviso 1', { exact: true })).toHaveCount(0);
});
test('notificaciones: abrir pedido propio marca solo ese aviso y no expone otro comprador', async ({ page }) => {
  const order = await testUnpaidOrder('web-notification-order');
  await login(page, order);
  await page.goto('/notificaciones');
  await expect(page.getByRole('heading', { name: new RegExp(`Pedido ${order.number}`) })).toBeVisible();
  await page.getByRole('button', { name: 'Ver pedido', exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`/pedidos/${order.orderId}`));
  await expect(page.getByRole('heading', { name: `Pedido ${order.number}`, exact: true })).toBeVisible();
  expect(await unread(order.userId)).toBe(0);
});
test('notificaciones: sesión cerrada requiere cuenta, sin historia o contador', async ({ page }) => {
  await page.goto('/notificaciones');
  await expect(page.getByRole('heading', { name: 'Inicia sesión para continuar' })).toBeVisible();
  await expect(page.locator('[data-testid^="notification-"]')).toHaveCount(0);
  await expect(page.locator('.notification-link')).toHaveCount(0);
});
