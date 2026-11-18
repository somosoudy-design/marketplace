const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
const req = createRequire(root + '/apps/storefront/package.json');
const ts = req('typescript');
const React = req('react');
const { renderToStaticMarkup } = req('react-dom/server');
const categories = ['Tecnología', 'Audio', 'Belleza', 'Odontología', 'Hogar', 'Mascotas', 'Accesorios'].map(
  (name, i) => ({
    id: `category-${i}`,
    name,
    slug: ['tecnologia', 'audio', 'belleza', 'odontologia', 'hogar', 'mascotas', 'accesorios'][i],
    image_path: null,
  }),
);
let homeCategories = categories;
let products = [];
const ports = {
  'react/jsx-runtime': req('react/jsx-runtime'),
  'next/link': { default: ({ children, prefetch, ...props }) => React.createElement('a', props, children) },
  'lucide-react': req('lucide-react'),
  '@/lib/product-link': require('../../apps/storefront/src/lib/product-link.ts'),
  '@/lib/server': {
    publicApi: () => ({ catalog: { home: async () => ({ categories: homeCategories, stores: [] }), cardsByIds: async () => [] } }),
  },
  '@/components/store-avatar': { StoreAvatar: () => null },
  '@/components/home-campaigns': { HomeCampaigns: () => null },
  '@/components/photo': {
    ProductPhoto: ({ id, path, alphaMask }) =>
      React.createElement('span', {
        className: 'product-photo',
        'data-photo-id': id,
        'data-photo-path': path,
        'data-mask': alphaMask,
      }),
  },
  '@/components/states': { Failure: () => React.createElement('p', null, 'Error') },
  '@/lib/discovery-server': { readDiscovery: async () => ({ products }) },
  '@/components/discovery-feed': { DiscoveryFeed: () => null },
  '@/lib/category-navigation-art': { categoryNavigationMask: (slug, path) => `${slug}:${path}` },
};
const m = { exports: {} };
new vm.Script(
  ts.transpileModule(fs.readFileSync(root + '/apps/storefront/src/app/page.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText,
).runInNewContext({
  exports: m.exports,
  crypto: { randomUUID: () => 'local-categories' },
  encodeURIComponent,
  require: (n) => {
    if (n in ports) return ports[n];
    throw Error('Unexpected import ' + n);
  },
});
async function render() {
  return renderToStaticMarkup(await m.exports.default());
}
test('every category appears once in the same navigation, including categories beyond the first four', async () => {
  const html = await render();
  assert.equal((html.match(/<nav /g) || []).length, 1);
  assert.equal((html.match(/class="market-category-tile"/g) || []).length, 7);
  for (const { name, slug } of categories) {
    assert.equal((html.match(new RegExp(`href="/buscar\\?category=${slug}"`, 'g')) || []).length, 1);
    assert.ok(html.includes(`<h2>${name}</h2>`));
  }
  assert.match(html, /lucide-paw-print/);
  assert.match(html, /lucide-headphones/);
  assert.doesNotMatch(html, /Más categorías|market-category-nav|Ver productos/);
});
test('category destinations are encoded without changing slugs or category names', async () => {
  homeCategories = [{ id: 'special', slug: 'audio & video', name: 'Audio & vídeo', image_path: null }];
  const html = await render();
  assert.match(html, /href="\/buscar\?category=audio%20%26%20video"/);
  assert.match(html, /<h2>Audio &amp; vídeo<\/h2>/);
  homeCategories = categories;
});
test('existing product and category images are preserved, with safe icon fallback for missing/demo-only images', async () => {
  homeCategories = categories.map((c) => ({ ...c }));
  homeCategories[1].image_path = 'seller/audio.jpg';
  homeCategories[2].image_path = 'demo/not-public.jpg';
  products = [{ id: 'product-tech', category_id: categories[0].id, image_path: 'seller/tech.jpg', is_demo: false }];
  const html = await render();
  assert.match(
    html,
    /data-photo-id="product-tech" data-photo-path="seller\/tech.jpg" data-mask="tecnologia:seller\/tech.jpg"/,
  );
  assert.match(html, /data-photo-id="category-1" data-photo-path="seller\/audio.jpg"/);
  assert.doesNotMatch(html, /demo\/not-public/);
  assert.equal((html.match(/market-category-icon/g) || []).length, 5);
  assert.equal((html.match(/class="market-category-art" aria-hidden="true"/g) || []).length, 7);
  homeCategories = categories;
  products = [];
});

test('keeps the existing product photo, category fallback, exact source and navigation matte', async () => {
  homeCategories = categories.map((c, index) => ({
    ...c,
    image_path: index === 0 ? 'category/old.jpg' : index === 1 ? 'category/audio.png' : 'demo/placeholder.png',
  }));
  products = [
    { id: 'product-technology', category_id: categories[0].id, image_path: 'product/original.png', is_demo: false },
  ];
  try {
    const html = await render();
    assert.match(
      html,
      /data-photo-id="product-technology" data-photo-path="product\/original.png" data-mask="tecnologia:product\/original.png"/,
    );
    assert.match(html, /data-photo-path="category\/audio.png"/);
    assert.doesNotMatch(html, /data-photo-path="category\/old.jpg"|data-photo-path="demo\//);
    assert.equal((html.match(/class="market-category-art" aria-hidden="true"/g) || []).length, 7);
  } finally {
    homeCategories = categories;
    products = [];
  }
});

test('encodes category slugs without losing or inventing destinations', async () => {
  homeCategories = [{ ...categories[0], slug: 'audio & video' }];
  try {
    const html = await render();
    assert.match(html, /href="\/buscar\?category=audio%20%26%20video"/);
    assert.doesNotMatch(html, /Más categorías|Ver productos/);
  } finally {
    homeCategories = categories;
  }
});
