import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { expect, test } from '@playwright/test';
import { databaseUrl } from '../tests/support/db';
import { signIn } from './helpers';

const proof = resolve(import.meta.dirname, '../../../.local/tiendas-operativas-20261106/captures');
mkdirSync(proof, { recursive: true });
async function fixture() {
  const db = new pg.Client({ connectionString: databaseUrl() }); await db.connect();
  try {
    const title = `Retirada local ${randomUUID().slice(0, 8)}`;
    const email = `delete-ui-${randomUUID()}@example.com`;
    const password = 'Local-delete-2026';
    await db.query('begin');
    const { rows: [user] } = await db.query(`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,reauthentication_token,phone_change,phone_change_token)
      values('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated',$1,extensions.crypt($2,extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Administrador local"}',now(),now(),'','','','','','','','') returning id`, [email, password]);
    await db.query(`insert into auth.identities(id,provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at) values(gen_random_uuid(),$1::text,$1::uuid,$2::jsonb,'email',now(),now(),now())`, [user.id, JSON.stringify({sub:user.id,email,email_verified:true})]);
    await db.query("insert into public.user_roles(user_id,role) values($1,'admin')", [user.id]);
    const { rows: [store] } = await db.query("insert into public.stores(name,slug,kind,status) values($1,$2,'platform','active') returning id", [title, `delete-${randomUUID().slice(0, 8)}`]);
    const { rows: [category] } = await db.query("select id from public.categories where slug='hogar'");
    const { rows: [p] } = await db.query("insert into public.products(store_id,category_id,title,origin,availability,weight_kg) values($1,$2,$3,'local','available',0.5) returning id", [store.id, category.id, title]);
    const { rows: [v] } = await db.query("insert into public.product_variants(product_id,title,price_usd,stock) values($1,'Única',25,5) returning id", [p.id]);
    await db.query("update public.products set moderation_status='suspended',moderation_note='Retirada' where id=$1", [p.id]);
    await db.query('commit');
    return { id: p.id as string, variant: v.id as string, title, email, password };
  } finally { await db.end(); }
}
async function exists(id: string) {
  const db = new pg.Client({ connectionString: databaseUrl() }); await db.connect();
  try { return (await db.query('select count(*)::int n from public.products where id=$1', [id])).rows[0].n === 1; }
  finally { await db.end(); }
}

for (const theme of ['light', 'dark'] as const) {
  test(`confirms one real deletion, blocks duplicates and preserves a retryable error in ${theme}`, async ({ page }) => {
    const p = await fixture();
    await page.emulateMedia({ colorScheme: theme });
    await page.setViewportSize({ width: theme === 'light' ? 320 : 390, height: 900 });
    await signIn(page, p.email, p.password);
    await page.goto('/admin/productos');
    await page.getByRole('tab', { name: /^Suspendido/ }).click();
    await page.getByRole('textbox', { name: 'Buscar productos', exact: true }).fill(p.title);
    await page.getByRole('button', { name: p.title, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: p.title, exact: true });
    await dialog.getByRole('button', { name: 'Eliminar producto', exact: true }).click();
    await expect(dialog.getByText('¿Eliminar este producto?', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Volver', exact: true }).click();
    expect(await exists(p.id)).toBe(true);
    await dialog.getByRole('button', { name: 'Eliminar producto', exact: true }).click();
    const endpoint = '**/rest/v1/rpc/admin_delete_suspended_product';
    let requests = 0;
    await page.route(endpoint, async route => {
      requests++;
      await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: '23503', hint: 'product_has_orders', message: 'order history', details: null }) });
    });
    await dialog.getByRole('button', { name: 'Eliminar definitivamente', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('pertenece a pedidos');
    expect(await exists(p.id)).toBe(true);
    await page.screenshot({ path: resolve(proof, `${theme}-protected.png`), fullPage: true });
    await page.unroute(endpoint);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route(endpoint, async route => { requests++; await gate; await route.continue(); });
    const action = dialog.getByRole('button', { name: 'Eliminar definitivamente', exact: true });
    try {
      await action.dblclick({ delay: 15, force: true });
      await expect(action).toBeDisabled();
      await expect(dialog.getByRole('button', { name: 'Volver', exact: true })).toBeDisabled();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();
      expect(requests).toBe(2); // one failed intent + exactly one real deletion
    } finally { release(); }
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'se eliminó del catálogo' })).toBeVisible();
    expect(await exists(p.id)).toBe(false);
    await page.reload();
    expect(await exists(p.id)).toBe(false);
    await page.screenshot({ path: resolve(proof, `${theme}-deleted.png`), fullPage: true });
  });
}
