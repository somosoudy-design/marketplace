import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test.beforeEach(async ({page})=>{
  await page.route('**://mimnotafmfasvwrclxan.supabase.co/**',route=>route.abort());
  await signIn(page,'admin@example.com');
  await page.goto('/admin/tasas');
  await expect(page.getByLabel('Fuente principal')).toBeVisible();
});

test('cached currency tabs preserve the matching policy and submit the displayed currency only',async({page})=>{
  const primary=page.getByLabel('Fuente principal');
  const maxAge=page.getByLabel('Antigüedad máxima (min)');
  const rounding=page.getByLabel('Decimales',{exact:true});
  const original={primary:await primary.inputValue(),maxAge:await maxAge.inputValue(),rounding:await rounding.inputValue()};
  await page.getByRole('tab',{name:'USD/USDT',exact:true}).click();
  await expect(primary).toHaveValue('kraken_usdt');
  await page.getByRole('tab',{name:'USD/VES',exact:true}).click();
  await expect(primary).toHaveValue(original.primary);
  await expect(maxAge).toHaveValue(original.maxAge);
  await expect(rounding).toHaveValue(original.rounding);
  let payload: Record<string,unknown>|undefined;
  let pair='';
  await page.route('**/rest/v1/rate_policies?*',async route=>{
    if(route.request().method()!=='PATCH')return route.continue();
    payload=route.request().postDataJSON();
    pair=new URL(route.request().url()).searchParams.get('pair')??'';
    // Capture and reject; never alter a financial setting for a browser regression test.
    return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'22023',message:'Test: update blocked'})});
  });
  await page.getByRole('button',{name:'Guardar',exact:true}).click();
  await expect.poll(()=>payload).toBeDefined();
  expect(pair).toBe('eq.USD/VES');
  expect(payload).toMatchObject({primary_source:original.primary,max_age_minutes:Number(original.maxAge),rounding_decimals:Number(original.rounding)});
});

test('a discarded manual-rate draft is not transferred to a different currency',async({page})=>{
  await page.getByRole('button',{name:'Fijar tasa manual',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Tasa',{exact:true}).fill('987');
  await dialog.getByLabel('Motivo',{exact:true}).fill('Borrador local descartado');
  await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.getByRole('tab',{name:'USD/USDT',exact:true}).click();
  await expect(page.getByLabel('Fuente principal')).toHaveValue('kraken_usdt');
  await page.getByRole('button',{name:'Fijar tasa manual',exact:true}).click();
  await expect(dialog).toHaveAccessibleName('Tasa manual · USD/USDT');
  await expect(dialog.getByLabel('Tasa',{exact:true})).toHaveValue('');
  await expect(dialog.getByLabel('Motivo',{exact:true})).toHaveValue('');
  await expect(dialog.getByRole('button',{name:'Fijar tasa',exact:true})).toBeDisabled();
});
