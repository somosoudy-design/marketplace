import { describe, expect, it } from 'vitest';
import { exhibitionGallery, exhibitionPhoto, type ExhibitionPhoto } from '../../apps/mobile/src/lib/catalog-exhibition-policy';

const product = '11111111-1111-4111-8111-111111111111';
const mappedPath = 'demo/gallery-1.webp';
const oldPath = 'demo/gallery-2.webp';
const sellerPrefix = `22222222-2222-4222-8222-222222222222/${product}`;
const uploadedPath = `${sellerPrefix}/1793048400000-0.jpg`;
const mapped = { path: mappedPath, alt: 'Mapped photograph', sort: 0 };
const legacy = { path: oldPath, alt: 'Historical illustration', sort: 1 };
const own = { path: uploadedPath, alt: 'New seller photograph', sort: 2 };
const photos: ExhibitionPhoto[] = [
  { productId: product, originalPath: mappedPath, source: 1, sha256: 'general', width: 100, height: 100, author: 'Author A', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', originUrl: 'https://example.com/source-a' },
  { productId: product, originalPath: mappedPath, variantId: 'known', source: 2, sha256: 'known', width: 100, height: 100, author: 'Author B', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', originUrl: 'https://example.com/source-b' },
];

describe('preview gallery retains new uploads without restoring legacy demo illustrations', () => {
  it('keeps mapped plus newly uploaded photos and removes only the unmatched legacy slide', () => {
    expect(exhibitionGallery(true, photos, product, [mapped, legacy, own], true)).toEqual([mapped, own]);
  });

  it('keeps the original backend order and objects when the seller photo is the cover', () => {
    const images = [own, legacy, mapped];
    const snapshot = [...images];
    const result = exhibitionGallery(true, photos, product, images, true);
    expect(result).toEqual([own, mapped]);
    expect(result[0]).toBe(own);
    expect(result[1]).toBe(mapped);
    expect(images).toEqual(snapshot);
  });

  it.each(['jpg', 'png', 'webp'])('retains a fresh store/product/%s Storage path', (ext) => {
    const upload = { path: `${sellerPrefix}/new.${ext}` };
    expect(exhibitionGallery(true, photos, product, [mapped, legacy, upload], true)).toEqual([mapped, upload]);
  });

  it('also preserves valid imported Storage paths without imposing the seller editor filename layout', () => {
    const imported = { path: '22222222-2222-4222-8222-222222222222/imports/33333333-3333-4333-8333-333333333333/own.jpg' };
    expect(exhibitionGallery(true, photos, product, [legacy, imported, mapped], true)).toEqual([imported, mapped]);
  });

  it('leaves all backend images untouched outside preview', () => {
    const images = [mapped, legacy, own];
    expect(exhibitionGallery(false, photos, product, images, true)).toBe(images);
  });

  it('keeps the current full fallback when the product or path has no usable mapping', () => {
    const images = [legacy, own];
    expect(exhibitionGallery(true, photos, product, images, true)).toBe(images);
    const other = [mapped, legacy, own];
    expect(exhibitionGallery(true, photos, 'other-product', other, true)).toBe(other);
    expect(exhibitionGallery(true, [], product, other, true)).toBe(other);
  });

  it('does not activate generated mappings unless is_demo is confirmed', () => {
    const generated = photos.map((photo) => ({ ...photo, kind: 'generated-demo' as const }));
    const images = [mapped, legacy, own];
    expect(exhibitionGallery(true, generated, product, images)).toBe(images);
    expect(exhibitionGallery(true, generated, product, images, false)).toBe(images);
    expect(exhibitionGallery(true, generated, product, images, true)).toEqual([mapped, own]);
  });

  it('never applies a local asset to the newly uploaded path, even for a known variant', () => {
    const images = exhibitionGallery(true, photos, product, [mapped, legacy, own], true);
    expect(exhibitionPhoto(true, photos, product, images[1]!.path, 'known', true)).toBeUndefined();
    expect(exhibitionPhoto(true, photos, product, images[0]!.path, 'known', true)).toBe(photos[1]);
    expect(exhibitionPhoto(true, photos, product, images[0]!.path, 'unknown', true)).toBeUndefined();
  });

  it('resolves attribution from the active photo and variant, without leaking it onto an own upload', () => {
    const images = exhibitionGallery(true, photos, product, [mapped, legacy, own], true);
    expect(exhibitionPhoto(true, photos, product, images[0]!.path, 'known', true)?.author).toBe('Author B');
    expect(exhibitionPhoto(true, photos, product, images[0]!.path, undefined, true)?.author).toBe('Author A');
    expect(exhibitionPhoto(true, photos, product, images[1]!.path, 'known', true)?.author).toBeUndefined();
    expect(exhibitionPhoto(true, photos, product, images[0]!.path, 'unknown', true)?.author).toBeUndefined();
  });

  it('returns the same empty gallery when there is nothing to filter', () => {
    const images: { path: string }[] = [];
    expect(exhibitionGallery(true, photos, product, images, true)).toBe(images);
  });
});
