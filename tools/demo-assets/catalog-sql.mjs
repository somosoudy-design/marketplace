// Catalog part of the demo data (categories, brands, stores, products, collections) as SQL, shared by the local
// seed (build-seed.mjs) and the remote demo catalog (build-remote-catalog.mjs). Every row is flagged demo.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brands, categories, collections, products, stores } from './catalog.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(here, '../../supabase/seed-assets/manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};

export const q = (v) => (v === null || v === undefined ? 'null' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
export const arr = (a) => (a && a.length ? `array[${a.map(q).join(',')}]::text[]` : `'{}'::text[]`);
export const json = (o) => `${q(JSON.stringify(o ?? {}))}::jsonb`;

/**
 * @param {object} opts
 * @param {(bucket: 'catalog' | 'stores', path: string) => string} [opts.asset] where an image lives (storage path or full URL)
 * @param {Record<string, string> | null} [opts.owners] demo user ids by role; null leaves stores without members
 */
export function catalogSql({ asset = (_bucket, path) => path, owners = null } = {}) {
  let sql = '';
  for (const c of categories) {
    sql += `insert into public.categories (slug, name, icon, tone, sort, risk_level, requires_review, parent_id) values (${q(c.slug)}, ${q(c.name)}, ${q(c.icon)}, ${q(c.tone)}, ${c.sort}, ${q(c.risk ?? 'low')}, ${c.review ? 'true' : 'false'}, ${c.parent ? `(select id from public.categories where slug = ${q(c.parent)})` : 'null'});\n`;
  }
  for (const b of brands) sql += `insert into public.brands (slug, name, official_url) values (${q(b.slug)}, ${q(b.name)}, ${q(b.url)});\n`;

  sql += `\n-- ---------- stores ----------\n`;
  for (const s of stores) {
    sql += `insert into public.stores (slug, name, tagline, description, logo_path, cover_path, accent, kind, status, shipping_info, policies, contact_email, is_demo)
values (${q(s.slug)}, ${q(s.name)}, ${q(s.tagline)}, ${q(s.description)}, ${q(asset('stores', `demo/${s.slug}-logo.webp`))}, ${q(asset('stores', `demo/${s.slug}-cover.webp`))}, ${q(s.accent)}, ${q(s.kind)}, ${q(s.status)}, ${q(s.shipping)},
  ${json({ returns: 'Cambios dentro de 7 días si el producto está sin uso y en su empaque (texto de demostración).', warranty: 'Según fabricante (texto de demostración).' })}, ${q(`${s.slug}@example.com`)}, true);\n`;
    if (s.owner && owners) sql += `insert into public.store_members (store_id, user_id, role) values ((select id from public.stores where slug = ${q(s.slug)}), ${q(owners[s.owner])}, 'owner');\n`;
  }
  if (owners) sql += `insert into public.store_members (store_id, user_id, role) values ((select id from public.stores where slug = 'kora'), ${q(owners.admin)}, 'owner');\n`;
  sql += `insert into public.commission_rules (store_id, category_id, rate_pct, note) values ((select id from public.stores where slug = 'odontopro'), null, 12, 'Demo: comisión acordada');
insert into public.commission_rules (store_id, category_id, rate_pct, note) values (null, (select id from public.categories where slug = 'mascotas'), 8, 'Demo: categoría mascotas');
`;

  sql += `\n-- ---------- products ----------\n`;
  for (const p of products) {
    const imgs = manifest[p.slug] ?? [`demo/${p.slug}-1.webp`];
    sql += `insert into public.products (store_id, category_id, brand_id, slug, title, subtitle, description, highlights, option_names, origin, availability, moderation_status, compare_at_usd, weight_kg, is_demo, popularity, moderation_note)
values ((select id from public.stores where slug = ${q(p.store)}), (select id from public.categories where slug = ${q(p.category)}), ${p.brand ? `(select id from public.brands where slug = ${q(p.brand)})` : 'null'},
  ${q(p.slug)}, ${q(p.title)}, ${q(p.subtitle)}, ${q(p.description)}, ${arr(p.highlights)}, ${arr(p.options ?? [])}, ${q(p.origin)}, ${q(p.availability)}, ${q(p.moderation ?? 'published')}, ${q(p.compareAt ?? null)}, ${p.weight}, true, ${p.popularity ?? 0},
  ${p.moderation === 'pending' ? q('Requiere documentación sanitaria (demo).') : 'null'});\n`;
    p.variants.forEach((v, i) => {
      sql += `insert into public.product_variants (product_id, sku, title, options, price_usd, stock, sort) values ((select id from public.products where slug = ${q(p.slug)}), ${q(`DEMO-${p.slug.toUpperCase().slice(0, 24)}-${i + 1}`)}, ${q(v.title)}, ${json(v.options ?? {})}, ${v.price}, ${v.stock === null ? 'null' : v.stock}, ${i});\n`;
    });
    imgs.forEach((path, i) => {
      sql += `insert into public.product_images (product_id, path, alt, sort, width, height, is_demo_asset) values ((select id from public.products where slug = ${q(p.slug)}), ${q(asset('catalog', path))}, ${q(p.title)}, ${i}, 800, 1000, true);\n`;
    });
  }
  // products whose variants have stock 0 for every unit were seeded as sold_out explicitly; keep availability as defined
  sql += `\n-- ---------- collections ----------\n`;
  for (const c of collections) {
    sql += `insert into public.collections (slug, title, subtitle, tone, layout, sort) values (${q(c.slug)}, ${q(c.title)}, ${q(c.subtitle)}, ${q(c.tone)}, ${q(c.layout)}, ${c.sort});\n`;
    products.filter((p) => (p.collections ?? []).includes(c.slug)).forEach((p, i) => {
      sql += `insert into public.collection_products (collection_id, product_id, sort) values ((select id from public.collections where slug = ${q(c.slug)}), (select id from public.products where slug = ${q(p.slug)}), ${i});\n`;
    });
  }

  return sql;
}
