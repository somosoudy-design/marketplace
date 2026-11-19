import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const source = path => fileURLToPath(new URL('../../' + path, import.meta.url));
export default defineConfig({
  resolve: { alias: {
    '@kora/core': source('packages/core/src/index.ts'),
    // The new test checks navigation ports, not React Native rendering or a device.
    'expo-router': source('tests/mobile/fixtures/expo-router-port-only.ts'),
  } },
  test: { environment: 'node', include: [
    'packages/core/test/payment-presentation.test.ts',
    'tests/storefront/checkout-plan-navigation.test.ts',
    'tests/storefront/payment-auth-return.test.ts',
    'tests/mobile/legal-links.test.ts',
    'tests/mobile/installment-auth-navigation.test.ts',
  ], exclude: ['**/node_modules/**', '**/.local/**'] },
});
