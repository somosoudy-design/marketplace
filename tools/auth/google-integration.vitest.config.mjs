import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
const source = path => fileURLToPath(new URL('../../' + path, import.meta.url));
export default defineConfig({
  resolve: { alias: {
    '@kora/api': source('packages/api/src/index.ts'),
    '@kora/core': source('packages/core/src/index.ts'),
    'expo-router': source('tests/mobile/fixtures/expo-router-port-only.ts'),
  } },
  test: { environment: 'node', include: [
    'packages/api/test/*.test.ts',
    'tests/mobile/legal-links.test.ts',
    'tests/mobile/installment-auth-navigation.test.ts',
  ], exclude: ['**/node_modules/**', '**/.local/**'], fileParallelism: false, testTimeout: 15_000 },
});
