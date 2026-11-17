import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import pg from 'pg';
import { testCartProduct, hideCartProduct } from './fixtures';
import { databaseUrl, asOn, newBuyer } from '../tests/support/db';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Only disposable local fixtures; never run these writes against a hosted database.
const BASE = process.env.SOCIAL_BASE_URL ?? 'http://127.0.0.1:3200';
const OUT = process.env.SOCIAL_EVIDENCE ?? join(process.cwd(), '.local/storefront-social');
const ADMIN = '00000000-0000-4000-a000-000000000001';
const SELLER = '00000000-0000-4000-a000-000000000003';
let fixture: Awaited<ReturnType<typeof testCartProduct>>;
let other: Awaited<ReturnType<typeof newBuyer>>;
let orderItem: string;
let reviewId: string;
let questionId: string;
const question = '¿Se puede limpiar este producto con agua después de utilizarlo?';
const answer = 'Sí. Límpialo con agua y deja que se seque antes de volver a utilizarlo.';
const comment = 'La compra llegó en buenas condiciones y coincide con la descripción.';
const reports: object[] = [];
const href = () => `/p/${fixture.slug}?variant=${fixture.variantId}`;
async function sql(text: string, params: unknown[] = [], actor?: string) {
  const url = databaseUrl();
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) throw new Error('Exact loopback database required.');
  const db = new pg.Client({ connectionString: url }); await db.connect();
  try { return actor ? await asOn(db)(actor, text, params) : (await db.query(text, params)).rows; }
  finally { await db.end(); }
}
async function context(browser: Browser, width = 390, theme: 'light' | 'dark' = 'light') {
  const c = await browser.newContext({ baseURL: BASE, viewport: { width, height: 900 }, colorScheme: theme, locale: 'es-VE', reducedMotion: 'reduce' });
  // Do not let an accidental environment change send a test mutation or fixture session remotely.
  await c.route('**/*', route => { const u = new URL(route.request().url()); return ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol) ? route.continue() : route.abort('blockedbyclient'); });
  return c;
}
async function login(p: Page, account = fixture) {
  await p.goto('/cuenta');
  await p.getByLabel('Correo electrónico', { exact: true }).fill(account.email);
  await p.getByLabel('Contraseña', { exact: true }).fill(account.password);
  await p.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(p.getByRole('heading', { name: 'Mi cuenta', exact: true })).toBeVisible();
}
async function open(p: Page) {
  await p.goto(href());
  await expect(p.locator('#preguntas')).toBeVisible();
  await expect(p.getByTestId('product-reviews')).toBeVisible();
  await expect(p.locator('#preguntas').getByText('Cargando preguntas…', { exact: true })).toHaveCount(0);
  await expect(p.getByTestId('product-reviews').getByText('Cargando opiniones…', { exact: true })).toHaveCount(0);
}
async function editor(p: Page) {
  const reviews = p.getByTestId('product-reviews');
  await reviews.getByRole('button', { name: /^(Calificar mi compra|Editar mi opinión)$/ }).click();
  await expect(p.getByTestId('product-review-form')).toBeVisible();
  return p.getByTestId('product-review-form');
}
async function logoutAnotherTab(c: BrowserContext) {
  const p = await c.newPage(); await p.goto('/cuenta');
  await p.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(p.getByRole('button', { name: 'Ingresar', exact: true })).toBeVisible();
  await p.close();
}

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(BASE).hostname)) throw new Error('Local storefront required.');
  mkdirSync(OUT, { recursive: true });
  fixture = await testCartProduct('social-elegible', { sourceSlug: 'juguete-cuerda-perros', stock: 4 });
  other = await newBuyer('social-sin-compra');
  await sql('select public.cart_set_quantity($1,1)', [fixture.variantId], fixture.id);
  const placed = await sql(`select public.place_order((select id from public.addresses where user_id=auth.uid() and is_default), '{}'::jsonb, 'full', $1) as r`, ['social-local-' + fixture.productId], fixture.id) as { r: { order_id: string } };
  const quote = await sql("select public.create_payment_quote($1,'zelle') as q", [placed.r.order_id], fixture.id) as { q: { id: string } };
  const payment = await sql(`select public.submit_payment($1,$2,$3,'{"name":"Ana Prueba"}'::jsonb,$4) as p`, [quote.q.id,'SOCIAL-LOCAL-' + fixture.productId,fixture.id + '/social-comprobante.webp','social-pay-' + fixture.productId],fixture.id) as {p:{id:string}};
  await sql('select public.review_payment($1,true)',[payment.p.id],ADMIN);
  const rows=await sql('select id from public.fulfillments where order_id=$1',[placed.r.order_id]) as {id:string}[];
  for(const step of ['confirmed','preparing','dispatched','delivered'])await sql('select public.advance_fulfillment($1,$2,null,$3)',[rows[0].id,step,step==='dispatched'?'SOCIAL-LOCAL-TRACK':null],SELLER);
  const items=await sql('select id from public.order_items where order_id=$1 and product_id=$2',[placed.r.order_id,fixture.productId]) as {id:string}[];orderItem=items[0].id;
  writeFileSync(join(OUT,'fixture-public-identifiers.json'),JSON.stringify({source:'fixture local aislada',productId:fixture.productId,slug:fixture.slug,variantId:fixture.variantId,orderItem},null,2));
});
test.afterAll(async()=>{writeFileSync(join(OUT,'recorridos.json'),JSON.stringify(reports,null,2));if(fixture)await hideCartProduct(fixture.productId);});

test('guest sees honest empty states and login returns to the selected product section',async({browser})=>{
  const c=await context(browser),p=await c.newPage();await open(p);
  await expect(p.locator('#preguntas')).toContainText('Aún no hay preguntas respondidas');
  await expect(p.getByTestId('product-reviews-empty')).toBeVisible();
  for(const [section,action,param]of[['#preguntas','Hacer una pregunta','preguntas'],['#opiniones','Calificar mi compra','opiniones']]){
    const link=p.locator(section).getByRole('link',{name:action,exact:true});const target=new URL((await link.getAttribute('href'))!,BASE);const back=new URL(target.searchParams.get('volver')!,BASE);
    expect(back.pathname).toBe('/p/'+fixture.slug);expect(back.searchParams.get('variant')).toBe(fixture.variantId);expect(back.searchParams.get('section')).toBe(param);
  }
  await expect(p.locator('#question-editor')).toHaveCount(0);await expect(p.getByTestId('product-review-form')).toHaveCount(0);
  reports.push({case:'guest-empty',status:'PASS'});await c.close();
});

test('buyer without a delivered purchase cannot rate the product',async({browser})=>{
  const c=await context(browser),p=await c.newPage();await login(p,other as typeof fixture);await open(p);
  await expect(p.getByTestId('product-reviews')).toContainText('Podrás calificarlo cuando una compra de este producto figure como entregada');
  await expect(p.getByTestId('product-reviews').getByRole('button',{name:/Calificar|Editar/})).toHaveCount(0);
  reports.push({case:'review-ineligible',status:'PASS'});await c.close();
});

test('verified buyer rates with keyboard, retains failed input and retries once',async({browser})=>{
  const c=await context(browser,320),p=await c.newPage();await login(p);await open(p);const f=await editor(p);
  const first=f.getByRole('radio',{name:'1 estrella: Muy malo',exact:true});await first.focus();await p.keyboard.press('Space');for(let i=0;i<4;i++)await p.keyboard.press('ArrowRight');
  await expect(f.getByRole('radio',{name:'5 estrellas: Excelente',exact:true})).toBeChecked();
  const hitBoxes=await f.locator('.review-rating-input label').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{w:r.width,h:r.height}}));for(const box of hitBoxes){expect(box.w).toBeGreaterThanOrEqual(44);expect(box.h).toBeGreaterThanOrEqual(44)}
  expect(await p.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await f.getByRole('textbox',{name:/Tu comentario/}).fill(comment);
  let attempts=0;await p.route('**/rpc/submit_review',async r=>{attempts++;if(attempts===1)await r.abort('failed');else await r.continue()});
  await f.getByRole('button',{name:'Publicar opinión',exact:true}).click();await expect(f.getByRole('alert')).toBeVisible();await expect(f.getByRole('textbox',{name:/Tu comentario/})).toHaveValue(comment);await expect(f.getByRole('radio',{name:'5 estrellas: Excelente',exact:true})).toBeChecked();
  await p.screenshot({path:join(OUT,'review-error-320.png'),fullPage:true});
  await f.getByRole('button',{name:'Publicar opinión',exact:true}).evaluate((e:HTMLButtonElement)=>{e.click();e.click()});
  await expect(p.getByTestId('product-reviews').getByRole('status')).toContainText('Tu opinión está publicada');expect(attempts).toBe(2);
  const rows=await sql('select id,rating,body from public.reviews where order_item_id=$1',[orderItem]) as {id:string;rating:number;body:string}[];expect(rows).toHaveLength(1);expect(rows[0].rating).toBe(5);expect(rows[0].body).toBe(comment);reviewId=rows[0].id;
  await expect(p.getByTestId('product-review-'+reviewId)).toContainText('Compra verificada');reports.push({case:'review-error-keyboard-retry',status:'PASS',hitBoxes,attempts});await c.close();
});

test('editing a moderated opinion keeps the moderation state and guest visibility',async({browser})=>{
  await sql('select public.moderate_review($1,true,$2)',[reviewId,'Revisión local del estado oculto'],ADMIN);
  const c=await context(browser),p=await c.newPage();await login(p);await open(p);const f=await editor(p);
  await expect(f).toContainText('Tu opinión está oculta por moderación');await f.getByRole('textbox',{name:/Tu comentario/}).fill(comment+' Actualización de mi experiencia.');await f.getByRole('button',{name:'Guardar cambios',exact:true}).click();
  await expect(p.getByTestId('product-reviews').getByRole('status')).toContainText('sigue oculta');const rows=await sql('select status from public.reviews where id=$1',[reviewId])as{status:string}[];expect(rows[0].status).toBe('hidden');await c.close();
  const guest=await context(browser),g=await guest.newPage();await open(g);await expect(g.getByTestId('product-review-'+reviewId)).toHaveCount(0);await guest.close();
  await sql('select public.moderate_review($1,false,null)',[reviewId],ADMIN);reports.push({case:'review-hidden-edit',status:'PASS'});
});

test('question failure preserves text; own pending question stays private until store answers',async({browser})=>{
  const c=await context(browser),p=await c.newPage();await login(p);await open(p);await p.locator('#preguntas').getByRole('button',{name:'Hacer una pregunta',exact:true}).click();
  const f=p.locator('#question-editor');await expect(p.locator('#question-body')).toBeFocused();await p.locator('#question-body').fill('Corta');await expect(f.getByRole('button',{name:'Enviar pregunta',exact:true})).toBeDisabled();await p.locator('#question-body').fill(question);
  let attempts=0;await p.route('**/rpc/ask_question',async r=>{attempts++;if(attempts===1)await r.abort('failed');else await r.continue()});await f.getByRole('button',{name:'Enviar pregunta',exact:true}).click();await expect(f.getByRole('alert')).toBeVisible();await expect(p.locator('#question-body')).toHaveValue(question);await f.getByRole('button',{name:'Enviar pregunta',exact:true}).evaluate((e:HTMLButtonElement)=>{e.click();e.click()});await expect(p.locator('#preguntas').getByRole('status')).toContainText('Pregunta enviada');await expect(p.locator('.question-item').filter({hasText:question})).toContainText('Esperando respuesta de la tienda');
  const rows=await sql('select id from public.product_questions where product_id=$1 and user_id=$2',[fixture.productId,fixture.id])as{id:string}[];expect(rows).toHaveLength(1);questionId=rows[0].id;await c.close();
  const guest=await context(browser),g=await guest.newPage();await open(g);await expect(g.locator('#preguntas')).not.toContainText(question);await guest.close();
  const seller=await context(browser),s=await seller.newPage();await login(s,{email:'tiendas@example.com',password:'Demo-1234'}as typeof fixture);await open(s);const row=s.locator('.question-item').filter({hasText:question});await row.getByRole('button',{name:'Responder',exact:true}).click();await row.getByRole('textbox',{name:'Respuesta pública',exact:true}).fill(answer);await row.getByRole('button',{name:'Publicar respuesta',exact:true}).click();await expect(row.locator('.question-answer')).toContainText(answer);await seller.close();
  const publicC=await context(browser),pub=await publicC.newPage();await open(pub);await expect(pub.locator('#preguntas')).toContainText(question);await expect(pub.locator('#preguntas')).toContainText(answer);await publicC.close();expect(attempts).toBe(2);reports.push({case:'question-private-then-public',status:'PASS',attempts});
});

test('question refuses personal contact information and retains the rejected draft',async({browser})=>{
  const c=await context(browser),p=await c.newPage();await login(p,other as typeof fixture);await open(p);await p.locator('#preguntas').getByRole('button',{name:'Hacer una pregunta',exact:true}).click();const draft='Quiero información por correo en prueba@example.com sobre este producto';await p.locator('#question-body').fill(draft);await p.locator('#question-editor').getByRole('button',{name:'Enviar pregunta',exact:true}).click();await expect(p.locator('#question-editor').getByRole('alert')).toContainText(/correo|teléfono|enlace|personal/i);await expect(p.locator('#question-body')).toHaveValue(draft);const count=await sql('select count(*)::int as n from public.product_questions where product_id=$1 and user_id=$2',[fixture.productId,other.id])as{n:number}[];expect(count[0].n).toBe(0);reports.push({case:'question-personal-info-rejected',status:'PASS'});await c.close();
});

for(const kind of ['review','question']as const)test(`${kind} pending response cannot restore private controls after logout`,async({browser})=>{
  const c=await context(browser),p=await c.newPage();await login(p);await open(p);let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);let sent=0;await p.route('**/rpc/'+(kind==='review'?'submit_review':'ask_question'),async r=>{sent++;await gate;await r.continue()});
  if(kind==='review'){const f=await editor(p);await f.getByRole('textbox',{name:/Tu comentario/}).fill(comment+' Comprobación de sesión local.');await f.getByRole('button',{name:'Guardar cambios',exact:true}).click()}
  else{await p.locator('#preguntas').getByRole('button',{name:'Hacer una pregunta',exact:true}).click();await p.locator('#question-body').fill('¿El material de este producto conserva su forma al utilizarlo?');await p.locator('#question-editor').getByRole('button',{name:'Enviar pregunta',exact:true}).click()}
  await expect.poll(()=>sent).toBe(1);
  try{await logoutAnotherTab(c);await expect(p.getByTestId('product-review-form')).toHaveCount(0);await expect(p.locator('#question-editor')).toHaveCount(0);release();await expect(p.getByTestId('product-reviews').getByRole('link',{name:'Calificar mi compra',exact:true})).toBeVisible();await expect(p.locator('#preguntas').getByRole('link',{name:'Hacer una pregunta',exact:true})).toBeVisible();await expect(p.locator('.question-feedback')).toHaveCount(0);reports.push({case:kind+'-logout-pending',status:'PASS',sent});}finally{release();await c.close()}
});

test('public social sections and auxiliary controls stay aligned in both themes and sizes',async({browser})=>{
  for(const [width,theme]of [[390,'light'],[390,'dark'],[1440,'light'],[1440,'dark']]as const){const c=await context(browser,width,theme),p=await c.newPage();const errors:string[]=[];p.on('pageerror',e=>errors.push(e.message));await open(p);await expect(p.getByTestId('product-review-'+reviewId)).toBeVisible();await expect(p.locator('.question-answer')).toContainText(answer);const shapes=await p.locator('.product-auxiliary').evaluate(e=>[...e.querySelectorAll(':scope > button')].filter(e=>e.getBoundingClientRect().width>0).map(e=>{const r=e.getBoundingClientRect();return{w:r.width,h:r.height,cy:r.y+r.height/2}}));expect(shapes).toHaveLength(2);expect(shapes[0].w).toBe(44);expect(shapes[1].w).toBe(44);expect(shapes[0].h).toBe(44);expect(shapes[1].h).toBe(44);expect(shapes[0].cy).toBe(shapes[1].cy);expect(await p.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await p.locator('#preguntas').screenshot({path:join(OUT,`preguntas-${width}-${theme}.png`)});await p.getByTestId('product-reviews').screenshot({path:join(OUT,`opiniones-${width}-${theme}.png`)});expect(errors).toEqual([]);reports.push({case:'public-social-visual',width,theme,shapes,status:'PASS'});await c.close()}
});
