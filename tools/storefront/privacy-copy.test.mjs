import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import './account-deletion.test.mjs';

test('request acknowledgment makes neither immediate deletion nor continuous access promises', () => {
  const text = readFileSync(new URL('../../apps/mobile/src/app/settings.tsx', import.meta.url), 'utf8');
  assert.match(text, /Enviarla no elimina los datos de inmediato/);
  assert.doesNotMatch(text, /tu cuenta sigue funcionando mientras se tramita/);
});
