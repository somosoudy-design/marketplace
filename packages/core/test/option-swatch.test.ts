import { expect, it } from 'vitest';
import { optionSwatchTone, variantSwatchLabel } from '../src/option-swatch';
import { presentAvailability } from '../src/availability';

it('presents reservable as Preventa while retaining the reservation behaviour', () => {
  expect(presentAvailability('reservable')).toEqual({ label: 'Preventa', action: 'Reservar', intent: 'reserve', tone: 'warning', purchasable: true });
  expect(presentAvailability('unavailable').purchasable).toBe(false);
  expect(presentAvailability('on_order').label).toBe('Por encargo');
});
it('decorates exact existing names without parsing compound variants or changing data', () => {
  const variant = Object.freeze({ title: 'Púrpura', options: Object.freeze({}) });
  expect(variantSwatchLabel(variant)).toBe('Púrpura');
  expect(optionSwatchTone(' PÚRPURA ')).toBe('purple');
  expect(variant.options).toEqual({});
  for (const title of ['Negro ·64GB', 'Kit púrpura', 'UGREEN S3', 'Única', 'RGB61', 'constructor']) expect(variantSwatchLabel({ title })).toBeNull();
});
it('preserves other attributes and never fabricates a shade for an unknown colour', () => {
  expect(variantSwatchLabel({ title: 'M / Negro', options: { Color: 'Negro', Talla: 'M' } })).toBe('Negro');
  expect(variantSwatchLabel({ title: 'Edición especial', options: { Color: 'Arena' } })).toBe('Arena');
  expect(optionSwatchTone('Arena')).toBeNull();
  expect(variantSwatchLabel({ title: 'Negro', options: { Color: 'Negro', color: 'Blanco' } })).toBeNull();
  expect(variantSwatchLabel({ title: 'Única', options: { Color: 123 } as unknown as Record<string, string> })).toBeNull();
});
