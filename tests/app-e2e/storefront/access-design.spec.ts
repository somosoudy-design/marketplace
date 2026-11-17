import { expect, test } from '@playwright/test';

for (const path of ['/cuenta', '/registro']) {
  test(`La contraseña se puede revisar sin enviarla ni perder el destino en ${path}`, async ({ page }) => {
    await page.goto(path + '?volver=%2Fcheckout');
    const password = page.getByLabel('Contraseña', { exact: true });
    await password.fill('SoloPrueba123');
    const originalURL = page.url();
    await page.getByRole('button', { name: 'Mostrar contraseña' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await expect(password).toHaveValue('SoloPrueba123');
    await page.getByRole('button', { name: 'Ocultar contraseña' }).click();
    await expect(password).toHaveAttribute('type', 'password');
    expect(page.url()).toBe(originalURL);
    const switchLink = page.locator('.access-switch a');
    await expect(switchLink).toHaveAttribute('href', (path === '/cuenta' ? '/registro' : '/cuenta') + '?volver=%2Fcheckout');
    if (path === '/cuenta') {
      await expect(page.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toHaveAttribute('href', '/recuperar?volver=%2Fcheckout');
      await expect(page.getByRole('link', { name: 'Explorar sin iniciar sesión' })).toHaveAttribute('href', '/carrito');
    } else {
      await expect(password).toHaveAccessibleDescription('Mínimo 8 caracteres con letras y números.');
    }
  });
}
