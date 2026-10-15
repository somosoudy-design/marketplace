import { expect, test, type Page } from '@playwright/test';
import { newBuyer } from './support/db';

// The profile photo on Account: picked from the gallery, previewed, saved or cancelled, removed back to the initials.
// Only image types go through, and the photo stays after reopening the app.

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

async function choose(page: Page, open: () => Promise<void>, file: { name: string; mimeType: string; buffer: Buffer }) {
  const chooser = page.waitForEvent('filechooser');
  await open();
  await (await chooser).setFiles(file);
}

test('a buyer adds a photo, sees a preview, keeps it after reopening and removes it', async ({ page }) => {
  const b = await newBuyer('ui-photo');
  await page.goto('/sign-in');
  await page.getByTestId('sign-in-email').fill(b.email);
  await page.getByTestId('sign-in-password').fill(b.password);
  await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/sign-in/);
  await page.goto('/account');
  const photo = page.getByTestId('account-photo');
  await expect(photo).toHaveAttribute('aria-label', 'Agregar foto de perfil');

  // cancelling the preview keeps the initials
  await choose(page, () => photo.click(), { name: 'yo.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByTestId('photo-sheet')).toContainText('Así se verá tu foto.');
  await page.getByTestId('photo-cancel').click();
  await expect(photo.getByTestId('avatar-photo')).toHaveCount(0);

  // another type is refused before anything is uploaded
  await choose(page, () => photo.click(), { name: 'animada.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
  await expect(page.getByTestId('photo-error')).toHaveText('Elige una foto en JPG, PNG o WebP.');
  await choose(page, () => page.getByTestId('photo-pick').click(), { name: 'yo.png', mimeType: 'image/png', buffer: PNG });
  await page.getByTestId('photo-save').click();
  await expect(page.getByTestId('photo-sheet')).toBeHidden();
  await expect(photo.getByTestId('avatar-photo')).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('account-photo').getByTestId('avatar-photo')).toBeVisible();
  await expect(page.getByTestId('account-photo')).toHaveAttribute('aria-label', 'Foto de perfil. Cambiarla o quitarla');

  await page.getByTestId('account-photo').click();
  await page.getByTestId('photo-remove').click();
  await expect(page.getByTestId('photo-sheet')).toBeHidden();
  await expect(page.getByTestId('account-photo').getByTestId('avatar-photo')).toHaveCount(0);
  await expect(page.getByTestId('account-photo')).toHaveAttribute('aria-label', 'Agregar foto de perfil');
});
