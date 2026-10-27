import { expect, test, type Page } from '@playwright/test';
import type { ProductDetail } from '@kora/api';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// All DTOs and Storage responses are intercepted LOCALLY. No remote reads, login or mutations.
const enabled = process.env.KORA_CATALOG_PRESENTATION_TEST === 'private-preview' && process.env.KORA_COMMERCIAL_GALLERY_TEST === 'local-fixture';
const repo = process.env.KORA_QA_REPO_ROOT ?? fileURLToPath(new URL('../../../', import.meta.url));
// Public identity/variant snapshot captured23Oct; embedded so this spec has no ignored-file dependency.
const snapshots = [
  {
    "id": "e7a91cd8-d3a2-4436-986c-71d1d95da813",
    "slug": "ugreen-nexode-65w",
    "title": "Samsung cargador USB-C 45 W · EP-T4510",
    "subtitle": "Negro",
    "brand_name": "Samsung",
    "category_name": "Cargadores",
    "category_slug": "cargadores",
    "description": "Cargador de pared Samsung EP-T4510 negro de45W. La fotografía principal incluye un cable USB-C; elige la presentación con cable o solo cargador.",
    "highlights": [
      "EP-T4510",
      "45 W",
      "USB-C"
    ],
    "option_names": [
      "Presentación"
    ],
    "image_path": "demo/ugreen-nexode-65w-1.webp",
    "images": [
      {
        "alt": "Samsung cargador USB-C 45 W · EP-T4510",
        "path": "demo/ugreen-nexode-65w-1.webp",
        "width": 800,
        "height": 1000
      },
      {
        "alt": "Samsung cargador USB-C 45 W · EP-T4510",
        "path": "demo/ugreen-nexode-65w-2.webp",
        "width": 800,
        "height": 1000
      },
      {
        "alt": "Samsung cargador USB-C 45 W · EP-T4510",
        "path": "demo/ugreen-nexode-65w-v1.webp",
        "width": 800,
        "height": 1000
      }
    ],
    "is_demo": true,
    "moderation_status": "published",
    "variants": [
      {
        "id": "930576a5-751f-4f67-904e-19f21b2e969b",
        "title": "Con cable · Negro",
        "options": {
          "Color": "Negro",
          "Presentación": "Con cable"
        },
        "sku": null,
        "active": true
      },
      {
        "id": "03c25cc2-2186-466f-a3a5-0f0201dfad81",
        "title": "Solo cargador · Negro",
        "options": {
          "Color": "Negro",
          "Presentación": "Solo cargador"
        },
        "sku": null,
        "active": true
      }
    ]
  },
  {
    "id": "0d93e509-6738-4d99-88ec-a5a1f5d08fdf",
    "slug": "audifonos-anc-over-ear",
    "title": "Audífonos inalámbricos con cancelación de ruido",
    "subtitle": "Over-ear, plegables",
    "brand_name": null,
    "category_name": "Audio",
    "category_slug": "audio",
    "description": "Audífonos over-ear genéricos de demostración. Por encargo internacional.",
    "highlights": [
      "Por encargo",
      "Plegables"
    ],
    "option_names": [
      "Color"
    ],
    "image_path": "demo/audifonos-anc-over-ear-1.webp",
    "images": [
      {
        "alt": "Audífonos inalámbricos con cancelación de ruido",
        "path": "demo/audifonos-anc-over-ear-1.webp",
        "width": 800,
        "height": 1000
      },
      {
        "alt": "Audífonos inalámbricos con cancelación de ruido",
        "path": "demo/audifonos-anc-over-ear-2.webp",
        "width": 800,
        "height": 1000
      },
      {
        "alt": "Audífonos inalámbricos con cancelación de ruido",
        "path": "demo/audifonos-anc-over-ear-v1.webp",
        "width": 800,
        "height": 1000
      }
    ],
    "is_demo": true,
    "moderation_status": "published",
    "variants": [
      {
        "id": "f4965176-bf53-4a7e-a9e1-07bf0608e856",
        "title": "Salvia",
        "options": {
          "Color": "Salvia"
        },
        "sku": null,
        "active": true
      },
      {
        "id": "f984e205-a702-4f95-b0e2-c2249127a4a0",
        "title": "Arena",
        "options": {
          "Color": "Arena"
        },
        "sku": null,
        "active": true
      }
    ]
  }
];
const studio = JSON.parse(readFileSync(resolve(repo, 'apps/mobile/assets/catalog-exhibition/studio-manifest.json'), 'utf8')).resources;
const headphones = '0d93e509-6738-4d99-88ec-a5a1f5d08fdf';
const samsung = 'e7a91cd8-d3a2-4436-986c-71d1d95da813';
const solo = '03c25cc2-2186-466f-a3a5-0f0201dfad81';
const freshPath = 'qa-local/own-product-photo.webp';
const kit = studio.find((r: { productId: string; variantId: string | null }) => r.productId === samsung && r.variantId !== solo);
const alone = studio.find((r: { variantId: string | null }) => r.variantId === solo);
const localPhoto = readFileSync(resolve(repo, 'apps/mobile/assets/catalog-exhibition/e7a91cd8-d3a2-4436-986c-71d1d95da813-c3b0a254f1c9.webp'));
function fixture(id: string): ProductDetail {
  const snapshot = snapshots.find((p: { id: string }) => p.id === id)!;
  // Controlled display values only; no assertion about current commercial prices.
  const price = id === samsung ? 42 : 89;
  return { store_id: '00000000-0000-4000-a000-000000000001', store_name: 'Tienda local', store_slug: 'local', store_kind: 'platform', store_status: 'active', category_id: '00000000-0000-4000-a000-000000000002', tone: 'mist', availability: 'available', origin: 'local', price_usd: price, compare_at_usd: null, stock_total: 20, lead_min_days: null, lead_max_days: null, popularity: 90, published_at: null, rating_avg: null, rating_count: 0, max_per_order: 5, weight_kg: null, store: { id: '00000000-0000-4000-a000-000000000001', name: 'Tienda local', slug: 'local', logo_path: null, accent: 'plum', kind: 'platform', shipping_info: null, rating_avg: null, rating_count: 0 }, is_favorite: false, alert_requested: false, related: [], ...snapshot, description: snapshot.description, variants: snapshot.variants.map((v) => ({ ...v, price_usd: price, stock: 20 })) } as ProductDetail;
}
async function localOnly(page: Page, products: ProductDetail[], failKit = false) {
  const unexpected: string[] = [];
  await page.route('**/*', async (route) => {
    const req = route.request(), url = new URL(req.url());
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) { unexpected.push(`${req.method()} ${url.origin}${url.pathname}`); return route.abort(); }
    if (failKit && url.pathname.includes(kit.optimizedSha256.slice(0, 12))) return route.abort('failed');
    if (url.pathname.includes('/storage/v1/object/public/catalog/')) return route.fulfill({ status: 200, contentType: 'image/webp', body: localPhoto });
    if (url.pathname.startsWith('/auth/v1/')) {
      if (req.method() !== 'GET') throw new Error(`Login/auth mutation forbidden: ${url.pathname}`);
      return route.fulfill({ status: 200, json: { user: null } });
    }
    if (!url.pathname.startsWith('/rest/v1/')) return route.continue();
    const rpc = url.pathname.split('/').at(-1)!;
    if (rpc === 'track_event') return route.fulfill({ status: 204, body: '' });
    const body = req.method() === 'POST' ? req.postDataJSON() : {};
    if (rpc === 'product_detail') return route.fulfill({ json: products.find((p) => p.id === body.p_id) ?? null });
    if (rpc === 'search_products') return route.fulfill({ json: products.filter((p) => !body.p_query || p.title.toLocaleLowerCase().includes(String(body.p_query).toLocaleLowerCase())) });
    if (rpc === 'home_feed') return route.fulfill({ json: { stores: [], categories: [], recommended: products, recently_viewed: [], personalized: false, collections: [{ id: '00000000-0000-4000-a000-000000000003', slug: 'seleccion', title: 'Selección', tone: 'mist', layout: 'feature', products: [products[0]] }] } });
    if (rpc === 'product_reviews') return route.fulfill({ json: { summary: { count: 0, avg: null, distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } }, items: [] } });
    if (rpc === 'rate_status') return route.fulfill({ json: { pair: 'USD/VES', available: false, reason: 'stale_or_missing', last: null } });
    if (rpc === 'pricing_today') return route.fulfill({ json: { available: false, reason: 'disabled' } });
    if (req.method() === 'GET') return route.fulfill({ json: [] });
    throw new Error(`Unplanned RPC or mutation blocked: ${url.pathname}`);
  });
  return unexpected;
}
async function commercial(page: Page) {
  await expect(page.locator('[data-testid="catalog-exhibition-notice"]:visible')).toHaveCount(0);
  await expect(page.getByTestId('product-demo')).toHaveCount(0);
  await expect(page.getByText('Demo', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Incluye imágenes generadas|Precios de ejemplo|Catálogo interno|Entorno de pruebas/i)).toHaveCount(0);
  await expect(page.locator('[data-testid="product-image-info-sheet"]:visible')).toHaveCount(0);
}
async function info(page: Page, keyboard = false) {
  const button = page.getByRole('button', { name: 'Información de la imagen', exact: true });
  if (keyboard) { await button.scrollIntoViewIfNeeded(); await button.focus(); await expect(button).toBeFocused(); await page.keyboard.press('Enter'); }
  else await button.click();
  const sheet = page.getByTestId('product-image-info-sheet');
  await expect(sheet).toBeVisible(); return sheet;
}
for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`commercial catalogue and own gallery ${colorScheme}`, () => {
    test.skip(!enabled, 'Explicit private-preview export plus LOCAL-only DTO fixtures required');
    test.use({ colorScheme, viewport: { width: 320, height: 892 }, reducedMotion: 'reduce' });
    test('Home, search, detail and guest cart stay commercial; image information opens and closes on demand', async ({ page }, testInfo) => {
      const product = fixture(headphones), unexpected = await localOnly(page, [product]);
      await page.goto('/'); await expect(page.getByTestId('home-hero')).toBeVisible(); await commercial(page);
      await page.getByRole('tab', { name: 'Buscar', exact: true }).click();
      await page.getByTestId('catalog-search').fill('Audífonos');
      const card = page.getByTestId('explore-list').getByTestId('product-card-audifonos-anc-over-ear');
      await expect(card).toBeVisible(); await expect(card).not.toHaveAccessibleName(/demostración/i); await commercial(page);
      await expect(card.getByTestId('card-title')).toHaveText(product.title);
      await expect(card.getByTestId('card-brand')).toHaveCount(0);
      await card.click(); await expect(page.getByTestId('product-title')).toHaveText(product.title); await commercial(page);
      await expect(page.getByTestId('product-description')).toContainText('Audífonos over-ear genéricos');
      await expect(page.getByTestId('product-description')).not.toContainText(/demostración/i);
      const sheet = await info(page, true); await expect(sheet.getByTestId('exhibition-generated-credit')).toHaveText('Imagen creada digitalmente.');
      await page.screenshot({ path: testInfo.outputPath('commercial-info-keyboard.png') });
      await page.getByTestId('product-image-info-sheet-close').focus(); await page.keyboard.press('Escape'); await expect(sheet).toBeHidden();
      await page.getByTestId('product-add').click(); await expect(page.getByTestId('added-to-cart')).toBeVisible(); await page.getByTestId('added-to-cart').click();
      await expect(page.getByTestId('cart-subtotal')).toContainText(Number(product.variants[0].price_usd).toFixed(2).replace('.', ',')); await commercial(page);
      await page.screenshot({ path: testInfo.outputPath('commercial-cart.png') }); expect(unexpected).toEqual([]);
    });
    test('a confirmed leading brand leaves more space for the model and preserves the full accessible name', async ({ page }) => {
      const product = fixture(samsung), unexpected = await localOnly(page, [product]);
      await page.goto('/explore');
      await page.getByTestId('catalog-search').fill('Samsung');
      const card = page.getByTestId(`product-card-${product.slug}`);
      await expect(card.getByTestId('card-title')).toHaveText('cargador USB-C 45 W · EP-T4510');
      await expect(card.getByTestId('card-brand')).toHaveText('Samsung');
      await expect(card).toHaveAccessibleName(/Samsung cargador USB-C 45 W · EP-T4510.*\$42,00.*Disponible/);
      await card.click();
      await expect(page.getByTestId('product-title')).toHaveText(product.title);
      await page.goBack();
      await expect(page.getByTestId('catalog-search')).toHaveValue('Samsung');
      await expect(card.getByTestId('card-brand')).toHaveText('Samsung');
      expect(unexpected).toEqual([]);
    });
    test('a fresh Storage path survives beside the mapped image; credits follow the active gallery page', async ({ page }, testInfo) => {
      const product = fixture(samsung); product.images = [product.images[0], product.images[1], { path: freshPath, alt: 'Fotografía propia de prueba local', width: 1600, height: 985 }];
      const unexpected = await localOnly(page, [product]); await page.goto(`/product/${samsung}`);
      const gallery = page.getByTestId('product-gallery'); await expect(gallery.locator('img')).toHaveCount(2);
      await expect(gallery.locator('img').first()).toHaveAttribute('src', new RegExp(kit.optimizedSha256.slice(0, 12)));
      await expect(gallery.locator('img').last()).toHaveAttribute('src', new RegExp(freshPath));
      let sheet = await info(page); await expect(sheet.getByRole('link', { name: `Fuente: ${kit.author}`, exact: true })).toBeVisible();
      await expect(sheet.getByRole('link', { name: kit.license, exact: true })).toBeVisible(); await expect(sheet.getByRole('link', { name: 'Detalle original', exact: true })).toBeVisible();
      await page.getByTestId('product-image-info-sheet-close').click();
      await page.getByTestId('product-scroll').evaluate((node) => node.scrollTo(0, 0));
      await gallery.scrollIntoViewIfNeeded(); await gallery.hover(); await page.mouse.wheel(330, 0);
      await expect(page.getByTestId('product-gallery-page')).toHaveAccessibleName('Foto 2 de 2');
      await expect(page.getByTestId('product-image-info')).toHaveCount(0); await expect(page.getByTestId('exhibition-photo-credit')).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath('own-storage-photo-active.png') });
      await gallery.scrollIntoViewIfNeeded(); await gallery.hover(); await page.mouse.wheel(-330, 0);
      await expect(page.getByTestId('product-gallery-page')).toHaveAccessibleName('Foto 1 de 2');
      sheet = await info(page); await expect(sheet.getByRole('link', { name: kit.license, exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('mapped-photo-sources-sheet.png') });
      await page.getByTestId('product-image-info-sheet-close').click(); expect(unexpected).toEqual([]);
    });
    test('an attributed override failure removes all credits; an unaffected variant recovers its own sources', async ({ page }, testInfo) => {
      const product = fixture(samsung), unexpected = await localOnly(page, [product], true);
      await page.goto(`/product/${samsung}`);
      const gallery = page.getByTestId('product-gallery');
      await expect(gallery.locator('img')).toHaveAttribute('src', /\/storage\/v1\/object\/public\/catalog\//);
      await expect.poll(() => gallery.locator('img').evaluateAll((imgs) => imgs.every((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))).toBe(true);
      await expect(gallery.getByTestId(`exhibition-photo-${samsung}`)).toHaveCount(0);
      await expect(page.getByTestId('product-image-info')).toHaveCount(0); await expect(page.getByTestId('exhibition-photo-credit')).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath('attributed-fallback-no-credit.png') });
      await page.getByTestId('product-selection-summary').click(); await page.getByTestId('variant-Solo cargador · Negro').click();
      await expect(gallery.locator('img')).toHaveAttribute('src', new RegExp(alone.optimizedSha256.slice(0, 12)));
      const sheet = await info(page); await expect(sheet.getByTestId('exhibition-generated-credit')).toHaveText('Imagen editada digitalmente a partir de una fotografía.');
      await expect(sheet.getByRole('link', { name: `Fuente: ${alone.author}`, exact: true })).toBeVisible(); await expect(sheet.getByRole('link', { name: alone.license, exact: true })).toBeVisible(); await expect(sheet.getByRole('link', { name: 'Detalle original', exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('variant-credit-recovery-sheet.png') });
      await page.getByTestId('product-image-info-sheet-close').click(); await expect(sheet).toBeHidden(); await commercial(page);
      await page.screenshot({ path: testInfo.outputPath('variant-credit-recovery.png') }); expect(unexpected).toEqual([]);
    });
  });
}
