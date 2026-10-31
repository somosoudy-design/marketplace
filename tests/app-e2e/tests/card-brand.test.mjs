import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { splitCardBrand } from '../../../apps/mobile/src/components/catalog/card-brand.ts';

test('shows a known leading brand separately without losing the product name', () => {
  assert.deepEqual(splitCardBrand('UGREEN cable USB-C 100 W', 'Ugreen'), { name: 'cable USB-C 100 W', brand: 'UGREEN' });
  assert.deepEqual(splitCardBrand('Samsung · cargador 45 W', 'Samsung'), { name: 'cargador 45 W', brand: 'Samsung' });
});

test('keeps names unchanged when the confirmed brand is absent, different, or the whole title', () => {
  for (const [title, brand] of [['UGREEN cable', null], ['UGREEN cable', 'Otra'], ['UGREEN', 'UGREEN'], ['UGREENX cable', 'UGREEN']]) {
    assert.deepEqual(splitCardBrand(title, brand), { name: title, brand: null });
  }
});
