import { expect, test } from '@playwright/test';
import { pushTrouble } from '../tests/support/db';
import { signIn } from './helpers';

// The dashboard tells the operator when phone notices stop working, and what to check, instead of failing silently.
test('the dashboard warns when push notices are stuck or the credentials are refused', async ({ page }) => {
  const cleanup = await pushTrouble('panel-push');
  try {
    await signIn(page, 'admin@example.com');
    await page.goto('/admin');
    const card = page.getByTestId('push-health');
    await expect(card).toBeVisible();
    await expect(card.getByText('Credenciales de avisos rechazadas')).toBeVisible();
    await expect(card.getByText(/avisos? sin enviar/)).toBeVisible();
    await expect(card.getByText('Revisa que la tarea programada push-dispatch')).toBeVisible();
  } finally {
    await cleanup();
  }
  await page.reload();
  await expect(page.getByTestId('push-health').getByText('Credenciales de avisos rechazadas')).toHaveCount(0);
});
