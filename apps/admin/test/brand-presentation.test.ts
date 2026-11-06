import { describe, expect, it } from 'vitest';
import installedBrand from '../../../config/brand.json';
import { brand, publicBrandLink } from '../../../config/brand-presentation';

describe('brand presentation rollout', () => {
  it('adopts the chosen name without changing the installed app identity', () => {
    expect(brand.name).toBe('mayami');
    expect(brand.officialDomain).toBe('mayami.app');
    for (const key of ['scheme', 'androidPackage', 'iosBundleId'] as const) {
      expect(brand[key]).toBe(installedBrand[key]);
    }
  });

  it('uses the activated commercial domain and support address', () => {
    expect(brand.legalName).toBe('Mayami');
    expect(brand.webDomain).toBe('mayami.app');
    expect(brand.supportEmail).toBe('soporte@mayami.app');
    expect(brand.publicWebOrigin).toBe('https://mayami.app');
    expect(publicBrandLink('/tienda/mi-tienda')).toBe('https://mayami.app/tienda/mi-tienda');
    expect(publicBrandLink('/p/cargador')).toBe('https://mayami.app/p/cargador');
  });

  it('keeps official shared links even when opened from another web origin', () => {
    expect(publicBrandLink('/p/cargador', 'https://evaluacion.example.test')).toBe('https://mayami.app/p/cargador');
  });
});
