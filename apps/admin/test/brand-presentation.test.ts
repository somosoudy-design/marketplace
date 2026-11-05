import { describe, expect, it } from 'vitest';
import installedBrand from '../../../config/brand.json';
import { brand, publicBrandLink } from '../../../config/brand-presentation';

describe('brand presentation rollout', () => {
  it('adopts the chosen name without changing the installed app identity', () => {
    expect(brand.name).toBe('mayami');
    expect(brand.officialDomain).toBe('mayami.app');
    for (const key of ['scheme', 'androidPackage', 'iosBundleId', 'webDomain', 'supportEmail', 'legalName'] as const) {
      expect(brand[key]).toBe(installedBrand[key]);
    }
  });

  it('keeps catalog links on the installed scheme until hosting is activated', () => {
    expect(brand.publicWebOrigin).toBeNull();
    expect(publicBrandLink('/tienda/mi-tienda')).toBe('kora://tienda/mi-tienda');
    expect(publicBrandLink('/p/cargador')).toBe('kora://p/cargador');
  });

  it('shares the actual web origin instead of a chosen but unconnected domain', () => {
    expect(publicBrandLink('/p/cargador', 'https://evaluacion.example.test')).toBe('https://evaluacion.example.test/p/cargador');
  });
});
