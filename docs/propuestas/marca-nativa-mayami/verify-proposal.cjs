// Read-only verification of a proposal. No assets, native directories, or tracked files are written.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const root = process.cwd();
const expoRequire = createRequire(path.join(root, 'apps/mobile/package.json'));
const here = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'originales-manifest.json'), 'utf8'));
for (const item of manifest) {
  const bytes = fs.readFileSync(path.join(here, item.localFile));
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  if (hash !== item.sha256 || bytes.length !== item.bytes) throw new Error(`Source changed: ${item.localFile}`);
}
const patch = path.join(here, 'android-native-identity.patch');
let patchState = 'pending';
try {
  execFileSync('git', ['apply', '--check', patch], { cwd: root, stdio: 'pipe' });
} catch {
  // After owner approval the prepared patch is already integrated. Reverse check never reverts it.
  execFileSync('git', ['apply', '--reverse', '--check', patch], { cwd: root, stdio: 'pipe' });
  patchState = 'applied';
}
execFileSync(process.execPath, ['--check', path.join(here, 'prepare-assets.mjs')]);
const source = fs.readFileSync(path.join(here, 'withMayamiAndroidLabel.cjs'), 'utf8');
const pluginModule = { exports: {} };
new Function('require', 'module', 'exports', source)(expoRequire, pluginModule, pluginModule.exports);
const original = {
  name: 'Kora (Preview)', slug: 'marketplace', scheme: 'kora',
  ios: { bundleIdentifier: 'com.example.kora.preview' },
  android: { package: 'com.example.kora.preview' },
};
const configured = pluginModule.exports({ ...original }, { name: 'mayami' });
if (Object.keys(configured.mods).join(',') !== 'android') throw new Error('Non-Android mod created');
(async () => {
  const result = await configured.mods.android.manifest({ ...configured,
    modRequest: { projectRoot: root, platform: 'android', modName: 'manifest', introspect: true },
    modResults: { manifest: { application: [{ $: {
      'android:name': '.MainApplication', 'android:label': '@string/app_name',
    } }] } },
  });
  if (result.modResults.manifest.application[0].$['android:label'] !== 'mayami') throw new Error('Wrong Android label');
  if (JSON.stringify(result.ios) !== JSON.stringify(original.ios)) throw new Error('iOS changed');
  if (result.android.package !== original.android.package || result.scheme !== original.scheme) throw new Error('Identifier changed');
  console.log(JSON.stringify({ sourceHashes: manifest.length, patchCheck: true, patchState, recipeSyntax: true,
    onlyAndroid: true, label: 'mayami', iosUnchanged: true, androidPackageUnchanged: true,
    schemeUnchanged: true, modifiesNativeFiles: false, prebuildExecuted: false }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
