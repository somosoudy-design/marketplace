import { describe, expect, it } from 'vitest';
import { exhibitionCategoryPhoto, exhibitionEnabled, exhibitionPhoto, prioritizeGeneratedExhibition, type ExhibitionContext, type ExhibitionPhoto } from '../../apps/mobile/src/lib/catalog-exhibition-policy';

const preview: ExhibitionContext = {
  optIn: 'private-preview', platform: 'android', channel: 'preview',
  backendUrl: 'https://mimnotafmfasvwrclxan.supabase.co',
};

describe('private catalogue presentation is closed by default', () => {
  it('accepts only the explicit Android preview opt-in on the test backend', () => {
    expect(exhibitionEnabled(preview)).toBe(true);
    for (const bad of [
      { optIn: undefined }, { optIn: 'true' }, { channel: 'production' }, { channel: null },
      { platform: 'ios' }, { backendUrl: 'https://production.supabase.co' },
      { backendUrl: 'https://mimnotafmfasvwrclxan.supabase.co.example.com' },
      { backendUrl: 'https://mimnotafmfasvwrclxan.supabase.co@evil.example' },
      { backendUrl: 'https://mimnotafmfasvwrclxan.supabase.co:444' },
      { backendUrl: 'invalid' },
    ]) expect(exhibitionEnabled({ ...preview, ...bad })).toBe(false);
  });

  it('permits local web evaluation, never a hosted public web export', () => {
    const web = { ...preview, platform: 'web', channel: null, backendUrl: 'http://127.0.0.1:54321' };
    for (const host of ['localhost', '127.0.0.1', '[::1]']) {
      expect(exhibitionEnabled({ ...web, webHostname: host })).toBe(true);
    }
    for (const host of [undefined, 'kora.expo.app', 'localhost.example.com']) {
      expect(exhibitionEnabled({ ...web, webHostname: host })).toBe(false);
    }
    expect(exhibitionEnabled({ ...web, webHostname: 'localhost', backendUrl: 'http://127.0.0.1:9999' })).toBe(false);
  });
});

describe('original generated demos preserve identity, colors and commercial status', () => {
  const common = { productId: 'headphones', originalPath: 'demo/headphones-1.webp', kind: 'generated-demo' as const, width: 1024, height: 1024 };
  const photos: ExhibitionPhoto[] = [
    { ...common, source: 10, sha256: 'sage' },
    { ...common, variantId: 'sage', source: 10, sha256: 'sage' },
    { ...common, variantId: 'sand', source: 11, sha256: 'sand' },
  ];
  it('shows the selected color in detail/cart and keeps unknown future colors on normal storage', () => {
    expect(exhibitionPhoto(true, photos, 'headphones', common.originalPath, undefined, true)?.source).toBe(10);
    expect(exhibitionPhoto(true, photos, 'headphones', common.originalPath, 'sand', true)?.source).toBe(11);
    expect(exhibitionPhoto(true, photos, 'headphones', common.originalPath, 'sage', true)?.source).toBe(10);
    expect(exhibitionPhoto(true, photos, 'headphones', common.originalPath, 'new-blue', true)).toBeUndefined();
    expect(exhibitionPhoto(true, photos, 'headphones', 'seller/replaced.webp', 'sand')).toBeUndefined();
  });
  it('never supplies synthetic demo images when demo status is absent or becomes false', () => {
    expect(exhibitionPhoto(true, photos, 'headphones', common.originalPath)).toBeUndefined();
    expect(exhibitionPhoto(true, photos, 'headphones', common.originalPath, 'sage', false)).toBeUndefined();
    expect(exhibitionPhoto(true, photos, 'headphones', common.originalPath, 'sage', true)?.source).toBe(10);
  });
  it('reuses a category representative only when its exact source identifies one product', () => {
    expect(exhibitionCategoryPhoto(true, photos, common.originalPath, undefined, true)?.source).toBe(10);
    expect(exhibitionCategoryPhoto(false, photos, common.originalPath)).toBeUndefined();
    expect(exhibitionCategoryPhoto(true, photos, 'other/path')).toBeUndefined();
    expect(exhibitionCategoryPhoto(true, [...photos, { ...photos[0]!, productId: 'different-product' }], common.originalPath)).toBeUndefined();
  });
  it('curates only actual generated demos in preview, without dropping other products or changing backend order elsewhere', () => {
    const products = [
      { id: 'ordinary', image_path: 'ordinary.webp', is_demo: false },
      { id: 'headphones', image_path: common.originalPath, is_demo: true },
      { id: 'another', image_path: 'another.webp', is_demo: true },
    ];
    expect(prioritizeGeneratedExhibition(true, photos, products).map((p) => p.id)).toEqual(['headphones', 'ordinary', 'another']);
    expect(prioritizeGeneratedExhibition(false, photos, products)).toEqual(products);
    expect(prioritizeGeneratedExhibition(true, photos, [{ ...products[1]!, is_demo: false }, products[0]!]).map((p) => p.id)).toEqual(['headphones', 'ordinary']);
  });
});

describe('photographs never cross product or gallery identities', () => {
  // Numbers represent Metro asset handles, not manufactured product photographs.
  const photos: ExhibitionPhoto[] = [
    { productId: 'existing-id-a', originalPath: 'demo/charger-1.webp', source: 1, sha256: 'a', width: 900, height: 900 },
    { productId: 'existing-id-b', originalPath: 'demo/lipstick-1.webp', source: 2, sha256: 'b', width: 900, height: 900 },
  ];
  it('returns an approved handle only for its exact product and original photo', () => {
    expect(exhibitionPhoto(true, photos, 'existing-id-a', 'demo/charger-1.webp')).toBe(photos[0]);
  });
  it('keeps normal storage loading for production, unknown products and changed gallery paths', () => {
    for (const [enabled, id, path] of [
      [false, 'existing-id-a', 'demo/charger-1.webp'], [true, 'unknown-id', 'demo/charger-1.webp'],
      [true, 'existing-id-b', 'demo/charger-1.webp'], [true, 'existing-id-a', 'demo/charger-2.webp'],
      [true, 'existing-id-a', null], [true, undefined, 'demo/charger-1.webp'],
    ] as const) expect(exhibitionPhoto(enabled, photos, id, path)).toBeUndefined();
    expect(exhibitionPhoto(true, [], 'existing-id-a', 'demo/charger-1.webp')).toBeUndefined();
  });
});
