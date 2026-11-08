import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const originals = resolve(root, 'assets/brand/mayami/v3');
const read = (file) => readFileSync(file, 'utf8');
const provenance = JSON.parse(read(resolve(originals, 'provenance.json')));
const artwork = JSON.parse(read(resolve(root, 'config/brand-artwork.json')));
const symbol = JSON.parse(read(resolve(root, 'config/brand-symbol.json')));

test('archived masters retain the bytes received from the owner', () => {
  for (const file of provenance.files) {
    const hash = createHash('sha256').update(readFileSync(resolve(originals, file.file))).digest('hex');
    assert.equal(hash, file.sha256, file.file);
  }
});

test('mobile embeds the original SVGs without redrawing or changing their proportions', () => {
  assert.equal(symbol.white, read(resolve(originals, 'SVG/MAYAMI_Simbolo_Optico_Blanco.svg')));
  for (const [variant, name] of [['violet', 'Violeta'], ['white', 'Blanco']]) {
    const xml = read(resolve(originals, `SVG/MAYAMI_Logotipo_${name}.svg`));
    assert.equal(artwork.wordmark[variant], xml);
    assert.equal(xml.match(/viewBox="([^"]+)"/)[1], artwork.viewBox);
    const [, , width, height] = artwork.viewBox.split(' ').map(Number);
    assert.equal(artwork.width, width);
    assert.equal(artwork.height, height);
  }
});

test('both web apps serve the original light/dark vectors and optical favicon', () => {
  for (const app of ['admin', 'storefront']) {
    for (const color of ['Violeta', 'Blanco']) {
      const name = `MAYAMI_Logotipo_${color}.svg`;
      assert.equal(read(resolve(root, `apps/${app}/public/brand/mayami-v3/${name}`)), read(resolve(originals, `SVG/${name}`)));
    }
    const icon = app === 'storefront' ? 'public/icon.svg' : 'src/app/icon.svg';
    assert.equal(read(resolve(root, `apps/${app}/${icon}`)), read(resolve(originals, 'App/MAYAMI_App_Optico.svg')));
    assert.deepEqual(readFileSync(resolve(root, `apps/${app}/src/app/favicon.ico`)), readFileSync(resolve(originals, 'App/favicon.ico')));
  }
});

test('distributed SVG masters contain passive vector geometry only', () => {
  for (const file of provenance.files.filter((item) => item.file.endsWith('.svg'))) {
    const xml = read(resolve(originals, file.file));
    const tags = [...xml.matchAll(/<\/?([a-zA-Z][\w:-]*)\b/g)].map((match) => match[1]);
    assert.ok(tags.every((tag) => ['svg', 'title', 'g', 'path', 'rect'].includes(tag)), file.file);
    assert.doesNotMatch(xml, /\b(?:\w+:)?href\s*=|\bon\w+\s*=|<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i, file.file);
  }
});
