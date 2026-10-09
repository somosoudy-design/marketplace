import { expect, type Page } from '@playwright/test';

/** Demo accounts from supabase/seed.sql (local development only). */
export async function signIn(page: Page, email: string, password = 'Demo-1234') {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.locator('input[name=email]').fill(email);
  await page.locator('input[name=password]').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

// 1x1 PNG, enough for the storage path and the image row.
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
