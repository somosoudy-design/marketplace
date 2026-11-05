const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { resolve } = require('node:path');
const plugin = require('../../apps/mobile/plugins/withMayamiAndroidLabel.cjs');
const root = resolve(__dirname, '../..');

test('Android label changes without changing package, scheme, iOS or application attributes', async () => {
  const original = { name: 'Kora (Preview)', slug: 'marketplace', scheme: 'kora',
    ios: { bundleIdentifier: 'com.example.kora.preview' }, android: { package: 'com.example.kora.preview' } };
  const configured = plugin(structuredClone(original), { name: 'mayami' });
  assert.deepEqual(Object.keys(configured.mods), ['android']);
  const attributes = { 'android:name': '.MainApplication', 'android:label': '@string/app_name', 'android:allowBackup': 'true' };
  const result = await configured.mods.android.manifest({ ...configured,
    modRequest: { projectRoot: root, platform: 'android', modName: 'manifest', introspect: true },
    modResults: { manifest: { application: [{ $: { ...attributes } }] } },
  });
  assert.deepEqual(result.modResults.manifest.application[0].$, { ...attributes, 'android:label': 'mayami' });
  for (const field of ['ios', 'android', 'scheme', 'name', 'slug']) assert.deepEqual(result[field], original[field]);
});

test('all five installed Android images match the reviewed Work derivatives', () => {
  const manifest = JSON.parse(readFileSync(resolve(root, 'docs/propuestas/marca-nativa-mayami/prepared-assets/manifest.json'), 'utf8'));
  assert.equal(manifest.length, 5);
  for (const item of manifest) {
    const bytes = readFileSync(resolve(root, 'apps/mobile/assets/images/mayami', item.file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256, item.file);
  }
});
