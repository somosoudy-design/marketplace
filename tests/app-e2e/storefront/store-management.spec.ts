import { test, expect } from '@playwright/test';

const panel = 'https://panel.mayami.app';

for (const account of ['comprador', 'tiendas', 'admin'] as const) {
  test(account + ' ve únicamente los accesos de sus tiendas y su rol', async ({ page, baseURL }) => {
    if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Solo fixtures locales');
    await page.goto('/cuenta');
    await page.getByLabel('Correo electrónico', { exact: true }).fill(account + '@example.com');
    await page.locator('input[type=password]').fill('Demo-1234');
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    const stores = page.locator('.account-stores');
    await expect(stores).toBeVisible();
    const global = stores.getByRole('link', { name: 'Administración de MAYAMI' });
    if (account === 'admin') await expect(global).toHaveAttribute('href', panel + '/admin');
    else await expect(global).toHaveCount(0);
    if (account === 'comprador') {
      await expect(stores).toContainText('Tu cuenta aún no tiene una tienda asignada');
      await expect(stores.getByRole('link', { name: 'Administrar tienda' })).toHaveCount(0);
    } else {
      await expect(stores.getByRole('link', { name: 'Ver tienda' }).first()).toBeVisible();
    }
    // Patitas is owned by the seller fixture. The global admin is not a member.
    await page.goto('/tienda/patitas');
    await expect(page.getByRole('heading', { name: 'Patitas & Co.', exact: true })).toBeVisible();
    const manage = page.getByRole('link', { name: 'Administrar tienda' });
    if (account === 'comprador') {
      await expect(manage).toHaveCount(0);
    } else {
      const prefix = account === 'admin' ? '/admin/tiendas/perfil?id=' : '/vendedor/tienda?id=';
      await expect(manage).toHaveAttribute('href', new RegExp('^https://panel\\.mayami\\.app' + prefix.replace('?', '\\?') + '[a-f0-9-]{36}$'));
    }
    await page.goto('/cuenta');
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeVisible();
    await page.goto('/tienda/patitas');
    await expect(page.getByRole('link', { name: 'Seguir tienda' })).toBeVisible();
    await expect(manage).toHaveCount(0);
  });
}
