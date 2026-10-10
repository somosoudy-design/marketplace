import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import personal from './personal-team.cjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const mobile = join(root, 'apps/mobile');
const target = join(root, '.local/ios-personal');
const marker = join(target, '.personal-team.json');
const previous = existsSync(marker) ? JSON.parse(readFileSync(marker, 'utf8')) : null;
if (existsSync(target) && previous?.generator !== 'hayazgo-ios-personal-v1') {
  throw new Error('La carpeta de destino ya existe y no pertenece a este generador. No se sobrescribe.');
}
const bundleId = personal.validateBundleId(process.env.IOS_PERSONAL_BUNDLE_ID ?? previous?.bundleId ?? personal.DEFAULT_BUNDLE_ID);
if (existsSync(join(target, 'ios')) && bundleId !== previous?.bundleId) {
  throw new Error('Ya existe un proyecto Xcode con otro bundle ID. Conserva el ID para renovar la firma.');
}
if (!existsSync(join(mobile, 'node_modules/expo/package.json'))) {
  throw new Error('Primero ejecuta pnpm install --frozen-lockfile en la raíz del repositorio.');
}
const preview = JSON.parse(readFileSync(join(mobile, 'eas.json'), 'utf8')).build.preview.env;
personal.validateTestBackend(preview);
personal.validateEnvironmentOverrides(process.env, preview);
const modules = join(target, 'node_modules');
if (existsSync(modules) && realpathSync(modules) !== realpathSync(join(mobile, 'node_modules'))) {
  throw new Error('node_modules local no corresponde a apps/mobile; no se reemplaza.');
}
const mobileRequire = createRequire(join(mobile, 'package.json'));
const { getConfig } = mobileRequire('expo/config');
const savedVariant = process.env.APP_VARIANT;
process.env.APP_VARIANT = 'development';
let base;
try {
  // skipPlugins also deletes the plugins array: retain the existing splash and permission options.
  base = getConfig(mobile).exp;
} finally {
  if (savedVariant === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = savedVariant;
}
const config = personal.createPersonalConfig(base, bundleId);
mkdirSync(target, { recursive: true });
for (const folder of ['src', 'assets']) {
  // This is a generated snapshot; remove obsolete routes/assets only inside its managed folders.
  rmSync(join(target, folder), { recursive: true, force: true });
  cpSync(join(mobile, folder), join(target, folder), { recursive: true });
}
cpSync(join(mobile, 'tsconfig.json'), join(target, 'tsconfig.json'));
const pkg = JSON.parse(readFileSync(join(mobile, 'package.json'), 'utf8'));
pkg.name = '@kora/ios-personal-local';
writeFileSync(join(target, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
writeFileSync(join(target, 'app.json'), `${JSON.stringify({ expo: config }, null, 2)}\n`);
for (const file of ['with-personal-team.cjs', 'personal-team.cjs']) cpSync(join(root, 'tools/ios-personal', file), join(target, file));
cpSync(join(root, 'tools/ios-personal/local-push.ts'), join(target, 'src/lib/push.ts'));
cpSync(join(root, 'tools/ios-personal/local-push-bridge.tsx'), join(target, 'src/components/PushBridge.tsx'));
if (!existsSync(modules)) {
  symlinkSync(join(mobile, 'node_modules'), modules, 'dir');
}
// Shell variables are supplied by Expo's dotenv loader, not by EAS. Never copy a private key.
writeFileSync(join(target, '.env.local'), Object.entries(preview)
  .filter(([key]) => ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_PANEL_URL'].includes(key))
  .map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600 });
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
writeFileSync(marker, `${JSON.stringify({ generator: 'hayazgo-ios-personal-v1', bundleId, sourceCommit }, null, 2)}\n`);
console.log(`Preparado: ${target}\nBundle ID: ${bundleId}\nBackend: Supabase de pruebas ${personal.TEST_PROJECT}\nFuente: ${sourceCommit}\nAPNs/Associated Domains/EAS Update desactivados solo en esta copia.\nSiguiente, en tu Mac: cd .local/ios-personal && npx expo prebuild --platform ios`);
