import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(new URL('../../apps/storefront/package.json', import.meta.url));
const ts = require('typescript'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const policy = JSON.parse(readFileSync(new URL('../../apps/storefront/src/data/policies.json', import.meta.url)));
const baseline = JSON.parse(execFileSync('git', ['show', '9916d3ef7792584f1ad9ceb52f4080664d370c80:apps/storefront/src/data/policies.json'], { encoding: 'utf8' }));
const source = readFileSync(new URL('../../apps/storefront/src/components/information-page.tsx', import.meta.url), 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText,
  { exports, require: id => id === '@/data/policies.json' ? policy : require(id) });
const html = slug => renderToStaticMarkup(React.createElement(exports.InformationPage, { slug }));

test('preserves unrelated legal text and dates while adding the deletion contact link', () => {
  assert.equal(policy.updatedAt, baseline.updatedAt);
  for (const slug of ['terminos', 'devoluciones']) assert.deepEqual(policy.pages.find(p => p.slug === slug), baseline.pages.find(p => p.slug === slug));
  const contact = structuredClone(policy.pages.find(p => p.slug === 'contacto'));
  assert.equal(contact.updatedAt, '8 de noviembre de 2026');
  delete contact.updatedAt;
  for (const section of contact.sections) if (section.links) section.links = section.links.filter(l => l.href !== '/eliminar-cuenta');
  assert.deepEqual(contact, baseline.pages.find(p => p.slug === 'contacto'));
});
for (const slug of ['privacidad', 'eliminar-cuenta']) test(`${slug} is server-rendered with current scope and no guaranteed automatic expiry`, () => {
  const rendered = html(slug);
  assert.match(rendered, /<h1>/);
  assert.match(rendered, /8 de noviembre de 2026/);
  assert.match(rendered, /soporte@mayami\.app/);
  assert.match(rendered, /90 días no son hoy un máximo de conservación garantizado/);
  assert.match(rendered, /todavía no se realiza de forma automática/);
  assert.match(rendered, /No hemos verificado un plazo/);
  assert.doesNotMatch(rendered, /se conserva durante 90 días desde el cierre|purga automática activada|JWT probado|borrado total acreditado/);
});
test('external request works as email instructions without a Mayami login or installed app', () => {
  const rendered = html('eliminar-cuenta');
  assert.match(rendered, /sin reinstalar la app ni iniciar sesión en Mayami/);
  assert.match(rendered, /href="mailto:soporte@mayami\.app"/);
  assert.match(rendered, /copia soporte@mayami\.app/);
  assert.match(rendered, /no envía la solicitud automáticamente/);
  assert.match(rendered, /comprobar que eres titular/);
  assert.match(rendered, /no damos la solicitud por ejecutada/);
  assert.doesNotMatch(rendered, /<form|type="password"|href="\/cuenta"/);
});
test('privacy and contact point to the public deletion route and it points back to privacy', () => {
  assert.match(html('privacidad'), /href="\/eliminar-cuenta"/);
  assert.match(html('contacto'), /href="\/eliminar-cuenta"/);
  assert.match(html('eliminar-cuenta'), /href="\/privacidad"/);
  const route = readFileSync(new URL('../../apps/storefront/src/app/eliminar-cuenta/page.tsx', import.meta.url), 'utf8');
  assert.match(route, /InformationPage slug="eliminar-cuenta"/);
});
