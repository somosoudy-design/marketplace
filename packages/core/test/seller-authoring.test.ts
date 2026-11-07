import { expect, it } from 'vitest';
import { sellerOptionNamesSchema, sellerRevisionSchema, sellerVariantOptionsSchema } from '../src/seller-authoring';
it('keeps omission distinct from explicit empty options without transforming labels', () => {
  expect(sellerOptionNamesSchema.optional().parse(undefined)).toBeUndefined();
  expect(sellerOptionNamesSchema.parse([])).toEqual([]);
  expect(sellerVariantOptionsSchema.parse({})).toEqual({});
  expect(sellerVariantOptionsSchema.parse({ ' Color ': ' Rojo ' })).toEqual({ ' Color ': ' Rojo ' });
});
it('rejects duplicate aliases with the same key whitespace rules as the server', () => {
  for (const alias of ['color', '\tColor\t', '\u00a0COLOR\ufeff']) {
    expect(sellerVariantOptionsSchema.safeParse({ Color: 'Rojo', [alias]: 'Azul' }).success).toBe(false);
    expect(sellerOptionNamesSchema.safeParse(['Color', alias]).success).toBe(false);
  }
});
it('rejects nonstring, blank and unbounded option writes instead of guessing associations', () => {
  for (const value of [1, null, '', ' \t\u00a0 ', 'x'.repeat(81)]) {
    expect(sellerVariantOptionsSchema.safeParse({ Color: value }).success).toBe(false);
  }
  expect(sellerOptionNamesSchema.safeParse(['\t']).success).toBe(false);
  expect(sellerOptionNamesSchema.safeParse(Array.from({ length: 11 }, (_, i) => `Opción ${i}`)).success).toBe(false);
});
it('requires a scalar server revision, retaining the exact token across retries', () => {
  const token = 'abcdef12'.repeat(8);
  expect(sellerRevisionSchema.parse(token)).toBe(token);
  for (const bad of [null, undefined, {}, [token], '2026-11-07T00:00:00Z', 'ABCDEF12'.repeat(8)]) {
    expect(sellerRevisionSchema.safeParse(bad).success).toBe(false);
  }
});

import { sellerNumericChangesSchema } from '../src/seller-authoring';
it('rejects NaN/Infinity before serialization can silently turn them into unlimited stock', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    expect(sellerNumericChangesSchema.safeParse({ variants: [{ stock: value }] }).success).toBe(false);
    expect(sellerNumericChangesSchema.safeParse({ fields: { compare_at_usd: value } }).success).toBe(false);
    expect(sellerNumericChangesSchema.safeParse({ costs: { freight_usd: value } }).success).toBe(false);
  }
  expect(sellerNumericChangesSchema.safeParse({ variants: [{ stock: null }] }).success).toBe(true);
  expect(sellerNumericChangesSchema.safeParse({ variants: [{ stock: 0 }] }).success).toBe(true);
});

it('requires image removal to be explicit and separate from image edits', () => {
  expect(sellerNumericChangesSchema.safeParse({ images: [{ id: 'photo', remove: true }] }).success).toBe(true);
  expect(sellerNumericChangesSchema.safeParse({ images: [] }).success).toBe(true);
  for (const image of [{ id: 'photo', remove: false }, { id: 'photo', remove: true, sort: 0 }, { id: 'photo', remove: true, path: 'other' }]) {
    expect(sellerNumericChangesSchema.safeParse({ images: [image] }).success).toBe(false);
  }
});
