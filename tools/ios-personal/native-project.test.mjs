import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyNativeBundleId } from './native-project.cjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const mobile = createRequire(join(root, 'apps/mobile/package.json'));
const expo = createRequire(mobile.resolve('expo/config-plugins'));
const plugin = createRequire(expo.resolve('@expo/config-plugins'));
const xcode = plugin('xcode');
const id = 'com.somosoudy.hayazgo.oliver.local';

// A real pbxproj fixture passed through the same parser as the verifier, never a regenerated app.
function withProject(debugId, releaseId, run, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'hayazgo-pbxproj-test-'));
  const file = join(dir, 'project.pbxproj');
  const debugSetting = debugId === null ? '' : `PRODUCT_BUNDLE_IDENTIFIER = ${debugId};`;
  const releaseSetting = releaseId === null ? '' : `PRODUCT_BUNDLE_IDENTIFIER = ${releaseId};`;
  const debugRef = options.referenceComments === false ? 'DEBUG' : 'DEBUG /* Debug */';
  const releaseRef = options.referenceComments === false ? 'RELEASE' : 'RELEASE /* Release */';
  try {
    const fixture = `// !$*UTF8*$!
{
  archiveVersion = 1; classes = {}; objectVersion = 54;
  objects = {
    /* Begin PBXNativeTarget section */
    APP = { isa = PBXNativeTarget; name = ${options.targetName ?? 'KoraDev'};
      productType = "com.apple.product-type.application"; buildConfigurationList = APP_CONFIGS; };
    OTHER = { isa = PBXNativeTarget; name = OtherApp; productType = "com.apple.product-type.application";
      buildConfigurationList = OTHER_CONFIGS; };
    /* End PBXNativeTarget section */
    /* Begin XCConfigurationList section */
    APP_CONFIGS = { isa = XCConfigurationList; buildConfigurations = (${debugRef}, ${releaseRef},); };
    OTHER_CONFIGS = { isa = XCConfigurationList; buildConfigurations = (OTHER_DEBUG,); };
    /* End XCConfigurationList section */
    /* Begin XCBuildConfiguration section */
    DEBUG = { isa = XCBuildConfiguration; name = Debug; buildSettings = { ${debugSetting} }; };
    RELEASE = { isa = XCBuildConfiguration; name = Release; buildSettings = { ${releaseSetting} }; };
    OTHER_DEBUG = { isa = XCBuildConfiguration; name = Debug; buildSettings = { PRODUCT_BUNDLE_IDENTIFIER = ${options.otherId ?? 'com.example.other'}; }; };
    /* End XCBuildConfiguration section */
  }; rootObject = APP;
}
`;
    const refs = Object.fromEntries(['APP', 'APP_CONFIGS', 'DEBUG', 'RELEASE', 'OTHER', 'OTHER_CONFIGS', 'OTHER_DEBUG']
      .map((name, index) => [name, `A${String(index + 1).padStart(23, '0')}`]));
    writeFileSync(file, fixture.replace(/\b(APP_CONFIGS|OTHER_CONFIGS|OTHER_DEBUG|APP|DEBUG|RELEASE|OTHER)\b/g, (name) => refs[name]));
    const project = xcode.project(file);
    project.parseSync();
    return run(project);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('quoted identifiers pass in all app configurations', () => {
  withProject(`"${id}"`, `"${id}"`, (p) => assert.equal(verifyNativeBundleId(p, 'KoraDev', id), 2));
});

test('Xcode bare identifiers and quoted target names pass', () => {
  withProject(id, id, (p) => assert.equal(verifyNativeBundleId(p, 'KoraDev', id), 2), { targetName: '"KoraDev"', referenceComments: false });
});

test('Debug and Release can use different valid quote styles', () => {
  withProject(id, `"${id}"`, (p) => assert.equal(verifyNativeBundleId(p, 'KoraDev', id), 2));
});

test('a mismatched Release ID is rejected even if Debug and another target match', () => {
  withProject(id, 'com.example.wrong.local', (p) => assert.throws(() => verifyNativeBundleId(p, 'KoraDev', id), /KoraDev\/Release/), { otherId: id });
});

test('an absent bundle ID cannot pass by matching another target', () => {
  withProject(null, id, (p) => assert.throws(() => verifyNativeBundleId(p, 'KoraDev', id), /KoraDev\/Debug/), { otherId: id });
});

test('another app target does not replace a missing principal target', () => {
  withProject(id, id, (p) => assert.throws(() => verifyNativeBundleId(p, 'MissingApp', id), /target principal/));
});
