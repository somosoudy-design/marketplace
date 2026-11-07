import { expect, test } from '@playwright/test';
import pg from 'pg';
import { databaseUrl, newBuyer } from './support/db';
import { testUnpaidOrder } from '../storefront/fixtures';
async function withDb<T>(run: (db: pg.Client) => Promise<T>) {
  const connectionString = databaseUrl();
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(connectionString).hostname)) throw new Error('Exact loopback required');
  const db = new pg.Client({ connectionString }); await db.connect();
  try { return await run(db); } finally { await db.end(); }
}
const unread = (id: string) => withDb(async db => (await db.query('select count(*)::int n from notifications where user_id=$1 and read_at is null', [id])).rows[0].n as number);
test.beforeEach(async ({ context }) => { await context.route('https://mimnotafmfasvwrclxan.supabase.co/**', r => r.abort('blockedbyclient')); });
test('avisos: contador completo, autolectura sólo visible y paginación sin perder noleídos', async ({ page }) => {
  const buyer = await newBuyer('mobile-notice-visible');
  const ids = await withDb(async db => (await db.query(`insert into notifications(user_id,kind,title,body,is_test,push_status,created_at)
    select $1,'system','Aviso '||n,'Información de tu compra',true,'skipped',now()-n*interval '1 minute'
    from generate_series(1,55) n returning id`, [buyer.id])).rows.map(r => r.id as string));
  await page.goto('/sign-in'); await page.getByTestId('sign-in-email').fill(buyer.email); await page.getByTestId('sign-in-password').fill(buyer.password); await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/sign-in/);
  await page.goto('/'); await expect(page.getByTestId('home-bell')).toHaveAttribute('aria-label', 'Notificaciones, 55 sin leer');
  const marked: string[][] = [];
  page.on('request', r => { if (r.url().includes('/rpc/mark_notifications_read')) marked.push(r.postDataJSON().p_ids); });
  await page.getByTestId('home-bell').click(); await expect(page.getByTestId('notifications-list')).toBeVisible();
  await expect.poll(() => unread(buyer.id)).toBeLessThan(55);
  const remaining = await unread(buyer.id);
  expect(remaining).toBeGreaterThan(5); // Not every loaded/off-screen row was acknowledged.
  expect(marked.length).toBeGreaterThan(0);
  expect(marked.every(batch => Array.isArray(batch) && batch.length > 0 && batch.length < 50 && batch.every(id => ids.includes(id)))).toBe(true);
  await page.getByTestId('notifications-mark-loaded').click();
  await expect.poll(() => unread(buyer.id)).toBe(5); // Explicit action is restricted to page1.
  await page.getByTestId('notifications-more').scrollIntoViewIfNeeded(); await page.getByTestId('notifications-more').click();
  await expect(page.getByTestId('notifications-more')).toHaveCount(0);
  // The last five are available; loading does not mark them unless shown/explicitly chosen.
  await page.getByTestId(`notification-${ids[54]}`).scrollIntoViewIfNeeded();
  await expect(page.getByTestId(`notification-${ids[54]}`)).toBeVisible();
});

test('administrador en modo comprador sólo recibe sus direcciones y conserva permisos reales', async ({ page }) => {
  const buyer = await newBuyer('mobile-admin-address');
  const foreign = await newBuyer('mobile-foreign-address');
  const fixture = await withDb(async db => {
    await db.query(`insert into user_roles(user_id,role) values ($1,'admin')`, [buyer.id]);
    const own = (await db.query(`update addresses set line1='Dirección propia de administrador' where user_id=$1 returning id`, [buyer.id])).rows[0].id;
    const other = (await db.query(`update addresses set line1='Dirección privada de otra cuenta' where user_id=$1 returning id`, [foreign.id])).rows[0].id;
    return { own, other };
  });
  await page.goto('/sign-in'); await page.getByTestId('sign-in-email').fill(buyer.email); await page.getByTestId('sign-in-password').fill(buyer.password); await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/sign-in/);
  await page.goto('/account');
  await expect(page.getByTestId('account-admin')).toBeVisible();
  let filtered: string | null = null;
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname === '/rest/v1/addresses') filtered = url.searchParams.get('user_id');
  });
  await page.getByText('Direcciones', { exact: true }).click();
  await expect(page.getByTestId(`addr-row-${fixture.own}`)).toBeVisible();
  await expect(page.getByTestId(`addr-row-${fixture.other}`)).toHaveCount(0);
  await expect(page.getByText('Dirección privada de otra cuenta', { exact: false })).toHaveCount(0);
  expect(filtered).toBe(`eq.${buyer.id}`);
});

test('inbox móvil no conserva avisos visibles ni cuenta al cerrar sesión y entrar como otra persona', async ({ page }) => {
  const a = await newBuyer('mobile-notice-account-a');
  const b = await newBuyer('mobile-notice-account-b');
  const notificationId = await withDb(async db => (await db.query(`insert into notifications(user_id,kind,title,body,is_test,push_status)
    values($1,'system','Mensaje exclusivo de cuenta A','Información privada de esta cuenta',true,'skipped') returning id`, [a.id])).rows[0].id);
  await page.goto('/sign-in'); await page.getByTestId('sign-in-email').fill(a.email); await page.getByTestId('sign-in-password').fill(a.password); await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/sign-in/);
  await page.goto('/'); await page.getByTestId('home-bell').click();
  await expect(page.getByTestId(`notification-${notificationId}`)).toBeVisible();
  await page.goBack(); await page.getByRole('tab', { name: 'Cuenta', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByTestId('account-sign-in')).toBeVisible();
  await page.goto('/notifications');
  await expect(page.getByText('Inicia sesión para ver tus avisos', { exact: true })).toBeVisible();
  await expect(page.getByTestId(`notification-${notificationId}`)).toHaveCount(0);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await page.getByTestId('sign-in-email').fill(b.email); await page.getByTestId('sign-in-password').fill(b.password); await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/sign-in/);
  await expect(page.getByText('Todo al día', { exact: true })).toBeVisible();
  await expect(page.getByTestId(`notification-${notificationId}`)).toHaveCount(0);
  await page.goto('/');
  await expect(page.getByTestId('home-bell')).toHaveAttribute('aria-label', 'Notificaciones');
});


test('administrador comprador abre su pedido y no el pedido ajeno desde un enlace', async ({ page }) => {
  const own = await testUnpaidOrder('mobile-admin-own-order');
  const foreign = await testUnpaidOrder('mobile-admin-foreign-order');
  await withDb(db => db.query("insert into user_roles(user_id,role) values ($1,'admin')", [own.userId]));
  await page.goto('/sign-in'); await page.getByTestId('sign-in-email').fill(own.email); await page.getByTestId('sign-in-password').fill(own.password); await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/sign-in/);
  let scoped: string | null = null;
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname === '/rest/v1/orders' && url.searchParams.get('id') === `eq.${foreign.orderId}`) scoped = url.searchParams.get('buyer_id');
  });
  await page.goto(`/orders/${foreign.orderId}`);
  await expect(page.getByText('No encontramos este pedido', { exact: true })).toBeVisible();
  await expect(page.getByTestId('order-number')).toHaveCount(0);
  expect(scoped).toBe(`eq.${own.userId}`);
  await page.goto(`/orders/${own.orderId}`);
  await expect(page.getByTestId('order-number')).toHaveText(`Pedido ${own.number}`);
  await expect(page.getByTestId('order-pay')).toBeVisible();
});
