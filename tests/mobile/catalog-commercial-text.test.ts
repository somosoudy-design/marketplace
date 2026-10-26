import { describe, expect, it } from 'vitest';
import { commercialCatalogText } from '../../apps/mobile/src/lib/catalog-exhibition-policy';

describe('commercial catalogue copy keeps source data and meaningful product information', () => {
  it('removes a recognised internal marker while retaining the product type and characteristics', () => {
    expect(commercialCatalogText(true, 'Correa de demostración con costuras reflectivas.', true)).toBe('Correa con costuras reflectivas.');
    expect(commercialCatalogText(true, 'Baberos desechables para pacientes. Producto de demostración.', true)).toBe('Baberos desechables para pacientes.');
  });
  it('keeps a real store condition instead of removing the whole description', () => {
    expect(commercialCatalogText(true, 'Tienda pendiente de aprobación (demostración).', true)).toBe('Tienda pendiente de aprobación.');
  });
  it('does not rewrite actual products or any other configuration', () => {
    const text = 'Tienda de demostración de suministros odontológicos.';
    expect(commercialCatalogText(false, text, true)).toBe(text);
    expect(commercialCatalogText(true, text, false)).toBe(text);
    expect(commercialCatalogText(true, text)).toBe(text);
  });
  it('does not indiscriminately strip commercial features mentioning demonstration', () => {
    const text = 'Incluye modo de demostración y temporizador.';
    expect(commercialCatalogText(true, text, true)).toBe(text);
  });
  it('supports empty descriptions and removes a standalone internal sentence', () => {
    expect(commercialCatalogText(true, null, true)).toBeNull();
    expect(commercialCatalogText(true, undefined, true)).toBeUndefined();
    expect(commercialCatalogText(true, 'Producto de demostración.', true)).toBe('');
  });
});
