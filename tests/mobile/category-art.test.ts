import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('illustrative category navigation artwork', () => {
  it('keeps the declared seven lightweight assets and their provenance intact', () => {
    const base = resolve(import.meta.dirname, '../../apps/mobile/assets/category-art');
    const manifest = JSON.parse(readFileSync(resolve(base, 'provenance.json'), 'utf8'));
    expect(manifest.assets.map((asset: { category: string }) => asset.category).sort()).toEqual(['accesorios', 'audio', 'belleza', 'hogar', 'mascotas', 'odontologia', 'tecnologia']);
    for (const asset of manifest.assets) {
      const bytes = readFileSync(resolve(base, `${asset.category}.webp`));
      expect(asset.kind).toBe('generated-illustration');
      expect(asset.usage).toBe('category-navigation-only');
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
      expect(bytes.length).toBe(asset.bytes);
      expect(bytes.length).toBeLessThan(100_000);
    }
  });
});
